from rest_framework import serializers
from .models import (
    Stage, StageApprover, StageRule, ECO, 
    ECOProductChange, ECOBomComponentChange, ECOBomOperationChange, ECOApproval
)

class StageApproverSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = StageApprover
        fields = ['id', 'user', 'username', 'category']

class StageRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageRule
        fields = ['id', 'approval_mode']

class StageSerializer(serializers.ModelSerializer):
    approvers = StageApproverSerializer(many=True, read_only=True)
    rule = StageRuleSerializer(read_only=True)

    class Meta:
        model = Stage
        fields = ['id', 'name', 'sequence', 'is_active', 'approvers', 'rule']

class ECOProductChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ECOProductChange
        fields = ['id', 'field_name', 'old_value', 'new_value']

class ECOBomComponentChangeSerializer(serializers.ModelSerializer):
    component_product_name = serializers.CharField(source='component_product.name', read_only=True)

    class Meta:
        model = ECOBomComponentChange
        fields = ['id', 'change_type', 'component_product', 'component_product_name', 'old_quantity', 'new_quantity']

class ECOBomOperationChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ECOBomOperationChange
        fields = ['id', 'change_type', 'operation_name', 'old_duration', 'new_duration']

class ECOSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    bom_version = serializers.CharField(source='bom.version', read_only=True)
    bom_reference = serializers.CharField(source='bom.reference', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    responsible_user_username = serializers.CharField(source='responsible_user.username', read_only=True, default=None)
    current_stage_name = serializers.CharField(source='current_stage.name', read_only=True)
    
    product_changes = ECOProductChangeSerializer(many=True, required=False)
    bom_component_changes = ECOBomComponentChangeSerializer(many=True, required=False)
    bom_operation_changes = ECOBomOperationChangeSerializer(many=True, required=False)
    
    approvals = serializers.SerializerMethodField()
    stage_summary = serializers.SerializerMethodField()

    class Meta:
        model = ECO
        fields = [
            'id', 'title', 'eco_type', 'product', 'product_name', 'bom', 'bom_version', 'bom_reference',
            'status', 'current_stage', 'current_stage_name', 'effective_date', 'version_update',
            'created_by', 'created_by_username', 'responsible_user', 'responsible_user_username',
            'created_at', 'updated_at',
            'product_changes', 'bom_component_changes', 'bom_operation_changes',
            'approvals', 'stage_summary'
        ]
        read_only_fields = ['status', 'current_stage', 'created_by', 'effective_date']

    def validate(self, data):
        eco_type = data.get('eco_type', getattr(self.instance, 'eco_type', None))
        bom = data.get('bom', getattr(self.instance, 'bom', None))

        if eco_type == 'bom' and bom is None:
            raise serializers.ValidationError({
                'bom': 'Bill of Materials is required when ECO type is "bom".'
            })
        if eco_type == 'product' and bom is not None:
            raise serializers.ValidationError({
                'bom': 'Bill of Materials must not be set when ECO type is "product".'
            })
        return data

    def get_approvals(self, obj):
        approvals = obj.approvals.all().order_by('stage__sequence', 'id')
        return ECOApprovalSerializer(approvals, many=True).data

    def get_stage_summary(self, obj):
        """Per-stage summary: green=approved, white=pending, red=rejected"""
        stages = Stage.objects.filter(is_active=True).order_by('sequence')
        result = []
        for stage in stages:
            stage_approvals = obj.approvals.filter(stage=stage)
            if not stage_approvals.exists():
                result.append({
                    'stage_id': stage.id,
                    'stage_name': stage.name,
                    'sequence': stage.sequence,
                    'status': 'upcoming',   # not yet reached
                })
                continue
            total = stage_approvals.count()
            approved = stage_approvals.filter(decision='approved').count()
            rejected = stage_approvals.filter(decision='rejected').count()
            pending = stage_approvals.filter(decision='pending').count()

            if rejected > 0:
                st = 'rejected'
            elif pending == 0 and approved == total:
                st = 'approved'
            else:
                st = 'in_progress'

            result.append({
                'stage_id': stage.id,
                'stage_name': stage.name,
                'sequence': stage.sequence,
                'status': st,
                'approved_count': approved,
                'total_count': total,
            })
        return result

    def create(self, validated_data):
        prod_changes_data = validated_data.pop('product_changes', [])
        bom_comp_data = validated_data.pop('bom_component_changes', [])
        bom_op_data = validated_data.pop('bom_operation_changes', [])
        
        # Default responsible_user to created_by if not set
        if not validated_data.get('responsible_user'):
            validated_data['responsible_user'] = validated_data.get('created_by')
        
        eco = ECO.objects.create(**validated_data)
        
        for pc in prod_changes_data:
            ECOProductChange.objects.create(eco=eco, **pc)
        for bc in bom_comp_data:
            ECOBomComponentChange.objects.create(eco=eco, **bc)
        for oc in bom_op_data:
            ECOBomOperationChange.objects.create(eco=eco, **oc)
            
        return eco

    def update(self, instance, validated_data):
        prod_changes_data = validated_data.pop('product_changes', None)
        bom_comp_data = validated_data.pop('bom_component_changes', None)
        bom_op_data = validated_data.pop('bom_operation_changes', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if prod_changes_data is not None:
            instance.product_changes.all().delete()
            for pc in prod_changes_data:
                ECOProductChange.objects.create(eco=instance, **pc)
        if bom_comp_data is not None:
            instance.bom_component_changes.all().delete()
            for bc in bom_comp_data:
                ECOBomComponentChange.objects.create(eco=instance, **bc)
        if bom_op_data is not None:
            instance.bom_operation_changes.all().delete()
            for oc in bom_op_data:
                ECOBomOperationChange.objects.create(eco=instance, **oc)
                
        return instance

class ECOApprovalSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    
    class Meta:
        model = ECOApproval
        fields = ['id', 'user', 'username', 'stage', 'stage_name', 'decision', 'comment', 'decided_at']
