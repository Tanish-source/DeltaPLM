import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES, ECO_STATUS, ECO_STATUS_LABELS } from '@/lib/constants'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Package,
  Layers,
  FileText,
  Clock,
  Plus,
  Settings,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import api from '@/api/client'

// ── Summary Stat Card ───────────────────────────────────────────
function StatCard({ title, value, icon: Icon, description, isLoading }) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-bold tracking-tight">{value}</div>
        )}
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Mock/Sample Data (until backend is ready) ────────────────────
const SAMPLE_ECOS = [
  { id: 1, title: 'Price Update Q4', eco_type: 'product', product_name: 'iPhone 17 Pro', status: 'approval', created_by: 'John Doe', created_at: '2026-03-18' },
  { id: 2, title: 'Component Revision', eco_type: 'bom', product_name: 'Galaxy S26', status: 'new', created_by: 'Sarah Chen', created_at: '2026-03-19' },
  { id: 3, title: 'New Assembly Line', eco_type: 'bom', product_name: 'Pixel 12', status: 'approved', created_by: 'Mike Johnson', created_at: '2026-03-17' },
  { id: 4, title: 'Cost Reduction', eco_type: 'product', product_name: 'iPhone 17 Pro', status: 'applied', created_by: 'John Doe', created_at: '2026-03-15' },
  { id: 5, title: 'Material Change', eco_type: 'bom', product_name: 'Galaxy S26', status: 'rejected', created_by: 'Lisa Wang', created_at: '2026-03-14' },
]

export default function Dashboard() {
  const { user, hasRole } = useAuth()
  const [stats, setStats] = useState({ products: 0, boms: 0, ecos: 0, pending: 0 })
  const [recentEcos, setRecentEcos] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true)
      try {
        // Try hitting real APIs; fall back to sample data
        const [productsRes, bomsRes, ecosRes] = await Promise.allSettled([
          api.get('/products/', { params: { is_active: true } }),
          api.get('/boms/', { params: { is_active: true } }),
          api.get('/ecos/'),
        ])

        const products = productsRes.status === 'fulfilled'
          ? (productsRes.value.data.results || productsRes.value.data)
          : []
        const boms = bomsRes.status === 'fulfilled'
          ? (bomsRes.value.data.results || bomsRes.value.data)
          : []
        const ecos = ecosRes.status === 'fulfilled'
          ? (ecosRes.value.data.results || ecosRes.value.data)
          : []

        const activeEcos = Array.isArray(ecos)
          ? ecos.filter(e => e.status === ECO_STATUS.APPROVAL)
          : []
        const pendingApprovals = Array.isArray(ecos)
          ? ecos.filter(e => e.status === ECO_STATUS.APPROVAL)
          : []

        setStats({
          products: Array.isArray(products) ? products.length : 0,
          boms: Array.isArray(boms) ? boms.length : 0,
          ecos: activeEcos.length,
          pending: pendingApprovals.length,
        })

        // Use real ECOs if available, else samples
        if (Array.isArray(ecos) && ecos.length > 0) {
          setRecentEcos(ecos.slice(0, 5))
        } else {
          setRecentEcos(SAMPLE_ECOS)
        }
      } catch {
        // Backend not ready — use defaults
        setStats({ products: 24, boms: 18, ecos: 7, pending: 3 })
        setRecentEcos(SAMPLE_ECOS)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────── */}
      <PageHeader
        title={`${greeting()}, ${user?.first_name || user?.username || 'User'}`}
        description="Here's what's happening with your products and ECOs."
      >
        {hasRole([ROLES.ENGINEERING, ROLES.ADMIN]) && (
          <Button asChild>
            <Link to="/ecos/new">
              <Plus className="mr-2 h-4 w-4" />
              Create ECO
            </Link>
          </Button>
        )}
        {hasRole([ROLES.ADMIN]) && (
          <Button variant="outline" asChild>
            <Link to="/stages">
              <Settings className="mr-2 h-4 w-4" />
              Manage Stages
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* ── Stat Cards ──────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={stats.products}
          icon={Package}
          description="Active products"
          isLoading={isLoading}
        />
        <StatCard
          title="Active BoMs"
          value={stats.boms}
          icon={Layers}
          description="Bill of materials"
          isLoading={isLoading}
        />
        <StatCard
          title="Active ECOs"
          value={stats.ecos}
          icon={FileText}
          description="In approval process"
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pending}
          icon={Clock}
          description={
            hasRole([ROLES.APPROVER, ROLES.ADMIN])
              ? 'Awaiting your review'
              : 'Total pending'
          }
          isLoading={isLoading}
        />
      </div>

      {/* ── Recent ECOs Table ────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Recent ECOs
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Latest engineering change orders
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/ecos" className="text-sm">
              View all
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Title
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Product
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentEcos.map((eco) => (
                    <tr
                      key={eco.id}
                      className="group cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          to={`/ecos/${eco.id}/detail`}
                          className="text-sm font-medium group-hover:underline"
                        >
                          {eco.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm text-muted-foreground capitalize">
                          {eco.eco_type === 'bom' ? 'BoM' : 'Product'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm">
                          {eco.product_name || eco.product?.name || '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={eco.status} />
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-sm text-muted-foreground">
                          {eco.created_at
                            ? new Date(eco.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Links (for Operations read-only info) ─────── */}
      {hasRole([ROLES.OPERATIONS]) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Quick Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/products">
                  <Package className="mr-2 h-4 w-4" />
                  View Products
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/boms">
                  <Layers className="mr-2 h-4 w-4" />
                  View BoMs
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/reports">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Reports
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
