from django.contrib import admin

from .models import Alert, EngineAnalysis


@admin.register(EngineAnalysis)
class EngineAnalysisAdmin(admin.ModelAdmin):
    list_display = [
        'plot', 'health_score', 'health_status',
        'xgboost_prediction', 'rule_triggered', 'created_at',
    ]


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = [
        'plot', 'user', 'level', 'category',
        'title', 'is_read', 'is_dismissed', 'created_at',
    ]
