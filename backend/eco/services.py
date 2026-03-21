from .models import ECO, ECOApproval, Stage, StageApprover, StageRule
from django.utils import timezone
from django.db import transaction
from audits.services import log_audit
from audits.models import AuditLog

def seed_approvals_for_stage(eco):
    stage = eco.current_stage
    if not stage:
        return
    approvers = stage.approvers.all()
    for approver in approvers:
        ECOApproval.objects.get_or_create(
            eco=eco,
            stage=stage,
            user=approver.user,
            defaults={'decision': ECOApproval.Decision.PENDING}
        )

def submit_eco_to_workflow(eco, user=None):
    if eco.status != ECO.Status.NEW:
        raise ValueError("Only NEW drafts can be submitted.")
    
    first_stage = Stage.objects.filter(is_active=True).order_by('sequence').first()
    if first_stage:
        eco.current_stage = first_stage
        eco.status = ECO.Status.APPROVAL
        eco.save()
        
        # Reset any old approvals before starting fresh
        ECOApproval.objects.filter(eco=eco).delete()
        seed_approvals_for_stage(eco)
    else:
        eco.status = ECO.Status.APPROVED
        eco.save()
        
    log_audit(
        action=AuditLog.Action.ECO_SUBMITTED,
        record_type='ECO',
        record_id=eco.id,
        user=user,
        description="ECO submitted to workflow."
    )
    return eco

def approve_stage(eco, user, comment=""):
    if eco.status != ECO.Status.APPROVAL:
        raise ValueError("ECO is not in approval state.")
    stage = eco.current_stage
    
    # Check if user is a pending approver for this stage
    approval = ECOApproval.objects.filter(eco=eco, stage=stage, user=user, decision=ECOApproval.Decision.PENDING).first()
    if not approval:
        raise ValueError("You are not a pending approver for this stage.")
    
    approval.decision = ECOApproval.Decision.APPROVED
    approval.comment = comment
    approval.decided_at = timezone.now()
    approval.save()
    
    log_audit(
        action=AuditLog.Action.APPROVAL_GIVEN,
        record_type='ECO',
        record_id=eco.id,
        user=user,
        description=f"Approved stage '{stage.name}'. Comment: {comment}"
    )
    
    check_stage_completion(eco, user)
    return eco

def reject_stage(eco, user, comment=""):
    if eco.status != ECO.Status.APPROVAL:
        raise ValueError("ECO is not in approval state.")
    stage = eco.current_stage
    
    # Record the rejection if they are an approver
    approval = ECOApproval.objects.filter(eco=eco, stage=stage, user=user).first()
    if approval:
        approval.decision = ECOApproval.Decision.REJECTED
        approval.comment = comment
        approval.decided_at = timezone.now()
        approval.save()
    
    # Send back to NEW state
    eco.status = ECO.Status.NEW
    eco.current_stage = None
    eco.save()
    
    log_audit(
        action=AuditLog.Action.APPROVAL_REJECTED,
        record_type='ECO',
        record_id=eco.id,
        user=user,
        description=f"Rejected stage '{stage.name}'. Comment: {comment}"
    )
    
    return eco

def validate_stage(eco, user=None):
    if eco.status != ECO.Status.APPROVAL:
        raise ValueError("ECO is not in approval state.")
    stage = eco.current_stage
    if stage.approvers.count() > 0:
        raise ValueError("This stage requires explicit approval from assigned users.")
    
    log_audit(
        action=AuditLog.Action.APPROVAL_GIVEN,
        record_type='ECO',
        record_id=eco.id,
        user=user,
        description=f"Validated logic-only stage '{stage.name}'."
    )
    advance_to_next_stage(eco, user)
    return eco

def check_stage_completion(eco, user=None):
    stage = eco.current_stage
    if not stage:
        return
    
    rule = getattr(stage, 'rule', None)
    mode = rule.approval_mode if rule else StageRule.ApprovalMode.ALL

    required_approvers = stage.approvers.filter(category=StageApprover.ApprovalCategory.REQUIRED)
    required_user_ids = required_approvers.values_list('user_id', flat=True)
    
    if not required_user_ids.exists() and stage.approvers.exists():
        mode = StageRule.ApprovalMode.ANY
        any_approved = ECOApproval.objects.filter(eco=eco, stage=stage, decision=ECOApproval.Decision.APPROVED).exists()
        if any_approved:
            advance_to_next_stage(eco, user)
        return

    approvals = ECOApproval.objects.filter(eco=eco, stage=stage, user_id__in=required_user_ids)
    
    if mode == StageRule.ApprovalMode.ALL:
        pending_or_rejected = approvals.exclude(decision=ECOApproval.Decision.APPROVED).exists()
        if not pending_or_rejected and approvals.count() == required_approvers.count():
            advance_to_next_stage(eco, user)
    else:
        any_approved = approvals.filter(decision=ECOApproval.Decision.APPROVED).exists()
        if any_approved:
            advance_to_next_stage(eco, user)

def advance_to_next_stage(eco, user=None):
    current_stage = eco.current_stage
    next_stage = Stage.objects.filter(
        is_active=True, 
        sequence__gt=current_stage.sequence
    ).order_by('sequence').first()

    if next_stage:
        eco.current_stage = next_stage
        eco.save()
        seed_approvals_for_stage(eco)
        log_audit(
            action=AuditLog.Action.STAGE_CHANGED,
            record_type='ECO',
            record_id=eco.id,
            user=user,
            description=f"ECO advanced to stage '{next_stage.name}'."
        )
    else:
        eco.status = ECO.Status.APPROVED
        eco.current_stage = None
        eco.save()
        log_audit(
            action=AuditLog.Action.STAGE_CHANGED,
            record_type='ECO',
            record_id=eco.id,
            user=user,
            description="All stages approved. ECO is now APPROVED."
        )

def apply_eco(eco, user=None):
    """
    Apply an approved ECO — sets status to APPLIED and auto-populates effective_date.
    Implements Phase 6 versioning and in-place update logic.
    """
    if eco.status != ECO.Status.APPROVED:
        raise ValueError("Only APPROVED ECOs can be applied.")

    from masterdata.models import Product, BillOfMaterials, BomComponent, BomOperation, ProductAttachment

    new_record_id = None
    target_id = None
    target_name = "Product" if eco.eco_type == ECO.ECOType.PRODUCT else "BoM"

    with transaction.atomic():
        if eco.eco_type == ECO.ECOType.PRODUCT:
            target_product = eco.product
            target_id = target_product.id
            
            if eco.version_update:
                # 1. Clone Product
                new_product = Product.objects.get(id=target_product.id)
                new_product.pk = None
                new_product.version = target_product.version + 1
                new_product.parent = target_product.parent or target_product
                
                # Apply changes to clone
                for change in eco.product_changes.all():
                    setattr(new_product, change.field_name, change.new_value)
                new_product.save()
                new_record_id = new_product.id

                # Clone Attachments
                for att in target_product.attachments.all():
                    ProductAttachment.objects.create(
                        product=new_product,
                        file=att.file,
                        name=att.name
                    )

                # Clone active BOMs to point to new product version
                for active_bom in target_product.boms.filter(is_active=True):
                    new_bom = BillOfMaterials.objects.get(id=active_bom.id)
                    new_bom.pk = None
                    new_bom.product = new_product
                    new_bom.reference = ''
                    new_bom.save()
                    
                    for comp in active_bom.components.all():
                        BomComponent.objects.create(
                            bom=new_bom,
                            component_product=comp.component_product,
                            quantity=comp.quantity
                        )
                    for op in active_bom.operations.all():
                        BomOperation.objects.create(
                            bom=new_bom,
                            name=op.name,
                            duration=op.duration,
                            work_center=op.work_center
                        )
                
                # Archive original
                target_product.is_active = False
                target_product.save()
                
            else:
                # In-place update
                for change in eco.product_changes.all():
                    setattr(target_product, change.field_name, change.new_value)
                target_product.save()

        elif eco.eco_type == ECO.ECOType.BOM:
            target_bom = eco.bom
            target_id = target_bom.id
            
            if eco.version_update:
                # 1. Clone BoM
                new_bom = BillOfMaterials.objects.get(id=target_bom.id)
                new_bom.pk = None
                new_bom.version = target_bom.version + 1
                new_bom.reference = '' 
                new_bom.save()
                new_record_id = new_bom.id

                # Apply component changes
                comps = {c.component_product_id: c for c in target_bom.components.all()}
                
                for change in eco.bom_component_changes.all():
                    if change.change_type == 'add':
                        BomComponent.objects.create(
                            bom=new_bom,
                            component_product=change.component_product,
                            quantity=change.new_quantity
                        )
                    elif change.change_type == 'remove':
                        if change.component_product_id in comps:
                            del comps[change.component_product_id]
                    elif change.change_type == 'modify':
                        if change.component_product_id in comps:
                            comps[change.component_product_id].quantity = change.new_quantity
                
                # Copy remaining components
                for c in comps.values():
                    BomComponent.objects.create(
                        bom=new_bom,
                        component_product=c.component_product,
                        quantity=c.quantity
                    )

                ops = {op.name: op for op in target_bom.operations.all()}
                for change in eco.bom_operation_changes.all():
                    if change.change_type == 'add':
                        BomOperation.objects.create(
                            bom=new_bom,
                            name=change.operation_name,
                            duration=change.new_duration,
                            work_center=''
                        )
                    elif change.change_type == 'remove':
                        if change.operation_name in ops:
                            del ops[change.operation_name]
                    elif change.change_type == 'modify':
                        if change.operation_name in ops:
                            ops[change.operation_name].duration = change.new_duration
                            
                for op in ops.values():
                    BomOperation.objects.create(
                        bom=new_bom,
                        name=op.name,
                        duration=op.duration,
                        work_center=op.work_center
                    )
                
                # Archive original
                target_bom.is_active = False
                target_bom.save()

            else:
                # In-place update
                comps = {c.component_product_id: c for c in target_bom.components.all()}
                for change in eco.bom_component_changes.all():
                    if change.change_type == 'add':
                        BomComponent.objects.create(
                            bom=target_bom,
                            component_product=change.component_product,
                            quantity=change.new_quantity
                        )
                    elif change.change_type == 'remove':
                        if change.component_product_id in comps:
                            comps[change.component_product_id].delete()
                    elif change.change_type == 'modify':
                        if change.component_product_id in comps:
                            c = comps[change.component_product_id]
                            c.quantity = change.new_quantity
                            c.save()

                ops = {op.name: op for op in target_bom.operations.all()}
                for change in eco.bom_operation_changes.all():
                    if change.change_type == 'add':
                        BomOperation.objects.create(
                            bom=target_bom,
                            name=change.operation_name,
                            duration=change.new_duration,
                            work_center=''
                        )
                    elif change.change_type == 'remove':
                        if change.operation_name in ops:
                            ops[change.operation_name].delete()
                    elif change.change_type == 'modify':
                        if change.operation_name in ops:
                            op = ops[change.operation_name]
                            op.duration = change.new_duration
                            op.save()

        # Update ECO
        eco.effective_date = timezone.now().date()
        eco.status = ECO.Status.APPLIED
        eco.save()

        if eco.version_update:
            log_audit(
                action=AuditLog.Action.RECORD_ARCHIVED,
                record_type=target_name,
                record_id=target_id,
                user=user,
                description=f"Archived older version via ECO {eco.id}."
            )
            log_audit(
                action=AuditLog.Action.VERSION_CREATED,
                record_type=target_name,
                record_id=new_record_id,
                user=user,
                description=f"Created new version via ECO {eco.id}."
            )
        else:
            log_audit(
                action=AuditLog.Action.RECORD_UPDATED,
                record_type=target_name,
                record_id=target_id,
                user=user,
                description=f"In-place active modified via ECO {eco.id}."
            )

    return eco
