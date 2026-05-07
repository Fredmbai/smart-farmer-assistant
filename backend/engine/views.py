from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from farms.models import Plot

from .models import Alert, EngineAnalysis
from .serializers import AlertSerializer, EngineAnalysisSerializer


class RunAnalysisView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, plot_id):
        plot = Plot.objects.filter(id=plot_id, farm__user=request.user).first()
        if not plot:
            return Response({'detail': 'Plot not found.'}, status=status.HTTP_404_NOT_FOUND)

        from engine.decision_engine import DecisionEngine
        result = DecisionEngine().run_analysis(plot)
        return Response(result, status=status.HTTP_200_OK)


class LatestAnalysisView(RetrieveAPIView):
    serializer_class = EngineAnalysisSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return (
            EngineAnalysis.objects
            .filter(plot_id=self.kwargs['plot_id'],
                    plot__farm__user=self.request.user)
            .prefetch_related('alerts')
            .first()
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not instance:
            return Response({'detail': 'No analysis found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(instance).data)


class AlertListView(ListAPIView):
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Alert.objects.filter(
            user=self.request.user,
            is_dismissed=False,
        ).order_by('-created_at')


class MarkAlertReadView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, alert_id):
        alert = Alert.objects.filter(id=alert_id, user=request.user).first()
        if not alert:
            return Response({'detail': 'Alert not found.'}, status=status.HTTP_404_NOT_FOUND)
        alert.is_read = True
        alert.save()
        return Response(AlertSerializer(alert).data)


class DismissAlertView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, alert_id):
        alert = Alert.objects.filter(id=alert_id, user=request.user).first()
        if not alert:
            return Response({'detail': 'Alert not found.'}, status=status.HTTP_404_NOT_FOUND)
        alert.is_dismissed = True
        alert.save()
        return Response(AlertSerializer(alert).data)
