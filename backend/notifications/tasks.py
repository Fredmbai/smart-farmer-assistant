from celery import shared_task
from django.conf import settings


@shared_task
def send_alert_notification_task(alert_id):
    from engine.models import Alert
    from .services import NotificationService

    alert = Alert.objects.filter(id=alert_id).first()
    if not alert:
        return 'alert_not_found'

    notification = NotificationService().send_alert_notification(alert)
    return notification.status


@shared_task
def send_bulk_notification_task(user_ids, title, body, data={}):
    from django.contrib.auth import get_user_model
    from .services import NotificationService

    User = get_user_model()
    service = NotificationService()
    sent = 0

    for user_id in user_ids:
        user = User.objects.filter(id=user_id).first()
        if user:
            n = service.send_push(user, title, body, data)
            if n.status == 'sent':
                sent += 1

    return sent


@shared_task
def send_weekly_summary_task():
    from django.contrib.auth import get_user_model
    from engine.models import EngineAnalysis
    from farms.models import Plot
    from .services import NotificationService

    User = get_user_model()
    service = NotificationService()
    farmers = User.objects.filter(role='farmer', is_active=True)

    for farmer in farmers:
        plots = Plot.objects.filter(farm__user=farmer)
        if not plots.exists():
            continue

        healthy = 0
        needs_attention = 0
        for plot in plots:
            latest = EngineAnalysis.objects.filter(plot=plot).first()
            if latest and latest.health_status == 'healthy':
                healthy += 1
            else:
                needs_attention += 1

        total = plots.count()
        summary = (
            f"Your farm health this week: {healthy} plot{'s' if healthy != 1 else ''} healthy, "
            f"{needs_attention} plot{'s' if needs_attention != 1 else ''} need{'s' if needs_attention == 1 else ''} attention."
        )
        service.send_push(
            farmer,
            title="📊 Weekly Farm Summary",
            body=summary,
            data={'type': 'weekly_summary', 'total_plots': total},
        )
