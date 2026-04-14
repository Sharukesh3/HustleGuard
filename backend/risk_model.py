from ml.premium_model import calculate_neural_risk_score

def calculate_premium_multiplier(weather_data: dict, traffic_data: dict, social_score: float, historical_score: float) -> dict:
    '''
    Calculates a dynamic risk multiplier for the WEEKLY Premium using a 
    NEUROSYMBOLIC Approach:
    Symbolic Rules: Hard caps on severe LLM social disruptions & historical safety caps
    Neural Model: An XGBoost Model processing raw features into a baseline, explained via SHAP
    '''
    base_multiplier = 1.0
    
    # -------------------------------------------------------------
    # NEURAL COMPONENT (Machine Learning Baseline)
    # The ML model looks at continuous anomalies and predicts a baseline
    # score trained on large synthetic historical events.
    # -------------------------------------------------------------
    rain = float(weather_data.get('rain_1h', 0.0))
    aqi = int(weather_data.get('aqi', 1))
    temp = float(weather_data.get('temp', 25.0))
    delay_factor = float(traffic_data.get('delay_factor', 1.0))
    
    # Pack for the new dictionary signature
    job_data_mock = {
        'weather_alerts': rain + (aqi - 1)*0.1,  # pseudo-mapping
        'traffic_score': min(delay_factor, 10.0),
        'vehicle_age_years': 5, # default
        'coverage_tier': 'standard'
    }
    
    # We now get a dictionary containing the baseline prediction and SHAP explanation
    ml_output = calculate_neural_risk_score(job_data_mock)
    
    # The ML model outputs a premium dollar amount (e.g. $120 to $350). 
    # We normalize to a multiplier base (e.g. 1.0 to 3.0) for the symbolic caps
    ml_dollar_value = ml_output['neural_base_premium']
    neural_multiplier = min(max(ml_dollar_value / 150.0, 1.0), 3.0) 
    
    base_multiplier = neural_multiplier
    
    # -------------------------------------------------------------
    # SYMBOLIC OVERRIDE COMPONENT (Hard Rules on top of ML)
    # -------------------------------------------------------------
    # 0. Historical / Seasonal Foundation
    if historical_score >= 0.7:
        base_multiplier += 0.4
    elif historical_score >= 0.4:
        base_multiplier += 0.2
        
    # 3. Social Disruption Logic (LLM output scale 0.0 to 1.0)
    if social_score >= 0.8:
        base_multiplier += 0.8
    elif social_score >= 0.5:
        base_multiplier += 0.4
    elif social_score >= 0.2:
        base_multiplier += 0.1

    # Cap to protect drivers
    final_multiplier = min(max(base_multiplier, 0.8), 3.5)
    
    return {
        'multiplier': round(final_multiplier, 2),
        'ml_model_explanations': ml_output['shap_factors']
    }
