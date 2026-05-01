from rest_framework import serializers

from .models import CropCycle, Farm, Plot


class CropCycleSerializer(serializers.ModelSerializer):
    days_since_planting = serializers.ReadOnlyField()
    growth_stage = serializers.ReadOnlyField()

    class Meta:
        model = CropCycle
        fields = [
            'id', 'plot', 'planting_date', 'expected_harvest_date',
            'actual_harvest_date', 'variety', 'status', 'notes',
            'days_since_planting', 'growth_stage', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'plot', 'created_at', 'updated_at']


class PlotSerializer(serializers.ModelSerializer):
    active_cycle = serializers.SerializerMethodField()

    class Meta:
        model = Plot
        fields = [
            'id', 'farm', 'name', 'size_acres', 'crop', 'variety',
            'active_cycle', 'created_at',
        ]
        read_only_fields = ['id', 'farm', 'created_at']

    def get_active_cycle(self, obj):
        cycle = obj.cycles.filter(status='active').order_by('-created_at').first()
        return str(cycle.id) if cycle else None


class FarmSerializer(serializers.ModelSerializer):
    class Meta:
        model = Farm
        fields = [
            'id', 'user', 'name', 'latitude', 'longitude',
            'county', 'sub_county', 'altitude', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
