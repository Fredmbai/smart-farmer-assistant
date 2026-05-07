from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from engine.models import Alert

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs


class NotificationStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = Notification.objects.filter(user=user)
        unread_alerts = Alert.objects.filter(user=user, is_read=False).count()
        return Response({
            'total': qs.count(),
            'sent': qs.filter(status='sent').count(),
            'failed': qs.filter(status='failed').count(),
            'unread_alerts': unread_alerts,
        })
