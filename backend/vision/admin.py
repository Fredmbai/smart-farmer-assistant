from django.contrib import admin

from .models import VisionScan


@admin.register(VisionScan)
class VisionScanAdmin(admin.ModelAdmin):
    list_display = ['plot', 'user', 'diagnosis', 'confidence', 'model_version', 'created_at']
