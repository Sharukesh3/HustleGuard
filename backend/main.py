from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import random
import asyncio
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import timedelta

# Import models, db, and auth (must be created below)
from db import engine, Base, get_db, SessionLocal
import models
import auth

from risk_model import calculate_premium_multiplier
from ml.fraud_model import is_fraudulent_telemetry
from services.external_apis import fetch_weather_data, fetch_traffic_data, analyze_unstructured_risks, analyze_historical_seasonal_risks, generate_overall_pricing_reason
from services.vision import analyze_hazard_image
from services.gcp_storage import upload_to_gcp
from services.redis_client import redis_cache
from h3_utils import get_h3_index
from fastapi import File, UploadFile, Form

from contextlib import asynccontextmanager

load_dotenv()

# Lifecycle block to properly initialize Database Models when the app starts, not on import
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        # Fix Supabase Security Warning: Supabase flags any table in 'public' without RLS
        # Since we use FastAPI for all auth, we just enable the flag so the PostgREST public API locks down
        with engine.connect() as conn:
            for table_name in Base.metadata.tables.keys():
                conn.execute(text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;"))
            conn.commit()
    except Exception as e:
        print(f"Database initialization bypassed (table likely exists or multi-worker concurrency issue): {e}")
    yield

app = FastAPI(title="GigProtect Insurance API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory OTP storage for demo
otps = {}
# Track active websockets for telemetry
active_connections: Dict[str, WebSocket] = {}
last_known_locations: Dict[str, str] = {} # rider_id -> h3_hex
recent_disconnects: List[Dict] = [] # stores {"rider_id": id, "hex": h3_hex, "time": timestamp}

async def parametric_monitor_task():
    """
    Background central monitor. Periodically simulates checking external APIs
    against the known locations of active workers. If a trigger condition is met,
    pushes an automated payout payload via WebSocket to active riders.
    """
    payout_count = 0  # Limit to 2 demo payloads
    max_payouts = 2

    while True:
        try:
            # Simulate central polling every 10 seconds
            await asyncio.sleep(10)
            
            # Stop sending demo payouts if limit reached
            if payout_count >= max_payouts:
                continue

            # Simulated parametric trigger logic for demonstration.
            # In a real app, this would poll a central weather/news API.
            if random.random() > 0.8 and active_connections:
                # Randomly pick a connected worker to simulate an auto-trigger
                rider_id, websocket = random.choice(list(active_connections.items()))
                
                hazards = [
                    {"code": "Flood", "desc": "Severe waterlogging detected directly on your active route."},
                    {"code": "Protest", "desc": "Civil unrest reported near your coordinates. Route deemed unsafe."},
                    {"code": "Platform", "desc": "Platform outage detected. Automatic compensation initiated."}
                ]
                incident = random.choice(hazards)
                
                # Create a persistent record of the payout in PostgreSQL using a new session
                try:
                    db = SessionLocal()
                    user = db.query(models.User).filter(models.User.id == int(rider_id)).first()
                    if user:
                        # Make a simulated automatic payout chunk
                        payout_amt = 50.0  # Example fix payout
                        new_payout = models.Payout(
                            user_id=user.id,
                            amount=payout_amt,
                            hazard_type=incident["code"],
                            reason=incident["desc"]
                        )
                        user.balance += payout_amt
                        db.add(new_payout)
                        db.commit()
                except Exception as db_err:
                    print(f"DB Error while saving auto_payout: {db_err}")
                finally:
                    if 'db' in locals():
                        db.close()

                # Use standard print for the demo terminal visibility
                payout_count += 1
                print(f"\n[CENTRAL MONITOR] 🔥 Parametric condition met: {incident['code']} for Rider: {rider_id}. (Trigger {payout_count}/{max_payouts})")
                
                await websocket.send_json({
                    "type": "auto_payout",
                    "hazard": incident["code"],
                    "reason": incident["desc"]
                })
        except Exception as e:
            print(f"[CENTRAL MONITOR] Error: {e}")
            await asyncio.sleep(5)

@app.on_event("startup")
async def startup_event():
    # Start the background task when the ASGI app starts
    asyncio.create_task(parametric_monitor_task())

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

class WalletTransaction(BaseModel):
    amount: float
    hazard_type: str
    reason: str

@app.post("/auth/send-otp")
async def send_otp(req: OTPRequest):
    otp = str(random.randint(1000, 9999))
    otps[req.phone] = otp
    
    # Try Twilio if configured, else console log
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if twilio_sid and twilio_token:
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            message = client.messages.create(
                body=f"Your HustleGuard OTP is: {otp}",
                from_=os.getenv("TWILIO_PHONE_NUMBER", "+1234567890"),
                to=req.phone
            )
            print(f"Twilio message sent: {message.sid}")
        except Exception as e:
            print(f"Twilio failed, fallback to console: {e}")
            print(f"--- OTP FOR {req.phone}: {otp} ---")
            return {"message": "Fallback", "fallback_otp": otp}
    else:
        print(f"--- OTP FOR {req.phone}: {otp} ---")
        return {"message": "Fallback", "fallback_otp": otp}
        
    return {"message": "OTP sent successfully"}

@app.post("/auth/verify-otp")
async def verify_otp(req: OTPVerify, db: Session = Depends(get_db)):
    if req.phone not in otps:
        raise HTTPException(status_code=400, detail="OTP not sent or expired")
    if otps[req.phone] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Store or fetch user from Persistence DB (Postgres)
    user = db.query(models.User).filter(models.User.phone == req.phone).first()
    if not user:
        user = models.User(phone=req.phone, name="Rider")
        db.add(user)
        db.commit()
        db.refresh(user)

    # Issue secure JWT token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.phone}, expires_delta=access_token_expires
    )
    
    # Clear OTP after successful verification
    del otps[req.phone]
    return {
        "message": "OTP verified successfully", 
        "token": access_token,
        "user": {"id": user.id, "phone": user.phone, "name": str(user.name), "balance": user.balance}
    }

@app.post("/fraud/verify-claim")
async def verify_claim(
    speed: float = Form(0.0), 
    gps_accuracy: float = Form(10.0), 
    distance_covered: float = Form(120.0), 
    ping_delta: float = Form(5.0),
    battery_level: float = Form(50.0),
    is_charging: bool = Form(False),
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    NEUROSYMBOLIC PIPELINE: Runs telemetry through the PyTorch Autoencoder 
    and Image upload through YOLO (Neural) + EXIF timestamp mapping (Symbolic)
    """
    # 1. Evaluate device telemetry for GPS spoofing anomalies
    is_spoofed, telemetry_reason = is_fraudulent_telemetry(
        speed, gps_accuracy, distance_covered, ping_delta, battery_level, is_charging
    )
    
    if is_spoofed:
        return {"status": "rejected", "reason": telemetry_reason}
        
    # 2. Extract uploaded image
    file_bytes = await file.read()
    
    # 3. Real GCP Storage Upload
    bucket_uri = upload_to_gcp(file_bytes, file.filename)
    
    # 4. Neural Vision Service (YOLO + EXIF validation)
    vision_report = analyze_hazard_image(file_bytes, file.filename)
    
    if not vision_report["vision_passed"]:
        return {"status": "rejected", "reason": vision_report["vision_reason"], "gcp_uri": bucket_uri}
        
    # Valid Claim: The Telemetry is organic and the User Photo has proper metadata + YOLO boxes.
    return {
        "status": "approved",
        "reason": "Claim automatically approved via Neurosymbolic validation.",
        "gcp_uri": bucket_uri,
        "yolo_analysis": {
            "classes": vision_report["yolo_detections"], 
            "confidence": vision_report["yolo_confidence"]
        }
    }

@app.get("/premium/calculate")
async def calculate_premium(lat: float, lng: float, 
                            dest_lat: Optional[float] = None, dest_lon: Optional[float] = None,
                            city: Optional[str] = "Bangalore",
                            current_user: models.User = Depends(auth.get_current_user)):
    # 1. Hyper-local spatial indexing via H3 (Resolution 9)
    # This identifies the roughly ~0.1 sq km block the rider is currently standing in.
    h3_hex = get_h3_index(lat, lng)
    
    # Cache key format: "premium:city:h3_hex"
    # To reduce LLM costs, we cache the hyper-local baseline values for 1 hour.
    cache_key = f"premium:{city}:{h3_hex}"
    
    # 0. Check Redis cache for recent calculation
    cached_data = redis_cache.get(cache_key)
    if cached_data:
        print(f"📦 [REDIS CACHE HIT] Returned premium data for hex {h3_hex}")
        # Insert telemetry hook to update worker's location silently
        return cached_data

    # A. Live Telemetry
    weather_data_task = fetch_weather_data(lat, lng)
    traffic_data_task = fetch_traffic_data(lat, lng, dest_lat or lat, dest_lon or lng)
    
    # B. Live and Historical Context via LLM (Heavy computation)
    unstructured_risks_task = analyze_unstructured_risks(city)
    historical_risks_task = analyze_historical_seasonal_risks(city)
    
    weather_data, traffic_data, social_risk, historical_risk = await asyncio.gather(
        weather_data_task, traffic_data_task, unstructured_risks_task, historical_risks_task
    )
    
    # Run the Neurosymbolic engine
    final_multiplier = calculate_premium_multiplier(
        weather_data, traffic_data, social_risk.get("score"), historical_risk.get("score")
    )
    
    base_premium = 25.0  # Base cost INR
    final_premium = round(base_premium * final_multiplier, 0)
    
    factors = {
        "hex_location": h3_hex,
        "weather": weather_data,
        "traffic": traffic_data,
        "social": social_risk,
        "historical": historical_risk
    }
    
    insight = await generate_overall_pricing_reason(city, base_premium, final_premium, factors)
    
    response_payload = {
        "worker_hex": h3_hex,
        "base_premium": base_premium,
        "final_premium": final_premium,
        "multiplier": round(final_multiplier, 2),
        "insight_summary": insight,
        "raw_factors": factors
    }
    
    # Cache the result in Redis for an hour for any other workers entering this hex
    redis_cache.set(cache_key, response_payload, expire_seconds=3600)
    
    return response_payload

@app.websocket("/ws/telemetry/{rider_id}")
async def websocket_telemetry(websocket: WebSocket, rider_id: str, token: str = None, db: Session = Depends(get_db)):
    await websocket.accept()
    # Authenticate WebSocket manually using the query token
    if not token:
        await websocket.close(code=1008)  # Policy violation
        return
    try:
        from jose import jwt, JWTError
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        phone = payload.get("sub")
        if phone is None:
            await websocket.close(code=1008)
            return
        user = db.query(models.User).filter(models.User.phone == phone).first()
        if not user or user.phone != rider_id:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    active_connections[rider_id] = websocket
    print(f"Rider {rider_id} authenticated and connected. Active websockets: {len(active_connections)}")
    try:
        import json
        import time
        while True:
            # Receive continuous background GPS telemetry here
            data = await websocket.receive_text()
            payload = json.loads(data)
            if "lat" in payload and "lng" in payload:
                # Track last location for dead zone computation
                h3_hex = get_h3_index(payload["lat"], payload["lng"])
                last_known_locations[rider_id] = h3_hex
                
            # Echo back or process the coordinates to verify liveness
    except WebSocketDisconnect:
        import time
        from collections import Counter
        
        print(f"Rider {rider_id} disconnected unexpectedly. Tracking potential ISP dead zone cluster.")
        if rider_id in active_connections:
            del active_connections[rider_id]
            
        disconnected_hex = last_known_locations.get(rider_id, "unknown_hex")
        
        # Log disconnect for cluster analysis
        recent_disconnects.append({
            "rider_id": rider_id,
            "hex": disconnected_hex,
            "time": time.time()
        })
        
        # Prune old disconnects (> 5 minutes ago)
        current_time = time.time()
        recent_disconnects[:] = [d for d in recent_disconnects if current_time - d["time"] < 300]
        
        # If >= 3 drops in the exact same 10-meter block happen within 5 minutes, we trigger a payout
        # (Using 3 here instead of 50 for demoability)
        area_drops = [d["hex"] for d in recent_disconnects if d["hex"] == disconnected_hex]
        if len(area_drops) >= 3 and disconnected_hex != "unknown_hex":
            print(f"\n[NETWORK DEAD ZONE DETECTED] {len(area_drops)} riders disconnected in hex {disconnected_hex}.")
            print("Triggering micro-payouts for all riders impacted by the ISP failure in this area...")
            
            affected_riders = [d["rider_id"] for d in recent_disconnects if d["hex"] == disconnected_hex]
            
            try:
                db_session = SessionLocal()
                payout_amt = 15.0 # Network latency/Cellular drop micro-payout
                
                for r_id in set(affected_riders):
                    r_user = db_session.query(models.User).filter(models.User.id == int(r_id)).first()
                    if r_user:
                        new_payout = models.Payout(
                            user_id=r_user.id,
                            amount=payout_amt,
                            hazard_type="ISP_FAILURE",
                            reason=f"Cellular/WebSocket Drop Cluster in zone {disconnected_hex}"
                        )
                        r_user.balance += payout_amt
                        db_session.add(new_payout)
                        print(f"-> Paid ₹{payout_amt} to Rider {r_id} for ISP Outage delay.")
                        
                db_session.commit()
            except Exception as e:
                print(f"Failed to process Dead Zone payout: {e}")
            finally:
                if 'db_session' in locals():
                    db_session.close()
                    
            # Clear this incident so it doesn't infinitely loop
            recent_disconnects[:] = [d for d in recent_disconnects if d["hex"] != disconnected_hex]

@app.get("/wallet")
async def get_wallet(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """
    Fetch persistent payout history and current balance from Postgres
    """
    payouts = db.query(models.Payout).filter(models.Payout.user_id == current_user.id).order_by(models.Payout.timestamp.desc()).all()
    
    return {
        "balance": current_user.balance,
        "history": [
            {
                "id": p.id,
                "amount": p.amount,
                "hazard_type": p.hazard_type,
                "reason": p.reason,
                "timestamp": p.timestamp.isoformat()
            } for p in payouts
        ]
    }

@app.post("/wallet/payout")
async def process_instant_payout(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """
    Simulates a Stripe/Razorpay UPI Instant Payout.
    Withdraws entire wallet balance to the worker's bank account instantly.
    """
    if current_user.balance <= 0:
        raise HTTPException(status_code=400, detail="Insufficient balance for withdrawal")
        
    payout_amount = current_user.balance
    
    # 1. Simulate active network delay calling Razorpay/Stripe APIs
    import asyncio
    await asyncio.sleep(1.5)
    
    # 2. Record the transaction mathematically
    current_user.balance = 0.0
    withdrawal_record = models.Payout(
        user_id=current_user.id,
        amount=-payout_amount, # Negative for withdrawal
        hazard_type="Withdrawal",
        reason=f"Instant UPI Payout via Razorpay/Stripe (Ref: {random.randint(1000000, 9999999)})"
    )
    
    db.add(withdrawal_record)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully withdrew ₹{payout_amount} to bank account.",
        "payout_ref": f"UPI_{random.randint(1000000, 9999999)}",
        "remaining_balance": 0.0
    }

@app.post("/wallet/transaction")
async def create_wallet_transaction(req: WalletTransaction, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """
    Records an automatic parametric payout or a premium deduction.
    Accepts positive or negative amounts.
    """
    new_tx = models.Payout(
        user_id=current_user.id,
        amount=req.amount,
        hazard_type=req.hazard_type,
        reason=req.reason
    )
    current_user.balance += req.amount
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    return {"message": "Transaction recorded", "balance": current_user.balance, "tx_id": new_tx.id}

@app.get("/admin/metrics")
async def get_admin_metrics(db: Session = Depends(get_db)):
    """
    Renders Loss Ratios, Predictive Risk, and Claim tallies for the Admin React Native UI.
    """
    from sqlalchemy.sql import func
    
    # 1. Active Users Count
    active_users = db.query(models.User).count()
    
    # 2. Simulate default base weekly premiums paid by every active system user
    mined_premiums = active_users * 25.0
    
    # 3. Aggregate all positive payouts (where amount > 0)
    total_payouts_result = db.query(func.sum(models.Payout.amount)).filter(models.Payout.amount > 0).scalar()
    total_payouts = float(total_payouts_result or 0.0)
    
    loss_ratio = round(total_payouts / mined_premiums, 2) if mined_premiums > 0 else 0.0
    
    # 4. LLM AI Future Predictions based off historical/live news feeds
    hist_score = await analyze_historical_seasonal_risks("Bangalore")
    social_score = await analyze_unstructured_risks("Bangalore")
    
    h_val = float(hist_score.get("score", 0.0))
    if h_val > 0.7:
        forecast_str = "Severe Weather Alert (Monsoon). High expected parametric payouts."
    elif h_val > 0.4:
        forecast_str = "Moderate traffic/weather risks elevated."
    else:
        forecast_str = "Clear conditions expected. Minimal payout events."
        
    return {
        "loss_ratio": loss_ratio,
        "total_premiums": mined_premiums,
        "total_payouts": total_payouts,
        "active_policies": active_users,
        "forecast_7_days": forecast_str,
        "llm_warnings": social_score.get("reason", "No immediate warnings from Groq LLM NLP Analysis")
    }