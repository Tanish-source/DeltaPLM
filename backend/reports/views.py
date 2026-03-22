from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from masterdata.models import Product, BillOfMaterials
from eco.models import ECO, ECOApproval, Stage
from eco.serializers import ECOListSerializer
from django.db.models import Prefetch
from django.utils import timezone
from datetime import timedelta

class DashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        recent_ecos_qs = ECO.objects.select_related('product', 'created_by').order_by('-created_at')[:5]
        recent_ecos = ECOListSerializer(recent_ecos_qs, many=True, context={'request': request}).data

        return Response({
            "stats": {
                "products": Product.objects.filter(is_active=True).count(),
                "boms": BillOfMaterials.objects.filter(is_active=True).count(),
                "ecos": ECO.objects.filter(status=ECO.Status.APPROVAL).count(),
                "pending": ECOApproval.objects.filter(decision=ECOApproval.Decision.PENDING).count(),
            },
            "recent_ecos": recent_ecos,
        })


class EcoSummaryReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)

        ecos = ECO.objects.select_related('product', 'bom').all()
        recent_ecos = ecos.filter(created_at__gte=thirty_days_ago)
        prior_ecos = ecos.filter(created_at__gte=sixty_days_ago, created_at__lt=thirty_days_ago)

        total_ecos = ecos.count()
        prior_total = prior_ecos.count()
        total_change = round(((recent_ecos.count() - prior_total) / prior_total) * 100) if prior_total else 0

        applied_count = ecos.filter(status=ECO.Status.APPLIED).count()
        approval_rate = round((applied_count / total_ecos) * 100) if total_ecos else 0

        recent_applied = recent_ecos.filter(status=ECO.Status.APPLIED).count()
        prior_applied = prior_ecos.filter(status=ECO.Status.APPLIED).count()
        recent_rate = round((recent_applied / recent_ecos.count()) * 100) if recent_ecos.count() else 0
        prior_rate = round((prior_applied / prior_ecos.count()) * 100) if prior_ecos.count() else 0

        decided_approvals = ECOApproval.objects.exclude(decided_at__isnull=True).select_related('eco')
        avg_approval_time = '0.0 days'
        if decided_approvals.exists():
            total_days = 0
            for approval in decided_approvals:
                total_days += (approval.decided_at - approval.eco.created_at).total_seconds() / 86400
            avg_approval_time = f"{(total_days / decided_approvals.count()):.1f} days"

        status_distribution = []
        visible_distribution_statuses = [
            ECO.Status.NEW,
            ECO.Status.APPROVAL,
            ECO.Status.APPLIED,
        ]
        for status_value in visible_distribution_statuses:
            count = ecos.filter(status=status_value).count()
            percentage = round((count / total_ecos) * 100) if total_ecos else 0
            status_distribution.append({
                "status": status_value,
                "count": count,
                "percentage": percentage,
            })

        monthly_trends = []
        current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        for offset in range(2, -1, -1):
            month_start = current_month - timedelta(days=offset * 30)
            month_end = month_start + timedelta(days=30)
            month_ecos = ecos.filter(created_at__gte=month_start, created_at__lt=month_end)
            monthly_trends.append({
                "month": month_start.strftime("%b %Y"),
                "created": month_ecos.count(),
                "approved": month_ecos.filter(status=ECO.Status.APPLIED).count(),
                "rejected": month_ecos.filter(
                    approvals__decision=ECOApproval.Decision.REJECTED
                ).distinct().count(),
            })

        approver_stats = []
        approver_ids = ECOApproval.objects.values_list('user_id', flat=True).distinct()
        for user_id in approver_ids:
            user_approvals = ECOApproval.objects.filter(user_id=user_id).select_related('user', 'eco')
            if not user_approvals.exists():
                continue
            user = user_approvals.first().user
            approved = user_approvals.filter(decision=ECOApproval.Decision.APPROVED).count()
            rejected = user_approvals.filter(decision=ECOApproval.Decision.REJECTED).count()
            pending = user_approvals.filter(decision=ECOApproval.Decision.PENDING).count()

            avg_time = '0.0 days'
            decided = user_approvals.exclude(decided_at__isnull=True)
            if decided.exists():
                total_days = 0
                for approval in decided:
                    total_days += (approval.decided_at - approval.eco.created_at).total_seconds() / 86400
                avg_time = f"{(total_days / decided.count()):.1f} days"

            approver_stats.append({
                "name": user.get_full_name().strip() or user.username,
                "approved": approved,
                "rejected": rejected,
                "pending": pending,
                "avg_time": avg_time,
            })

        product_changes = []
        for product in Product.objects.all().order_by('name'):
            product_ecos = ecos.filter(product=product)
            if not product_ecos.exists():
                continue
            latest_change = product_ecos.order_by('-created_at').first()
            product_changes.append({
                "product": product.name,
                "total_ecos": product_ecos.count(),
                "applied": product_ecos.filter(status=ECO.Status.APPLIED).count(),
                "pending": product_ecos.exclude(status=ECO.Status.APPLIED).count(),
                "last_change": latest_change.created_at.date() if latest_change else None,
            })

        return Response({
            "summary": {
                "total_ecos": total_ecos,
                "total_ecos_change": total_change,
                "avg_approval_time": avg_approval_time,
                "approval_rate": approval_rate,
                "approval_rate_change": recent_rate - prior_rate,
                "active_stages": Stage.objects.filter(is_active=True).count(),
                "pending_approvals": ECOApproval.objects.filter(decision=ECOApproval.Decision.PENDING).count(),
            },
            "status_distribution": status_distribution,
            "monthly_trends": monthly_trends,
            "approver_stats": approver_stats,
            "product_changes": product_changes,
        })

class EcoReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ecos = ECO.objects.select_related('product', 'bom').all().order_by('-created_at')
        data = []
        for eco in ecos:
            data.append({
                "id": eco.id,
                "title": eco.title,
                "type": eco.get_eco_type_display(),
                "product_name": eco.product.name if eco.product else None,
                "status": eco.get_status_display(),
                "effective_date": eco.effective_date
            })
        return Response(data)

class ProductVersionsReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        products = Product.objects.all().order_by('name', '-version')
        data = []
        for p in products:
            data.append({
                "id": p.id,
                "name": p.name,
                "version": p.version,
                "sale_price": str(p.sale_price),
                "cost_price": str(p.cost_price),
                "is_active": p.is_active,
                "parent_id": p.parent_id
            })
        return Response(data)

class BomChangesReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        boms = BillOfMaterials.objects.select_related('product').all().order_by('reference', '-version')
        data = []
        for b in boms:
            data.append({
                "id": b.id,
                "reference": b.reference,
                "product_name": b.product.name,
                "version": b.version,
                "is_active": b.is_active
            })
        return Response(data)

class ArchivedReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        archived_products = Product.objects.filter(is_active=False).order_by('-updated_at')
        archived_boms = BillOfMaterials.objects.filter(is_active=False).select_related('product').order_by('-updated_at')
        
        products_data = [{"id": p.id, "name": p.name, "version": p.version} for p in archived_products]
        boms_data = [{"id": b.id, "reference": b.reference, "product_name": b.product.name, "version": b.version} for b in archived_boms]
        
        return Response({
            "products": products_data,
            "boms": boms_data
        })

class ActiveMatrixReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Active Product -> Version -> Active BoMs
        active_products = Product.objects.filter(is_active=True).prefetch_related(
            Prefetch('boms', queryset=BillOfMaterials.objects.filter(is_active=True), to_attr='active_boms')
        ).order_by('name')
        
        data = []
        for p in active_products:
            bom_list = [{"id": b.id, "reference": b.reference, "version": b.version} for b in p.active_boms]
            data.append({
                "product_id": p.id,
                "product_name": p.name,
                "product_version": p.version,
                "active_boms": bom_list
            })
        return Response(data)
