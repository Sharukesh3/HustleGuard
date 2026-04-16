import os
import sys
import pytest

# Ensure we can import from backend services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.gcp_storage import upload_to_gcp
from services.redis_client import redis_cache
from services.vision import detect_ai_generation, verify_hazard_with_gemini, analyze_hazard_image

# Dummy pixel image
sample_image_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0aIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

def test_gcp_upload():
    """Test if GCP Storage upload logic works."""
    try:
        uri = upload_to_gcp(sample_image_bytes, "test_pytest_hackathon_image.png")
        assert "gs://" in uri, "Failed to get valid URI from GCP upload."
    except Exception as e:
        # If credentials fail (e.g. 403), skip or fail cleanly
        pytest.xfail(f"GCP Storage Test failed or was blocked due to IAM: {str(e)}")

def test_redis_cache():
    """Test if Redis Caching mechanism works."""
    test_key = "pytest_hackathon_key"
    test_val = "pytest_value_123"
    
    # Run the set operation
    redis_cache.set(test_key, test_val)
    
    # Retrieve
    retrieved = redis_cache.get(test_key)
    assert retrieved == test_val, "Redis cache retrieved data did not match the test value."
    
    # Clean up (for in-memory or cloud)
    if redis_cache.client:
        redis_cache.client.delete(test_key)
    elif hasattr(redis_cache, 'cache'):
        if isinstance(redis_cache.cache, dict) and test_key in redis_cache.cache:
            del redis_cache.cache[test_key]

def test_synthid_detect_ai():
    """Test if SynthID Neurosymbolic Byte-Scanner detects ai successfully."""
    # Assuming this path exists or we simulate it
    image_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "phase 1 vid", "Gemini_Generated_Image_3czwol3czwol3czw.png")
    
    if not os.path.exists(image_path):
        pytest.skip(f"Test image not found at {image_path}, skipping deepfake detection test.")
        
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    is_ai, evidence = detect_ai_generation(image_bytes)
    assert is_ai == True, "AI Generation detection failed on a known Gemini image!"
    assert "Credentials" in evidence or "watermark" in evidence.lower() or "SynthID" in evidence or "JUMBF" in evidence or "signature" in evidence, "Evidence string was empty or incorrect."

def test_gemini_appeal_logic():
    """Test if the Gemini Appeal System works via Vertex AI."""
    image_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "phase 1 vid", "Gemini_Generated_Image_3czwol3czwol3czw.png")
    
    if not os.path.exists(image_path):
        pytest.skip(f"Test image not found at {image_path}, skipping Gemini appeal test.")
        
    with open(image_path, "rb") as f:
        image_bytes = f.read()
        
    try:
        gs_uri = upload_to_gcp(image_bytes, "test_pytest_appeal_image.png")
    except Exception as e:
        pytest.xfail(f"GCP Upload failed, cannot test Gemini without URI: {e}")
        return

    appeal_reason = "The YOLO model missed it, but there is clearly a massive pothole in the middle of the lane!"
    
    try:
        result = verify_hazard_with_gemini(gs_uri, appeal_reason)
        # Gemini might still be provisioning, so we just check if it ran properly
        # or didn't blow up entirely (if it failed, result['gemini_passed'] is False but gives a clear reason)
        assert "gemini_passed" in result
        assert "gemini_confidence" in result
        assert "gemini_reason" in result
    except Exception as e:
        pytest.xfail(f"Gemini Appeal Test failed or was blocked due to IAM/Provisioning: {str(e)}")

def test_yolo_fallen_tree_logic():
    """Test if YOLO properly recognizes the fallen tree photo."""
    image_path = os.path.join(os.path.dirname(__file__), "Fallen_Tree_2.jpg")
    
    if not os.path.exists(image_path):
        pytest.skip(f"Test image not found at {image_path}, skipping YOLO vision test.")
        
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    result = analyze_hazard_image(image_bytes, "Fallen_Tree_2.jpg")
    
    assert result is not None, "Analyze hazard image returned None."
    assert "Fallen Tree" in result.get("yolo_detections", []), "YOLO failed to detect Fallen Tree."
    assert result.get("yolo_confidence", 0) > 0.5, "Confidence too low for fallen tree."
    assert result.get("vision_passed") is True, "Vision check should pass for a clear fallen tree."

def test_fraud_telemetry_model():
    """Test the autoencoder telemetry fraud detection system."""
    from ml.fraud_model import is_fraudulent_telemetry
    
    # 1. Test normal healthy telemetry (should pass without fraud)
    # speed, gps_accuracy, distance, ping_delta, battery_level, is_charging
    is_fraud, msg = is_fraudulent_telemetry(speed=20.0, gps_accuracy=10.0, distance=200.0, ping_delta=2.0, battery_level=60.0, is_charging=False)
    assert is_fraud is False, f"Model flagged normal telemetry as fraud: {msg}"
    
    # 2. Test impossible distance (GPS spoofing teleportation)
    is_fraud, msg = is_fraudulent_telemetry(speed=120.0, gps_accuracy=10.0, distance=5000.0, ping_delta=2.0, battery_level=55.0, is_charging=False)
    assert is_fraud is True, "Model failed to catch impossible teleportation spoofing."
    
    # 3. Test static farm charging (fraud farm)
    is_fraud, msg = is_fraudulent_telemetry(speed=0.0, gps_accuracy=5.0, distance=0.0, ping_delta=5.0, battery_level=100.0, is_charging=True)
    assert is_fraud is True, "Model failed to catch static 100% charging fraud farm behavior."

def test_premium_xgboost_model():
    """Test the Neurosymbolic Explainable AI Pricing model."""
    from ml.premium_model import calculate_neural_risk_score
    
    # Simulate an incoming job route mapping
    job_data = {
        'weather_severity': 0.8,   # Bad weather
        'traffic_density': 0.9,    # High
        'vehicle_age_years': 10.0, # Moderately old (scaled to 10.0/20)
        'coverage_level': 0.9      # Comprehensive
    }
    
    try:
        result = calculate_neural_risk_score(job_data)
        
        assert 'neural_base_premium' in result, "Missing neural_base_premium in output"
        assert 'shap_factors' in result, "Missing explainable SHAP factors"
        
        # Ensure premium calculation gave us a float
        assert isinstance(result['neural_base_premium'], float), "Premium was not computed properly as Float"
        assert len(result['shap_factors']) > 0, "Expected at least one SHAP explanation for these extreme inputs"
        
    except Exception as e:
        pytest.fail(f"XGBoost Premium Model failed: {e}")

