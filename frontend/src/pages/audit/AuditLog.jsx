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

const ACTION_CONFIG = {
  eco_created: { icon: Plus, label: 'ECO Created', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  eco_submitted: { icon: Send, label: 'ECO Submitted', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  approval_given: { icon: CheckCircle2, label: 'Approval Given', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  approval_rejected: { icon: XCircle, label: 'Approval Rejected', color: 'bg-red-100 text-red-700 border-red-200' },
  stage_changed: { icon: Settings, label: 'Stage Changed', color: 'bg-secondary text-secondary-foreground border-border' },
  version_created: { icon: Shield, label: 'Version Created', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  record_archived: { icon: Pencil, label: 'Archived', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  record_updated: { icon: Pencil, label: 'Updated', color: 'bg-secondary text-secondary-foreground border-border' },
  default: { icon: FileText, label: 'Action', color: 'bg-secondary text-secondary-foreground border-border' },
}

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'eco_created', label: 'ECO Created' },
  { value: 'eco_submitted', label: 'ECO Submitted' },
  { value: 'approval_given', label: 'Approval Given' },
  { value: 'approval_rejected', label: 'Approval Rejected' },
  { value: 'stage_changed', label: 'Stage Changed' },
  { value: 'version_created', label: 'Version Created' },
  { value: 'record_archived', label: 'Archived' },
  { value: 'record_updated', label: 'Updated' },
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
      setAllLogs(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      setAllLogs([])
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
