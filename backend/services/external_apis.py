import os
import httpx
import json
from tavily import TavilyClient
from groq import Groq
from dotenv import load_dotenv
import datetime

load_dotenv()

# Load environment variables
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
GMAPS_API_KEY = os.getenv("GMAPS_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

async def fetch_weather_data(lat: float, lon: float):
    """
    Fetch real-time weather and AQI data from OpenWeatherMap.
    """
    if not OPENWEATHER_API_KEY:
        return {"weather": "clear", "temp": 25, "aqi": 1, "rain_1h": 0}
        
    try:
        async with httpx.AsyncClient() as client:
            weather_res = await client.get(
                f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
            )
            weather_data = weather_res.json()
            
            aqi_res = await client.get(
                f"https://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}"
            )
            aqi_data = aqi_res.json()
            
            temp = weather_data.get("main", {}).get("temp", 25)
            weather_desc = weather_data.get("weather", [{}])[0].get("main", "Clear").lower()
            rain_1h = weather_data.get("rain", {}).get("1h", 0)
            aqi = aqi_data.get("list", [{}])[0].get("main", {}).get("aqi", 1)  # 1 = Good, 5 = Very Poor
            
            return {
                "weather": weather_desc,
                "temp": temp,
                "rain_1h": rain_1h,
                "aqi": aqi
            }
    except Exception as e:
        print(f"Error fetching weather: {e}")
        return {"weather": "clear", "temp": 25, "aqi": 1, "rain_1h": 0}

async def fetch_traffic_data(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float):
    """
    Calculates expected vs actual duration to identify traffic anomalies using Google Maps API.
    """
    if not GMAPS_API_KEY:
        return {"expected_mins": 10, "traffic_mins": 10, "delay_factor": 1.0}
        
    try:
        async with httpx.AsyncClient() as client:
            url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origin_lat},{origin_lon}&destination={dest_lat},{dest_lon}&departure_time=now&key={GMAPS_API_KEY}"
            res = await client.get(url)
            data = res.json()
            
            if data.get("status") == "OK":
                leg = data["routes"][0]["legs"][0]
                expected_duration = leg.get("duration", {}).get("value", 600) / 60 # mins
                traffic_duration = leg.get("duration_in_traffic", {}).get("value", expected_duration * 60) / 60
                
                # Calculate the ratio of traffic delay
                delay_factor = traffic_duration / expected_duration if expected_duration > 0 else 1.0
                
                return {
                    "expected_mins": round(expected_duration, 1),
                    "traffic_mins": round(traffic_duration, 1),
                    "delay_factor": round(delay_factor, 2)
                }
    except Exception as e:
        print(f"Error fetching traffic: {e}")
    
    return {"expected_mins": 10, "traffic_mins": 10, "delay_factor": 1.0}

async def analyze_unstructured_risks(city: str):
    """
    Uses Tavily to scrape recent localized events and Groq LLM to determine the severity.
    Checks for Storms, Power/ISP failures, strikes, or VIP movements.
    """
    if not GROQ_API_KEY or not TAVILY_API_KEY:
        return {"score": 0.0, "reason": "API keys missing."}
        
    try:
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        query = f"Recent news in {city} about strikes, protests, floods, internet outage, power grid failures, or VIP visits today"
        search_result = tavily_client.search(query=query, search_depth="basic", max_results=3)
        context_str = str(search_result.get("results", []))
        
        groq_client = Groq(api_key=GROQ_API_KEY)
        prompt = f'''
        You are a risk analyzer for a gig-worker insurance app. 
        Evaluate the recent news context below for the city {city}. 
        Rate the CURRENT localized disruption severity from 0.0 (no disruption) to 1.0 (extreme disruption like severe floods, massive city-wide protests, or complete grid failure).
        Respond ONLY with a JSON object strictly containing two keys: "score" (a float) and "reason" (a short sentence). Do not add markdown or extra text.
        
        Context: {context_str}
        '''
        
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=150,
        )
        
        content = completion.choices[0].message.content
        import re
        # try strictly extracting the json
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return {"score": float(data.get("score", 0.0)), "reason": data.get("reason", "Analyzed.")}
        else:
            return {"score": 0.0, "reason": "Failed to parse LLM response"}

    except Exception as e:
        print(f"Error analyzing unstructured risks: {e}")
        return {"score": 0.0, "reason": "Error during analysis"}

async def analyze_historical_seasonal_risks(city: str):
    """
    Uses Tavily to scrape historical data and Groq LLM to determine the SEASONAL risk 
    for the current month (e.g. Monsoon season history, historical winter AQI in Delhi, etc.).
    Returns a unified historical risk baseline score from 0.0 to 1.0.
    """
    if not GROQ_API_KEY or not TAVILY_API_KEY:
        return {"score": 0.0, "reason": "API keys missing."}
        
    try:
        current_month = datetime.datetime.now().strftime("%B")
        tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        
        # Scrape historical data regarding this specific city during this month
        query = f"historical weather typical disruptions average AQI monsoon flooding power grid stability historical traffic congestion average commute delays in {city} during {current_month}"
        search_result = tavily_client.search(query=query, search_depth="advanced", max_results=3)
        context_str = str(search_result.get("results", []))
        
        groq_client = Groq(api_key=GROQ_API_KEY)
        prompt = f'''
        You are a risk actuary for a parametric insurance product in India.
        Evaluate the baseline operational risk for gig workers in {city} during {current_month}.
        
        CRITICAL INSTRUCTIONS:
        1. Context provided covers weather/AQI. But you MUST use your worldly knowledge about the city's general infrastructure and notorious traffic map.
        2. If the city is known for severe baseline traffic (e.g., Bangalore, Mumbai, Delhi), the score MUST BE ABOVE 0.4 regardless of perfect weather. 
        3. A score of 0.0 is a rural ghost town. {city} is a major metro.
        
        Score the baseline risk (0.0 to 1.0).
        Respond ONLY with a JSON object containing "score" (a float) and "reason" (1-2 sentences). No markdown.
        
        Context Data from Web: {context_str}
        '''
        
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=150,
        )
        
        content = completion.choices[0].message.content
        import re
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return {"score": float(data.get("score", 0.0)), "reason": data.get("reason", "Analyzed historical baseline.")}
        else:
            return {"score": 0.0, "reason": "Failed to parse historical LLM response"}

    except Exception as e:
        print(f"Error analyzing historical risks: {e}")
        return {"score": 0.0, "reason": "Error during historical analysis"}

async def generate_overall_pricing_reason(city, base_premium, final_premium, factors):
    """
    Uses Groq LLM to generate a 1-2 sentence profile insight explaining why the dynamic premium 
    is high or low based on the exact live and historical factors.
    """
    if not GROQ_API_KEY:
        return "Pricing generated based on local geographical metrics."
    
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
        prompt = f'''
        You are an AI actuary for a gig-worker insurance app.
        We just calculated a weekly insurance premium of ₹{final_premium} (Base was ₹{base_premium}) for a delivery rider in {city}.
        
        Here are the factors that influenced this price:
        {json.dumps(factors, indent=2)}
        
        Write a concise, 1-2 sentence max "Profile Insight" explaining to the user in a friendly but professional tone WHY their premium is priced this way today. Mention the relevant traffic, weather, or seasonal risks if they drove the price up or down. Keep it extremely brief.
        '''
        
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=100,
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating overall reason: {e}")
        return "Premium adjusted for your specific location and current operational conditions."
