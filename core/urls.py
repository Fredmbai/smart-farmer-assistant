from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/farms/', include('farms.urls')),
    path('api/iot/', include('iot.urls')),
    path('api/weather/', include('weather.urls')),
    path('api/engine/', include('engine.urls')),
    path('api/vision/', include('vision.urls')),
    path('api/market/', include('market.urls')),
    path('api/notifications/', include('notifications.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
