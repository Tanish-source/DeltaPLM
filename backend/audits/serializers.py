from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    actor = serializers.SerializerMethodField()
    actor_role = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()
    details = serializers.CharField(source='description', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'record_type', 'record_id', 'old_values', 'new_values',
            'user', 'user_name', 'timestamp', 'description', 'actor', 'actor_role',
            'target', 'details'
        ]
        
    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return "System"

    def get_actor(self, obj):
        return self.get_user_name(obj)

    def get_actor_role(self, obj):
        if obj.user:
            return getattr(obj.user, 'role', 'system')
        return 'system'

    def get_target(self, obj):
        return f"{obj.record_type} #{obj.record_id}"
