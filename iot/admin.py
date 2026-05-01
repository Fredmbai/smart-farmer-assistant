from django.contrib import admin

from .models import Sensor, SensorReading


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ['device_id', 'sensor_type', 'plot', 'is_active', 'mqtt_topic']


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display = ['plot', 'source', 'moisture', 'ph', 'temperature', 'timestamp']
