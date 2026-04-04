from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import random
from dotenv import load_dotenv
from risk_model import calculate_premium_multiplier

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory OTP storage for demo
otps = {}

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

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
async def verify_otp(req: OTPVerify):
    if req.phone not in otps:
        raise HTTPException(status_code=400, detail="OTP not sent or expired")
    if otps[req.phone] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Clear OTP after successful verification
    del otps[req.phone]
    return {"message": "OTP verified successfully", "token": "mock-jwt-token"}

@app.get("/premium/calculate")
async def calculate_premium(lat: float, lng: float):
    # Mock fetching external data
    traffic_score = random.uniform(0, 1)  # TomTom
    weather_score = random.uniform(0, 1)  # OpenWeather/AQI
    apartment_complexity = random.uniform(0, 1) # Mock
    road_closures = random.uniform(0, 1) # Mock
    social_strikes = random.uniform(0, 1) # Scraped data mock
    
    multiplier = calculate_premium_multiplier(
        traffic_score, weather_score, apartment_complexity, road_closures, social_strikes
    )
    
    base_premium = 25
    final_premium = round(base_premium * multiplier, 2)
    return {
        "base_premium": base_premium,
        "multiplier": round(multiplier, 2),
        "final_premium": final_premium,
        "factors": {
            "traffic": traffic_score,
            "weather": weather_score,
            "apartments": apartment_complexity,
            "closures": road_closures,
            "social": social_strikes
        }
    }