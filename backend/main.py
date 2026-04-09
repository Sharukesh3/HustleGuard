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
from services.external_apis import fetch_weather_data, fetch_traffic_data, analyze_unstructured_risks, analyze_historical_seasonal_risks, generate_overall_pricing_reason

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

@app.get("/premium/calculate")
async def calculate_premium(lat: float, lng: float, 
                            dest_lat: Optional[float] = None, dest_lon: Optional[float] = None,
                            city: Optional[str] = "Bangalore",
                            current_user: models.User = Depends(auth.get_current_user)):
    """
    Calculate dynamic weekly premium based on LIVE current factors AND Historical Seasonal factors.
    """
    # 1. Fetch real-time weather
    weather_data = await fetch_weather_data(lat, lng)
    
    # 2. Fetch traffic delay factor (if destination is provided)
    if dest_lat and dest_lon:
        traffic_data = await fetch_traffic_data(lat, lng, dest_lat, dest_lon)
    else:
        # Give a default/neutral response if no route
        traffic_data = {"delay_factor": 1.0}
        
    # 3. Analyze recent unstructured risks (live news, active strikes, recent grid alerts)
    social_data = await analyze_unstructured_risks(city)
    
    # 4. Analyze baseline historical & seasonal risks for the current month
    #    (e.g., Delhi smog season, Mumbai monsoons, infrastructure history)
    historical_data = await analyze_historical_seasonal_risks(city)
    
    # Send factors to risk_model to output the final weekly multiplier
    multiplier = calculate_premium_multiplier(
        weather_data=weather_data,
        traffic_data=traffic_data,
        social_score=social_data.get("score", 0.0),
        historical_score=historical_data.get("score", 0.0)
    )
    
    base_premium = 25
    final_premium = round(base_premium * multiplier, 2)
    
    factors = {
        "weather_live": weather_data,
        "traffic_live": traffic_data,
        "social_live": social_data,
        "historical_baseline": historical_data
    }
    
    overall_reason = await generate_overall_pricing_reason(city, base_premium, final_premium, factors)
    
    return {
        "base_premium": base_premium,
        "multiplier": round(multiplier, 2),
        "final_premium": final_premium,
        "overall_reason": overall_reason,
        "factors": factors
    }

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
        while True:
            # Receive continuous background GPS telemetry here
            data = await websocket.receive_text()
            # Echo back or process the coordinates to verify liveness
            # In a real system, you'd cluster disconnects by coordinate.
            # print(f"Telemetry from {rider_id}: {data}")
    except WebSocketDisconnect:
        print(f"Rider {rider_id} disconnected unexpectedly. Tracking potential ISP dead zone cluster.")
        if rider_id in active_connections:
            del active_connections[rider_id]

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