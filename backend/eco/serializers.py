from rest_framework import serializers
from .models import (
    Stage, StageApprover, StageRule, ECO, 
    ECOProductChange, ECOProductAttachmentChange, ECOBomComponentChange, ECOBomOperationChange, ECOApproval
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

    def validate_name(self, value):
        queryset = Stage.objects.filter(name__iexact=value.strip())
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Stage name must be unique.')
        return value.strip()

class ECOProductChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ECOProductChange
        fields = ['id', 'field_name', 'old_value', 'new_value']

class ECOProductAttachmentChangeSerializer(serializers.ModelSerializer):
    original_attachment_name = serializers.CharField(source='original_attachment.name', read_only=True)

    class Meta:
        model = ECOProductAttachmentChange
        fields = [
            'id',
            'change_type',
            'original_attachment',
            'original_attachment_name',
            'attachment_name',
            'file',
        ]

class ECOBomComponentChangeSerializer(serializers.ModelSerializer):
    component_product_name = serializers.CharField(source='component_product.name', read_only=True)

    class Meta:
        model = ECOBomComponentChange
        fields = ['id', 'change_type', 'component_product', 'component_product_name', 'old_quantity', 'new_quantity']

class ECOBomOperationChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ECOBomOperationChange
        fields = [
            'id',
            'change_type',
            'operation_name',
            'new_operation_name',
            'old_duration',
            'new_duration',
            'old_work_center',
            'new_work_center',
        ]

class ECOSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    bom_version = serializers.CharField(source='bom.version', read_only=True)
    bom_reference = serializers.CharField(source='bom.reference', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    responsible_user_username = serializers.CharField(source='responsible_user.username', read_only=True, default=None)
    current_stage_name = serializers.CharField(source='current_stage.name', read_only=True)
    new_version = serializers.SerializerMethodField()
    applied_record_id = serializers.SerializerMethodField()
    
    product_changes = ECOProductChangeSerializer(many=True, required=False)
    product_attachment_changes = ECOProductAttachmentChangeSerializer(many=True, read_only=True)
    bom_component_changes = ECOBomComponentChangeSerializer(many=True, required=False)
    bom_operation_changes = ECOBomOperationChangeSerializer(many=True, required=False)
    
    approvals = serializers.SerializerMethodField()
    stage_summary = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    can_reject = serializers.SerializerMethodField()
    can_validate = serializers.SerializerMethodField()
    can_apply = serializers.SerializerMethodField()

    class Meta:
        model = ECO
        fields = [
            'id', 'title', 'eco_type', 'product', 'product_name', 'bom', 'bom_version', 'bom_reference',
            'status', 'current_stage', 'current_stage_name', 'rejected_stage', 'effective_date', 'version_update',
            'created_by', 'created_by_username', 'created_by_name', 'responsible_user', 'responsible_user_username',
            'created_at', 'updated_at',
            'product_changes', 'product_attachment_changes', 'bom_component_changes', 'bom_operation_changes',
            'approvals', 'stage_summary', 'new_version', 'applied_record_id',
            'can_approve', 'can_reject', 'can_validate', 'can_apply'
        ]
        read_only_fields = ['status', 'created_by', 'effective_date']

    def validate(self, data):
        eco_type = data.get('eco_type', getattr(self.instance, 'eco_type', None))
        bom = data.get('bom', getattr(self.instance, 'bom', None))
        product = data.get('product', getattr(self.instance, 'product', None))

        if eco_type == 'bom' and bom is None:
            raise serializers.ValidationError({
                'bom': 'Bill of Materials is required when ECO type is "bom".'
            })
        if eco_type == 'product' and bom is not None:
            raise serializers.ValidationError({
                'bom': 'Bill of Materials must not be set when ECO type is "product".'
            })
            
        if bom and getattr(bom, 'is_active', True) is False:
            raise serializers.ValidationError({'bom': 'Selected BoM must be active.'})
            
        if product and getattr(product, 'is_active', True) is False:
            raise serializers.ValidationError({'product': 'Selected Product must be active.'})
            
        if eco_type == 'bom' and bom and product and bom.product_id != product.id:
            raise serializers.ValidationError({'bom': 'Selected BoM must belong to the selected Product.'})
        if eco_type == 'product' and product is None:
            raise serializers.ValidationError({'product': 'Product is required when ECO type is "product".'})

        has_product_changes = bool(data.get('product_changes'))
        has_bom_component_changes = bool(data.get('bom_component_changes'))
        has_bom_operation_changes = bool(data.get('bom_operation_changes'))

        if self.instance:
            has_product_changes = has_product_changes or self.instance.product_changes.exists()
            has_bom_component_changes = has_bom_component_changes or self.instance.bom_component_changes.exists()
            has_bom_operation_changes = has_bom_operation_changes or self.instance.bom_operation_changes.exists()

        if eco_type == 'bom' and not (has_bom_component_changes or has_bom_operation_changes):
            raise serializers.ValidationError({
                'bom_component_changes': 'At least one BoM component or operation change is required.'
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
            if obj.status == ECO.Status.NEW:
                result.append({
                    'stage_id': stage.id,
                    'stage_name': stage.name,
                    'sequence': stage.sequence,
                    'status': 'upcoming',
                })
                continue

            stage_approvals = obj.approvals.filter(stage=stage)
            if obj.status == ECO.Status.APPLIED and obj.current_stage_id == stage.id:
                result.append({
                    'stage_id': stage.id,
                    'stage_name': stage.name,
                    'sequence': stage.sequence,
                    'status': 'approved',
                    'approved_count': stage_approvals.filter(decision='approved').count(),
                    'total_count': max(stage_approvals.count(), stage.approvers.count()),
                })
                continue
            if not stage_approvals.exists():
                status_value = 'current' if obj.status == ECO.Status.APPROVAL and obj.current_stage_id == stage.id else 'upcoming'
                result.append({
                    'stage_id': stage.id,
                    'stage_name': stage.name,
                    'sequence': stage.sequence,
                    'status': status_value,
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

    def get_new_version(self, obj):
        if obj.eco_type == ECO.ECOType.PRODUCT:
            return obj.product.version + 1 if obj.version_update else obj.product.version
        if obj.eco_type == ECO.ECOType.BOM and obj.bom:
            return obj.bom.version + 1 if obj.version_update else obj.bom.version
        return None

    def get_applied_record_id(self, obj):
        if obj.eco_type == ECO.ECOType.PRODUCT:
            if not obj.version_update or obj.status != ECO.Status.APPLIED:
                return obj.product_id

            from masterdata.models import Product

            next_version = obj.product.version + 1
            applied_product = Product.objects.filter(
                parent_id=obj.product.parent_id or obj.product_id,
                version=next_version,
                is_active=True,
            ).order_by('-id').first()

            if applied_product:
                return applied_product.id

            fallback_product = Product.objects.filter(
                parent_id=obj.product.parent_id or obj.product_id,
                is_active=True,
            ).order_by('-version', '-id').first()
            return fallback_product.id if fallback_product else obj.product_id

        if obj.eco_type != ECO.ECOType.BOM or not obj.bom_id:
            return None

        if not obj.version_update:
            return obj.bom_id

        if obj.status != ECO.Status.APPLIED:
            return obj.bom_id

        from masterdata.models import BillOfMaterials

        next_version = obj.bom.version + 1
        applied_bom = BillOfMaterials.objects.filter(
            product_id=obj.product_id,
            version=next_version,
            is_active=True,
        ).order_by('-id').first()

        if applied_bom:
            return applied_bom.id

        fallback_bom = BillOfMaterials.objects.filter(
            product_id=obj.product_id,
            is_active=True,
        ).order_by('-version', '-id').first()
        return fallback_bom.id if fallback_bom else obj.bom_id

    def _approval_capable_user(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return None
        if getattr(user, 'is_superuser', False) or getattr(user, 'role', '') in ['approver', 'admin']:
            return user
        return None

    def _is_stage_assigned(self, obj, user):
        if not obj.current_stage or not user:
            return False
        if obj.approvals.filter(stage=obj.current_stage, user=user).exists():
            return True
        return StageApprover.objects.filter(stage=obj.current_stage, user=user).exists()

    def get_can_approve(self, obj):
        user = self._approval_capable_user()
        if not user or obj.status != ECO.Status.APPROVAL or not obj.current_stage:
            return False
        if obj.current_stage.approvers.count() == 0:
            return False
        return self._is_stage_assigned(obj, user)

    def get_can_reject(self, obj):
        return self.get_can_approve(obj)

    def get_can_validate(self, obj):
        user = self._approval_capable_user()
        if not user or obj.status != ECO.Status.APPROVAL or not obj.current_stage:
            return False
        return obj.current_stage.approvers.count() == 0

    def get_can_apply(self, obj):
        return False

class ECOApprovalSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    category = serializers.SerializerMethodField()
    
    class Meta:
        model = ECOApproval
        fields = ['id', 'user', 'username', 'stage', 'stage_name', 'category', 'decision', 'comment', 'decided_at']

    def get_category(self, obj):
        stage_approver = StageApprover.objects.filter(stage=obj.stage, user=obj.user).first()
        return stage_approver.category if stage_approver else None
