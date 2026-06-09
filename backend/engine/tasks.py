from datetime import date

from celery import shared_task


@shared_task
def run_engine_for_plot(plot_id):
    from farms.models import Plot
    from engine.decision_engine import DecisionEngine

    try:
        plot = Plot.objects.get(id=plot_id)
    except Plot.DoesNotExist:
        return None

    engine = DecisionEngine()
    return engine.run_analysis(plot)


@shared_task
def check_regional_disease_alerts():
    """
    Check weather conditions across high-risk Kenyan highland counties
    and create regional Late Blight INFO alerts for affected potato farms.
    Runs daily at 7:30am via Celery Beat.
    """
    from farms.models import Farm
    from weather.models import WeatherData
    from engine.models import Alert

    HIGH_RISK_COUNTIES = [
        'Nyandarua', 'Nakuru', 'Meru',
        'Nyeri', 'Kiambu', 'Bomet',
    ]

    at_risk_farms = Farm.objects.filter(county__in=HIGH_RISK_COUNTIES)
    created_count = 0

    for farm in at_risk_farms:
        latest_weather = WeatherData.objects.filter(farm=farm).first()
        if not latest_weather:
            continue

        temp   = float(latest_weather.temperature_current or 99)
        hum    = float(latest_weather.humidity or 0)
        rain48 = float(latest_weather.rainfall_probability_48h or 0)

        # Regional blight risk: sustained cool + humid highland conditions
        if temp <= 20 and hum >= 75 and rain48 >= 0.5:
            for plot in farm.plots.filter(crop='potato'):
                # Deduplicate — one alert per plot per day
                already_exists = Alert.objects.filter(
                    plot=plot,
                    title='Regional Late Blight Risk',
                    created_at__date=date.today(),
                ).exists()

                if not already_exists:
                    Alert.objects.create(
                        analysis=None,
                        plot=plot,
                        user=farm.user,
                        level='info',
                        category='disease',
                        title='Regional Late Blight Risk',
                        message=(
                            f"Weather conditions in {farm.county} are favourable "
                            f"for Late Blight spread. Cool temperatures "
                            f"({latest_weather.temperature_current}°C) and high "
                            f"humidity ({latest_weather.humidity}%) create ideal "
                            f"blight conditions. Inspect your crops and consider "
                            f"preventive fungicide application."
                        ),
                        action_required=(
                            'Inspect crops for early blight symptoms. '
                            'Consider preventive copper-based fungicide.'
                        ),
                    )
                    created_count += 1
                    print(f"Regional blight alert created for {farm.name} / {plot.name}")

    print(f"check_regional_disease_alerts: {created_count} alerts created")
    return {'alerts_created': created_count}
