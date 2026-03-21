from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from masterdata.models import Product, BillOfMaterials, BomComponent, BomOperation

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds initial users and master data for DeltaPLM testing'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding data...')
        
        # 1. Create Users
        users = [
            {'username': 'admin', 'email': 'admin@deltaplm.app', 'password': 'password', 'role': User.Role.ADMIN, 'is_superuser': True, 'is_staff': True},
            {'username': 'engineer', 'email': 'eng@deltaplm.app', 'password': 'password', 'role': User.Role.ENGINEERING, 'is_superuser': False, 'is_staff': False},
            {'username': 'approver', 'email': 'approver@deltaplm.app', 'password': 'password', 'role': User.Role.APPROVER, 'is_superuser': False, 'is_staff': False},
            {'username': 'ops', 'email': 'ops@deltaplm.app', 'password': 'password', 'role': User.Role.OPERATIONS, 'is_superuser': False, 'is_staff': False},
        ]
        
        for u in users:
            if not User.objects.filter(username=u['username']).exists():
                user = User(
                    username=u['username'],
                    email=u['email'],
                    role=u['role'],
                    is_superuser=u['is_superuser'],
                    is_staff=u['is_staff']
                )
                user.set_password(u['password'])
                user.save()
                self.stdout.write(f"Created {u['role']} user: {u['username']}")

        # 2. Create Products
        p1, _ = Product.objects.get_or_create(
            name='Alpha Engine Block', 
            defaults={'sale_price': 1500.00, 'cost_price': 800.00, 'version': 1}
        )
        p2, _ = Product.objects.get_or_create(
            name='Beta Intake Valve', 
            defaults={'sale_price': 50.00, 'cost_price': 12.00, 'version': 1}
        )
        p3, _ = Product.objects.get_or_create(
            name='Gamma Piston Set', 
            defaults={'sale_price': 300.00, 'cost_price': 110.00, 'version': 1}
        )
        
        # 3. Create BoM
        if not BillOfMaterials.objects.filter(product=p1).exists():
            bom = BillOfMaterials.objects.create(product=p1, version=1)
            
            # Components
            BomComponent.objects.create(bom=bom, component_product=p2, quantity=16)
            BomComponent.objects.create(bom=bom, component_product=p3, quantity=8)
            
            # Operations
            import datetime
            BomOperation.objects.create(
                bom=bom, 
                name='Casting Inspection', 
                duration=datetime.timedelta(hours=1), 
                work_center='QA Station 1'
            )
            BomOperation.objects.create(
                bom=bom, 
                name='Machining & Assembly', 
                duration=datetime.timedelta(hours=4, minutes=30), 
                work_center='Assembly Line B'
            )
            self.stdout.write("Created Master Data: Products and BoM")
        
        self.stdout.write(self.style.SUCCESS('Successfully seeded database!'))
