from django.urls import path

from .views import (
    AlertListView,
    DismissAlertView,
    LatestAnalysisView,
    MarkAlertReadView,
    RunAnalysisView,
)

urlpatterns = [
    path('analyze/<uuid:plot_id>/',           RunAnalysisView.as_view(),    name='engine-analyze'),
    path('analysis/<uuid:plot_id>/latest/',   LatestAnalysisView.as_view(), name='engine-latest'),
    path('alerts/',                           AlertListView.as_view(),      name='engine-alerts'),
    path('alerts/<uuid:alert_id>/read/',      MarkAlertReadView.as_view(),  name='engine-alert-read'),
    path('alerts/<uuid:alert_id>/dismiss/',   DismissAlertView.as_view(),   name='engine-alert-dismiss'),
]
