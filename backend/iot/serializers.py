from rest_framework import serializers

from .models import Sensor, SensorReading


class SensorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sensor
        fields = [
            'id', 'plot', 'sensor_type', 'device_id', 'label',
            'is_active', 'mqtt_topic', 'created_at',
        ]
        read_only_fields = ['id', 'plot', 'mqtt_topic', 'created_at']


class SensorReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SensorReading
        fields = [
            'id', 'plot', 'moisture', 'ph', 'temperature', 'humidity',
            'npk_n', 'npk_p', 'npk_k', 'source', 'raw_payload',
            'timestamp', 'created_at',
        ]
        read_only_fields = ['id', 'plot', 'created_at']


class ManualReadingSerializer(serializers.Serializer):
    plot = serializers.UUIDField()
    moisture = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)
    ph = serializers.DecimalField(max_digits=4, decimal_places=2, required=False, allow_null=True)
    temperature = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)
    humidity = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)
    npk_n = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    npk_p = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    npk_k = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)

    SENSOR_FIELDS = ['moisture', 'ph', 'temperature', 'humidity', 'npk_n', 'npk_p', 'npk_k']

    def validate(self, attrs):
        has_value = any(attrs.get(f) is not None for f in self.SENSOR_FIELDS)
        if not has_value:
            raise serializers.ValidationError(
                'At least one sensor value must be provided.'
            )
        return attrs
