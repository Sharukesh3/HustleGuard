import os
import time
import json
from kafka import KafkaProducer
from sqlalchemy.orm import Session
from models import ActiveHazard
from db import SessionLocal
from services.redis_client import RedisClient

# Initialize Redis Client to perform GEOSEARCH
redis_cache = RedisClient().client

# Initialize Kafka Producer connected to Azure Event Hubs
producer = KafkaProducer(
    bootstrap_servers=[os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'hustleguard-kafka.servicebus.windows.net:9093')],
    security_protocol='SASL_SSL',
    sasl_mechanism='PLAIN',
    sasl_plain_username='$ConnectionString',
    sasl_plain_password=os.getenv('KAFKA_CONNECTION_STRING', 'temp-connection-string'),
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

print("🚀 Kafka Producer (Hazard Radar) started. Scanning for active geofences every 10 seconds...")

def scan_hazards_and_publish():
    db = SessionLocal()
    try:
        active_hazards = db.query(ActiveHazard).filter(ActiveHazard.is_active == 1).all()
        for hazard in active_hazards:
            try:
                # Redis GEORADIUS: Find riders inside the hazard radius (Compatible with Azure Cache for Redis)
                impacted_riders = redis_cache.georadius(
                    "rider_locations",
                    longitude=float(hazard.longitude),
                    latitude=float(hazard.latitude),
                    radius=float(hazard.radius_km),
                    unit="km"
                )
            except Exception as e:
                print(f"[RADAR] Redis GEORADIUS error: {e}")
                continue
            
            for rider_id in impacted_riders:
                # We found a rider in the hazard zone! Publish an event to Kafka.
                # Kafka acts as the guaranteed delivery buffer.
                event_payload = {
                    "rider_id": rider_id.decode("utf-8") if isinstance(rider_id, bytes) else rider_id,
                    "hazard_id": hazard.id,
                    "hazard_type": hazard.hazard_type,
                    "payout_amount": hazard.payout_amount,
                    "description": hazard.description
                }
                
                producer.send("insurance.payout.triggered", value=event_payload)
                print(f"📡 [KAFKA PUBLISHER] Dispatched payout event for Rider {event_payload['rider_id']} entering {hazard.hazard_type} zone to Kafka!")

        producer.flush()
    except Exception as e:
        print(f"[RADAR] Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    while True:
        scan_hazards_and_publish()
        time.sleep(10)
