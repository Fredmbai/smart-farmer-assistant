from django.urls import path

from .views import NotificationListView, NotificationStatsView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('stats/', NotificationStatsView.as_view(), name='notification-stats'),
]
