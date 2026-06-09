from django.urls import path

from .views import CropCycleViewSet, FarmViewSet, PlotViewSet, SoilDataView

farm_list   = FarmViewSet.as_view({'get': 'list',   'post': 'create'})
farm_detail = FarmViewSet.as_view({'get': 'retrieve', 'put': 'update',
                                   'patch': 'partial_update', 'delete': 'destroy'})

plot_list   = PlotViewSet.as_view({'get': 'list',   'post': 'create'})
plot_detail = PlotViewSet.as_view({'get': 'retrieve', 'put': 'update',
                                   'patch': 'partial_update', 'delete': 'destroy'})

cycle_list   = CropCycleViewSet.as_view({'get': 'list',   'post': 'create'})
cycle_detail = CropCycleViewSet.as_view({'get': 'retrieve', 'put': 'update',
                                         'patch': 'partial_update', 'delete': 'destroy'})

urlpatterns = [
    path('',                                                          farm_list),
    path('<uuid:farm_id>/',                                           farm_detail),
    path('<uuid:farm_id>/soil-data/',                                 SoilDataView.as_view(), name='farm-soil-data'),
    path('<uuid:farm_id>/plots/',                                     plot_list),
    path('<uuid:farm_id>/plots/<uuid:plot_id>/',                      plot_detail),
    path('<uuid:farm_id>/plots/<uuid:plot_id>/cycles/',               cycle_list),
    path('<uuid:farm_id>/plots/<uuid:plot_id>/cycles/<uuid:pk>/',     cycle_detail),
]
