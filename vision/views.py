from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from farms.models import Plot

from .inference import PotatoDiseaseClassifier
from .models import VisionScan
from .serializers import VisionScanSerializer


class VisionScanView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        plot_id = request.data.get('plot')
        image = request.FILES.get('image')

        if not plot_id or not image:
            return Response(
                {'detail': 'plot and image are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plot = Plot.objects.filter(id=plot_id, farm__user=request.user).first()
        if not plot:
            return Response(
                {'detail': 'Plot not found or access denied.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        scan = VisionScan.objects.create(
            plot=plot,
            user=request.user,
            image=image,
            diagnosis='unknown',
            confidence=0.0,
            recommendation='',
        )

        result = PotatoDiseaseClassifier().predict(scan.image.path)

        scan.diagnosis = result['diagnosis']
        scan.confidence = result['confidence']
        scan.recommendation = result['recommendation']
        scan.model_version = result['model_version']
        scan.save()

        if result['diagnosis'] in ('late_blight', 'early_blight'):
            self._create_disease_alert(scan, plot, request.user, result)

        try:
            from engine.tasks import run_engine_for_plot
            run_engine_for_plot.delay(str(plot.id))
        except Exception:
            pass

        return Response(VisionScanSerializer(scan).data, status=status.HTTP_201_CREATED)

    def _create_disease_alert(self, scan, plot, user, result):
        from engine.models import Alert
        diagnosis = result['diagnosis']
        Alert.objects.create(
            analysis=None,
            plot=plot,
            user=user,
            level='critical' if diagnosis == 'late_blight' else 'warning',
            category='disease',
            title=f"Disease detected: {diagnosis.replace('_', ' ').title()}",
            message=result['recommendation'],
            action_required='Inspect and treat affected plants immediately',
        )


class VisionScanHistoryView(ListAPIView):
    serializer_class = VisionScanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return VisionScan.objects.filter(
            plot_id=self.kwargs['plot_id'],
            plot__farm__user=self.request.user,
        ).order_by('-created_at')


class VisionScanDetailView(RetrieveAPIView):
    serializer_class = VisionScanSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return VisionScan.objects.filter(
            id=self.kwargs['scan_id'],
            user=self.request.user,
        ).first()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not instance:
            return Response({'detail': 'Scan not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(instance).data)
