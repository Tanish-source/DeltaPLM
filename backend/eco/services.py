from .models import ECO, ECOApproval, Stage, StageApprover, StageRule
from django.utils import timezone

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

def submit_eco_to_workflow(eco):
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
    
    check_stage_completion(eco)
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
    return eco

def validate_stage(eco):
    if eco.status != ECO.Status.APPROVAL:
        raise ValueError("ECO is not in approval state.")
    stage = eco.current_stage
    if stage.approvers.count() > 0:
        raise ValueError("This stage requires explicit approval from assigned users.")
    
    advance_to_next_stage(eco)
    return eco

def check_stage_completion(eco):
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
            advance_to_next_stage(eco)
        return

    approvals = ECOApproval.objects.filter(eco=eco, stage=stage, user_id__in=required_user_ids)
    
    if mode == StageRule.ApprovalMode.ALL:
        pending_or_rejected = approvals.exclude(decision=ECOApproval.Decision.APPROVED).exists()
        if not pending_or_rejected and approvals.count() == required_approvers.count():
            advance_to_next_stage(eco)
    else:
        any_approved = approvals.filter(decision=ECOApproval.Decision.APPROVED).exists()
        if any_approved:
            advance_to_next_stage(eco)

def advance_to_next_stage(eco):
    current_stage = eco.current_stage
    next_stage = Stage.objects.filter(
        is_active=True, 
        sequence__gt=current_stage.sequence
    ).order_by('sequence').first()

    if next_stage:
        eco.current_stage = next_stage
        eco.save()
        seed_approvals_for_stage(eco)
    else:
        eco.status = ECO.Status.APPROVED
        eco.current_stage = None
        eco.save()


def apply_eco(eco):
    """
    Apply an approved ECO — sets status to APPLIED and auto-populates effective_date.
    Phase 6 versioning logic will be added here later.
    """
    if eco.status != ECO.Status.APPROVED:
        raise ValueError("Only APPROVED ECOs can be applied.")

    # Auto-set effective_date to today
    eco.effective_date = timezone.now().date()
    eco.status = ECO.Status.APPLIED
    eco.save()

    # --- Phase 6 placeholder ---
    # If eco.version_update is True:
    #   Clone product/bom, increment version, apply changes to clone, archive original
    # If eco.version_update is False:
    #   Apply changes directly to the existing record (in-place update)

    return eco
