from django.contrib import admin

from .models import WeatherData


@admin.register(WeatherData)
class WeatherDataAdmin(admin.ModelAdmin):
    list_display = [
        'farm', 'temperature_current', 'condition',
        'rainfall_probability_48h', 'frost_probability', 'fetched_at',
    ]
