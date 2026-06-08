from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    VerifyOTPSerializer,
)
from .services import WhatsAppOTPService


def _make_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        phone_number = data['phone_number']

        if User.objects.filter(phone_number=phone_number, is_active=True).exists():
            return Response(
                {'error': 'Phone number already registered.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user, _ = User.objects.update_or_create(
            phone_number=phone_number,
            defaults={
                'full_name': data['full_name'],
                'county': data.get('county', ''),
                'is_active': False,
            },
        )
        user.set_password(data['password'])
        user.save()

        otp_result = WhatsAppOTPService.send_otp(phone_number)
        response_data = {'message': f'OTP sent to {phone_number}'}
        if settings.DEBUG:
            response_data['debug_otp'] = otp_result
        return Response(response_data, status=status.HTTP_201_CREATED)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        phone_number = data['phone_number']

        try:
            user = User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not WhatsAppOTPService.verify_otp(phone_number, data['otp']):
            return Response(
                {'error': 'Invalid or expired OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = True
        user.save()

        return Response(
            {**_make_tokens(user), 'user': UserProfileSerializer(user).data},
            status=status.HTTP_200_OK,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            user = User.objects.get(phone_number=data['phone_number'])
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(data['password']):
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'error': 'Account not verified.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(
            {**_make_tokens(user), 'user': UserProfileSerializer(user).data},
            status=status.HTTP_200_OK,
        )


class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone_number = request.data.get('phone_number')
        if not phone_number:
            return Response(
                {'error': 'phone_number is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        otp_result = WhatsAppOTPService.send_otp(phone_number)
        response_data = {'message': 'OTP resent.'}
        if settings.DEBUG:
            response_data['debug_otp'] = otp_result
        return Response(response_data, status=status.HTTP_200_OK)


class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
