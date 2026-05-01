from django.contrib import admin

from .models import MarketPrice


@admin.register(MarketPrice)
class MarketPriceAdmin(admin.ModelAdmin):
    list_display = [
        'crop', 'price_per_kg', 'market_name',
        'county', 'price_date', 'source', 'reported_by',
    ]
