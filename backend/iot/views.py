from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from farms.models import Plot

from .models import Sensor, SensorReading
from .serializers import ManualReadingSerializer, SensorReadingSerializer, SensorSerializer


class SensorViewSet(ModelViewSet):
    serializer_class = SensorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Sensor.objects.filter(plot__farm__user=self.request.user)
        plot_id = self.kwargs.get('plot_id')
        if plot_id:
            qs = qs.filter(plot_id=plot_id)
        return qs

    def perform_create(self, serializer):
        plot = Plot.objects.get(
            id=self.kwargs['plot_id'],
            farm__user=self.request.user,
        )
        serializer.save(plot=plot)


class SensorReadingListView(ListAPIView):
    serializer_class = SensorReadingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SensorReading.objects.filter(
            plot_id=self.kwargs['plot_id'],
            plot__farm__user=self.request.user,
        ).order_by('-timestamp')[:50]


class LatestReadingView(RetrieveAPIView):
    serializer_class = SensorReadingSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return SensorReading.objects.filter(
            plot_id=self.kwargs['plot_id'],
            plot__farm__user=self.request.user,
        ).order_by('-timestamp').first()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance is None:
            return Response(
                {'detail': 'No readings found for this plot.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(self.get_serializer(instance).data)


class ManualReadingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ManualReadingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        plot = Plot.objects.filter(
            id=data['plot'],
            farm__user=request.user,
        ).first()
        if not plot:
            return Response(
                {'detail': 'Plot not found or access denied.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        reading = SensorReading.objects.create(
            plot=plot,
            source='manual',
            moisture=data.get('moisture'),
            ph=data.get('ph'),
            temperature=data.get('temperature'),
            humidity=data.get('humidity'),
            npk_n=data.get('npk_n'),
            npk_p=data.get('npk_p'),
            npk_k=data.get('npk_k'),
        )

        try:
            from engine.tasks import run_engine_for_plot
            run_engine_for_plot.delay(str(plot.id))
        except Exception:
            pass

        return Response(
            SensorReadingSerializer(reading).data,
            status=status.HTTP_201_CREATED,
        )
