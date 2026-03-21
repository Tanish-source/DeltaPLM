from .models import AuditLog

def log_audit(action, record_type, record_id, user=None, old_values=None, new_values=None, description=""):
    """
    Utility function to create an audit log entry.
    """
    AuditLog.objects.create(
        action=action,
        record_type=record_type,
        record_id=record_id,
        user=user,
        old_values=old_values,
        new_values=new_values,
        description=description
    )
