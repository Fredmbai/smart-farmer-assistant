from datetime import date, timedelta

from django.db.models import Avg
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MarketPrice
from .serializers import (
    FarmerPriceReportSerializer,
    MarketPriceSerializer,
    MarketPriceTrendSerializer,
)


class MarketPriceListView(ListAPIView):
    serializer_class = MarketPriceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        crop = self.request.query_params.get('crop')
        qs = MarketPrice.objects.all()
        if crop:
            qs = qs.filter(crop=crop)
        return qs.order_by('-price_date')[:30]


class MarketPriceTrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        crop = request.query_params.get('crop', 'potato')
        today = date.today()
        since_30 = today - timedelta(days=30)
        since_7 = today - timedelta(days=7)

        latest = (
            MarketPrice.objects.filter(crop=crop)
            .order_by('-price_date')
            .first()
        )
        if not latest:
            return Response(
                {'detail': 'No price data available.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        avg_result = MarketPrice.objects.filter(
            crop=crop, price_date__gte=since_30
        ).aggregate(avg=Avg('price_per_kg'))
        avg_price = avg_result['avg'] or latest.price_per_kg

        current = float(latest.price_per_kg)
        avg = float(avg_price)
        if current > avg * 1.05:
            trend = 'rising'
        elif current < avg * 0.95:
            trend = 'falling'
        else:
            trend = 'stable'

        best = (
            MarketPrice.objects.filter(crop=crop, price_date__gte=since_7)
            .order_by('-price_per_kg')
            .first()
        )
        best_market = best.market_name if best else latest.market_name

        data = {
            'crop': crop,
            'current_price': latest.price_per_kg,
            'avg_price_30_days': round(avg_price, 2),
            'price_trend': trend,
            'best_market': best_market,
            'price_date': latest.price_date,
        }
        return Response(MarketPriceTrendSerializer(data).data)


class FarmerPriceReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FarmerPriceReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        price = MarketPrice.objects.create(
            crop=data.get('crop', 'potato'),
            price_per_kg=data['price_per_kg'],
            market_name=data['market_name'],
            county=data['county'],
            price_date=data['price_date'],
            source='farmer_report',
            reported_by=request.user,
        )
        return Response(MarketPriceSerializer(price).data, status=status.HTTP_201_CREATED)


class MarketPricesView(APIView):
    """GET (public list) + POST (admin create) on /market/prices/."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdminUser()]
        return [AllowAny()]

    def get(self, request):
        crop = request.query_params.get('crop')
        qs = MarketPrice.objects.all()
        if crop:
            qs = qs.filter(crop=crop)
        qs = qs.order_by('-price_date')[:30]
        return Response(MarketPriceSerializer(qs, many=True).data)

    def post(self, request):
        serializer = MarketPriceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        price = serializer.save()
        return Response(MarketPriceSerializer(price).data, status=status.HTTP_201_CREATED)
