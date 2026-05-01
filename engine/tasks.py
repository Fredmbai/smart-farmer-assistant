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
