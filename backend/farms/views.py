from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import CropCycle, Farm, Plot
from .serializers import CropCycleSerializer, FarmSerializer, PlotSerializer


class FarmViewSet(ModelViewSet):
    serializer_class = FarmSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'farm_id'

    def get_queryset(self):
        return Farm.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PlotViewSet(ModelViewSet):
    serializer_class = PlotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Plot.objects.filter(
            farm__user=self.request.user,
            farm_id=self.kwargs['farm_id'],
        )

    def perform_create(self, serializer):
        farm = Farm.objects.get(
            id=self.kwargs['farm_id'],
            user=self.request.user,
        )
        serializer.save(farm=farm)


class CropCycleViewSet(ModelViewSet):
    serializer_class = CropCycleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CropCycle.objects.filter(
            plot__farm__user=self.request.user,
            plot_id=self.kwargs['plot_id'],
        )

    def perform_create(self, serializer):
        plot = Plot.objects.get(
            id=self.kwargs['plot_id'],
            farm__user=self.request.user,
        )
        serializer.save(plot=plot)
