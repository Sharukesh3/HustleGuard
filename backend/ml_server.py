from fastapi import FastAPI, File, UploadFile, Form
import uvicorn

# Import ML and Vision logic from your existing modules
from ml.fraud_model import is_fraudulent_telemetry
from ml.premium_model import calculate_neural_risk_score
from services.vision import analyze_hazard_image

app = FastAPI(title="HustleGuard Dedicated ML Microservice", version="1.0.0")

@app.get("/")
def health_check():
    return {"status": "ML Microservice is running!"}

@app.post("/api/vision/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Receives an image upload, passes it to YOLOv11 and the Geometric Road Mask.
    """
    image_bytes = await file.read()
    result = analyze_hazard_image(image_bytes, file.filename)
    return result

@app.post("/api/fraud/telemetry")
async def check_telemetry(
    speed: float = Form(...), 
    gps_accuracy: float = Form(...), 
    distance: float = Form(...), 
    ping_delta: float = Form(...), 
    battery_level: float = Form(...), 
    is_charging: bool = Form(...)
):
    """
    Receives standard telemetry metrics and runs them through the PyTorch Autoencoder.
    """
    is_fraud, reason = is_fraudulent_telemetry(
        speed, gps_accuracy, distance, ping_delta, battery_level, is_charging
    )
    return {"is_fraud": is_fraud, "reason": reason}

@app.post("/api/premium/calculate")
async def calculate_premium(job_data: dict):
    """
    Receives standard dictionary of weather/traffic metrics and runs XGBoost + SHAP.
    Expected JSON body example:
    {
        "weather_alerts": 0.8,
        "traffic_score": 7.5,
        "vehicle_age_years": 4,
        "coverage_tier": "standard"
    }
    """
    result = calculate_neural_risk_score(job_data)
    return result

if __name__ == "__main__":
    # We run this on port 8001 so it doesn't conflict with your main backend on 8000
    uvicorn.run("ml_server:app", host="0.0.0.0", port=8001, reload=True)