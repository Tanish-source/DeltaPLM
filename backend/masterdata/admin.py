from django.contrib import admin
from .models import Product, ProductAttachment, BillOfMaterials, BomComponent, BomOperation

class ProductAttachmentInline(admin.TabularInline):
    model = ProductAttachment
    extra = 1

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'version', 'is_active', 'sale_price', 'cost_price', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name',)
    inlines = [ProductAttachmentInline]

class BomComponentInline(admin.TabularInline):
    model = BomComponent
    extra = 1

class BomOperationInline(admin.TabularInline):
    model = BomOperation
    extra = 1

@admin.register(BillOfMaterials)
class BillOfMaterialsAdmin(admin.ModelAdmin):
    list_display = ('product', 'version', 'is_active', 'created_at')
    list_filter = ('is_active', 'product')
    search_fields = ('product__name',)
    inlines = [BomComponentInline, BomOperationInline]
