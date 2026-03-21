from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Product, BillOfMaterials
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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'parent']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at', 'version']
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Returns all versions of a specific product family."""
        product = self.get_object()
        # The parent logic: either this is the parent, or it has a parent.
        # Find the root parent, then return all items with that parent + the parent itself.
        root_parent_id = product.parent_id if product.parent_id else product.id
        versions = Product.objects.filter(models.Q(id=root_parent_id) | models.Q(parent_id=root_parent_id)).order_by('-version')
        serializer = self.get_serializer(versions, many=True)
        return Response(serializer.data)


class BillOfMaterialsViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows BoMs to be viewed or edited.
    """
    queryset = BillOfMaterials.objects.all()
    serializer_class = BillOfMaterialsSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrEngineeringWriteOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'product']
    search_fields = ['product__name']
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        bom = self.get_object()
        # Find all BoMs for this exact product family (assuming product family links versions)
        # For BoMs, versioning usually ties to the product. Here, we'll just filter by product.id
        versions = BillOfMaterials.objects.filter(product_id=bom.product_id).order_by('-version')
        serializer = self.get_serializer(versions, many=True)
        return Response(serializer.data)
