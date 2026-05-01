from django.urls import path

from .views import LatestWeatherView, RefreshWeatherView

urlpatterns = [
    path('<uuid:farm_id>/',          LatestWeatherView.as_view(),   name='weather-latest'),
    path('<uuid:farm_id>/refresh/',  RefreshWeatherView.as_view(),  name='weather-refresh'),
]
