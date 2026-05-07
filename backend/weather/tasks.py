from celery import shared_task


@shared_task
def fetch_weather_for_all_farms():
    from farms.models import Farm
    farms = Farm.objects.filter(plots__isnull=False).distinct()
    for farm in farms:
        fetch_weather_for_farm.delay(str(farm.id))


@shared_task
def fetch_weather_for_farm(farm_id):
    from farms.models import Farm
    from .services import WeatherService

    try:
        farm = Farm.objects.get(id=farm_id)
    except Farm.DoesNotExist:
        return

    WeatherService().fetch_for_farm(farm)

    try:
        from engine.tasks import run_engine_for_plot
        for plot in farm.plots.all():
            run_engine_for_plot.delay(str(plot.id))
    except Exception:
        pass
