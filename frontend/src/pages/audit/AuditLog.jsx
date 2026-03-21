import { useState, useEffect } from 'react'
import { getAuditLogs } from '@/api/audit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import PageHeader from '@/components/shared/PageHeader'
import {
  ScrollText,
  Search,
  User,
  FileText,
  Settings,
  CheckCircle2,
  XCircle,
  Send,
  Shield,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// ── Sample data ─────────────────────────────────────────────────
const SAMPLE_AUDIT_LOGS = [
  { id: 1, action: 'eco_created', actor: 'John Doe', actor_role: 'engineering', target: 'ECO: Price Update Q4', details: 'Created new product ECO for iPhone 17 Pro', timestamp: '2026-03-21T18:05:00Z', eco_id: 1 },
  { id: 2, action: 'eco_submitted', actor: 'John Doe', actor_role: 'engineering', target: 'ECO: Price Update Q4', details: 'Submitted ECO for approval', timestamp: '2026-03-21T17:30:00Z', eco_id: 1 },
  { id: 3, action: 'eco_approved', actor: 'Sarah Chen', actor_role: 'approver', target: 'ECO: Price Update Q4', details: 'Approved at Manager Review stage. Comment: "Pricing looks appropriate for Q4."', timestamp: '2026-03-21T16:00:00Z', eco_id: 1 },
  { id: 4, action: 'eco_rejected', actor: 'Lisa Wang', actor_role: 'approver', target: 'ECO: Material Change', details: 'Rejected at Quality Check stage. Reason: "Materials fail compliance test ISO-9001."', timestamp: '2026-03-21T14:45:00Z', eco_id: 5 },
  { id: 5, action: 'stage_created', actor: 'Admin', actor_role: 'admin', target: 'Stage: Final Approval', details: 'Created new approval stage with sequence 3', timestamp: '2026-03-21T12:00:00Z', eco_id: null },
  { id: 6, action: 'approver_added', actor: 'Admin', actor_role: 'admin', target: 'Stage: Manager Review', details: 'Added Sarah Chen as required approver', timestamp: '2026-03-21T11:50:00Z', eco_id: null },
  { id: 7, action: 'eco_created', actor: 'Sarah Chen', actor_role: 'engineering', target: 'ECO: Component Revision', details: 'Created new BoM ECO for Galaxy S26', timestamp: '2026-03-20T14:30:00Z', eco_id: 2 },
  { id: 8, action: 'product_created', actor: 'Mike Johnson', actor_role: 'engineering', target: 'Product: Pixel 12', details: 'Created new product with sale price $699', timestamp: '2026-03-20T10:00:00Z', eco_id: null },
  { id: 9, action: 'eco_applied', actor: 'System', actor_role: 'admin', target: 'ECO: Cost Reduction', details: 'ECO changes applied. iPhone 17 Pro updated to version 3.', timestamp: '2026-03-19T09:00:00Z', eco_id: 4 },
  { id: 10, action: 'eco_approved', actor: 'Mike Johnson', actor_role: 'approver', target: 'ECO: New Assembly Line', details: 'Approved at Final Approval stage.', timestamp: '2026-03-18T16:00:00Z', eco_id: 3 },
  { id: 11, action: 'bom_created', actor: 'John Doe', actor_role: 'engineering', target: 'BoM: Galaxy S26 v1', details: 'Created BoM with 8 components and 3 operations', timestamp: '2026-03-17T09:15:00Z', eco_id: null },
  { id: 12, action: 'eco_submitted', actor: 'Mike Johnson', actor_role: 'engineering', target: 'ECO: Connector Upgrade', details: 'Submitted ECO for approval', timestamp: '2026-03-16T13:20:00Z', eco_id: 7 },
]

const ACTION_CONFIG = {
  eco_created: { icon: Plus, label: 'ECO Created', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  eco_submitted: { icon: Send, label: 'ECO Submitted', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  eco_approved: { icon: CheckCircle2, label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  eco_rejected: { icon: XCircle, label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200' },
  eco_applied: { icon: Shield, label: 'Applied', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  stage_created: { icon: Settings, label: 'Stage Created', color: 'bg-secondary text-secondary-foreground border-border' },
  approver_added: { icon: User, label: 'Approver Added', color: 'bg-secondary text-secondary-foreground border-border' },
  product_created: { icon: Plus, label: 'Product Created', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  bom_created: { icon: Plus, label: 'BoM Created', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  default: { icon: FileText, label: 'Action', color: 'bg-secondary text-secondary-foreground border-border' },
}

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'eco_created', label: 'ECO Created' },
  { value: 'eco_submitted', label: 'ECO Submitted' },
  { value: 'eco_approved', label: 'Approved' },
  { value: 'eco_rejected', label: 'Rejected' },
  { value: 'eco_applied', label: 'Applied' },
  { value: 'stage_created', label: 'Stage Created' },
  { value: 'approver_added', label: 'Approver Added' },
  { value: 'product_created', label: 'Product Created' },
  { value: 'bom_created', label: 'BoM Created' },
]

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [allLogs, setAllLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [page, setPage] = useState(1)
  const perPage = 10

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const res = await getAuditLogs()
      const data = res.data?.results || res.data || []
      setAllLogs(Array.isArray(data) && data.length > 0 ? data : SAMPLE_AUDIT_LOGS)
    } catch {
      setAllLogs([...SAMPLE_AUDIT_LOGS])
    } finally {
      setIsLoading(false)
    }
  }

  // Client-side filtering
  useEffect(() => {
    let filtered = [...allLogs]
    if (actionFilter !== 'all') {
      filtered = filtered.filter(l => l.action === actionFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(l =>
        l.actor?.toLowerCase().includes(q) ||
        l.target?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q)
      )
    }
    setLogs(filtered)
    setPage(1)
  }, [allLogs, search, actionFilter])

  const totalPages = Math.max(1, Math.ceil(logs.length / perPage))
  const paginatedLogs = logs.slice((page - 1) * perPage, page * perPage)

  const formatTimestamp = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all actions across ECOs, products, stages, and user management."
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-52">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No audit logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Timestamp</TableHead>
                    <TableHead className="w-32">Action</TableHead>
                    <TableHead className="w-36">User</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => {
                    const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.default
                    const Icon = config.icon
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs gap-1 ${config.color}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm font-medium">{log.actor}</span>
                            <p className="text-xs text-muted-foreground capitalize">{log.actor_role}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{log.target}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {log.details}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {logs.length > perPage && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, logs.length)} of {logs.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
