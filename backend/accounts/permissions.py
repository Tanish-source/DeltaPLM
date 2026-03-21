from rest_framework.permissions import BasePermission
import logging

logger = logging.getLogger(__name__)

class IsAdmin(BasePermission):
    """Allows access only to Admin users or superusers."""
    def has_permission(self, request, view):
        is_admin = bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role == 'admin' or request.user.is_superuser)
        )
        return is_admin


class IsEngineering(BasePermission):
    """Allows access only to Engineering users or Admins."""
    def has_permission(self, request, view):
        has_access = bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role == 'engineering' or request.user.role == 'admin')
        )
        return has_access


class IsApprover(BasePermission):
    """Allows access only to Approver users or Admins."""
    def has_permission(self, request, view):
        has_access = bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role == 'approver' or request.user.role == 'admin')
        )
        return has_access


class IsOperationsReadOnly(BasePermission):
    """
    Operations users only have read-only access (GET, HEAD, OPTIONS).
    Admins bypass this restriction.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.role == 'admin' or request.user.is_superuser:
            return True

        if request.user.role == 'operations':
            return request.method in ('GET', 'HEAD', 'OPTIONS')
            
        # For endpoints using this permission, returning True here allows 
        # Engineering/Approvers to also access the view if other permissions allow it. 
        # But this specific class just ensures Operations users can't write.
        return True
