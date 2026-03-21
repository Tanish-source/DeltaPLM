from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    # Auth endpoints
    path('register/', views.RegisterView.as_view(), name='auth_register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', views.CurrentUserView.as_view(), name='auth_me'),
    
    # User management / Admin endpoints
    path('users/', views.UserListView.as_view(), name='admin_user_list'),
    path('users/<int:pk>/role/', views.UserRoleUpdateView.as_view(), name='admin_user_role_update'),
]
