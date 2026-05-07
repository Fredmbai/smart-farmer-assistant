POTATO_RULES = {
    'moisture_critical_low': 15,
    'moisture_critical_high': 90,
    'moisture_warning_low': 25,
    'moisture_warning_high': 80,
    'ph_min_critical': 4.5,
    'ph_max_critical': 8.0,
    'ph_min_optimal': 5.0,
    'ph_max_optimal': 6.5,
    'late_blight_temp_max': 18,
    'late_blight_humidity_min': 80,
    'frost_temp_critical': 2,
    'npk_n_low': 40,
    'npk_p_low': 20,
    'npk_k_low': 30,
}


class PotatoRuleEngine:

    def __init__(self, sensor_data, weather_data, market_data=None):
        self.sensor = sensor_data
        self.weather = weather_data
        self.market = market_data
        self.triggered_rules = []

    def check_all(self):
        results = []
        results += self._check_moisture()
        results += self._check_ph()
        results += self._check_late_blight()
        results += self._check_frost()
        results += self._check_npk()
        results += self._check_harvest()
        self.triggered_rules = results
        return results

    def _check_moisture(self):
        results = []
        m = self.sensor.get('moisture')
        rain_48h = float(self.weather.get('rainfall_probability_48h') or 0)
        rain_mm = self.weather.get('rainfall_mm_expected', 0)

        if m is None:
            return results
        m = float(m)

        if m < POTATO_RULES['moisture_critical_low']:
            if rain_48h >= 0.7:
                pct = int(rain_48h * 100)
                results.append({
                    'rule_name': 'moisture_critical_rain_coming',
                    'level': 'critical',
                    'category': 'irrigation',
                    'title': 'Critical: Soil moisture very low',
                    'message': (
                        f"Soil moisture is critically low at {m}%. "
                        f"However, rain is forecast in the next 48 hours "
                        f"({pct}% chance, ~{rain_mm}mm expected). "
                        f"Apply 40% of normal irrigation volume to sustain "
                        f"crops until rainfall arrives."
                    ),
                    'action_required': 'Apply partial irrigation immediately',
                })
            else:
                results.append({
                    'rule_name': 'moisture_critical_low',
                    'level': 'critical',
                    'category': 'irrigation',
                    'title': 'Critical: Irrigate immediately',
                    'message': (
                        f"Soil moisture is critically low at {m}%. "
                        f"Crops are at risk of water stress. "
                        f"Irrigate immediately with full water volume."
                    ),
                    'action_required': 'Irrigate immediately',
                })
        elif m < POTATO_RULES['moisture_warning_low']:
            results.append({
                'rule_name': 'moisture_warning_low',
                'level': 'warning',
                'category': 'irrigation',
                'title': 'Warning: Soil moisture dropping',
                'message': (
                    f"Soil moisture is at {m}%, below optimal range. "
                    f"Consider irrigating within the next 24 hours."
                ),
                'action_required': 'Plan irrigation within 24 hours',
            })
        elif m > POTATO_RULES['moisture_critical_high']:
            results.append({
                'rule_name': 'moisture_critical_high',
                'level': 'critical',
                'category': 'irrigation',
                'title': 'Critical: Waterlogging risk',
                'message': (
                    f"Soil moisture is dangerously high at {m}%. "
                    f"Potato roots are at risk of rot. "
                    f"Improve drainage immediately."
                ),
                'action_required': 'Improve field drainage immediately',
            })
        elif m > POTATO_RULES['moisture_warning_high']:
            results.append({
                'rule_name': 'moisture_warning_high',
                'level': 'warning',
                'category': 'irrigation',
                'title': 'Warning: Soil moisture too high',
                'message': (
                    f"Soil moisture at {m}% is above optimal. "
                    f"Reduce or stop irrigation. "
                    f"Monitor for disease conditions."
                ),
                'action_required': 'Stop irrigation and monitor',
            })
        return results

    def _check_ph(self):
        results = []
        ph = self.sensor.get('ph')
        if ph is None:
            return results
        ph = float(ph)

        if ph < POTATO_RULES['ph_min_critical']:
            results.append({
                'rule_name': 'ph_critical_low',
                'level': 'critical',
                'category': 'fertilizer',
                'title': 'Critical: Soil pH dangerously low',
                'message': (
                    f"Soil pH is {ph}, far below the safe range of 5.0-6.5. "
                    f"Nutrient uptake is severely impaired. "
                    f"Apply agricultural lime immediately."
                ),
                'action_required': 'Apply agricultural lime immediately',
            })
        elif ph < POTATO_RULES['ph_min_optimal']:
            results.append({
                'rule_name': 'ph_warning_low',
                'level': 'warning',
                'category': 'fertilizer',
                'title': 'Warning: Soil pH below optimal',
                'message': (
                    f"Soil pH is {ph}. Optimal range for potatoes is 5.0-6.5. "
                    f"Consider applying lime to raise pH gradually."
                ),
                'action_required': 'Apply lime to raise soil pH',
            })
        elif ph > POTATO_RULES['ph_max_critical']:
            results.append({
                'rule_name': 'ph_critical_high',
                'level': 'critical',
                'category': 'fertilizer',
                'title': 'Critical: Soil pH dangerously high',
                'message': (
                    f"Soil pH is {ph}, above the safe range. "
                    f"Apply sulfur to lower pH."
                ),
                'action_required': 'Apply sulfur to lower soil pH',
            })
        elif ph > POTATO_RULES['ph_max_optimal']:
            results.append({
                'rule_name': 'ph_warning_high',
                'level': 'warning',
                'category': 'fertilizer',
                'title': 'Warning: Soil pH above optimal',
                'message': (
                    f"Soil pH is {ph}, slightly above optimal range. "
                    f"Monitor and consider sulfur treatment."
                ),
                'action_required': 'Monitor pH and consider sulfur treatment',
            })
        return results

    def _check_late_blight(self):
        results = []
        temp = self.sensor.get('temperature')
        humidity = self.sensor.get('humidity')
        if temp is None or humidity is None:
            return results
        temp = float(temp)
        humidity = float(humidity)

        if (temp <= POTATO_RULES['late_blight_temp_max'] and
                humidity >= POTATO_RULES['late_blight_humidity_min']):
            results.append({
                'rule_name': 'late_blight_risk',
                'level': 'critical',
                'category': 'disease',
                'title': 'Critical: Late Blight conditions detected',
                'message': (
                    f"Temperature ({temp}°C) and humidity ({humidity}%) "
                    f"are in the Late Blight danger zone. "
                    f"Late Blight (Phytophthora infestans) can destroy "
                    f"a potato crop within days. "
                    f"Apply fungicide immediately and inspect leaves."
                ),
                'action_required': (
                    'Apply copper-based fungicide immediately. '
                    'Inspect all plants for dark lesions.'
                ),
            })
        return results

    def _check_frost(self):
        results = []
        frost_prob = float(self.weather.get('frost_probability') or 0)
        temp = self.sensor.get('temperature')

        if frost_prob >= 1.0 or (temp is not None and float(temp) <= 2):
            results.append({
                'rule_name': 'frost_risk',
                'level': 'critical',
                'category': 'weather',
                'title': 'Critical: Frost risk tonight',
                'message': (
                    f"Freezing temperatures are forecast. "
                    f"Potato plants will be severely damaged by frost. "
                    f"Cover young plants with frost cloth or straw mulch."
                ),
                'action_required': 'Cover crops with frost protection material',
            })
        return results

    def _check_npk(self):
        results = []
        n = self.sensor.get('npk_n')
        p = self.sensor.get('npk_p')
        k = self.sensor.get('npk_k')
        rain_48h = float(self.weather.get('rainfall_probability_48h') or 0)

        if n is not None and float(n) < POTATO_RULES['npk_n_low']:
            timing = (
                "Wait for rain to pass before applying — "
                "apply after rainfall for better absorption."
                if rain_48h >= 0.6
                else "Apply nitrogen fertilizer soon."
            )
            results.append({
                'rule_name': 'npk_n_low',
                'level': 'warning',
                'category': 'fertilizer',
                'title': 'Warning: Low nitrogen levels',
                'message': (
                    f"Soil nitrogen is low at {n} mg/kg. "
                    f"Potatoes need adequate nitrogen for leaf growth. "
                    f"{timing}"
                ),
                'action_required': 'Apply nitrogen fertilizer',
            })

        if p is not None and float(p) < POTATO_RULES['npk_p_low']:
            results.append({
                'rule_name': 'npk_p_low',
                'level': 'warning',
                'category': 'fertilizer',
                'title': 'Warning: Low phosphorus levels',
                'message': (
                    f"Soil phosphorus is low at {p} mg/kg. "
                    f"Phosphorus supports root and tuber development. "
                    f"Apply DAP or SSP fertilizer."
                ),
                'action_required': 'Apply phosphorus fertilizer (DAP or SSP)',
            })

        if k is not None and float(k) < POTATO_RULES['npk_k_low']:
            results.append({
                'rule_name': 'npk_k_low',
                'level': 'warning',
                'category': 'fertilizer',
                'title': 'Warning: Low potassium levels',
                'message': (
                    f"Soil potassium is low at {k} mg/kg. "
                    f"Potassium is critical for tuber quality and yield. "
                    f"Apply muriate of potash (MOP)."
                ),
                'action_required': 'Apply potassium fertilizer (MOP)',
            })
        return results

    def _check_harvest(self):
        results = []
        if not self.market:
            return results
        trend = self.market.get('price_trend')
        current_price = self.market.get('current_price')
        growth_stage = self.sensor.get('growth_stage', '')

        if (trend == 'rising' and
                growth_stage in ['tuber_bulking', 'maturity'] and
                current_price):
            results.append({
                'rule_name': 'harvest_timing_good',
                'level': 'info',
                'category': 'harvest',
                'title': 'Good time to harvest soon',
                'message': (
                    f"Potato prices are rising "
                    f"(currently KES {current_price}/kg). "
                    f"Your crop is at {growth_stage} stage. "
                    f"Plan harvest within the next 1-2 weeks to "
                    f"maximise your return."
                ),
                'action_required': 'Plan harvest timing',
            })
        return results

    @property
    def has_critical(self):
        return any(r['level'] == 'critical' for r in self.triggered_rules)
