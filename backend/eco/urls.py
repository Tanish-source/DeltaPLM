from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ECOViewSet, StageViewSet

router = DefaultRouter()
router.register(r'ecos', ECOViewSet)
router.register(r'stages', StageViewSet, basename='stage')

urlpatterns = [
    path('', include(router.urls)),
]
