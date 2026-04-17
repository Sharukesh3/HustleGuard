import os
import json
from kafka import KafkaConsumer
from sqlalchemy.orm import Session
from models import User, Payout
from db import SessionLocal
from services.redis_client import RedisClient

# Initialize Redis Client to use as the Pub/Sub broker
redis_client = RedisClient().client

# Initialize Kafka Consumer connected to Azure Event Hubs
consumer = KafkaConsumer(
    'insurance.payout.triggered',
    bootstrap_servers=[os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'hustleguard-kafka.servicebus.windows.net:9093')],
    security_protocol='SASL_SSL',
    sasl_mechanism='PLAIN',
    sasl_plain_username='$ConnectionString',
    sasl_plain_password=os.getenv('KAFKA_CONNECTION_STRING', 'temp-connection-string'),
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    group_id='payment-processor-group',
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

print("💰 Kafka Consumer (Payment Engine) started. Listening for verified payout triggers...")

def process_kafka_payout(message):
    data = message.value
    rider_id = data.get("rider_id")
    hazard_id = data.get("hazard_id")
    hazard_type = data.get("hazard_type")
    payout_amount = data.get("payout_amount")
    description = data.get("description")

    db = SessionLocal()
    try:
        # Validation: Has this user already been paid for this exact hazard?
        # Ensure Idempotency (so we don't double charge Kafka replays)
        existing_payout = db.query(Payout).filter(
            Payout.user_id == int(rider_id),
            Payout.hazard_type == hazard_type,
            Payout.reason.like(f"%Event ID: {hazard_id}%")
        ).first()

        if existing_payout:
            # Already processed this payload for this specific event
            return

        user = db.query(User).filter(User.id == int(rider_id)).first()
        if user:
            # Trigger Automatic DB Payout
            new_payout = Payout(
                user_id=user.id,
                amount=payout_amount,
                hazard_type=hazard_type,
                reason=f"Kafka Geofence Trigger: {description} (Event ID: {hazard_id})"
            )
            user.balance += payout_amount
            db.add(new_payout)
            db.commit()
            
            print(f"🔥 [KAFKA CONSUMER] Success! Paid ₹{payout_amount} to rider {rider_id} for entering {hazard_type} zone!")

            # Trigger real-time WebSocket push via Redis Pub/Sub
            ws_payload = {
                "type": "auto_payout",
                "hazard": hazard_type,
                "reason": f"Active Hazard Zone: {description}"
            }
            redis_client.publish(f"ws_notify:{rider_id}", json.dumps(ws_payload))

    except Exception as e:
        db.rollback()
        print(f"[KAFKA CONSUMER] Error processing parametric triggers: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    try:
        for message in consumer:
            process_kafka_payout(message)
    except KeyboardInterrupt:
        print("\nStopping Kafka Consumer.")
