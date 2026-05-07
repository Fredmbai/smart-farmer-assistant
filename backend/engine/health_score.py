def compute_health_score(sensor_data, weather_data, rule_results):
    score = 100

    for r in rule_results:
        if r['level'] == 'critical':
            score -= 25
        elif r['level'] == 'warning':
            score -= 10

    moisture = sensor_data.get('moisture')
    if moisture is not None:
        moisture = float(moisture)
        if 15 <= moisture < 25:
            score -= 5

    ph = sensor_data.get('ph')
    if ph is not None:
        ph = float(ph)
        ph_warning_triggered = any(
            r['rule_name'] in ('ph_warning_low', 'ph_warning_high',
                               'ph_critical_low', 'ph_critical_high')
            for r in rule_results
        )
        if not ph_warning_triggered and not (5.0 <= ph <= 6.5):
            score -= 5

    frost_prob = float(weather_data.get('frost_probability') or 0)
    if frost_prob >= 0.5:
        score -= 15

    temp = sensor_data.get('temperature')
    humidity = sensor_data.get('humidity')
    if temp is not None and humidity is not None:
        if float(temp) <= 18 and float(humidity) >= 75:
            late_blight_triggered = any(
                r['rule_name'] == 'late_blight_risk' for r in rule_results
            )
            if not late_blight_triggered:
                score -= 10

    score = max(0, min(100, score))

    if score >= 70:
        status = 'healthy'
    elif score >= 40:
        status = 'warning'
    else:
        status = 'critical'

    return score, status
