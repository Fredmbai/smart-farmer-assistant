import uuid

from django.db import models


class WeatherData(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(
        'farms.Farm', on_delete=models.CASCADE, related_name='weather_data'
    )
    temperature_current = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    humidity = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    rainfall_probability_24h = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    rainfall_probability_48h = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    rainfall_mm_expected = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    wind_speed = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    frost_probability = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.0
    )
    condition = models.CharField(max_length=50, blank=True)
    raw_current = models.JSONField(null=True, blank=True)
    raw_forecast = models.JSONField(null=True, blank=True)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fetched_at']

    def __str__(self):
        return f"Weather for {self.farm.name} at {self.fetched_at}"
