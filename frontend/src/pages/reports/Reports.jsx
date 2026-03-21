import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEcoSummaryReport } from '@/api/reports'
import { ECO_STATUS_LABELS, ECO_STATUS_STYLES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PageHeader from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus as MinusIcon,
} from 'lucide-react'

// ── Sample report data ──────────────────────────────────────────
const SAMPLE_STATUS_DISTRIBUTION = [
  { status: 'new', count: 3, percentage: 21 },
  { status: 'approval', count: 4, percentage: 29 },
  { status: 'approved', count: 2, percentage: 14 },
  { status: 'applied', count: 3, percentage: 22 },
  { status: 'rejected', count: 2, percentage: 14 },
]

const SAMPLE_MONTHLY_TRENDS = [
  { month: 'Jan 2026', created: 5, approved: 3, rejected: 1 },
  { month: 'Feb 2026', created: 8, approved: 6, rejected: 2 },
  { month: 'Mar 2026', created: 14, approved: 9, rejected: 2 },
]

const SAMPLE_APPROVER_STATS = [
  { name: 'Sarah Chen', approved: 8, rejected: 1, avg_time: '1.2 days', pending: 2 },
  { name: 'Mike Johnson', approved: 6, rejected: 0, avg_time: '0.8 days', pending: 1 },
  { name: 'Lisa Wang', approved: 4, rejected: 2, avg_time: '2.1 days', pending: 0 },
  { name: 'Alex Rivera', approved: 3, rejected: 0, avg_time: '1.5 days', pending: 3 },
]

const SAMPLE_PRODUCT_CHANGES = [
  { product: 'iPhone 17 Pro', total_ecos: 4, applied: 2, pending: 1, last_change: '2026-03-20' },
  { product: 'Galaxy S26', total_ecos: 3, applied: 1, pending: 1, last_change: '2026-03-19' },
  { product: 'Pixel 12', total_ecos: 2, applied: 1, pending: 0, last_change: '2026-03-17' },
  { product: 'OnePlus 14', total_ecos: 1, applied: 0, pending: 1, last_change: '2026-03-21' },
  { product: 'Xperia 5', total_ecos: 1, applied: 1, pending: 0, last_change: '2026-03-10' },
]

const SAMPLE_SUMMARY = {
  total_ecos: 14,
  total_ecos_change: 12,
  avg_approval_time: '1.4 days',
  approval_rate: 82,
  approval_rate_change: 5,
  active_stages: 3,
  pending_approvals: 4,
}

function StatCard({ title, value, icon: Icon, description, trend, trendValue }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {(description || trendValue !== undefined) && (
          <div className="flex items-center gap-1.5 mt-1">
            {trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />}
            {trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />}
            {trend === 'neutral' && <MinusIcon className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className={`text-xs ${
              trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
            }`}>
              {trendValue !== undefined && `${trendValue > 0 ? '+' : ''}${trendValue}%`}
              {description && ` ${description}`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simple visual bar chart
function BarChartVisual({ data }) {
  const maxVal = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-3">
      {data.map((item) => {
        const statusStyle = ECO_STATUS_STYLES[item.status] || 'bg-secondary text-secondary-foreground'
        return (
          <div key={item.status} className="flex items-center gap-3">
            <div className="w-24">
              <Badge variant="outline" className={`text-xs ${statusStyle}`}>
                {ECO_STATUS_LABELS[item.status] || item.status}
              </Badge>
            </div>
            <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden relative">
              <div
                className="h-full bg-primary/80 rounded-md transition-all duration-700 ease-out flex items-center"
                style={{ width: `${(item.count / maxVal) * 100}%`, minWidth: item.count > 0 ? '24px' : '0px' }}
              >
                <span className="text-xs font-semibold text-primary-foreground pl-2 whitespace-nowrap">
                  {item.count}
                </span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right">{item.percentage}%</span>
          </div>
        )
      })}
    </div>
  )
}

// Mini trend chart using CSS
function TrendChart({ data }) {
  const maxCreated = Math.max(...data.map(d => d.created), 1)
  return (
    <div className="space-y-4">
      {data.map((row) => (
        <div key={row.month} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{row.month}</span>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Created: <strong className="text-foreground">{row.created}</strong></span>
              <span>Approved: <strong className="text-emerald-600">{row.approved}</strong></span>
              <span>Rejected: <strong className="text-red-600">{row.rejected}</strong></span>
            </div>
          </div>
          <div className="flex gap-1 h-5">
            <div className="bg-primary/70 rounded-sm h-full transition-all duration-500" style={{ width: `${(row.created / maxCreated) * 100}%` }} />
            <div className="bg-emerald-500/70 rounded-sm h-full transition-all duration-500" style={{ width: `${(row.approved / maxCreated) * 100}%` }} />
            <div className="bg-red-500/70 rounded-sm h-full transition-all duration-500" style={{ width: `${(row.rejected / maxCreated) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/70" />Created</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/70" />Approved</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500/70" />Rejected</span>
      </div>
    </div>
  )
}

export default function Reports() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(SAMPLE_SUMMARY)
  const [statusDist, setStatusDist] = useState(SAMPLE_STATUS_DISTRIBUTION)
  const [trends, setTrends] = useState(SAMPLE_MONTHLY_TRENDS)
  const [approverStats, setApproverStats] = useState(SAMPLE_APPROVER_STATS)
  const [productChanges, setProductChanges] = useState(SAMPLE_PRODUCT_CHANGES)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true)
      try {
        const res = await getEcoSummaryReport()
        if (res.data) {
          if (res.data.summary) setSummary(res.data.summary)
          if (res.data.status_distribution) setStatusDist(res.data.status_distribution)
          if (res.data.monthly_trends) setTrends(res.data.monthly_trends)
          if (res.data.approver_stats) setApproverStats(res.data.approver_stats)
          if (res.data.product_changes) setProductChanges(res.data.product_changes)
        }
      } catch {
        // Keep sample data
      } finally {
        setIsLoading(false)
      }
    }
    fetchReports()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Overview of ECO activity, approval performance, and product change history."
      />

      {/* ── Key Metrics ──────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total ECOs"
          value={summary.total_ecos}
          icon={FileText}
          trend="up"
          trendValue={summary.total_ecos_change}
          description="vs last month"
        />
        <StatCard
          title="Avg Approval Time"
          value={summary.avg_approval_time}
          icon={Clock}
          trend="neutral"
          description="across all stages"
        />
        <StatCard
          title="Approval Rate"
          value={`${summary.approval_rate}%`}
          icon={CheckCircle2}
          trend={summary.approval_rate_change > 0 ? 'up' : 'down'}
          trendValue={summary.approval_rate_change}
          description="vs last month"
        />
        <StatCard
          title="Pending Approvals"
          value={summary.pending_approvals}
          icon={Users}
          description="awaiting review"
        />
      </div>

      {/* ── Charts / Tables ──────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvers">Approver Performance</TabsTrigger>
          <TabsTrigger value="products">Product Changes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> ECO Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BarChartVisual data={statusDist} />
              </CardContent>
            </Card>

            {/* Monthly Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Monthly Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={trends} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Approver Performance Tab */}
        <TabsContent value="approvers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Approver Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Approver</TableHead>
                      <TableHead className="text-center">Approved</TableHead>
                      <TableHead className="text-center">Rejected</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead className="text-center">Avg Response Time</TableHead>
                      <TableHead className="text-center">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approverStats.map((a) => {
                      const total = a.approved + a.rejected
                      const rate = total > 0 ? Math.round((a.approved / total) * 100) : 0
                      return (
                        <TableRow key={a.name}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-emerald-600 font-semibold">{a.approved}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-red-600 font-semibold">{a.rejected}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {a.pending > 0 ? (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                {a.pending}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{a.avg_time}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{rate}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product Changes Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Product Change Frequency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Total ECOs</TableHead>
                      <TableHead className="text-center">Applied</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead>Last Change</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productChanges.map((p) => (
                      <TableRow key={p.product}>
                        <TableCell className="font-medium">{p.product}</TableCell>
                        <TableCell className="text-center font-semibold">{p.total_ecos}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-emerald-600">{p.applied}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {p.pending > 0 ? (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                              {p.pending}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(p.last_change).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/ecos?product=${encodeURIComponent(p.product)}`)}>
                            View ECOs
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
