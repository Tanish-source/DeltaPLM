from rest_framework import serializers
from .models import Product, ProductAttachment, BillOfMaterials, BomComponent, BomOperation


class ProductAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttachment
        fields = ['id', 'name', 'file']


class ProductSerializer(serializers.ModelSerializer):
    attachments = ProductAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sale_price', 'cost_price', 'version', 
            'is_active', 'parent', 'created_at', 'updated_at', 'attachments'
        ]
        read_only_fields = ['version', 'is_active', 'parent', 'created_at', 'updated_at']


class BomComponentSerializer(serializers.ModelSerializer):
    component_product_name = serializers.CharField(source='component_product.name', read_only=True)

    class Meta:
        model = BomComponent
        fields = ['id', 'component_product', 'component_product_name', 'quantity']


class BomOperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BomOperation
        fields = ['id', 'name', 'duration', 'work_center']


class BillOfMaterialsSerializer(serializers.ModelSerializer):
    components = BomComponentSerializer(many=True, read_only=True)
    operations = BomOperationSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = BillOfMaterials
        fields = [
            'id', 'product', 'product_name', 'version', 'is_active', 
            'created_at', 'updated_at', 'components', 'operations'
        ]
        read_only_fields = ['version', 'is_active', 'created_at', 'updated_at']
