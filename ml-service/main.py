from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import logging
import os
from datetime import datetime, timedelta
import json

app = FastAPI(title="VayuGuard ML Service", version="1.0.0")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Request/Response models
class ForecastRequest(BaseModel):
    location_id: int
    city: str
    horizon_hours: int = 24

class ForecastResponse(BaseModel):
    location_id: int
    city: str
    forecast_date: str
    horizon_hours: int
    predicted_aqi: float
    predicted_pm25: float
    predicted_pm10: float
    confidence_score: float
    model_version: str

class HealthRiskRequest(BaseModel):
    aqi: float
    pm25: float
    user_profile: str  # 'asthma', 'elderly', 'child', 'outdoor_worker', 'general'

class HealthRiskResponse(BaseModel):
    risk_level: str  # 'low', 'moderate', 'high', 'severe'
    risk_score: float
    recommendations: list
    affected_group: str

# Health Profiles
HEALTH_PROFILES = {
    'asthma': {
        'pm25_threshold': 35.5,
        'aqi_threshold': 100,
        'multiplier': 1.5
    },
    'elderly': {
        'pm25_threshold': 35.5,
        'aqi_threshold': 100,
        'multiplier': 1.3
    },
    'child': {
        'pm25_threshold': 25,
        'aqi_threshold': 80,
        'multiplier': 1.4
    },
    'outdoor_worker': {
        'pm25_threshold': 45,
        'aqi_threshold': 150,
        'multiplier': 1.2
    },
    'general': {
        'pm25_threshold': 50,
        'aqi_threshold': 200,
        'multiplier': 1.0
    }
}

@app.get('/health')
async def health_check():
    """Health check endpoint"""
    return {
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'vayuguard-ml'
    }

@app.post('/forecast', response_model=ForecastResponse)
async def get_forecast(request: ForecastRequest):
    """
    Get AQI forecast for a location
    
    NOTE: This is a placeholder. Replace with actual ML model predictions
    using trained LSTM/XGBoost models with historical data.
    """
    try:
        # Placeholder prediction logic
        # In production: Load trained model, fetch historical features, predict
        
        base_aqi = 100  # Mock value
        predicted_pm25 = 45.5
        predicted_pm10 = 78.2
        
        forecast_response = ForecastResponse(
            location_id=request.location_id,
            city=request.city,
            forecast_date=datetime.now().isoformat(),
            horizon_hours=request.horizon_hours,
            predicted_aqi=base_aqi + (request.horizon_hours / 24),
            predicted_pm25=predicted_pm25,
            predicted_pm10=predicted_pm10,
            confidence_score=0.82,
            model_version='v1.0'
        )
        
        logger.info(f'Forecast generated for {request.city}')
        return forecast_response
        
    except Exception as e:
        logger.error(f'Forecast error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/health-risk', response_model=HealthRiskResponse)
async def assess_health_risk(request: HealthRiskRequest):
    """
    Assess health risk based on AQI/pollutants and user profile
    """
    try:
        profile = HEALTH_PROFILES.get(request.user_profile, HEALTH_PROFILES['general'])
        
        # Calculate risk score
        pm25_risk = max(0, (request.pm25 - profile['pm25_threshold']) / profile['pm25_threshold'])
        aqi_risk = max(0, (request.aqi - profile['aqi_threshold']) / profile['aqi_threshold'])
        
        combined_risk = (pm25_risk + aqi_risk) / 2 * profile['multiplier']
        
        # Determine risk level
        if combined_risk < 0.2:
            risk_level = 'low'
            recommendations = ['All outdoor activities are safe']
        elif combined_risk < 0.5:
            risk_level = 'moderate'
            recommendations = ['Limit prolonged outdoor activities', 'Consider wearing a mask if sensitive']
        elif combined_risk < 0.8:
            risk_level = 'high'
            recommendations = ['Avoid outdoor activities', 'Use N95/P100 mask if going out', 'Keep windows closed']
        else:
            risk_level = 'severe'
            recommendations = ['Stay indoors', 'Use HEPA air purifier', 'Seek medical advice if symptoms worsen']
        
        return HealthRiskResponse(
            risk_level=risk_level,
            risk_score=min(1.0, combined_risk),
            recommendations=recommendations,
            affected_group=request.user_profile
        )
        
    except Exception as e:
        logger.error(f'Health risk assessment error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/models')
async def get_available_models():
    """List available ML models and their details"""
    return {
        'models': [
            {
                'name': 'LSTM Forecaster',
                'version': 'v1.0',
                'type': 'deep_learning',
                'horizon': '24-72 hours',
                'status': 'training'
            },
            {
                'name': 'XGBoost Predictor',
                'version': 'v1.0',
                'type': 'ensemble',
                'horizon': '6-24 hours',
                'status': 'training'
            },
            {
                'name': 'Health Risk Scorer',
                'version': 'v1.0',
                'type': 'rule_based',
                'horizon': 'real-time',
                'status': 'active'
            }
        ]
    }

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
