from django.urls import path

from .views import (
    LatestReadingView,
    ManualReadingView,
    SensorReadingListView,
    SensorViewSet,
)

sensor_list   = SensorViewSet.as_view({'get': 'list',    'post': 'create'})
sensor_detail = SensorViewSet.as_view({'get': 'retrieve', 'put': 'update',
                                       'patch': 'partial_update', 'delete': 'destroy'})

urlpatterns = [
    path('sensors/plots/<uuid:plot_id>/',    sensor_list,            name='sensor-list'),
    path('sensors/<uuid:sensor_id>/',        sensor_detail,          name='sensor-detail'),
    path('readings/manual/',                 ManualReadingView.as_view(),     name='reading-manual'),
    path('readings/<uuid:plot_id>/latest/',  LatestReadingView.as_view(),     name='reading-latest'),
    path('readings/<uuid:plot_id>/',         SensorReadingListView.as_view(), name='reading-list'),
]
