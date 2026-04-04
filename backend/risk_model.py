def calculate_premium_multiplier(weather_data: dict, traffic_data: dict, social_score: float, historical_score: float) -> float:
    """
    Calculates a dynamic risk multiplier for the WEEKLY Premium based on:
    1. Historical Baseline (Seasonal AQI, Monsoon History, Power grid reliability for this month)
    2. Dynamic Live Anomalies (Current extreme rain, current traffic delay, live strikes)
    """
    base_multiplier = 1.0
    
    # 0. Historical / Seasonal Foundation
    # The historical factor sets the baseline expectation for the week.
    # Scores > 0.6 indicate severe seasonal trends (e.g., Delhi in November, Mumbai in July).
    if historical_score >= 0.7:
        base_multiplier += 0.4
    elif historical_score >= 0.4:
        base_multiplier += 0.2
        
    # 1. Weather Logic (LIVE Anomalies)
    # Heavily penalize high rain and extreme AQI since these cause huge delays right now
    rain = float(weather_data.get("rain_1h", 0.0))
    if rain > 5.0:
        base_multiplier += 0.5  # Heavy rain
    elif rain > 0.5:
        base_multiplier += 0.2  # Light rain
        
    aqi = int(weather_data.get("aqi", 1))
    if aqi >= 4:
        base_multiplier += 0.3  # Very poor/Hazardous air quality
    elif aqi == 3:
        base_multiplier += 0.1
        
    temp = float(weather_data.get("temp", 25.0))
    if temp > 40.0:
        base_multiplier += 0.2  # Extreme heat
    
    # 2. Traffic Logic
    # Delay factor > 1 means traffic duration is longer than expected duration
    delay_factor = float(traffic_data.get("delay_factor", 1.0))
    if delay_factor >= 2.0:
        base_multiplier += 0.4  # Taking double the time
    elif delay_factor >= 1.4:
        base_multiplier += 0.15 # Taking 40% longer
    elif delay_factor >= 1.2:
        base_multiplier += 0.05 # Taking 20% longer (very common, slight bump)
        
    # 3. Social Disruption Logic (LLM output scale 0.0 to 1.0)
    # The groq model outputs a score where > 0.5 indicates serious localized events
    # like strikes, VIP movements, unmapped hazards.
    if social_score >= 0.8:
        base_multiplier += 0.8
    elif social_score >= 0.5:
        base_multiplier += 0.4
    elif social_score >= 0.2:
        base_multiplier += 0.1

    # Cap it so premiums don't become instantly impossible 
    # but still show clear dynamic surges.
    return min(max(base_multiplier, 0.8), 3.5)