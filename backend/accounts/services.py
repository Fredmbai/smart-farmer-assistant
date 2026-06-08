import random
import string
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from .models import OTPVerification


class WhatsAppOTPService:

    @staticmethod
    def generate_otp():
        return ''.join(random.choices(string.digits, k=6))

    @classmethod
    def send_otp(cls, phone_number):
        otp = cls.generate_otp()

        OTPVerification.objects.create(
            phone_number=phone_number,
            otp_code=otp,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        if settings.DEBUG:
            print('=' * 50)
            print(f'DEBUG OTP for {phone_number}: {otp}')
            print('=' * 50)
            return otp

        url = f'https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_ID}/messages'
        headers = {
            'Authorization': f'Bearer {settings.WHATSAPP_TOKEN}',
            'Content-Type': 'application/json',
        }
        payload = {
            'messaging_product': 'whatsapp',
            'to': phone_number,
            'type': 'text',
            'text': {'body': f'Your Smart Farmer OTP is: {otp}. Valid for 10 minutes.'},
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            return response.status_code == 200
        except requests.RequestException:
            return False

    @staticmethod
    def verify_otp(phone_number, otp_code):
        try:
            record = OTPVerification.objects.filter(
                phone_number=phone_number,
                otp_code=otp_code,
                is_used=False,
            ).latest('created_at')
        except OTPVerification.DoesNotExist:
            return False

        if not record.is_valid():
            return False

        record.is_used = True
        record.save()
        return True
