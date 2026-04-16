import os
import pickle
import numpy as np
import xgboost as xgb
import shap
import pandas as pd

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'premium_xgboost.pkl')
EXPLAINER_PATH = os.path.join(os.path.dirname(__file__), 'shap_explainer.pkl')

def train_dummy_model():
    # Dummy data: [weather_severity(0-1), traffic_density(0-1), vehicle_age(years)/20, coverage_level(0-1)]
    X_train = pd.DataFrame(
        [
            [0.1, 0.2, 0.1, 0.5],
            [0.8, 0.9, 0.5, 0.9],
            [0.3, 0.1, 0.8, 0.1],
            [0.5, 0.5, 0.2, 0.5],
            [0.9, 0.8, 0.3, 0.8],
            [0.2, 0.2, 0.2, 0.2]
        ],
        columns=['weather', 'traffic', 'vehicle_age', 'coverage']
    )
    
    # Target: Base neural premium (in USD)
    y_train = np.array([120, 350, 150, 200, 310, 110])
    
    # Train the XGBoost Regressor
    model = xgb.XGBRegressor(n_estimators=50, max_depth=3, learning_rate=0.1, objective='reg:squarederror')
    model.fit(X_train, y_train)
    
    # Fit SHAP Explainer
    explainer = shap.TreeExplainer(model)
    
    # Save both
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    with open(EXPLAINER_PATH, 'wb') as f:
        pickle.dump(explainer, f)
        
    print('XGBoost model and SHAP Explainer generated and saved!')

def load_or_train_model():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(EXPLAINER_PATH):
        train_dummy_model()
    
    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    with open(EXPLAINER_PATH, 'rb') as f:
        explainer = pickle.load(f)
        
    return model, explainer

def calculate_neural_risk_score(job_data: dict) -> dict:
    model, explainer = load_or_train_model()
    
    # Feature extraction (mock logic)
    weather = min(job_data.get('weather_alerts', 0) * 0.1, 1.0)
    traffic = min(job_data.get('traffic_score', 5) / 10.0, 1.0)
    vehicle_age = min(job_data.get('vehicle_age_years', 5) / 20.0, 1.0)
    coverage_map = {'basic': 0.2, 'standard': 0.5, 'comprehensive': 0.9}
    coverage = coverage_map.get(job_data.get('coverage_tier', 'standard'), 0.5)
    
    # Build dataframe for SHAP consistency
    features_df = pd.DataFrame(
        [[weather, traffic, vehicle_age, coverage]], 
        columns=['weather', 'traffic', 'vehicle_age', 'coverage']
    )
    
    # Predict
    prediction = float(model.predict(features_df)[0])
    
    # SHAP Explainability
    shap_values = explainer.shap_values(features_df)
    
    base_value = float(explainer.expected_value)
    
    explanations = []
    for i, col in enumerate(features_df.columns):
        impact = float(shap_values[0][i])
        if abs(impact) > 1.0:  # Only report significant factors
            direction = 'increased' if impact > 0 else 'decreased'
            explanations.append(f'{col.capitalize()} {direction} premium by ${abs(impact):.2f}')
            
    # Compile the Explainable AI response
    return {
        'neural_base_premium': round(prediction, 2),
        'model_baseline': round(base_value, 2),
        'shap_factors': explanations
    }

if __name__ == r'__main__':
    train_dummy_model()
