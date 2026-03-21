from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from masterdata.models import Product, BillOfMaterials
from eco.models import ECO
from django.db.models import Prefetch

class EcoReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ecos = ECO.objects.select_related('product', 'bom').all().order_by('-created_at')
        data = []
        for eco in ecos:
            data.append({
                "id": eco.id,
                "title": eco.title,
                "type": eco.get_eco_type_display(),
                "product_name": eco.product.name if eco.product else None,
                "status": eco.get_status_display(),
                "effective_date": eco.effective_date
            })
        return Response(data)

class ProductVersionsReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        products = Product.objects.all().order_by('name', '-version')
        data = []
        for p in products:
            data.append({
                "id": p.id,
                "name": p.name,
                "version": p.version,
                "sale_price": str(p.sale_price),
                "cost_price": str(p.cost_price),
                "is_active": p.is_active,
                "parent_id": p.parent_id
            })
        return Response(data)

class BomChangesReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        boms = BillOfMaterials.objects.select_related('product').all().order_by('reference', '-version')
        data = []
        for b in boms:
            data.append({
                "id": b.id,
                "reference": b.reference,
                "product_name": b.product.name,
                "version": b.version,
                "is_active": b.is_active
            })
        return Response(data)

class ArchivedReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        archived_products = Product.objects.filter(is_active=False).order_by('-updated_at')
        archived_boms = BillOfMaterials.objects.filter(is_active=False).select_related('product').order_by('-updated_at')
        
        products_data = [{"id": p.id, "name": p.name, "version": p.version} for p in archived_products]
        boms_data = [{"id": b.id, "reference": b.reference, "product_name": b.product.name, "version": b.version} for b in archived_boms]
        
        return Response({
            "products": products_data,
            "boms": boms_data
        })

class ActiveMatrixReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Active Product -> Version -> Active BoMs
        active_products = Product.objects.filter(is_active=True).prefetch_related(
            Prefetch('boms', queryset=BillOfMaterials.objects.filter(is_active=True), to_attr='active_boms')
        ).order_by('name')
        
        data = []
        for p in active_products:
            bom_list = [{"id": b.id, "reference": b.reference, "version": b.version} for b in p.active_boms]
            data.append({
                "product_id": p.id,
                "product_name": p.name,
                "product_version": p.version,
                "active_boms": bom_list
            })
        return Response(data)
