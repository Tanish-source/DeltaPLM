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
        read_only_fields = ['version', 'parent', 'created_at', 'updated_at']


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
    components = BomComponentSerializer(many=True, required=False)
    operations = BomOperationSerializer(many=True, required=False)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = BillOfMaterials
        fields = [
            'id', 'product', 'product_name', 'version', 'is_active', 
            'created_at', 'updated_at', 'components', 'operations'
        ]
        read_only_fields = ['version', 'created_at', 'updated_at']

    def create(self, validated_data):
        components_data = validated_data.pop('components', [])
        operations_data = validated_data.pop('operations', [])
        bom = BillOfMaterials.objects.create(**validated_data)
        
        for comp in components_data:
            BomComponent.objects.create(bom=bom, **comp)
        
        for op in operations_data:
            BomOperation.objects.create(bom=bom, **op)
            
        return bom

    def update(self, instance, validated_data):
        components_data = validated_data.pop('components', None)
        operations_data = validated_data.pop('operations', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if components_data is not None:
            instance.components.all().delete()
            for comp in components_data:
                BomComponent.objects.create(bom=instance, **comp)
                
        if operations_data is not None:
            instance.operations.all().delete()
            for op in operations_data:
                BomOperation.objects.create(bom=instance, **op)
                
        return instance
