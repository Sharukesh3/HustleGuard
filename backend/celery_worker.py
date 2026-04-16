import os
import json
from celery import Celery
from celery.schedules import crontab
from sqlalchemy.orm import Session
from models import ActiveHazard, User, Payout
from db import SessionLocal
from services.redis_client import RedisClient

# Initialize Redis Client to use as the geospatial broker
redis_client = RedisClient().client

# Celery App Configuration with Redis as Broker
redis_url = f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{int(os.getenv('REDIS_PORT', 6379))}/0"
if os.getenv('REDIS_PASSWORD'):
    redis_url = f"redis://:{os.getenv('REDIS_PASSWORD')}@{os.getenv('REDIS_HOST', 'localhost')}:{int(os.getenv('REDIS_PORT', 6379))}/0"

celery_app = Celery(
    "hazard_monitor",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    # Silence the task logger to only show criticals or standard prints
    worker_hijack_root_logger=False
)

# Beat scheduler to run the heavy processing task every 10 seconds locally
celery_app.conf.beat_schedule = {
    "poll-active-hazards": {
        "task": "celery_worker.process_parametric_triggers_at_scale",
        "schedule": 10.0,
    },
}

@celery_app.task
def process_parametric_triggers_at_scale():
    """
    CELERY TASK: Scans Active Geofences (PostgreSQL) vs active Rider Cords (Redis GEO).
    Dispatches automated payouts and triggers PubSub for WebSocket pushes.
    """
    if not redis_client:
        return "Skip: Redis Client Unreachable"

    db = SessionLocal()
    try:
        # 1. Fetch active Hazards from PostgreSQL
        active_hazards = db.query(ActiveHazard).filter(ActiveHazard.is_active == 1).all()
        if not active_hazards:
            return "No active hazards"

        payout_count = 0

        for hazard in active_hazards:
            # 2. Redis GEOSEARCH: Which riders are currently inside the hazard radius?
            # Returns a list of rider_id strings
            try:
                impacted_riders = redis_client.geosearch(
                    "rider_locations",
                    longitude=hazard.longitude,
                    latitude=hazard.latitude,
                    radius=hazard.radius_km,
                    unit="km"
                )
            except Exception as e:
                print(f"[CELERY] Redis GEOSEARCH error: {e}")
                continue

            for rider_id in impacted_riders:
                # 3. Validation: Has this user already been paid for this exact hazard?
                # Ensure idempotency 
                existing_payout = db.query(Payout).filter(
                    Payout.user_id == int(rider_id),
                    Payout.hazard_type == hazard.hazard_type,
                    Payout.reason.like(f"%Event ID: {hazard.id}%")
                ).first()

                if existing_payout:
                    # Already processed this worker for this specific event
                    continue

                user = db.query(User).filter(User.id == int(rider_id)).first()
                if user:
                    # 4. Trigger Automatic DB Payout 
                    new_payout = Payout(
                        user_id=user.id,
                        amount=hazard.payout_amount,
                        hazard_type=hazard.hazard_type,
                        reason=f"Geofence Trigger: {hazard.description} (Event ID: {hazard.id})"
                    )
                    user.balance += hazard.payout_amount
                    db.add(new_payout)
                    payout_count += 1
                    
                    print(f"🔥 [CELERY WORKER] Paid ₹{hazard.payout_amount} to rider {rider_id} for entering {hazard.hazard_type} zone!")

                    # 5. Trigger real-time WebSocket push via Redis Pub/Sub
                    ws_payload = {
                        "type": "auto_payout",
                        "hazard": hazard.hazard_type,
                        "reason": f"Active Hazard Zone: {hazard.description}"
                    }
                    redis_client.publish(f"ws_notify:{rider_id}", json.dumps(ws_payload))

        db.commit()
        return f"Processed {payout_count} geofenced payouts."

    except Exception as e:
        db.rollback()
        print(f"[CELERY] Error processing parametric triggers: {e}")
        return "Error"
    finally:
        db.close()
