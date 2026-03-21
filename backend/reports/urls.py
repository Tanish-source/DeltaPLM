from django.urls import path
from . import views

urlpatterns = [
    path('reports/eco-summary/', views.EcoSummaryReportView.as_view(), name='report-eco-summary'),
    path('reports/ecos/', views.EcoReportView.as_view(), name='report-ecos'),
    path('reports/product-versions/', views.ProductVersionsReportView.as_view(), name='report-product-versions'),
    path('reports/bom-changes/', views.BomChangesReportView.as_view(), name='report-bom-changes'),
    path('reports/archived/', views.ArchivedReportView.as_view(), name='report-archived'),
    path('reports/active-matrix/', views.ActiveMatrixReportView.as_view(), name='report-active-matrix'),
]
