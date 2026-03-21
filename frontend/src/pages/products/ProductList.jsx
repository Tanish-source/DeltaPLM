import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProducts, archiveProduct, restoreProduct } from '@/api/products'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/lib/constants'
import PageHeader from '@/components/shared/PageHeader'
import DataTable from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Eye, Pencil, Archive, ArchiveRestore } from 'lucide-react'

export default function ProductList() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState('active')
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const canEdit = hasRole([ROLES.ENGINEERING, ROLES.ADMIN])

  const fetchProducts = async (isActive, search = '') => {
    setIsLoading(true)
    try {
      const { data } = await getProducts({ is_active: isActive, search })
      setProducts(data.results || data || [])
    } catch (error) {
      console.error('Failed to fetch products', error)
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Debounce search slightly
    const timer = setTimeout(() => {
      fetchProducts(activeTab === 'active', searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [activeTab, searchQuery])

  const handleArchive = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to archive this product?')) return
    
    try {
      await archiveProduct(id)
      fetchProducts(activeTab === 'active', searchQuery)
    } catch (error) {
      console.error('Failed to archive product', error)
    }
  }

  const handleRestore = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to restore this product?')) return
    
    try {
      await restoreProduct(id)
      fetchProducts(activeTab === 'active', searchQuery)
    } catch (error) {
      console.error('Failed to restore product', error)
    }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'sale_price', label: 'Sale Price', render: (row) => `$${Number(row.sale_price).toFixed(2)}` },
    { key: 'cost_price', label: 'Cost Price', render: (row) => `$${Number(row.cost_price).toFixed(2)}` },
    { key: 'version', label: 'Version', render: (row) => `v${row.version}` },
    { 
      key: 'created_at', 
      label: 'Created', 
      render: (row) => new Date(row.created_at).toLocaleDateString() 
    },
  ]

  const renderActions = (row) => (
    <div className="flex items-center gap-1">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="View Details"
        onClick={() => navigate(`/products/${row.id}`)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      
      {canEdit && activeTab === 'active' && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Archive Product"
          onClick={(e) => handleArchive(e, row.id)}
        >
          <Archive className="h-4 w-4" />
        </Button>
      )}

      {canEdit && activeTab === 'archived' && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-green-600"
          title="Restore Product"
          onClick={(e) => handleRestore(e, row.id)}
        >
          <ArchiveRestore className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Manage your master product data.">
        {canEdit && (
          <Button asChild>
            <Link to="/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Product
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Tabs defaultValue="active" onValueChange={setActiveTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="active" className="m-0 mt-4">
          <DataTable
            data={products}
            columns={columns}
            isLoading={isLoading}
            searchPlaceholder="Search active products..."
            onSearch={setSearchQuery}
            actions={renderActions}
            onRowClick={(row) => navigate(`/products/${row.id}`)}
            emptyMessage="No active products found."
          />
        </TabsContent>
        
        <TabsContent value="archived" className="m-0">
          <DataTable
            data={products}
            columns={columns}
            isLoading={isLoading}
            searchPlaceholder="Search archived products..."
            onSearch={setSearchQuery}
            actions={renderActions}
            onRowClick={(row) => navigate(`/products/${row.id}`)}
            emptyMessage="No archived products found."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
