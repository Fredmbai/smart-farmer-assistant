from rest_framework import serializers

from .models import Alert, EngineAnalysis


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = [
            'id', 'analysis', 'plot', 'user', 'level', 'category',
            'title', 'message', 'action_required',
            'is_read', 'is_dismissed', 'created_at',
        ]
        read_only_fields = ['id', 'analysis', 'plot', 'user', 'created_at']


class EngineAnalysisSerializer(serializers.ModelSerializer):
    alerts = AlertSerializer(many=True, read_only=True)

    class Meta:
        model = EngineAnalysis
        fields = [
            'id', 'plot', 'crop_cycle', 'sensor_reading', 'weather_data',
            'health_score', 'health_status', 'growth_stage',
            'xgboost_prediction', 'xgboost_confidence',
            'rule_triggered', 'rule_name', 'feature_vector',
            'alerts', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
