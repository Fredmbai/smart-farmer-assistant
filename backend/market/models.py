import uuid

from django.conf import settings
from django.db import models


class MarketPrice(models.Model):
    SOURCE_CHOICES = [
        ('manual', 'Manual Entry'),
        ('farmer_report', 'Farmer Report'),
        ('scraped', 'Scraped'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    crop = models.CharField(max_length=50, default='potato')
    price_per_kg = models.DecimalField(max_digits=8, decimal_places=2)
    market_name = models.CharField(max_length=100)
    county = models.CharField(max_length=50)
    price_date = models.DateField()
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='price_reports',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-price_date']

    def __str__(self):
        return f"{self.crop} @ KES {self.price_per_kg}/kg — {self.market_name} ({self.price_date})"
