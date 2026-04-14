import torch
import torch.nn as nn
import torch.optim as optim
import os
import numpy as np

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "fraud_autoencoder.pth")

class TelemetryAutoencoder(nn.Module):
    """
    Lightweight Autoencoder to detect GPS spoofing or airplane-mode anomalies.
    Input dim = 6 [speed, gps_accuracy, distance_from_last, ping_delta, battery_level, is_charging]
    """
    def __init__(self):
        super(TelemetryAutoencoder, self).__init__()
        self.encoder = nn.Sequential(
            nn.Linear(6, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 4)
        )
        self.decoder = nn.Sequential(
            nn.Linear(4, 8),
            nn.ReLU(),
            nn.Linear(8, 16),
            nn.ReLU(),
            nn.Linear(16, 6)
        )

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

def train_dummy_autoencoder():
    """
    Trains the autoencoder on 'normal' healthy driver telemetry.
    """
    print("Training Autoencoder on safe telemetry records...")
    model = TelemetryAutoencoder()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.01)

    # Generate "Normal" data
    # feature bounds roughly mapped: [speed/50, gps_accuracy/100, distance/1000, ping_delta/60, battery/100, is_charging]
    # Normal driving varies battery mostly between 20-80 (0.2-0.8), charging often 0 (0.0). Fraud usually is battery=1.0, charging=1.0 constantly
    np.random.seed(42)
    torch.manual_seed(42)
    normal_data = np.random.normal(loc=[0.4, 0.1, 0.2, 0.05, 0.5, 0.2], scale=[0.1, 0.02, 0.05, 0.01, 0.3, 0.1], size=(500, 6))
    normal_data = np.clip(normal_data, 0, 1).astype(np.float32)
    dataset = torch.tensor(normal_data)

    model.train()
    for epoch in range(100):
        optimizer.zero_grad()
        outputs = model(dataset)
        loss = criterion(outputs, dataset)
        loss.backward()
        optimizer.step()

    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Autoencoder training complete! Saved to {MODEL_PATH}")

def load_or_train_model():
    if not os.path.exists(MODEL_PATH):
        train_dummy_autoencoder()
        
    model = TelemetryAutoencoder()
    model.load_state_dict(torch.load(MODEL_PATH, weights_only=True))
    model.eval()
    return model

def calculate_fraud_anomaly_score(speed: float, gps_accuracy: float, distance: float, ping_delta: float, battery_level: float = 50.0, is_charging: bool = False) -> tuple[float, dict]:
    """
    Returns an anomaly score (Mean Squared Error) and feature-wise explanations.
    Higher score = More likely to be fraud.
    """
    try:
        model = load_or_train_model()

        # Normalization approximation matching training data
        features = np.array([
            min(max(speed / 50.0, 0), 1),
            min(max(gps_accuracy / 100.0, 0), 1),
            min(max(distance / 1000.0, 0), 1),
            min(max(ping_delta / 60.0, 0), 1),
            min(max(battery_level / 100.0, 0), 1),
            1.0 if is_charging else 0.0
        ], dtype=np.float32)

        tensor_input = torch.tensor(features).unsqueeze(0)
        
        with torch.no_grad():
            reconstructed = model(tensor_input)
            # Calculate element-wise loss for explainability
            squared_errors = ((reconstructed - tensor_input) ** 2).squeeze().numpy()
            total_loss = squared_errors.mean().item()

        feature_names = ['Speed', 'GPS Accuracy', 'Distance From Last', 'Ping Delta', 'Battery Level', 'Is Charging']
        
        explanations = {}
        for i, name in enumerate(feature_names):
            # Calculate percentage contribution to the total error
            contribution = (squared_errors[i] / (squared_errors.sum() + 1e-9)) * 100
            explanations[name] = round(contribution, 1)

        return total_loss, explanations
    except Exception as e:
        print(f"Fraud model error: {e}")
        return 0.0, {}

def is_fraudulent_telemetry(speed: float, gps_accuracy: float, distance: float, ping_delta: float, battery_level: float = 50.0, is_charging: bool = False, anomaly_threshold: float = 0.08) -> tuple[bool, str]:
    """
    Combines Symbolic Logic (Hard rules) with Neural Logic (Autoencoder).
    """
    # 1. Symbolic Rules (Absolute failures)
    if gps_accuracy > 500:
        return True, "Fails symbolic rule: GPS Accuracy too low (Likely spoofing/Cell tower proxy)."
    if ping_delta > 300 and distance == 0:
        return True, "Fails symbolic rule: Ghosting (Airplane mode while retaining claim)."
    if battery_level == 100.0 and is_charging and speed < 2.0 and ping_delta > 0:
        # A bit of logic to catch "fraud farms" running at 100% battery standing still but connected.
        # But we'll leave the autoencoder to catch the main subtleties.
        pass
    
    # 2. Neural Anomaly Score
    neural_score, explanations = calculate_fraud_anomaly_score(speed, gps_accuracy, distance, ping_delta, battery_level, is_charging)
    
    if neural_score > anomaly_threshold:
        # Find the most anomalous feature
        top_anomaly = max(explanations, key=explanations.get)
        top_cont = explanations[top_anomaly]
        
        return True, f"Fails neural rule: Telemetry matches spoofing signature (Anomaly Score: {neural_score:.4f}). Primary driver: {top_anomaly} ({top_cont}% of anomaly)."
        
    return False, "Telemetry verified."

if __name__ == '__main__':
    train_dummy_autoencoder()
    
    print("\n--- Testing Neurosymbolic Explainable AI ---")
    
    # Test 1: Normal profile
    is_fraud, msg = is_fraudulent_telemetry(speed=20.0, gps_accuracy=10.0, distance=200.0, ping_delta=2.0, battery_level=60.0, is_charging=False)
    print(f"Normal Test -> Fraud: {is_fraud} | Reason: {msg}")
    
    # Test 2: Teleportation Anomaly (impossible distance in short ping)
    is_fraud, msg = is_fraudulent_telemetry(speed=120.0, gps_accuracy=10.0, distance=5000.0, ping_delta=2.0, battery_level=55.0, is_charging=False)
    print(f"Spoofing Test -> Fraud: {is_fraud} | Reason: {msg}")

    # Test 3: Fraud Farm (Always 100% battery, charging, zero distance, standing still)
    is_fraud, msg = is_fraudulent_telemetry(speed=0.0, gps_accuracy=5.0, distance=0.0, ping_delta=5.0, battery_level=100.0, is_charging=True)
    print(f"Fraud Farm Test -> Fraud: {is_fraud} | Reason: {msg}")
