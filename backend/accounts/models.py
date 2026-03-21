from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model with role field for PLM access control."""

    class Role(models.TextChoices):
        ENGINEERING = 'engineering', 'Engineering User'
        APPROVER = 'approver', 'Approver'
        OPERATIONS = 'operations', 'Operations User'
        ADMIN = 'admin', 'Admin'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.ENGINEERING,
    )

    class Meta:
        db_table = 'accounts_user'

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
