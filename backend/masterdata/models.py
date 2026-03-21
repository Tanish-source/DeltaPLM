from django.db import models

class Product(models.Model):
    name = models.CharField(max_length=255)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2)
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    parent = models.ForeignKey(
        'self', 
        null=True, 
        blank=True,
        on_delete=models.SET_NULL, 
        related_name='versions',
        help_text="If this is a new version of an older product, link to the original."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f"{self.name} (v{self.version})"


class ProductAttachment(models.Model):
    product = models.ForeignKey(Product, related_name='attachments', on_delete=models.CASCADE)
    file = models.FileField(upload_to='product_attachments/')
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class BillOfMaterials(models.Model):
    product = models.ForeignKey(Product, related_name='boms', on_delete=models.CASCADE)
    reference = models.CharField(max_length=20, unique=True, blank=True, editable=False)
    drawer = models.CharField(max_length=100, blank=True, help_text="Person or team who drew/drafted this BoM")
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']
        verbose_name_plural = 'Bills of Materials'

    def save(self, *args, **kwargs):
        if not self.reference:
            last_bom = BillOfMaterials.objects.order_by('-id').first()
            next_num = (last_bom.id + 1) if last_bom else 1
            self.reference = f"BOM-{next_num:06d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} — {self.product.name} (v{self.version})"


class BomComponent(models.Model):
    bom = models.ForeignKey(BillOfMaterials, related_name='components', on_delete=models.CASCADE)
    component_product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.component_product.name}"


class BomOperation(models.Model):
    bom = models.ForeignKey(BillOfMaterials, related_name='operations', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    duration = models.DurationField() # e.g. "01:00:00"
    work_center = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name
