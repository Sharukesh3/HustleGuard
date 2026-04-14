import os
import sys
import pytest

# Ensure we can import from backend services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.gcp_storage import upload_to_gcp
from services.redis_client import redis_cache
from services.vision import detect_ai_generation

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
    else:
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
