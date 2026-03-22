import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Edit2, Plus } from 'lucide-react'
import { getEcos } from '@/api/ecos'
import { useAuth } from '@/contexts/AuthContext'
import { ACCESS, ECO_STATUS, ECO_STATUS_LABELS, ECO_TYPE_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PageHeader from '@/components/shared/PageHeader'
import DataTable from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'

export default function EcoList() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: ''
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEcos()
    }, 300)
    return () => clearTimeout(timer)
  }, [filters.status, filters.type, filters.search])

  const fetchEcos = async () => {
    setIsLoading(true)
    try {
      const params = {}
      if (filters.status !== 'all') params.status = filters.status
      if (filters.type !== 'all') params.eco_type = filters.type
      if (filters.search) params.search = filters.search

      const res = await getEcos(params)
      setData(res.data?.results || res.data || [])
    } catch (error) {
      console.error('Failed to fetch ECOs:', error)
      setData([])
    } finally {
      setIsLoading(false)
    }
  }

  const columns = [
    { key: 'title', label: 'Title' },
    { 
      key: 'type', 
      label: 'Type',
      render: (row) => ECO_TYPE_LABELS[row.eco_type] || row.eco_type
    },
    { 
      key: 'product_name', 
      label: 'Product',
      render: (row) => row.product_name || '-'
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />
    },
    { 
      key: 'created_by_name', 
      label: 'Created By',
      render: (row) => row.created_by_username || row.created_by_name || '-'
    },
    { 
      key: 'created_at', 
      label: 'Created Date',
      render: (row) => new Date(row.created_at).toLocaleDateString()
    }
  ]

  const actions = (row) => (
    <div className="flex items-center gap-1">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => navigate(`/ecos/${row.id}/detail`)}
        title="View Detail"
      >
        <Eye className="h-4 w-4 text-muted-foreground" />
      </Button>
      {row.status === ECO_STATUS.NEW && hasRole(ACCESS.CREATE_ECO) && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/ecos/${row.id}/edit`)
          }}
          title="Edit Draft"
        >
          <Edit2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  )

  const canCreate = ACCESS.CREATE_ECO.some(role => hasRole(role))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering Change Orders"
        description="Manage and track product and BoM changes."
      >
        {canCreate && (
          <Button onClick={() => navigate('/ecos/new')} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            <span>Create ECO</span>
          </Button>
        )}
      </PageHeader>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-48">
          <Select 
            value={filters.status} 
            onValueChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(ECO_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-full sm:w-48">
          <Select 
            value={filters.type} 
            onValueChange={(val) => setFilters(prev => ({ ...prev, type: val }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="bom">Bill of Materials</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchPlaceholder="Search ECOs..."
        onSearch={(val) => setFilters(prev => ({ ...prev, search: val }))}
        actions={actions}
        emptyMessage="No ECOs found matching your criteria."
      />
    </div>
  )
}
