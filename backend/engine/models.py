import uuid

from django.conf import settings
from django.db import models


class EngineAnalysis(models.Model):
    HEALTH_STATUS_CHOICES = [
        ('critical', 'Critical'),
        ('warning', 'Warning'),
        ('healthy', 'Healthy'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plot = models.ForeignKey(
        'farms.Plot', on_delete=models.CASCADE, related_name='analyses'
    )
    crop_cycle = models.ForeignKey(
        'farms.CropCycle', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='analyses'
    )
    sensor_reading = models.ForeignKey(
        'iot.SensorReading', on_delete=models.SET_NULL, null=True, blank=True
    )
    weather_data = models.ForeignKey(
        'weather.WeatherData', on_delete=models.SET_NULL, null=True, blank=True
    )
    health_score = models.IntegerField()
    health_status = models.CharField(max_length=20, choices=HEALTH_STATUS_CHOICES)
    growth_stage = models.CharField(max_length=20, blank=True)
    xgboost_prediction = models.CharField(max_length=50, blank=True)
    xgboost_confidence = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True
    )
    rule_triggered = models.BooleanField(default=False)
    rule_name = models.CharField(max_length=100, blank=True)
    feature_vector = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Analysis for {self.plot} — {self.health_status} ({self.created_at})"


class Alert(models.Model):
    LEVEL_CHOICES = [
        ('critical', 'Critical'),
        ('warning', 'Warning'),
        ('info', 'Info'),
    ]
    CATEGORY_CHOICES = [
        ('irrigation', 'Irrigation'),
        ('fertilizer', 'Fertilizer'),
        ('disease', 'Disease'),
        ('pest', 'Pest'),
        ('harvest', 'Harvest'),
        ('weather', 'Weather'),
        ('general', 'General'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    analysis = models.ForeignKey(
        EngineAnalysis, on_delete=models.CASCADE,
        related_name='alerts', null=True, blank=True
    )
    plot = models.ForeignKey(
        'farms.Plot', on_delete=models.CASCADE, related_name='alerts'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alerts'
    )
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    action_required = models.TextField(blank=True)
    is_read = models.BooleanField(default=False)
    is_dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=Alert)
def alert_created(sender, instance, created, **kwargs):
    if created:
        from notifications.tasks import send_alert_notification_task
        send_alert_notification_task.delay(str(instance.id))
