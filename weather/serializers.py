from rest_framework import serializers

from .models import WeatherData


class WeatherDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeatherData
        fields = [
            'id', 'farm', 'temperature_current', 'humidity',
            'rainfall_probability_24h', 'rainfall_probability_48h',
            'rainfall_mm_expected', 'wind_speed', 'frost_probability',
            'condition', 'fetched_at',
        ]
        read_only_fields = ['id', 'farm', 'fetched_at']
