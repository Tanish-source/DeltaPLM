from django.db import models
from django.conf import settings

class AuditLog(models.Model):
    class Action(models.TextChoices):
        ECO_CREATED       = 'eco_created', 'ECO Created'
        ECO_SUBMITTED     = 'eco_submitted', 'ECO Submitted'
        STAGE_CHANGED     = 'stage_changed', 'Stage Changed'
        APPROVAL_GIVEN    = 'approval_given', 'Approval Given'
        APPROVAL_REJECTED = 'approval_rejected', 'Approval Rejected'
        VERSION_CREATED   = 'version_created', 'Version Created'
        RECORD_ARCHIVED   = 'record_archived', 'Record Archived'
        RECORD_UPDATED    = 'record_updated', 'Record Updated'

    action          = models.CharField(max_length=30, choices=Action.choices)
    record_type     = models.CharField(max_length=50)  # 'Product', 'BoM', 'ECO'
    record_id       = models.PositiveIntegerField()
    old_values      = models.JSONField(null=True, blank=True)
    new_values      = models.JSONField(null=True, blank=True)
    user            = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    timestamp       = models.DateTimeField(auto_now_add=True)
    description     = models.TextField(blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} on {self.record_type} #{self.record_id} by {self.user}"
