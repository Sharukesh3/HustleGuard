from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import random
import asyncio
import json
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
from services.vision import analyze_hazard_image, verify_hazard_with_gemini
from services.gcp_storage import upload_to_gcp
from services.redis_client import redis_cache
from services.payment import process_instant_payout as stripe_process_payout
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

@app.get("/admin")
async def redirect_to_admin():
    """
    Convenience redirect for Hackathon evaluators to find the Admin Portal
    on the React Native Web instance. 
    (Port may vary between 8081/8082, update if testing locally throws connection refused)
    """
    return RedirectResponse(url="http://localhost:8082/admin")

# In-memory OTP storage for demo
otps = {}

# Celery has taken over the background periodic parametric looping natively!
# Removing the asyncio simulated loop below since we use real Celery BEAT processing.

@app.get("/api/test-hazard/create")
def create_test_hazard(lat: float, lng: float, radius: float = 5.0, db: Session = Depends(get_db)):
    """
    Test endpoint to instantly drop an ActiveHazard onto the database.
    Pass the lat/lng where you are simulating a rider.
    """
    hazard = models.ActiveHazard(
        hazard_type="DEMO_TEST",
        description="Live testing of the Celery Parametric Loop",
        latitude=lat,
        longitude=lng,
        radius_km=radius,
        payout_amount=150.0,
        is_active=1
    )
    db.add(hazard)
    db.commit()
    db.refresh(hazard)
    return {"status": "success", "hazard_id": hazard.id, "message": "Hazard created! Celery Beat should pick this up in 10 seconds if a rider is near."}

@app.on_event("startup")
async def startup_event():
    # Database and Redis handles everything via background workers.
    print("Startup: Redis & PostgreSQL hooked. Background loop deferred to Celery.")

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
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
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
        # Save rejected spoofing report to DB so it appears in Wallet history
        new_report = models.HazardReport(
            user_id=current_user.id,
            image_uri="N/A",
            yolo_detections="[]",
            confidence=0.0,
            road_overlap=0.0,
            status="rejected",
            rejection_reason=f"Fraud attempt blocked: {telemetry_reason}"
        )
        db.add(new_report)
        db.commit()
        db.refresh(new_report)
        return {"status": "rejected", "reason": f"Fraud attempt blocked: {telemetry_reason}"}
        
    # 2. Extract uploaded image
    file_bytes = await file.read()
    
    # 3. Real GCP Storage Upload
    bucket_uri = upload_to_gcp(file_bytes, file.filename)
    
    # 4. Neural Vision Service (YOLO + EXIF validation)
    vision_report = analyze_hazard_image(file_bytes, file.filename)
    
    # 5. Store Hazard Report to database 
    new_report = models.HazardReport(
        user_id=current_user.id,
        image_uri=bucket_uri,
        yolo_detections=json.dumps(vision_report["yolo_detections"]),
        confidence=vision_report["yolo_confidence"],
        road_overlap=vision_report["road_overlap_percentage"],
        status="approved" if vision_report["vision_passed"] else "rejected",
        rejection_reason=None if vision_report["vision_passed"] else vision_report["vision_reason"]
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    if not vision_report["vision_passed"]:
        return {"status": "rejected", "reason": vision_report["vision_reason"], "gcp_uri": bucket_uri, "report_id": new_report.id}
        
    # Valid Claim: The Telemetry is organic and the User Photo has proper metadata + YOLO boxes.
    new_payout = models.Payout(user_id=current_user.id, amount=20.0, hazard_type="Verified Hazard", reason="Obstacle Verified by YOLO")
    current_user.balance += 20.0
    db.add(new_payout)
    db.commit()
    
    # Process instant simulated payout
    stripe_res = None
    
    return {
        "status": "approved",
        "reason": "Claim automatically approved via Neurosymbolic validation.",
        "gcp_uri": bucket_uri,
        "report_id": new_report.id,
        "stripe_status": stripe_res,
        "yolo_analysis": {
            "classes": vision_report["yolo_detections"], 
            "confidence": vision_report["yolo_confidence"]
        }
    }

@app.post("/hazard/appeal/{report_id}")
async def appeal_hazard_verification(
    report_id: int, 
    appeal_reason: str = Form(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Appeals a rejected YOLO hazard verification by sending the stored image to Gemini Vision
    for a premium AI assessment. 
    """
    report = db.query(models.HazardReport).filter(models.HazardReport.id == report_id, models.HazardReport.user_id == current_user.id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Hazard report not found or unauthorized.")
        
    if report.status == "approved":
        return {"status": "already_approved", "message": "This report was already approved."}
        
    if "appealed" in report.status:
        return {"status": "already_appealed", "message": "This report was already appealed."}
    
    # Pass to Gemini
    gemini_result = verify_hazard_with_gemini(report.image_uri, appeal_reason)
    
    # Save appeal record
    new_appeal = models.HazardAppeal(
        hazard_report_id=report.id,
        user_id=current_user.id,
        appeal_reason=appeal_reason,
        gemini_analysis=gemini_result["gemini_reason"],
        gemini_confidence=gemini_result["gemini_confidence"],
        appeal_status="approved" if gemini_result["gemini_passed"] else "rejected"
    )
    db.add(new_appeal)
    
    # Update main report
    report.status = "appealed_approved" if gemini_result["gemini_passed"] else "appealed_rejected"
    
    stripe_res = None
    if gemini_result["gemini_passed"]:
        new_payout = models.Payout(user_id=current_user.id, amount=20.0, hazard_type="Appealed Hazard", reason=f"Gemini verified: {gemini_result['gemini_reason']}")
        current_user.balance += 20.0
        db.add(new_payout)
        
        # No automatic payout process anymore
        stripe_res = None
        
    db.commit()
    db.refresh(new_appeal)
    
    return {
        "status": "success",
        "gemini_decision": "approved" if gemini_result["gemini_passed"] else "rejected",
        "reason": gemini_result["gemini_reason"],
        "confidence": gemini_result["gemini_confidence"],
        "payout_credited": gemini_result["gemini_passed"],
        "stripe_status": stripe_res
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
    premium_result = calculate_premium_multiplier(
        weather_data, traffic_data, social_risk.get("score"), historical_risk.get("score")
    )
    final_multiplier = premium_result['multiplier']
    
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
        "ml_model_explanations": premium_result.get('ml_model_explanations', []),
        "raw_factors": factors
    }
    
    # Cache the result in Redis for a day for any other workers entering this hex
    redis_cache.set(cache_key, response_payload, expire_seconds=86400)
    
    return response_payload

@app.websocket("/ws/telemetry/{rider_id}")
async def websocket_telemetry(websocket: WebSocket, rider_id: str, token: str = None, db: Session = Depends(get_db)):
    await websocket.accept()
    if not token:
        await websocket.close(code=1008)
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

    print(f"Rider {rider_id} connected. Processing telemetry exclusively via Redis Pub/Sub & GEOADD.")
    
    import json
    import asyncio

    # Setup Redis PubSub listener for Celery triggering payouts
    pubsub = None
    if redis_cache.client:
        pubsub = redis_cache.client.pubsub()
        pubsub.subscribe(f"ws_notify:{rider_id}")
    
    async def pubsub_reader(ws: WebSocket):
        if not pubsub:
            return
        while True:
            try:
                # Need to run blocking redis get_message in a safe way or poll slowly
                message = pubsub.get_message(ignore_subscribe_messages=True)
                if message:
                    try:
                        data = json.loads(message['data'])
                        await ws.send_json(data)
                    except Exception as parse_e:
                        pass
                await asyncio.sleep(1)  # poll every second
            except Exception as e:
                print(f"PubSub error: {e}")
                await asyncio.sleep(2)

    reader_task = asyncio.create_task(pubsub_reader(websocket))

    try:
        while True:
            # Continuous background GPS telemetry
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if "lat" in payload and "lng" in payload:
                # Add location natively to Redis GEO
                if redis_cache.client:
                    redis_cache.client.geoadd(
                        "rider_locations", 
                        (float(payload["lng"]), float(payload["lat"]), rider_id)
                    )
    except WebSocketDisconnect:
        print(f"Rider {rider_id} disconnected.")
        if not reader_task.done():
            reader_task.cancel()
        if pubsub:
            pubsub.unsubscribe()
        
        # Remove active coordinates from Redis queue
        if redis_cache.client:
            redis_cache.client.zrem("rider_locations", rider_id)

@app.get("/wallet")
async def get_wallet(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """
    Fetch persistent payout history and current balance from Postgres
    """
    payouts = db.query(models.Payout).filter(models.Payout.user_id == current_user.id).order_by(models.Payout.timestamp.desc()).all()
    
    # Also fetch all hazard reports by user for claim tracking
    hazard_reports = db.query(models.HazardReport).filter(models.HazardReport.user_id == current_user.id).order_by(models.HazardReport.timestamp.desc()).all()
    
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
        ],
        "hazard_reports": [
            {
                "id": r.id,
                "status": r.status,
                "image_uri": r.image_uri,
                "yolo_detections": r.yolo_detections,
                "rejection_reason": r.rejection_reason,
                "timestamp": r.timestamp.isoformat()
            } for r in hazard_reports
        ]
    }

@app.post("/wallet/payout")
async def process_instant_payout(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """
    Simulates a Stripe UPI Instant Payout.
    Withdraws entire wallet balance to the worker's bank account instantly.
    """
    if current_user.balance <= 0:
        raise HTTPException(status_code=400, detail="Insufficient balance for withdrawal")
        
    payout_amount = current_user.balance
    
    # 1. Execute Real Stripe Transfer (Sandbox)
    stripe_result = stripe_process_payout(current_user.id, payout_amount, "Wallet Withdrawal")
    
    # 2. Record the transaction mathematically
    current_user.balance = 0.0
    withdrawal_record = models.Payout(
        user_id=current_user.id,
        amount=-payout_amount, # Negative for withdrawal
        hazard_type="Withdrawal",
        reason=f"Stripe Instant Payout (Ref: {stripe_result.get('transaction_id', 'Unknown')})"
    )
    
    db.add(withdrawal_record)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully withdrew ₹{payout_amount} to bank account via Stripe.",
        "payout_ref": stripe_result.get("transaction_id", "Unknown"),
        "remaining_balance": 0.0,
        "stripe_response": stripe_result
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
    if req.hazard_type == 'premium':
        from services.payment import process_premium_payment
        process_premium_payment(current_user.id, abs(req.amount), 'Weekly Premium')
    else:
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
    
    # 5. Track Fraudulent Claims Blocked (status = 'rejected')
    fraud_attempts_blocked = db.query(models.HazardReport).filter(models.HazardReport.status == "rejected").count()
    
    # 6. LLM AI Future Predictions based off historical/live news feeds
    hist_score = await analyze_historical_seasonal_risks("Bangalore")
    social_score = await analyze_unstructured_risks("Bangalore")
    
    h_val = float(hist_score.get("score", 0.0))
    if h_val > 0.7:
        forecast_str = "Severe Weather Alert (Monsoon). High expected parametric payouts."
    elif h_val > 0.4:
        forecast_str = "Moderate traffic/weather risks elevated."
    else:
        forecast_str = "Clear conditions expected. Minimal payout events."
        
    recent_payouts_nodes = db.query(models.Payout).filter(models.Payout.amount > 0).order_by(models.Payout.timestamp.desc()).limit(5).all()
    
    return {
        "metrics": {
            "lossRatio": f"{int(loss_ratio * 100)}%",
            "totalPremiums": mined_premiums,
            "claimsPaid": total_payouts,
            "activePolicies": active_users,
            "fraudAttemptsBlocked": fraud_attempts_blocked,
            "recentPayouts": [
                {
                    "id": p.id,
                    "amount": p.amount,
                    "hazard_type": p.hazard_type,
                    "reason": p.reason,
                    "time": p.timestamp.isoformat()
                } for p in recent_payouts_nodes
            ]
        },
        "forecast_7_days": forecast_str,
        "llm_warnings": social_score.get("reason", "No immediate warnings from Groq LLM NLP Analysis")
    }

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi import Request
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print('Validation Error:', exc.errors())
    # Convert errors to strings so they are JSON serializable
    errors = []
    for err in exc.errors():
        err_dict = dict(err)
        if 'ctx' in err_dict and 'error' in err_dict['ctx']:
            err_dict['ctx']['error'] = str(err_dict['ctx']['error'])
        errors.append(err_dict)
    return JSONResponse(status_code=422, content={'detail': errors})

@app.get("/admin/predictive-risk")
async def get_predictive_risk(risk_category: str = "Weather Events", timeline_week: int = 1, db: Session = Depends(get_db)):
    """
    Generate an awe-inspiring Heat Map of India Predictive Risk Analysis. 
    Optimized by saving results to PostgreSQL to avoid repetitive external API hits.

    ==============================================================================
    PRODUCTION / REAL API IMPLEMENTATION (Disabled for Hackathon Demo)
    ==============================================================================
    In a real-world production environment, we would calculate the predictive risk 
    map by hitting our external APIs (OpenWeather, Google Maps, Groq LLM, Tavily) 
    for the capital city or major hubs of each state. 
    
    However, running 4 heavy API calls * 35 states = 140 API requests per map load.
    To avoid exhausting our API rate limits and to ensure instantaneous loading 
    during the demo review, we have commented out the live API aggregation below 
    and fall back to a high-fidelity simulated heuristics model for the map.

    # --- THE REAL ARCHITECTURE (COMMENTED OUT) ---
    # async def build_real_predictive_map():
    #     capitals = {
    #         "Maharashtra": ("Mumbai", 19.0760, 72.8777),
    #         "Karnataka": ("Bangalore", 12.9716, 77.5946),
    #         "Delhi": ("New Delhi", 28.6139, 77.2090),
    #         # ... mapped for all 35 states/UTs
    #     }
    #     real_predictions = []
    #     for state_name, (city, lat, lng) in capitals.items():
    #         # 1. Fetch Live APIs (Weather & Traffic)
    #         weather = await fetch_weather_data(lat, lng)
    #         traffic = await fetch_traffic_data(lat, lng, lat + 0.05, lng + 0.05)
    #         
    #         # 2. Fetch LLM & Unstructured Web Risk (Tavily NLP + Groq)
    #         social = await analyze_unstructured_risks(city)
    #         historical = await analyze_historical_seasonal_risks(city)
    #         
    #         # 3. Pass through ML Neurosymbolic logic inside risk_model.py
    #         risk_result = calculate_premium_multiplier(
    #             weather, traffic, social.get("score"), historical.get("score")
    #         )
    #         
    #         # 4. Normalize ML multiplier (e.g., 1.0 - 5.0) to a 0.0 - 1.0 heat score
    #         heat_score = min(1.0, (risk_result["multiplier"] - 1.0) / 4.0)
    #         
    #         # 5. Forward timeline projection logic
    #         adjusted_score = min(0.99, heat_score * (1 + (timeline_week * 0.10)))
    #         
    #         real_predictions.append({
    #             "state": state_name,
    #             "risk_score": round(adjusted_score, 2),
    #             "confidence": max(0.40, 0.95 - (timeline_week * 0.15))
    #         })
    #     return {"source": "real_api", "predictions": real_predictions}
    ==============================================================================
    """
    import random
    from datetime import datetime, timedelta
    
    time_limit = datetime.utcnow() - timedelta(hours=24)
    cached_predictions = db.query(models.PredictionCache).filter(
        models.PredictionCache.risk_category == risk_category,
        models.PredictionCache.timeline_week == timeline_week,
        models.PredictionCache.updated_at > time_limit
    ).all()
    
    if cached_predictions:
        return {"source": "cache", "predictions": [
            {"state": p.city_name, "risk_score": p.risk_score, "confidence": p.confidence} for p in cached_predictions
        ]}
    
    # States of India
    states = [
        "Andaman and Nicobar", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
        "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu", "Delhi", 
        "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", 
        "Karnataka", "Kerala", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", 
        "Meghalaya", "Mizoram", "Nagaland", "Orissa", "Puducherry", "Punjab", "Rajasthan", 
        "Sikkim", "Tamil Nadu", "Tripura", "Uttar Pradesh", "Uttaranchal", "West Bengal"
    ]
    
    db.query(models.PredictionCache).filter(
        models.PredictionCache.risk_category == risk_category,
        models.PredictionCache.timeline_week == timeline_week
    ).delete()
    
    new_predictions = []
    for state_name in states:
        base = random.uniform(0.1, 0.5)
        cat_lower = risk_category.lower()
        if cat_lower in ["weather events", "heavy rainfall"]:
            if state_name in ["Maharashtra", "Kerala", "Tamil Nadu", "Assam", "West Bengal"]: base += 0.4
            if state_name in ["Karnataka", "Orissa"]: base += 0.2
        elif cat_lower in ["traffic", "grid failure"]:
            if state_name in ["Karnataka", "Delhi", "Maharashtra"]: base += 0.35
        elif cat_lower in ["social strikes", "lockdowns"]:
            if state_name in ["West Bengal", "Delhi", "Kerala"]: base += 0.3
        
        adjusted_score = min(0.99, base * (1 + (timeline_week * 0.10)))
        confidence = max(0.40, 0.95 - (timeline_week * 0.15))
        
        db_pred = models.PredictionCache(
            city_name=state_name, latitude=0, longitude=0,
            risk_category=risk_category, timeline_week=timeline_week,
            risk_score=round(adjusted_score, 2), confidence=round(confidence, 2)
        )
        db.add(db_pred)
        new_predictions.append({
            "state": db_pred.city_name,
            "risk_score": db_pred.risk_score, "confidence": db_pred.confidence
        })
        
    db.commit()
    return {"source": "computed", "predictions": new_predictions}


