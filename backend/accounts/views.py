from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

from .serializers import (
    UserRegistrationSerializer, 
    UserDetailSerializer, 
    UserRoleUpdateSerializer,
    ForgotPasswordSerializer
)
from .permissions import IsAdmin

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """
    API endpoint to register a new user.
    Enforces: username 6-12 chars unique, email unique,
    password >= 8 chars with lowercase, uppercase, special char.
    """
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer


class ForgotPasswordView(APIView):
    """
    Simulated forgot-password endpoint.
    Validates email exists, returns success (no real email sent in hackathon demo).
    """
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if serializer.is_valid():
            # In a real app, send a password reset email here
            return Response(
                {'message': 'Password reset instructions have been sent to your email.'},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    """
    Returns details of the currently authenticated user.
    """
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)


class UserListView(generics.ListAPIView):
    """
    Admin-only endpoint to list all users.
    """
    queryset = User.objects.all().order_by('username')
    permission_classes = (IsAuthenticated, IsAdmin)
    serializer_class = UserDetailSerializer


class UserRoleUpdateView(generics.UpdateAPIView):
    """
    Admin-only endpoint to change a user's role.
    """
    queryset = User.objects.all()
    permission_classes = (IsAuthenticated, IsAdmin)
    serializer_class = UserRoleUpdateSerializer
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Return the full updated user details
        detail_serializer = UserDetailSerializer(instance)
        return Response(detail_serializer.data)
