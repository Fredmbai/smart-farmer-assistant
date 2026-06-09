from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from farms.models import Farm

from .models import WeatherData
from .serializers import WeatherDataSerializer
from .services import WeatherService


class LatestWeatherView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, farm_id):
        farm = Farm.objects.filter(id=farm_id, user=request.user).first()
        if not farm:
            return Response(
                {'detail': 'Farm not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        weather = WeatherData.objects.filter(farm=farm).first()

        if not weather:
            weather = WeatherService().fetch_for_farm(farm)

        if not weather:
            return Response(
                {'detail': 'No weather data available for this farm.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(WeatherDataSerializer(weather).data)


class RefreshWeatherView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, farm_id):
        farm = Farm.objects.filter(id=farm_id, user=request.user).first()
        if not farm:
            return Response(
                {'detail': 'Farm not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        weather = WeatherService().fetch_for_farm(farm)
        if not weather:
            return Response(
                {'detail': 'No weather data available for this farm.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(WeatherDataSerializer(weather).data, status=status.HTTP_200_OK)


class WeatherSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, farm_id):
        farm = Farm.objects.filter(id=farm_id, user=request.user).first()
        if not farm:
            return Response(
                {'detail': 'Farm not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        summary = WeatherService().get_weather_summary(farm)
        if not summary:
            return Response(
                {'detail': 'No weather data available for this farm.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(summary)
