def calculate_premium_multiplier(traffic, weather, apartments, closures, social):
    """
    Mock ML Model to calculate the risk multiplier based on 5 features.
    In reality, this could be a PyTorch model:
    ```
    import torch
    import torch.nn as nn
    
    class RiskModel(nn.Module):
        def __init__(self):
            super().__init__()
            self.linear = nn.Linear(5, 1)
        
        def forward(self, x):
            return torch.sigmoid(self.linear(x)) * 2.0  # multiplier between 0 and 2
    ```
    For prototyping, we're taking a weighted average.
    """
    weights = [0.3, 0.2, 0.15, 0.15, 0.2]
    
    # 1. Traffic (Google Maps / TomTom)
    # 2. Weather (Rainfall, Heat, AQI) from OpenWeather
    # 3. Apartments (Historical Nav Delay)
    # 4. Road Closures
    # 5. Social Context (Strikes, Web scrapers)
    
    risk_score = (
        traffic * weights[0] +
        weather * weights[1] +
        apartments * weights[2] +
        closures * weights[3] +
        social * weights[4]
    )
    
    # Map score to a practical multiplier between 0.8 and 1.5
    # Base risk is around 1.0
    multiplier = 0.8 + (risk_score * 0.7)
    
    return max(0.8, min(1.5, multiplier))