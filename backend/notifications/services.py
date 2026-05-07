import requests
from django.conf import settings
from django.utils import timezone

from .models import Notification


class NotificationService:

    def send_push(self, user, title, body, data={}):
        notification = Notification.objects.create(
            user=user,
            title=title,
            body=body,
            data=data,
            status='pending',
        )

        if not user.fcm_token:
            notification.status = 'failed'
            notification.failure_reason = 'No FCM token registered'
            notification.save()
            return notification

        if settings.DEBUG or not settings.FCM_SERVER_KEY:
            print(f"[NOTIFICATION] To: {user.full_name}")
            print(f"[NOTIFICATION] Title: {title}")
            print(f"[NOTIFICATION] Body: {body}")
            notification.status = 'sent'
            notification.fcm_message_id = 'debug-mode'
            notification.sent_at = timezone.now()
            notification.save()
            return notification

        payload = {
            'to': user.fcm_token,
            'notification': {
                'title': title,
                'body': body,
                'sound': 'default',
            },
            'data': data,
            'priority': 'high',
        }
        headers = {
            'Authorization': f'key={settings.FCM_SERVER_KEY}',
            'Content-Type': 'application/json',
        }

        try:
            response = requests.post(
                'https://fcm.googleapis.com/fcm/send',
                json=payload,
                headers=headers,
                timeout=10,
            )
            result = response.json()
            if result.get('results') and result['results'][0].get('message_id'):
                notification.status = 'sent'
                notification.fcm_message_id = result['results'][0]['message_id']
                notification.sent_at = timezone.now()
            else:
                notification.status = 'failed'
                notification.failure_reason = str(
                    result.get('results', [{}])[0].get('error', 'Unknown FCM error')
                )
        except Exception as e:
            notification.status = 'failed'
            notification.failure_reason = str(e)

        notification.save()
        return notification

    def send_alert_notification(self, alert):
        emoji_map = {
            'critical': '🔴',
            'warning': '⚠️',
            'info': '💡',
        }
        emoji = emoji_map.get(alert.level, '💡')
        title = f"{emoji} {alert.title}"
        body = alert.message[:150]
        data = {
            'alert_id': str(alert.id),
            'plot_id': str(alert.plot.id),
            'level': alert.level,
            'category': alert.category,
            'type': 'farm_alert',
        }
        notification = self.send_push(alert.user, title, body, data)
        notification.alert = alert
        notification.save()
        return notification
