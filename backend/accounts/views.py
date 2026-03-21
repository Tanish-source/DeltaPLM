from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

from .serializers import (
    UserRegistrationSerializer, 
    UserDetailSerializer, 
    UserRoleUpdateSerializer
)
from .permissions import IsAdmin

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """
    API endpoint to register a new user. Role is forced to ENGINEERING internally.
    """
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer


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
