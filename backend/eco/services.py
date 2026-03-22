from .models import ECO, ECOApproval, Stage, StageApprover, StageRule
from django.utils import timezone
from django.db import transaction
from audits.services import log_audit
from audits.models import AuditLog

DEFAULT_STAGES = (
    ("New", 1),
    ("Done", 2),
)


def ensure_default_stages():
    """
    Ensure the system always has a minimal workflow shape.
    This keeps the hackathon app usable even on a fresh database.
    """
    if Stage.objects.exists():
        return

    for name, sequence in DEFAULT_STAGES:
        stage = Stage.objects.create(name=name, sequence=sequence, is_active=True)
        StageRule.objects.get_or_create(stage=stage, defaults={"approval_mode": StageRule.ApprovalMode.ALL})


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


def sync_current_stage_approvals(eco):
    """
    Keep ECOApproval rows aligned with the currently assigned approvers for a stage.
    This covers the common case where approvers are configured after an ECO has
    already entered the stage.
    """
    stage = eco.current_stage
    if not stage:
        return
    seed_approvals_for_stage(eco)


def eco_has_recorded_changes(eco):
    if eco.eco_type == ECO.ECOType.PRODUCT:
        return eco.product_changes.exists() or eco.product_attachment_changes.exists()
    if eco.eco_type == ECO.ECOType.BOM:
        return eco.bom_component_changes.exists() or eco.bom_operation_changes.exists()
    return False

def submit_eco_to_workflow(eco, user=None):
    if eco.status != ECO.Status.NEW:
        raise ValueError("Only Draft ECOs can be started.")
    if not eco_has_recorded_changes(eco):
        raise ValueError("Add at least one change before starting the ECO.")

    ensure_default_stages()
    first_stage = Stage.objects.filter(is_active=True).order_by('sequence').first()
    if first_stage:
        eco.current_stage = first_stage
        eco.status = ECO.Status.APPROVAL
        eco.rejected_stage = None # Clear any previous rejection
        eco.save()
        
        # Reset any old approvals before starting fresh
        ECOApproval.objects.filter(eco=eco).delete()
        seed_approvals_for_stage(eco)

        if not Stage.objects.filter(is_active=True, sequence__gt=first_stage.sequence).exists():
            eco.status = ECO.Status.APPROVED
            eco.save(update_fields=['status'])
            log_audit(
                action=AuditLog.Action.ECO_SUBMITTED,
                record_type='ECO',
                record_id=eco.id,
                user=user,
                description=f"ECO started and moved to final stage '{first_stage.name}'."
            )
            log_audit(
                action=AuditLog.Action.STAGE_CHANGED,
                record_type='ECO',
                record_id=eco.id,
                user=user,
                description=f"ECO entered final stage '{first_stage.name}'. Applying changes automatically."
            )
            return apply_eco(eco, user)
    else:
        eco.status = ECO.Status.APPROVED
        eco.save()
        log_audit(
            action=AuditLog.Action.ECO_SUBMITTED,
            record_type='ECO',
            record_id=eco.id,
            user=user,
            description="ECO started with no configured stages and will be applied automatically."
        )
        return apply_eco(eco, user)
        
    log_audit(
        action=AuditLog.Action.ECO_SUBMITTED,
        record_type='ECO',
        record_id=eco.id,
        user=user,
        description=f"ECO started and moved to stage '{first_stage.name}'."
    )
    return eco

@transaction.atomic
def approve_stage(eco, user, comment=""):
    if eco.status != ECO.Status.APPROVAL:
        raise ValueError("ECO is not in approval state.")
    stage = eco.current_stage
    if not stage:
        raise ValueError("ECO has no current approval stage.")

    if stage.approvers.count() == 0:
        advance_to_next_stage(eco, user)
        return eco

    sync_current_stage_approvals(eco)

    approval = ECOApproval.objects.filter(eco=eco, stage=stage, user=user).first()
    stage_assignment = StageApprover.objects.filter(stage=stage, user=user).first()
    if not approval and not stage_assignment:
        raise ValueError("You are not assigned as an approver for this stage.")

    if not approval:
        approval = ECOApproval.objects.create(
            eco=eco,
            stage=stage,
            user=user,
            decision=ECOApproval.Decision.PENDING,
        )
    if approval.decision == ECOApproval.Decision.APPROVED:
        raise ValueError("You have already approved this stage.")
    if approval.decision != ECOApproval.Decision.PENDING:
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

@transaction.atomic
def reject_stage(eco, user, comment=""):
    if eco.status != ECO.Status.APPROVAL:
        raise ValueError("ECO is not in approval state.")
    stage = eco.current_stage

    sync_current_stage_approvals(eco)

    approval = ECOApproval.objects.filter(eco=eco, stage=stage, user=user).first()
    stage_assignment = StageApprover.objects.filter(stage=stage, user=user).first()
    if not approval and not stage_assignment:
        raise ValueError("You are not assigned as an approver for this stage.")

    if not approval:
        approval = ECOApproval.objects.create(
            eco=eco,
            stage=stage,
            user=user,
            decision=ECOApproval.Decision.PENDING,
        )
    approval.decision = ECOApproval.Decision.REJECTED
    approval.comment = comment
    approval.decided_at = timezone.now()
    approval.save()
    
    # Capture where it was rejected before resetting
    eco.rejected_stage = eco.current_stage
    
    # Rejecting returns ECO to draft
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

@transaction.atomic
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
        eco.rejected_stage = None # Clear on advancement
        eco.save()
        if Stage.objects.filter(is_active=True, sequence__gt=next_stage.sequence).exists():
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
            eco.save(update_fields=['status'])
            log_audit(
                action=AuditLog.Action.STAGE_CHANGED,
                record_type='ECO',
                record_id=eco.id,
                user=user,
                description=f"ECO entered final stage '{next_stage.name}'. Applying changes automatically."
            )
            apply_eco(eco, user)
    else:
        eco.status = ECO.Status.APPROVED
        eco.save(update_fields=['status'])
        log_audit(
            action=AuditLog.Action.STAGE_CHANGED,
            record_type='ECO',
            record_id=eco.id,
            user=user,
            description="ECO completed the final configured stage. Applying changes automatically."
        )
        apply_eco(eco, user)

def apply_eco(eco, user=None):
    """
    Apply an approved ECO — sets status to APPLIED and auto-populates effective_date.
    Implements Phase 6 versioning and in-place update logic.
    """
    if eco.status != ECO.Status.APPROVED:
        raise ValueError("Only APPROVED ECOs can be applied.")

    from masterdata.models import Product, BillOfMaterials, BomComponent, BomOperation, ProductAttachment

    def operation_effective_name(change):
        return change.new_operation_name or change.operation_name

    new_record_id = None
    target_id = None
    target_name = "Product" if eco.eco_type == ECO.ECOType.PRODUCT else "BoM"

    with transaction.atomic():
        if eco.eco_type == ECO.ECOType.PRODUCT:
            target_product = eco.product
            target_id = target_product.id
            removed_attachment_ids = set(
                eco.product_attachment_changes.filter(
                    change_type='remove',
                    original_attachment_id__isnull=False,
                ).values_list('original_attachment_id', flat=True)
            )
            add_attachment_changes = eco.product_attachment_changes.filter(change_type='add')
            
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
                for att in target_product.attachments.exclude(id__in=removed_attachment_ids):
                    ProductAttachment.objects.create(
                        product=new_product,
                        file=att.file,
                        name=att.name
                    )

                for change in add_attachment_changes:
                    ProductAttachment.objects.create(
                        product=new_product,
                        file=change.file,
                        name=change.attachment_name or getattr(change.file, 'name', 'Attachment')
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
                if removed_attachment_ids:
                    target_product.attachments.filter(id__in=removed_attachment_ids).delete()
                for change in add_attachment_changes:
                    ProductAttachment.objects.create(
                        product=target_product,
                        file=change.file,
                        name=change.attachment_name or getattr(change.file, 'name', 'Attachment')
                    )

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
                            name=operation_effective_name(change),
                            duration=change.new_duration,
                            work_center=change.new_work_center
                        )
                    elif change.change_type == 'remove':
                        if change.operation_name in ops:
                            del ops[change.operation_name]
                    elif change.change_type == 'modify':
                        if change.operation_name in ops:
                            original_op = ops.pop(change.operation_name)
                            original_op.duration = change.new_duration
                            original_op.name = operation_effective_name(change)
                            original_op.work_center = change.new_work_center
                            ops[original_op.name] = original_op
                            
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
                            name=operation_effective_name(change),
                            duration=change.new_duration,
                            work_center=change.new_work_center
                        )
                    elif change.change_type == 'remove':
                        if change.operation_name in ops:
                            ops[change.operation_name].delete()
                    elif change.change_type == 'modify':
                        if change.operation_name in ops:
                            op = ops[change.operation_name]
                            op.name = operation_effective_name(change)
                            op.duration = change.new_duration
                            op.work_center = change.new_work_center
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
