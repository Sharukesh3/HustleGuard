from PIL import Image
import piexif
import os
from io import BytesIO
from datetime import datetime
import numpy as np
from shapely.geometry import Polygon, box

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

try:
    cred_path = os.path.join(os.path.dirname(__file__), "..", "gcp-credentials.json")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path
    import vertexai
    from vertexai.preview.vision_models import WatermarkVerificationModel, Image as VertexImage
    from vertexai.generative_models import GenerativeModel, Part
    VERTEX_AI_AVAILABLE = True
except Exception as e:
    VERTEX_AI_AVAILABLE = False

CUSTOM_YOLO_WEIGHTS = os.path.join(os.path.dirname(__file__), "best.pt")

HAZARD_CLASSES = [ "Drain Hole", "Fallen Tree", "Fire Source", "Garbage Pillups", "Open-Manhole", "pothole", "Sewer"]

def check_gemini_synthid(image_bytes: bytes) -> bool:
    if not VERTEX_AI_AVAILABLE: return False
    try:
        from google.oauth2 import service_account
        credentials = service_account.Credentials.from_service_account_file(cred_path)
        vertexai.init(project="hustleguard", location="us-central1", credentials=credentials)
        model = WatermarkVerificationModel.from_pretrained("imageverification@001")
        img = VertexImage(image_bytes)
        response = model.verify_image(img)
        result = str(response.watermark_verification_result).upper()
        return "WATERMARKED" in result and "NOT" not in result
    except Exception as e:
        return False

def detect_ai_generation(image_bytes: bytes):
    if check_gemini_synthid(image_bytes):
        return True, "Google SynthID pixel watermark detected (Gemini)"

    lower_bytes = image_bytes.lower()
    signatures = {
        b"c2pa": "C2PA Content Credentials found",
        b"jumbf": "JUMBF metadata box found",
        b"dall-e": "DALL-E signature found",
        b"midjourney": "Midjourney signature found",
        b"synthid": "SynthID metadata tag found",
        b"adobe firefly": "Adobe Firefly signature found"
    }
    
    for sig, description in signatures.items():
        if sig in lower_bytes:
            return True, description
            
    return False, ""

def calculate_road_intersection(img_width: int, img_height: int, hazard_box: list) -> float:
    # -----------------------------------------------------------------------------------
    # GEOMETRIC ROADMASK (Replacing the need for LLMs)
    # This polygon represents the drivable path (bottom half/trapezoid) of a dashcam view
    # -----------------------------------------------------------------------------------
    road_polygon = Polygon([
        (img_width * 0.3, img_height * 0.5),   # Top Left of road curve
        (img_width * 0.7, img_height * 0.5),   # Top Right of road curve
        (img_width * 1.0, img_height * 1.0),   # Bottom Right dashcam edge
        (0.0,             img_height * 1.0)    # Bottom Left dashcam edge
    ])
    
    # Extract the Bounding Box from YOLO [x1, y1, x2, y2]
    x1, y1, x2, y2 = hazard_box
    hazard_polygon = box(x1, y1, x2, y2)
    
    # Calculate geometric intersection over area
    intersection_area = road_polygon.intersection(hazard_polygon).area
    hazard_area = hazard_polygon.area
    
    if hazard_area == 0:
        return 0.0
        
    overlap_percentage = (intersection_area / hazard_area) * 100.0
    return overlap_percentage

def analyze_hazard_image(image_bytes: bytes, filename: str) -> dict:
    is_ai, ai_reason = detect_ai_generation(image_bytes)
    if is_ai:
        return {
            "yolo_detections": [],
            "yolo_confidence": 0.0,
            "road_overlap_percentage": 0.0,
            "vision_passed": False,
            "vision_reason": f"Fraud attempt blocked: {ai_reason}."
        }

    img = Image.open(BytesIO(image_bytes)).convert('RGB')
    img_width, img_height = img.size
    
    detections = []
    max_confidence = 0.0
    passed = False
    reason = "No hazard geometrically confirmed on the drivable road path."
    overlap_pct = 0.0
    
    # -----------------------------------------------------------------------------------
    # DYNAMIC YOLO HANDLER (Ready for the Roboflow weights)
    # -----------------------------------------------------------------------------------
    if YOLO_AVAILABLE and os.path.exists(CUSTOM_YOLO_WEIGHTS):
        print("Running Custom Roboflow YOLO Model...")
        model = YOLO(CUSTOM_YOLO_WEIGHTS)
        results = model(img)
        
        for r in results:
            for yolo_box in r.boxes:
                cls_name = model.names[int(yolo_box.cls[0])]
                conf = float(yolo_box.conf[0])
                
                # Check if it's one of your target Roboflow Classes
                if cls_name.lower() in [h.lower() for h in HAZARD_CLASSES]:
                    bbox = yolo_box.xyxy[0].tolist() # [x1, y1, x2, y2]
                    overlap = calculate_road_intersection(img_width, img_height, bbox)
                    
                    detections.append(cls_name)
                    if conf > max_confidence:
                        max_confidence = conf
                        overlap_pct = overlap
                        
                    # Semantic Segment Rule: Must overlap the drivable road area > 20%
                    if overlap > 20.0 and conf > 0.50:
                        passed = True
                        reason = f"{cls_name.capitalize()} verified blocking {overlap:.1f}% of the road geometry."
                        
    else:
        # Mock calculation to prevent crash while weights download
        print("Custom YOLO weights not found. Simulating geometric verification path.")
        detections = ["Fallen Tree"]
        max_confidence = 0.88
        mock_bbox = [img_width * 0.2, img_height * 0.6, img_width * 0.8, img_height * 0.8]
        overlap_pct = calculate_road_intersection(img_width, img_height, mock_bbox)
        
        if overlap_pct > 20.0:
            passed = True
            reason = f"Simulated: Fallen Tree mathematically verified blocking {overlap_pct:.1f}% of the road geometry."
    
    return {
        "yolo_detections": detections,
        "yolo_confidence": round(max_confidence, 2),
        "road_overlap_percentage": round(overlap_pct, 2),
        "vision_passed": passed,
        "vision_reason": reason
    }

def verify_hazard_with_gemini(gs_uri: str, appeal_reason: str) -> dict:
    if not VERTEX_AI_AVAILABLE:
        return {
            "gemini_passed": False,
            "gemini_reason": "Vertex AI SDK not available.",
            "gemini_confidence": 0.0
        }
        
    try:
        from google.oauth2 import service_account
        import json
        
        credentials = service_account.Credentials.from_service_account_file(cred_path)
        vertexai.init(project=credentials.project_id, location="us-central1", credentials=credentials)
        
        # We use gemini-2.5-flash as per the March 2026 GCP release notes
        model = GenerativeModel("gemini-2.5-flash")
        
        image_part = Part.from_uri(
            uri=gs_uri,
            mime_type="image/jpeg"
        )
        
        prompt = f"""
        You are a highly precise traffic safety AI. A driver reported a hazard on the road, but our lightweight model rejected it. 
        The driver appealed the rejection with the following reason: "{appeal_reason}"
        
        Look at the image closely. Is there a genuine physical road hazard (like a pothole, fallen tree, collapsed wall, large debris) 
        that is actively blocking or making the drivable road surface unsafe? 
        Respond ONLY with a JSON object exactly like this, nothing else:
        {{"passed": true/false, "confidence": 0.0-100.0, "reason": "short explanation of what you see"}}
        """
        
        response = model.generate_content([image_part, prompt])
        
        # Parse the JSON response
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        result = json.loads(text)
        
        return {
            "gemini_passed": result.get("passed", False),
            "gemini_reason": result.get("reason", "Failed to parse Gemini explanation."),
            "gemini_confidence": result.get("confidence", 0.0)
        }
        
    except Exception as e:
        print(f"Gemini Appeal Error: {e}")
        return {
            "gemini_passed": False,
            "gemini_reason": f"Gemini API failure: {str(e)}",
            "gemini_confidence": 0.0
        }
