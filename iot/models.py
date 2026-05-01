import uuid

from django.db import models
from django.utils import timezone


class Sensor(models.Model):
    SENSOR_TYPE_CHOICES = [
        ('moisture', 'Moisture'),
        ('ph', 'Soil pH'),
        ('temperature', 'Temperature'),
        ('humidity', 'Humidity'),
        ('npk', 'NPK'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plot = models.ForeignKey(
        'farms.Plot', on_delete=models.CASCADE, related_name='sensors'
    )
    sensor_type = models.CharField(max_length=20, choices=SENSOR_TYPE_CHOICES)
    device_id = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    mqtt_topic = models.CharField(max_length=200, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.mqtt_topic = (
            f"smartfarmer/{self.plot.farm.id}/{self.plot.id}/{self.sensor_type}"
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.sensor_type} sensor on {self.plot}"


class SensorReading(models.Model):
    SOURCE_CHOICES = [
        ('mqtt', 'MQTT Sensor'),
        ('manual', 'Manual Entry'),
        ('simulator', 'Simulator'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plot = models.ForeignKey(
        'farms.Plot', on_delete=models.CASCADE, related_name='sensor_readings'
    )
    moisture = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ph = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    humidity = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    npk_n = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    npk_p = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    npk_k = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='mqtt')
    raw_payload = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Reading for {self.plot} at {self.timestamp}"
