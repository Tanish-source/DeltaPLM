from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ECO, ECOApproval, Stage, StageApprover, StageRule
from .serializers import (
    ECOSerializer, ECOApprovalSerializer, StageSerializer,
    StageApproverSerializer, StageRuleSerializer
)
from .services import submit_eco_to_workflow, approve_stage, reject_stage, validate_stage, apply_eco

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and (request.user.role == 'admin' or request.user.is_superuser)

class StageViewSet(viewsets.ModelViewSet):
    queryset = Stage.objects.all()
    serializer_class = StageSerializer
    permission_classes = [IsAdminOrReadOnly]
    
    @action(detail=True, methods=['post'], url_path='approvers')
    def add_approver(self, request, pk=None):
        stage = self.get_object()
        serializer = StageApproverSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(stage=stage)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'], url_path=r'approvers/(?P<approver_id>[^/.]+)')
    def remove_approver(self, request, pk=None, approver_id=None):
        stage = self.get_object()
        try:
            approver = stage.approvers.get(id=approver_id)
            approver.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except StageApprover.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get', 'put', 'patch'], url_path='rule')
    def manage_rule(self, request, pk=None):
        stage = self.get_object()
        rule, _ = StageRule.objects.get_or_create(stage=stage)
        
        if request.method == 'GET':
            serializer = StageRuleSerializer(rule)
            return Response(serializer.data)
        else:
            serializer = StageRuleSerializer(rule, data=request.data, partial=(request.method == 'PATCH'))
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ECOViewSet(viewsets.ModelViewSet):
    queryset = ECO.objects.all().order_by('-created_at')
    serializer_class = ECOSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['eco_type', 'status', 'product']
    search_fields = ['title']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        
    @action(detail=True, methods=['post'], url_path='submit')
    def submit_eco(self, request, pk=None):
        eco = self.get_object()
        try:
            eco = submit_eco_to_workflow(eco)
            return Response({'status': eco.status, 'state': eco.current_stage.name if eco.current_stage else 'APPROVED'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve_eco(self, request, pk=None):
        eco = self.get_object()
        comment = request.data.get('comment', '')
        try:
            eco = approve_stage(eco, request.user, comment)
            return Response({'status': eco.status})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
    @action(detail=True, methods=['post'], url_path='reject')
    def reject_eco(self, request, pk=None):
        eco = self.get_object()
        comment = request.data.get('comment', '')
        try:
            eco = reject_stage(eco, request.user, comment)
            return Response({'status': eco.status})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='validate')
    def validate_eco(self, request, pk=None):
        eco = self.get_object()
        try:
            eco = validate_stage(eco)
            return Response({'status': eco.status})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='apply')
    def apply_eco(self, request, pk=None):
        """Apply an approved ECO to master data. Auto-sets effective_date."""
        eco = self.get_object()
        try:
            eco = apply_eco(eco)
            serializer = self.get_serializer(eco)
            return Response(serializer.data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='changes')
    def get_changes(self, request, pk=None):
        eco = self.get_object()
        serializer = self.get_serializer(eco)
        return Response({
            'product_changes': serializer.data.get('product_changes', []),
            'bom_component_changes': serializer.data.get('bom_component_changes', []),
            'bom_operation_changes': serializer.data.get('bom_operation_changes', []),
        })
