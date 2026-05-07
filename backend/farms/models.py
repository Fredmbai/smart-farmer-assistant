import uuid
from datetime import date, timedelta

from django.conf import settings
from django.db import models


class Farm(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='farms'
    )
    name = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    county = models.CharField(max_length=50)
    sub_county = models.CharField(max_length=50, blank=True)
    altitude = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


VARIETY_CHOICES = [
    ('shangi', 'Shangi'),
    ('dutch_robijn', 'Dutch Robijn'),
    ('kenya_mpya', 'Kenya Mpya'),
    ('tigoni', 'Tigoni'),
    ('other', 'Other'),
]


class Plot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name='plots')
    name = models.CharField(max_length=100)
    size_acres = models.DecimalField(max_digits=6, decimal_places=2)
    crop = models.CharField(max_length=50, default='potato')
    variety = models.CharField(max_length=50, blank=True, choices=VARIETY_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.farm.name} - {self.name}"


class CropCycle(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('harvested', 'Harvested'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plot = models.ForeignKey(Plot, on_delete=models.CASCADE, related_name='cycles')
    planting_date = models.DateField(null=True, blank=True)
    expected_harvest_date = models.DateField(null=True, blank=True)
    actual_harvest_date = models.DateField(null=True, blank=True)
    variety = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.planting_date:
            if self.status == 'pending':
                self.status = 'active'
            if self.expected_harvest_date is None:
                self.expected_harvest_date = self.planting_date + timedelta(days=120)
        super().save(*args, **kwargs)

    @property
    def days_since_planting(self):
        if not self.planting_date:
            return None
        return (date.today() - self.planting_date).days

    @property
    def growth_stage(self):
        if not self.planting_date:
            return 'unknown'
        days = self.days_since_planting
        if days < 0:
            return 'not_planted'
        if days <= 30:
            return 'sprouting'
        if days <= 60:
            return 'vegetative'
        if days <= 90:
            return 'flowering'
        if days <= 120:
            return 'tuber_bulking'
        return 'maturity'

    def __str__(self):
        return f"{self.plot} cycle ({self.status})"
