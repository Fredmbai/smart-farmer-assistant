from django.urls import path

from .views import VisionScanDetailView, VisionScanHistoryView, VisionScanView

urlpatterns = [
    path('scan/',                          VisionScanView.as_view(),        name='vision-scan'),
    path('scans/<uuid:plot_id>/',          VisionScanHistoryView.as_view(), name='vision-history'),
    path('scans/detail/<uuid:scan_id>/',   VisionScanDetailView.as_view(),  name='vision-detail'),
]
