import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getBoms, archiveBom, restoreBom } from '@/api/boms'
import { getProducts } from '@/api/products'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/lib/constants'
import PageHeader from '@/components/shared/PageHeader'
import DataTable from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Eye, Pencil, Archive, ArchiveRestore } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function BomList() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState('active')
  const [boms, setBoms] = useState([])
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const canEdit = hasRole([ROLES.ENGINEERING, ROLES.ADMIN])

  useEffect(() => {
    // Fetch products for the filter dropdown
    const fetchSelectProducts = async () => {
      try {
        const { data } = await getProducts({ is_active: true })
        setProducts(data.results || data || [])
      } catch (err) {
        console.error(err)
      }
    }
    fetchSelectProducts()
  }, [])

  const fetchBoms = async (isActive, search = '', productId = 'all') => {
    setIsLoading(true)
    try {
      const params = { is_active: isActive, search }
      if (productId !== 'all') {
        params.product = productId
      }
      const { data } = await getBoms(params)
      setBoms(data.results || data || [])
    } catch (error) {
      console.error('Failed to fetch BoMs', error)
      setBoms([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBoms(activeTab === 'active', searchQuery, selectedProduct)
    }, 300)
    return () => clearTimeout(timer)
  }, [activeTab, searchQuery, selectedProduct])

  const handleArchive = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to archive this Bill of Materials?')) return
    
    try {
      await archiveBom(id)
      fetchBoms(activeTab === 'active', searchQuery, selectedProduct)
    } catch (error) {
      console.error('Failed to archive BoM', error)
    }
  }

  const handleRestore = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to restore this Bill of Materials?')) return
    
    try {
      await restoreBom(id)
      fetchBoms(activeTab === 'active', searchQuery, selectedProduct)
    } catch (error) {
      console.error('Failed to restore BoM', error)
    }
  }

  const columns = [
    { key: 'reference', label: 'Reference', render: (row) => <span className="font-mono text-xs">{row.reference || '—'}</span> },
    { key: 'product_name', label: 'Product', render: (row) => <span className="font-medium">{row.product_name || row.product?.name || 'Unknown'}</span> },
    { key: 'version', label: 'Version', render: (row) => `v${row.version}` },
    { key: 'components', label: 'Components', render: (row) => `${row.components?.length || 0} items` },
    { key: 'operations', label: 'Operations', render: (row) => `${row.operations?.length || 0} steps` },
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
        onClick={() => navigate(`/boms/${row.id}`)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      
      {canEdit && activeTab === 'active' && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Archive BoM"
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
          title="Restore BoM"
          onClick={(e) => handleRestore(e, row.id)}
        >
          <ArchiveRestore className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Bills of Materials" description="Manage sub-components and operations for your products.">
        {canEdit && (
          <Button asChild>
            <Link to="/boms/new">
              <Plus className="mr-2 h-4 w-4" />
              Create BoM
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

        <div className="w-[200px]">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger>
              <SelectValue placeholder="All Products">
                {selectedProduct !== 'all' ? (products.find(p => p.id.toString() === selectedProduct)?.name || selectedProduct) : "All Products"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        data={boms}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Search BoMs..."
        onSearch={setSearchQuery}
        actions={renderActions}
        onRowClick={(row) => navigate(`/boms/${row.id}`)}
        emptyMessage={`No ${activeTab} BoMs found.`}
      />
    </div>
  )
}
