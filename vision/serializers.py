from rest_framework import serializers

from .models import VisionScan


class VisionScanSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisionScan
        fields = [
            'id', 'plot', 'user', 'image', 'diagnosis', 'confidence',
            'recommendation', 'model_version', 'fed_to_engine', 'created_at',
        ]
        read_only_fields = [
            'id', 'user', 'diagnosis', 'confidence',
            'recommendation', 'model_version', 'fed_to_engine', 'created_at',
        ]
