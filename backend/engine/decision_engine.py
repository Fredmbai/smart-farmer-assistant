import datetime
import os

import joblib
import pandas as pd

ML_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ml')

GROWTH_STAGE_MAP = {
    'sprouting': 0, 'vegetative': 1, 'flowering': 2,
    'tuber_bulking': 3, 'maturity': 4, 'unknown': 0,
}
TREND_MAP = {'falling': 0, 'stable': 1, 'rising': 2}


def _load(fname):
    return joblib.load(os.path.join(ML_DIR, fname))


class DecisionEngine:

    def __init__(self):
        # Try v2 first, fall back to v1
        try:
            self.model          = _load('xgboost_potato_v2.pkl')
            self.label_encoder  = _load('label_encoder_v2.pkl')
            self.feature_names  = _load('feature_names_v2.pkl')
            self.variety_encoder = _load('variety_encoder.pkl')
            self.model_version  = 'v2'
            print("[Engine] Loaded XGBoost v2 model.")
        except FileNotFoundError:
            try:
                self.model          = _load('xgboost_potato.pkl')
                self.label_encoder  = _load('label_encoder.pkl')
                self.feature_names  = _load('feature_names.pkl')
                self.variety_encoder = {}
                self.model_version  = 'v1'
                print("[Engine] v2 not found — loaded XGBoost v1 fallback.")
            except FileNotFoundError:
                self.model = None
                self.model_version = 'none'
                print("[Engine] WARNING: no model found.")

    def _encode_variety(self, variety_str):
        """Map variety slug to integer; default 0 (shangi) if unknown."""
        if not variety_str:
            return 0
        return self.variety_encoder.get(variety_str.lower(), 0)

    def build_feature_vector(self, sensor_data, weather_data,
                             crop_cycle=None, market_data=None):
        growth_stage = sensor_data.get('growth_stage', 'unknown')
        growth_enc   = GROWTH_STAGE_MAP.get(growth_stage, 0)

        days = 0
        if crop_cycle and crop_cycle.days_since_planting is not None:
            days = crop_cycle.days_since_planting

        trend_enc = TREND_MAP.get((market_data or {}).get('price_trend'), 1)

        # variety_encoded is passed via sensor_data['variety_encoded']
        # (set in run_analysis before calling here)
        variety_enc = int(sensor_data.get('variety_encoded', 0))

        fv = {
            'moisture':                     float(sensor_data.get('moisture') or 50),
            'ph':                           float(sensor_data.get('ph') or 6.0),
            'temperature':                  float(sensor_data.get('temperature') or 18),
            'humidity':                     float(sensor_data.get('humidity') or 65),
            'npk_n':                        float(sensor_data.get('npk_n') or 60),
            'npk_p':                        float(sensor_data.get('npk_p') or 30),
            'npk_k':                        float(sensor_data.get('npk_k') or 50),
            'rainfall_probability_48h':     float(weather_data.get('rainfall_probability_48h') or 0),
            'rainfall_mm_expected':         float(weather_data.get('rainfall_mm_expected') or 0),
            'frost_probability':            float(weather_data.get('frost_probability') or 0),
            'growth_stage_encoded':         growth_enc,
            'days_since_planting':          float(days),
            'market_price_trend_encoded':   trend_enc,
        }
        # Only include variety_encoded if the loaded model expects it (v2)
        if 'variety_encoded' in self.feature_names:
            fv['variety_encoded'] = float(variety_enc)

        return fv

    def run_analysis(self, plot, sensor_reading=None, weather_obj=None):
        from engine.health_score import compute_health_score
        from engine.models import Alert, EngineAnalysis
        from engine.rules import PotatoRuleEngine
        from iot.models import SensorReading
        from market.models import MarketPrice
        from weather.models import WeatherData
        from django.db.models import Avg

        # 1. Latest sensor reading
        if sensor_reading is None:
            sensor_reading = SensorReading.objects.filter(plot=plot).first()

        # 2. Latest weather
        if weather_obj is None:
            weather_obj = WeatherData.objects.filter(farm=plot.farm).first()

        # 3. Active crop cycle
        crop_cycle = plot.cycles.filter(status='active').first()

        # 4. Market data
        latest_price = MarketPrice.objects.filter(crop='potato').first()
        avg_result   = MarketPrice.objects.filter(
            crop='potato',
            price_date__gte=datetime.date.today() - datetime.timedelta(days=30),
        ).aggregate(avg=Avg('price_per_kg'))
        avg_price = avg_result['avg']

        market_data = None
        if latest_price and avg_price:
            current = float(latest_price.price_per_kg)
            avg     = float(avg_price)
            if current > avg * 1.05:
                trend = 'rising'
            elif current < avg * 0.95:
                trend = 'falling'
            else:
                trend = 'stable'
            market_data = {'price_trend': trend, 'current_price': current}

        # 5. Build sensor dict — include variety for rules engine
        variety = (plot.variety or 'shangi').strip() or 'shangi'
        sensor_data = {'variety': variety}
        if sensor_reading:
            for field in ('moisture', 'ph', 'temperature', 'humidity',
                          'npk_n', 'npk_p', 'npk_k'):
                val = getattr(sensor_reading, field, None)
                if val is not None:
                    sensor_data[field] = float(val)
        if crop_cycle:
            sensor_data['growth_stage'] = crop_cycle.growth_stage

        # Encode variety for XGBoost feature vector
        sensor_data['variety_encoded'] = self._encode_variety(variety)

        # 6. Build weather dict
        weather_data = {}
        if weather_obj:
            for field in ('rainfall_probability_48h', 'rainfall_probability_24h',
                          'rainfall_mm_expected', 'frost_probability',
                          'temperature_current', 'humidity'):
                val = getattr(weather_obj, field, None)
                if val is not None:
                    weather_data[field] = float(val)

        # 7. Rule engine (variety-aware)
        rule_engine  = PotatoRuleEngine(sensor_data, weather_data, market_data)
        rule_results = rule_engine.check_all()

        # 8. Health score
        score, health_status = compute_health_score(sensor_data, weather_data, rule_results)

        # 9. XGBoost prediction
        prediction = ''
        confidence = None
        if self.model:
            try:
                features   = self.build_feature_vector(
                    sensor_data, weather_data, crop_cycle, market_data
                )
                feature_df = pd.DataFrame([features])[self.feature_names]
                prediction = self.label_encoder.inverse_transform(
                    self.model.predict(feature_df)
                )[0]
                confidence = float(self.model.predict_proba(feature_df).max())
            except Exception as e:
                print(f"[Engine] XGBoost prediction error: {e}")

        rule_triggered = len(rule_results) > 0
        primary_rule   = rule_results[0]['rule_name'] if rule_results else ''

        # 10. Save analysis
        analysis = EngineAnalysis.objects.create(
            plot=plot,
            crop_cycle=crop_cycle,
            sensor_reading=sensor_reading,
            weather_data=weather_obj,
            health_score=score,
            health_status=health_status,
            growth_stage=sensor_data.get('growth_stage', 'unknown'),
            xgboost_prediction=prediction,
            xgboost_confidence=confidence,
            rule_triggered=rule_triggered,
            rule_name=primary_rule,
            feature_vector=self.build_feature_vector(
                sensor_data, weather_data, crop_cycle, market_data
            ) if self.model else None,
        )

        # 11. Create alerts from rule results
        farm_user = plot.farm.user
        for rule in rule_results:
            Alert.objects.create(
                analysis=analysis,
                plot=plot,
                user=farm_user,
                level=rule['level'],
                category=rule['category'],
                title=rule['title'],
                message=rule['message'],
                action_required=rule.get('action_required', ''),
            )

        from weather.services import WeatherService
        weather_summary = WeatherService().get_weather_summary(plot.farm)

        return {
            'analysis_id':        str(analysis.id),
            'health_score':       score,
            'health_status':      health_status,
            'growth_stage':       sensor_data.get('growth_stage', 'unknown'),
            'rule_alerts':        rule_results,
            'xgboost_prediction': prediction,
            'xgboost_confidence': round(confidence, 4) if confidence else None,
            'total_alerts':       len(rule_results),
            'model_version':      self.model_version,
            'variety':            variety,
            'weather_summary':    weather_summary,
        }
