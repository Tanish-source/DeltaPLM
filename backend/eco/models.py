from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

class Stage(models.Model):
    name       = models.CharField(max_length=100)
    sequence   = models.PositiveIntegerField(unique=True)
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ['sequence']

class StageApprover(models.Model):
    class ApprovalCategory(models.TextChoices):
        REQUIRED = 'required', 'Required'
        OPTIONAL = 'optional', 'Optional'

    stage    = models.ForeignKey(Stage, related_name='approvers', on_delete=models.CASCADE)
    user     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    category = models.CharField(max_length=10, choices=ApprovalCategory.choices, default=ApprovalCategory.REQUIRED)

class StageRule(models.Model):
    class ApprovalMode(models.TextChoices):
        ALL = 'all', 'All must approve'
        ANY = 'any', 'Any one can approve'

    stage         = models.OneToOneField(Stage, related_name='rule', on_delete=models.CASCADE)
    approval_mode = models.CharField(max_length=5, choices=ApprovalMode.choices, default=ApprovalMode.ALL)

class ECO(models.Model):
    class ECOType(models.TextChoices):
        PRODUCT = 'product', 'Product'
        BOM     = 'bom', 'Bill of Materials'

    class Status(models.TextChoices):
        NEW      = 'new', 'New'
        APPROVAL = 'approval', 'In Approval'
        APPROVED = 'approved', 'Approved'
        APPLIED  = 'applied', 'Applied'
        REJECTED = 'rejected', 'Rejected'

    title          = models.CharField(max_length=255)
    eco_type       = models.CharField(max_length=10, choices=ECOType.choices)
    product        = models.ForeignKey('masterdata.Product', on_delete=models.CASCADE)
    bom            = models.ForeignKey('masterdata.BillOfMaterials', null=True, blank=True, on_delete=models.CASCADE)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    current_stage  = models.ForeignKey(Stage, null=True, blank=True, on_delete=models.SET_NULL, related_name='current_ecos')
    rejected_stage = models.ForeignKey(Stage, null=True, blank=True, on_delete=models.SET_NULL, related_name='rejected_ecos')
    effective_date = models.DateField(null=True, blank=True)
    version_update = models.BooleanField(default=True)
    created_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ecos_created')
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='ecos_responsible',
        help_text='Responsible user for this ECO. Defaults to created_by if not set.'
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

class ECOProductChange(models.Model):
    eco            = models.ForeignKey(ECO, related_name='product_changes', on_delete=models.CASCADE)
    field_name     = models.CharField(max_length=50)
    old_value      = models.TextField(blank=True)
    new_value      = models.TextField(blank=True)

class ECOBomComponentChange(models.Model):
    class ChangeType(models.TextChoices):
        ADD    = 'add', 'Add'
        REMOVE = 'remove', 'Remove'
        MODIFY = 'modify', 'Modify'

    eco               = models.ForeignKey(ECO, related_name='bom_component_changes', on_delete=models.CASCADE)
    change_type       = models.CharField(max_length=10, choices=ChangeType.choices)
    component_product = models.ForeignKey('masterdata.Product', null=True, on_delete=models.SET_NULL)
    old_quantity      = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0.01)])
    new_quantity      = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0.01)])

class ECOBomOperationChange(models.Model):
    class ChangeType(models.TextChoices):
        ADD    = 'add', 'Add'
        REMOVE = 'remove', 'Remove'
        MODIFY = 'modify', 'Modify'

    eco            = models.ForeignKey(ECO, related_name='bom_operation_changes', on_delete=models.CASCADE)
    change_type    = models.CharField(max_length=10, choices=ChangeType.choices)
    operation_name = models.CharField(max_length=255)
    old_duration   = models.DurationField(null=True, blank=True)
    new_duration   = models.DurationField(null=True, blank=True)

class ECOApproval(models.Model):
    class Decision(models.TextChoices):
        PENDING  = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    eco        = models.ForeignKey(ECO, related_name='approvals', on_delete=models.CASCADE)
    stage      = models.ForeignKey(Stage, on_delete=models.CASCADE)
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    decision   = models.CharField(max_length=10, choices=Decision.choices, default=Decision.PENDING)
    comment    = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
