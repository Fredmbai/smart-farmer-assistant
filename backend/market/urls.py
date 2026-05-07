from django.urls import path

from .views import (
    FarmerPriceReportView,
    MarketPriceTrendView,
    MarketPricesView,
)

urlpatterns = [
    path('prices/trend/',          MarketPriceTrendView.as_view(),   name='market-trend'),
    path('prices/farmer-report/',  FarmerPriceReportView.as_view(),  name='market-farmer-report'),
    path('prices/',                MarketPricesView.as_view(),       name='market-prices'),
]
