from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q

from .models import Product, ProductAttachment, BillOfMaterials, BomComponent, BomOperation
from .serializers import ProductSerializer, BillOfMaterialsSerializer

# We'll use the Operations readonly permission here
class IsAdminOrEngineeringWriteOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Admin has full access
        if request.user.role == 'admin' or request.user.is_superuser:
            return True
            
        # Operations and Approvers are Read-Only for Master Data
        if request.user.role in ['operations', 'approver']:
            return request.method in permissions.SAFE_METHODS
            
        # Engineering can create/edit Master Data directly (if no ECO enforcement is needed for initial creation)
        if request.user.role == 'engineering':
            return True
            
        return False

    def has_object_permission(self, request, view, obj):
        # Read operations are always allowed
        if request.method in permissions.SAFE_METHODS:
            return True

        if getattr(view, 'action', None) == 'rollback':
            return request.user.role in ['engineering', 'admin'] or request.user.is_superuser
            
        # For write operations (PUT, PATCH, DELETE), deny if archived
        if getattr(obj, 'is_active', True) is False:
            return False
            
        return True

# Alternative: Only Admin and Engineering can write, others read-only.
# In a strict PLM, modifications ONLY happen via ECOs, so direct PUT/PATCH might be disabled 
# entirely for existing active items, except for initial creation.
# For Phase 2, we allow creation and basic editing. 


class ProductViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows products to be viewed or edited.
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrEngineeringWriteOrReadOnly]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'parent']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at', 'version']
    
    def perform_create(self, serializer):
        from .models import ProductAttachment
        from audits.models import AuditLog
        from audits.services import log_audit
        product = serializer.save()
        files = self.request.FILES.getlist('attachments')
        for f in files:
            ProductAttachment.objects.create(product=product, file=f, name=f.name)
        log_audit(AuditLog.Action.VERSION_CREATED, 'Product', product.id, self.request.user, description=f"Created Product {product.name}")

    def update(self, request, *args, **kwargs):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Direct modifications to Master Data are restricted. Please use an ECO.")
        
    def partial_update(self, request, *args, **kwargs):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Direct modifications to Master Data are restricted. Please use an ECO.")
        
    def destroy(self, request, *args, **kwargs):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Direct deletions are restricted. Please use an ECO to archive.")

    def perform_update(self, serializer):
        from audits.models import AuditLog
        from audits.services import log_audit
        
        # Check if it's being archived
        was_active = serializer.instance.is_active
        product = serializer.save()
        
        if was_active and not product.is_active:
            log_audit(AuditLog.Action.RECORD_ARCHIVED, 'Product', product.id, self.request.user, description=f"Archived Product {product.name}")
        else:
            log_audit(AuditLog.Action.RECORD_UPDATED, 'Product', product.id, self.request.user, description=f"Updated Product {product.name}")
            
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Returns all versions of a specific product family."""
        from audits.models import AuditLog

        product = self.get_object()
        root_parent_id = product.parent_id if product.parent_id else product.id
        versions = Product.objects.filter(Q(id=root_parent_id) | Q(parent_id=root_parent_id)).order_by('-version')

        data = []
        for version in versions:
            latest_audit = AuditLog.objects.filter(
                record_type='Product',
                record_id=version.id,
            ).select_related('user').order_by('-timestamp').first()

            changed_by = "System"
            if latest_audit and latest_audit.user:
                changed_by = latest_audit.user.get_full_name().strip() or latest_audit.user.username

            data.append({
                "id": version.id,
                "version": version.version,
                "is_current": version.is_active,
                "changed_at": version.updated_at,
                "changed_by": changed_by,
                "eco_title": None,
                "fields_changed": [],
            })
        return Response(data)


    @action(detail=True, methods=['get'])
    def compare(self, request, pk=None):
        base_product = self.get_object()
        target_id = request.query_params.get('target_id')
        if not target_id:
            return Response({"error": "target_id query parameter is required"}, status=400)
            
        try:
            target_product = Product.objects.get(id=target_id)
        except Product.DoesNotExist:
            return Response({"error": "Target product not found"}, status=404)
            
        changes = []
        if base_product.name != target_product.name:
            changes.append({"field": "name", "old": base_product.name, "new": target_product.name})
        if base_product.sale_price != target_product.sale_price:
            changes.append({"field": "sale_price", "old": str(base_product.sale_price), "new": str(target_product.sale_price)})
        if base_product.cost_price != target_product.cost_price:
            changes.append({"field": "cost_price", "old": str(base_product.cost_price), "new": str(target_product.cost_price)})
            
        return Response({
            "product_name": base_product.name,
            "version_old": base_product.version,
            "version_new": target_product.version,
            "changes": changes
        })

    @action(detail=True, methods=['post'])
    def rollback(self, request, pk=None):
        from audits.models import AuditLog
        from audits.services import log_audit
        from rest_framework.exceptions import PermissionDenied

        if getattr(request.user, 'role', '') not in ['engineering', 'admin'] and not getattr(request.user, 'is_superuser', False):
            raise PermissionDenied("Only Engineering or Admin can rollback Product versions.")

        current_product = self.get_object()
        target_id = request.data.get('target_id')
        if not target_id:
            return Response({"error": "target_id is required."}, status=400)

        root_parent_id = current_product.parent_id if current_product.parent_id else current_product.id
        family_versions = Product.objects.filter(Q(id=root_parent_id) | Q(parent_id=root_parent_id))
        target_product = family_versions.filter(id=target_id).first()
        if not target_product:
            return Response({"error": "Target product version not found in the same version family."}, status=404)

        current_active = family_versions.filter(is_active=True).order_by('-version', '-id').first()
        next_version = (family_versions.order_by('-version').first().version if family_versions.exists() else 0) + 1

        with transaction.atomic():
            new_product = Product.objects.get(id=target_product.id)
            new_product.pk = None
            new_product.version = next_version
            new_product.parent = target_product.parent or target_product
            new_product.is_active = True
            new_product.save()

            for attachment in target_product.attachments.all():
                ProductAttachment.objects.create(
                    product=new_product,
                    file=attachment.file,
                    name=attachment.name,
                )

            if current_active:
                for active_bom in current_active.boms.filter(is_active=True):
                    active_bom.is_active = False
                    active_bom.save(update_fields=['is_active'])
                    log_audit(
                        AuditLog.Action.RECORD_ARCHIVED,
                        'BoM',
                        active_bom.id,
                        request.user,
                        description=f"Archived BoM during product rollback to Product v{target_product.version}.",
                    )

            for source_bom in target_product.boms.all():
                new_bom = BillOfMaterials.objects.get(id=source_bom.id)
                new_bom.pk = None
                new_bom.product = new_product
                new_bom.reference = ''
                new_bom.is_active = True
                new_bom.save()

                for component in source_bom.components.all():
                    BomComponent.objects.create(
                        bom=new_bom,
                        component_product=component.component_product,
                        quantity=component.quantity,
                    )
                for operation in source_bom.operations.all():
                    BomOperation.objects.create(
                        bom=new_bom,
                        name=operation.name,
                        duration=operation.duration,
                        work_center=operation.work_center,
                    )

            if current_active and current_active.id != new_product.id:
                current_active.is_active = False
                current_active.save(update_fields=['is_active'])
                log_audit(
                    AuditLog.Action.RECORD_ARCHIVED,
                    'Product',
                    current_active.id,
                    request.user,
                    description=f"Archived Product {current_active.name} during rollback.",
                )

            log_audit(
                AuditLog.Action.VERSION_CREATED,
                'Product',
                new_product.id,
                request.user,
                description=f"Rolled back Product to version {target_product.version}; created new version {new_product.version}.",
            )

        return Response(ProductSerializer(new_product, context={'request': request}).data)

class BillOfMaterialsViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows BoMs to be viewed or edited.
    """
    queryset = BillOfMaterials.objects.all()
    serializer_class = BillOfMaterialsSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrEngineeringWriteOrReadOnly]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'product']
    search_fields = ['product__name']
    
    def perform_create(self, serializer):
        from audits.models import AuditLog
        from audits.services import log_audit
        bom = serializer.save()
        log_audit(AuditLog.Action.VERSION_CREATED, 'BoM', bom.id, self.request.user, description=f"Created BoM for {bom.product.name}")

    def update(self, request, *args, **kwargs):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Direct modifications to Master Data are restricted. Please use an ECO.")
        
    def partial_update(self, request, *args, **kwargs):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Direct modifications to Master Data are restricted. Please use an ECO.")
        
    def destroy(self, request, *args, **kwargs):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Direct deletions are restricted. Please use an ECO to archive.")

    def perform_update(self, serializer):
        from audits.models import AuditLog
        from audits.services import log_audit
        was_active = serializer.instance.is_active
        bom = serializer.save()
        
        if was_active and not bom.is_active:
            log_audit(AuditLog.Action.RECORD_ARCHIVED, 'BoM', bom.id, self.request.user, description=f"Archived BoM {bom.reference}")
        else:
            log_audit(AuditLog.Action.RECORD_UPDATED, 'BoM', bom.id, self.request.user, description=f"Updated BoM {bom.reference}")
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        from audits.models import AuditLog

        bom = self.get_object()
        versions = BillOfMaterials.objects.filter(product_id=bom.product_id).order_by('-version')

        data = []
        for version in versions:
            latest_audit = AuditLog.objects.filter(
                record_type='BoM',
                record_id=version.id,
            ).select_related('user').order_by('-timestamp').first()

            changed_by = "System"
            if latest_audit and latest_audit.user:
                changed_by = latest_audit.user.get_full_name().strip() or latest_audit.user.username

            data.append({
                "id": version.id,
                "version": version.version,
                "is_current": version.is_active,
                "changed_at": version.updated_at,
                "changed_by": changed_by,
                "eco_title": None,
                "fields_changed": [],
                "reference": version.reference,
            })
        return Response(data)

    @action(detail=True, methods=['get'])
    def compare(self, request, pk=None):
        base_bom = self.get_object()
        target_id = request.query_params.get('target_id')
        if not target_id:
            return Response({"error": "target_id query parameter is required"}, status=400)
            
        try:
            target_bom = BillOfMaterials.objects.get(id=target_id)
        except BillOfMaterials.DoesNotExist:
            return Response({"error": "Target BoM not found"}, status=404)
            
        # Compare components
        base_comps = {c.component_product_id: c for c in base_bom.components.all()}
        target_comps = {c.component_product_id: c for c in target_bom.components.all()}
        
        components = []
        all_comp_ids = set(base_comps.keys()).union(set(target_comps.keys()))
        for cid in all_comp_ids:
            old_c = base_comps.get(cid)
            new_c = target_comps.get(cid)
            
            if old_c and not new_c:
                components.append({
                    "name": old_c.component_product.name,
                    "old_qty": str(old_c.quantity), "new_qty": None, "change": "remove"
                })
            elif not old_c and new_c:
                components.append({
                    "name": new_c.component_product.name,
                    "old_qty": None, "new_qty": str(new_c.quantity), "change": "add"
                })
            elif old_c and new_c and old_c.quantity != new_c.quantity:
                components.append({
                    "name": new_c.component_product.name,
                    "old_qty": str(old_c.quantity), "new_qty": str(new_c.quantity), "change": "modify"
                })
                
        # Compare operations
        base_ops = {op.name: op for op in base_bom.operations.all()}
        target_ops = {op.name: op for op in target_bom.operations.all()}
        
        operations = []
        all_op_names = set(base_ops.keys()).union(set(target_ops.keys()))
        for name in all_op_names:
            old_op = base_ops.get(name)
            new_op = target_ops.get(name)
            
            if old_op and not new_op:
                operations.append({
                    "name": name,
                    "old": str(old_op.duration), "new": None, "change": "remove"
                })
            elif not old_op and new_op:
                operations.append({
                    "name": name,
                    "old": None, "new": str(new_op.duration), "change": "add"
                })
            elif old_op and new_op and old_op.duration != new_op.duration:
                operations.append({
                    "name": name,
                    "old": str(old_op.duration), "new": str(new_op.duration), "change": "modify"
                })
                
        return Response({
            "product_name": base_bom.product.name,
            "bom_version_old": base_bom.version,
            "bom_version_new": target_bom.version,
            "components": components,
            "operations": operations
        })

    @action(detail=True, methods=['post'])
    def rollback(self, request, pk=None):
        from audits.models import AuditLog
        from audits.services import log_audit
        from rest_framework.exceptions import PermissionDenied

        if getattr(request.user, 'role', '') not in ['engineering', 'admin'] and not getattr(request.user, 'is_superuser', False):
            raise PermissionDenied("Only Engineering or Admin can rollback BoM versions.")

        current_bom = self.get_object()
        target_id = request.data.get('target_id')
        if not target_id:
            return Response({"error": "target_id is required."}, status=400)

        family_versions = BillOfMaterials.objects.filter(product_id=current_bom.product_id)
        target_bom = family_versions.filter(id=target_id).first()
        if not target_bom:
            return Response({"error": "Target BoM version not found for the same product."}, status=404)

        current_active = family_versions.filter(is_active=True).order_by('-version', '-id').first()
        next_version = (family_versions.order_by('-version').first().version if family_versions.exists() else 0) + 1

        with transaction.atomic():
            new_bom = BillOfMaterials.objects.get(id=target_bom.id)
            new_bom.pk = None
            new_bom.version = next_version
            new_bom.reference = ''
            new_bom.is_active = True
            new_bom.save()

            for component in target_bom.components.all():
                BomComponent.objects.create(
                    bom=new_bom,
                    component_product=component.component_product,
                    quantity=component.quantity,
                )
            for operation in target_bom.operations.all():
                BomOperation.objects.create(
                    bom=new_bom,
                    name=operation.name,
                    duration=operation.duration,
                    work_center=operation.work_center,
                )

            if current_active and current_active.id != new_bom.id:
                current_active.is_active = False
                current_active.save(update_fields=['is_active'])
                log_audit(
                    AuditLog.Action.RECORD_ARCHIVED,
                    'BoM',
                    current_active.id,
                    request.user,
                    description=f"Archived BoM {current_active.reference} during rollback.",
                )

            log_audit(
                AuditLog.Action.VERSION_CREATED,
                'BoM',
                new_bom.id,
                request.user,
                description=f"Rolled back BoM to version {target_bom.version}; created new version {new_bom.version}.",
            )

        return Response(BillOfMaterialsSerializer(new_bom, context={'request': request}).data)
