import phonenumbers
from phonenumbers import NumberParseException
from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    full_name = serializers.CharField(max_length=100)
    password = serializers.CharField(write_only=True)
    county = serializers.CharField(max_length=50, required=False, allow_blank=True)

    def validate_phone_number(self, value):
        try:
            parsed = phonenumbers.parse(value, 'KE')
            if not phonenumbers.is_valid_number(parsed):
                raise serializers.ValidationError('Invalid phone number.')
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except NumberParseException:
            raise serializers.ValidationError('Invalid phone number format.')

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters.')
        return value


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    otp = serializers.CharField(max_length=6)


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'phone_number', 'full_name', 'county', 'role', 'fcm_token', 'created_at']
        read_only_fields = ['id', 'phone_number', 'role', 'created_at']
