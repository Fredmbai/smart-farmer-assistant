from rest_framework import serializers

from .models import MarketPrice


class MarketPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketPrice
        fields = [
            'id', 'crop', 'price_per_kg', 'market_name', 'county',
            'price_date', 'source', 'reported_by', 'created_at',
        ]
        read_only_fields = ['id', 'reported_by', 'created_at']


class MarketPriceTrendSerializer(serializers.Serializer):
    crop = serializers.CharField()
    current_price = serializers.DecimalField(max_digits=8, decimal_places=2)
    avg_price_30_days = serializers.DecimalField(max_digits=8, decimal_places=2)
    price_trend = serializers.CharField()
    best_market = serializers.CharField()
    price_date = serializers.DateField()


class FarmerPriceReportSerializer(serializers.Serializer):
    crop = serializers.CharField(max_length=50, default='potato')
    price_per_kg = serializers.DecimalField(max_digits=8, decimal_places=2)
    market_name = serializers.CharField(max_length=100)
    county = serializers.CharField(max_length=50)
    price_date = serializers.DateField()
