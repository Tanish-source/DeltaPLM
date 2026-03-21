from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ECO, ECOApproval, Stage, StageApprover, StageRule
from .serializers import (
    ECOSerializer, ECOApprovalSerializer, StageSerializer,
    StageApproverSerializer, StageRuleSerializer
)
from .services import submit_eco_to_workflow, approve_stage, reject_stage, validate_stage, apply_eco, ensure_default_stages

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and (request.user.role == 'admin' or request.user.is_superuser)

class StageViewSet(viewsets.ModelViewSet):
    serializer_class = StageSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        ensure_default_stages()
        return Stage.objects.all()
    
    @action(detail=True, methods=['get', 'post'], url_path='approvers')
    def approvers(self, request, pk=None):
        stage = self.get_object()
        if request.method == 'GET':
            serializer = StageApproverSerializer(stage.approvers.all(), many=True)
            return Response(serializer.data)
        
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
        user = self.request.user
        if getattr(user, 'role', '') not in ['engineering', 'admin'] and not getattr(user, 'is_superuser', False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Engineering or Admin can create ECOs.")
        serializer.save(created_by=user)

    def update(self, request, *args, **kwargs):
        user = request.user
        if getattr(user, 'role', '') not in ['engineering', 'admin'] and not getattr(user, 'is_superuser', False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Engineering or Admin can edit ECOs.")
        eco = self.get_object()
        if eco.status != 'new':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot edit an ECO that is not in the NEW status.")
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        if getattr(user, 'role', '') not in ['engineering', 'admin'] and not getattr(user, 'is_superuser', False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Engineering or Admin can delete ECOs.")
        eco = self.get_object()
        if eco.status != 'new':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot delete an ECO that is not in the NEW status.")
        return super().destroy(request, *args, **kwargs)
        
    @action(detail=True, methods=['post'], url_path='submit')
    def submit_eco(self, request, pk=None):
        if getattr(request.user, 'role', '') not in ['engineering', 'admin'] and not getattr(request.user, 'is_superuser', False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Engineering or Admin can submit ECOs.")
        eco = self.get_object()
        try:
            eco = submit_eco_to_workflow(eco, request.user)
            serializer = self.get_serializer(eco)
            return Response(serializer.data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve_eco(self, request, pk=None):
        if getattr(request.user, 'role', '') not in ['approver', 'admin'] and not getattr(request.user, 'is_superuser', False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Approvers or Admin can approve ECOs.")
        eco = self.get_object()
        comment = request.data.get('comment', '')
        try:
            eco = approve_stage(eco, request.user, comment)
            return Response({'status': eco.status})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
    @action(detail=True, methods=['post'], url_path='reject')
    def reject_eco(self, request, pk=None):
        if getattr(request.user, 'role', '') not in ['approver', 'admin'] and not getattr(request.user, 'is_superuser', False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Approvers or Admin can reject ECOs.")
        eco = self.get_object()
        comment = request.data.get('comment', '')
        try:
            eco = reject_stage(eco, request.user, comment)
            return Response({'status': eco.status})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='validate')
    def validate_eco(self, request, pk=None):
        if getattr(request.user, 'role', '') not in ['approver', 'admin'] and not getattr(request.user, 'is_superuser', False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Approvers or Admin can validate ECOs.")
        eco = self.get_object()
        try:
            eco = validate_stage(eco, request.user)
            return Response({'status': eco.status})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='apply')
    def apply_eco(self, request, pk=None):
        """Apply an approved ECO to master data. Auto-sets effective_date."""
        if getattr(request.user, 'role', '') not in ['approver', 'admin'] and not getattr(request.user, 'is_superuser', False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Approvers or Admin can apply ECOs.")
        eco = self.get_object()
        try:
            eco = apply_eco(eco, request.user)
            serializer = self.get_serializer(eco)
            return Response(serializer.data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='diff')
    def diff(self, request, pk=None):
        eco = self.get_object()
        if eco.eco_type == ECO.ECOType.PRODUCT:
            fields = []
            for c in eco.product_changes.all():
                fields.append({
                    "field": c.field_name,
                    "label": c.field_name.replace('_', ' ').title(),
                    "old": c.old_value,
                    "new": c.new_value,
                    "changed": c.old_value != c.new_value,
                })

            version_old = eco.product.version if eco.product else 1
            version_new = version_old + 1 if eco.version_update else version_old

            return Response({
                "type": "product",
                "product_name": eco.product.name,
                "old_version": version_old,
                "new_version": version_new,
                "fields": fields
            })
            
        elif eco.eco_type == ECO.ECOType.BOM:
            components = []
            for c in eco.bom_component_changes.all():
                components.append({
                    "name": getattr(c.component_product, 'name', f"Product {c.component_product_id}"),
                    "old_qty": str(c.old_quantity) if c.old_quantity is not None else None,
                    "new_qty": str(c.new_quantity) if c.new_quantity is not None else None,
                    "change": c.change_type
                })
                
            operations = []
            for c in eco.bom_operation_changes.all():
                operations.append({
                    "name": c.operation_name,
                    "old_duration": str(c.old_duration) if c.old_duration is not None else None,
                    "new_duration": str(c.new_duration) if c.new_duration is not None else None,
                    "change": c.change_type,
                    "changed": c.old_duration != c.new_duration
                })
                
            bom_version_old = eco.bom.version if eco.bom else 1
            bom_version_new = bom_version_old + 1 if eco.version_update else bom_version_old
                
            return Response({
                "type": "bom",
                "product_name": eco.product.name if eco.product else "Unknown",
                "old_version": bom_version_old,
                "new_version": bom_version_new,
                "bom_version": f"v{bom_version_old} -> v{bom_version_new}",
                "bom_version_old": bom_version_old,
                "bom_version_new": bom_version_new,
                "components": components,
                "operations": operations
            })

    @action(detail=True, methods=['get'], url_path='changes')
    def get_changes(self, request, pk=None):
        eco = self.get_object()
        serializer = self.get_serializer(eco)
        return Response({
            'product_changes': serializer.data.get('product_changes', []),
            'bom_component_changes': serializer.data.get('bom_component_changes', []),
            'bom_operation_changes': serializer.data.get('bom_operation_changes', []),
        })
