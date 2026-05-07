from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'alert', 'title', 'body', 'data',
            'fcm_message_id', 'status', 'failure_reason',
            'sent_at', 'created_at',
        ]
        read_only_fields = ['id', 'user', 'fcm_message_id', 'sent_at', 'created_at']
