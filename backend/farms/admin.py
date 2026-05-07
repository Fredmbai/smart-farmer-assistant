from django.contrib import admin

from .models import CropCycle, Farm, Plot


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'county', 'created_at']


@admin.register(Plot)
class PlotAdmin(admin.ModelAdmin):
    list_display = ['name', 'farm', 'crop', 'variety', 'size_acres']


@admin.register(CropCycle)
class CropCycleAdmin(admin.ModelAdmin):
    list_display = [
        'plot', 'status', 'planting_date',
        'growth_stage', 'days_since_planting', 'expected_harvest_date',
    ]
