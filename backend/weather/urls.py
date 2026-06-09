from django.urls import path

from .views import LatestWeatherView, RefreshWeatherView, WeatherSummaryView

urlpatterns = [
    path('<uuid:farm_id>/',          LatestWeatherView.as_view(),   name='weather-latest'),
    path('<uuid:farm_id>/refresh/',  RefreshWeatherView.as_view(),  name='weather-refresh'),
    path('<uuid:farm_id>/summary/',  WeatherSummaryView.as_view(),  name='weather-summary'),
]
