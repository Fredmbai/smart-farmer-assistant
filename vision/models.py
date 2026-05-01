import uuid

from django.conf import settings
from django.db import models


class VisionScan(models.Model):
    DIAGNOSIS_CHOICES = [
        ('healthy', 'Healthy'),
        ('early_blight', 'Early Blight'),
        ('late_blight', 'Late Blight'),
        ('unknown', 'Unknown'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plot = models.ForeignKey(
        'farms.Plot', on_delete=models.CASCADE, related_name='vision_scans'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='vision_scans'
    )
    image = models.ImageField(upload_to='vision_scans/%Y/%m/%d/')
    diagnosis = models.CharField(max_length=50, choices=DIAGNOSIS_CHOICES)
    confidence = models.DecimalField(max_digits=5, decimal_places=4)
    recommendation = models.TextField()
    model_version = models.CharField(max_length=50, default='mock_v1')
    fed_to_engine = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Scan {self.plot} — {self.diagnosis} ({self.confidence})"
