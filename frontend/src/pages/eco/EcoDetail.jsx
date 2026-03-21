import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getEco,
  getEcoChanges,
  submitEco,
  approveEco,
  rejectEco,
  validateEco,
  applyEco,
} from '@/api/ecos'
import { getStages } from '@/api/stages'
import { useAuth } from '@/contexts/AuthContext'
import {
  ECO_STATUS,
  ECO_TYPE_LABELS,
  ACCESS,
  ROLES,
} from '@/lib/constants'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import PageHeader from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import StageProgress from '@/components/shared/StageProgress'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

import {
  ArrowLeft,
  Send,
  CheckCircle2,
  XCircle,
  FastForward,
  ExternalLink,
  CalendarDays,
  User,
  Layers,
} from 'lucide-react'

// ── Sample data (until backend ECO endpoints are ready) ─────────
const SAMPLE_ECOS = {
  1: {
    id: 1, title: 'Price Update Q4', eco_type: 'product', product: 101,
    product_name: 'iPhone 17 Pro', status: 'approval', created_by: 1,
    created_by_name: 'John Doe', created_at: '2026-03-18T10:00:00Z',
    effective_date: '2026-04-01', version_update: true, current_stage: 1,
    current_stage_approvers: [
      { id: 1, user_id: 2, username: 'Sarah Chen', category: 'required', decision: 'approved', decided_at: '2026-03-19T09:00:00Z' },
      { id: 2, user_id: 3, username: 'Mike Johnson', category: 'required', decision: 'pending', decided_at: null },
    ],
  },
  2: {
    id: 2, title: 'Component Revision', eco_type: 'bom', product: 102,
    product_name: 'Galaxy S26', bom: 201, status: 'new', created_by: 2,
    created_by_name: 'Sarah Chen', created_at: '2026-03-19T14:30:00Z',
    effective_date: null, version_update: true, current_stage: null,
    current_stage_approvers: [],
  },
  3: {
    id: 3, title: 'New Assembly Line', eco_type: 'bom', product: 103,
    product_name: 'Pixel 12', bom: 202, status: 'approved', created_by: 3,
    created_by_name: 'Mike Johnson', created_at: '2026-03-17T09:15:00Z',
    effective_date: '2026-03-25', version_update: true, current_stage: 2,
    current_stage_approvers: [],
  },
  4: {
    id: 4, title: 'Cost Reduction', eco_type: 'product', product: 101,
    product_name: 'iPhone 17 Pro', status: 'applied', created_by: 1,
    created_by_name: 'John Doe', created_at: '2026-03-15T11:00:00Z',
    effective_date: '2026-03-20', version_update: true, new_version: 3,
    current_stage: null, current_stage_approvers: [],
  },
  5: {
    id: 5, title: 'Material Change', eco_type: 'bom', product: 102,
    product_name: 'Galaxy S26', bom: 203, status: 'rejected', created_by: 4,
    created_by_name: 'Lisa Wang', created_at: '2026-03-14T16:45:00Z',
    effective_date: null, version_update: false, current_stage: 1,
    rejected_stage: 1, current_stage_approvers: [],
  },
  6: {
    id: 6, title: 'Packaging Redesign', eco_type: 'product', product: 103,
    product_name: 'Pixel 12', status: 'new', created_by: 2,
    created_by_name: 'Sarah Chen', created_at: '2026-03-20T08:00:00Z',
    effective_date: null, version_update: true, current_stage: null,
    current_stage_approvers: [],
  },
  7: {
    id: 7, title: 'Connector Upgrade', eco_type: 'bom', product: 101,
    product_name: 'iPhone 17 Pro', bom: 204, status: 'approval', created_by: 3,
    created_by_name: 'Mike Johnson', created_at: '2026-03-16T13:20:00Z',
    effective_date: '2026-04-10', version_update: true, current_stage: 2,
    current_stage_approvers: [
      { id: 3, user_id: 4, username: 'Lisa Wang', category: 'required', decision: 'pending', decided_at: null },
    ],
  },
}

const SAMPLE_CHANGES = {
  1: [
    { field_name: 'sale_price', old_value: '$500', new_value: '$545' },
    { field_name: 'cost_price', old_value: '$340', new_value: '$360' },
  ],
  2: [
    { target_product_name: 'Capacitor 10μF', old_quantity: 5, new_quantity: 8 },
    { target_product_name: 'Resistor 1kΩ', old_quantity: 6, new_quantity: 3 },
  ],
  3: [
    { target_product_name: 'USB-C Port', old_quantity: 1, new_quantity: 2 },
  ],
  4: [
    { field_name: 'cost_price', old_value: '$340', new_value: '$310' },
  ],
  7: [
    { target_product_name: 'Lightning Connector', old_quantity: 1, new_quantity: 0 },
    { target_product_name: 'USB-C Connector', old_quantity: 0, new_quantity: 1 },
  ],
}

const SAMPLE_STAGES = [
  { id: 1, name: 'Manager Review', sequence: 1, is_active: true },
  { id: 2, name: 'Quality Check', sequence: 2, is_active: true },
  { id: 3, name: 'Final Approval', sequence: 3, is_active: true },
]

export default function EcoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const [eco, setEco] = useState(null)
  const [changes, setChanges] = useState([])
  const [stages, setStages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Dialog state for approve / reject / apply
  const [commentDialog, setCommentDialog] = useState({ open: false, action: null })
  const [applyDialog, setApplyDialog] = useState(false)
  const [comment, setComment] = useState('')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [ecoRes, changesRes, stagesRes] = await Promise.allSettled([
        getEco(id),
        getEcoChanges(id),
        getStages(),
      ])

      // ECO data
      if (ecoRes.status === 'fulfilled' && ecoRes.value.data) {
        setEco(ecoRes.value.data)
      } else {
        setEco(SAMPLE_ECOS[id] || null)
      }

      // Changes
      if (changesRes.status === 'fulfilled' && changesRes.value.data) {
        const chData = changesRes.value.data
        const flatChanges = [
          ...(chData.product_changes || []),
          ...(chData.bom_component_changes || []).map(c => ({
            target_product_name: c.component_product_name,
            old_quantity: c.old_quantity,
            new_quantity: c.new_quantity
          })),
          ...(chData.bom_operation_changes || []).map(c => ({
            target_product_name: c.operation_name,
            old_quantity: c.old_duration,
            new_quantity: c.new_duration
          }))
        ]
        setChanges(flatChanges)
      } else {
        setChanges(SAMPLE_CHANGES[id] || [])
      }

      // Stages
      if (stagesRes.status === 'fulfilled' && stagesRes.value.data) {
        const s = stagesRes.value.data
        setStages(Array.isArray(s) ? s : [])
      } else {
        setStages(SAMPLE_STAGES)
      }
    } catch {
      // Full fallback
      setEco(SAMPLE_ECOS[id] || null)
      setChanges(SAMPLE_CHANGES[id] || [])
      setStages(SAMPLE_STAGES)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Action handlers ──────────────────────────────────────────
  const handleSubmit = async () => {
    setActionLoading(true)
    try {
      await submitEco(id)
      await fetchData()
    } catch {
      // Demo fallback: just change status locally
      setEco(prev => prev ? { ...prev, status: 'approval', current_stage: SAMPLE_STAGES[0]?.id } : prev)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveReject = async () => {
    setActionLoading(true)
    try {
      if (commentDialog.action === 'approve') {
        await approveEco(id, comment)
      } else {
        await rejectEco(id, comment)
      }
      setCommentDialog({ open: false, action: null })
      setComment('')
      await fetchData()
    } catch {
      // Demo fallback
      if (commentDialog.action === 'approve') {
        setEco(prev => prev ? { ...prev, status: 'approved' } : prev)
      } else {
        setEco(prev => prev ? { ...prev, status: 'rejected', rejected_stage: prev.current_stage } : prev)
      }
      setCommentDialog({ open: false, action: null })
      setComment('')
    } finally {
      setActionLoading(false)
    }
  }

  const handleValidate = async () => {
    setActionLoading(true)
    try {
      await validateEco(id)
      await fetchData()
    } catch {
      setEco(prev => prev ? { ...prev, status: 'approved' } : prev)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApply = async () => {
    setActionLoading(true)
    try {
      await applyEco(id)
      setApplyDialog(false)
      await fetchData()
    } catch {
      setEco(prev => prev ? { ...prev, status: 'applied' } : prev)
      setApplyDialog(false)
    } finally {
      setActionLoading(false)
    }
  }

  // ── Derived state ────────────────────────────────────────────
  const isCreator =
    eco && user && (eco.created_by === user.id || eco.created_by_name === user.username)

  const currentStageApprovers = (eco?.approvals || []).filter(
    (a) => a.stage === eco?.current_stage
  )
  const isAssignedApprover = currentStageApprovers.some(
    (a) => a.user === user?.id
  )
  const stageHasNoApprovers = currentStageApprovers.length === 0
  const isOps = hasRole(ROLES.OPERATIONS)

  // ── Loading / empty state ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!eco) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        ECO not found.{' '}
        <Button variant="link" onClick={() => navigate('/ecos')}>
          Back to list
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground -ml-2"
        onClick={() => navigate('/ecos')}
      >
        <ArrowLeft className="h-4 w-4" /> Back to ECOs
      </Button>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {eco.title}
            </h1>
            <StatusBadge status={eco.status} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              {ECO_TYPE_LABELS[eco.eco_type] || eco.eco_type}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {eco.created_by_name || 'Unknown'}
            </span>
            {eco.effective_date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date(eco.effective_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Quick-nav button */}
        {eco.status === ECO_STATUS.NEW && !isOps && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/ecos/${id}`)}
          >
            Edit Draft
          </Button>
        )}
      </div>

      <Separator />

      {/* ── Stage Progress ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <StageProgress
            stages={stages}
            currentStageId={eco.current_stage}
            ecoStatus={eco.status}
            rejectedStageId={eco.rejected_stage}
          />
        </CardContent>
      </Card>

      {/* ── Proposed Changes ─────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Proposed Changes</CardTitle>
          {(eco.status === ECO_STATUS.APPROVED ||
            eco.status === ECO_STATUS.APPLIED) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/comparison/${id}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Full Comparison
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No change details recorded.
            </p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field / Item</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map((ch, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {ch.field_name || ch.target_product_name || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ch.old_value ?? ch.old_quantity ?? '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-red-600 font-medium">
                          {ch.new_value ?? ch.new_quantity ?? '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Current Stage Approvers ──────────────────────────── */}
      {eco.status === ECO_STATUS.APPROVAL && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Current Stage — Approvers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentStageApprovers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No approvers assigned to this stage.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Approver</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Decided At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentStageApprovers.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {a.username || a.user_name || '-'}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs uppercase tracking-wider text-muted-foreground">
                            {a.category || 'Required'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {a.decision === 'approved' ? (
                            <span className="text-emerald-600 font-medium">
                              Approved
                            </span>
                          ) : a.decision === 'rejected' ? (
                            <span className="text-red-600 font-medium">
                              Rejected
                            </span>
                          ) : (
                            <span className="text-amber-600">Pending</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {a.decided_at
                            ? new Date(a.decided_at).toLocaleString()
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Applied Banner ───────────────────────────────────── */}
      {eco.status === ECO_STATUS.APPLIED && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-emerald-800">
                ✅ Changes have been applied.
              </p>
              <p className="text-sm text-emerald-700">
                Product updated to Version {eco.new_version || 'N+1'}.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/comparison/${id}`)}
              >
                View Comparison
              </Button>
              {eco.product && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/products/${eco.product}`)}
                >
                  View Product
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Action Buttons ───────────────────────────────────── */}
      {!isOps && (
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          {/* Submit — creator, status=new */}
          {eco.status === ECO_STATUS.NEW && isCreator && (
            <Button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" /> Submit for Approval
            </Button>
          )}

          {/* Approve / Reject — assigned approver, status=approval */}
          {eco.status === ECO_STATUS.APPROVAL && isAssignedApprover && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  setCommentDialog({ open: true, action: 'reject' })
                }
                disabled={actionLoading}
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button
                onClick={() =>
                  setCommentDialog({ open: true, action: 'approve' })
                }
                disabled={actionLoading}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            </>
          )}

          {/* Validate — stage has no approvers, user is eng/admin */}
          {eco.status === ECO_STATUS.APPROVAL &&
            stageHasNoApprovers &&
            hasRole(ACCESS.CREATE_ECO) && (
              <Button
                variant="secondary"
                onClick={handleValidate}
                disabled={actionLoading}
                className="gap-1.5"
              >
                <FastForward className="h-4 w-4" /> Validate & Advance
              </Button>
            )}

          {/* Apply — final step, status=approved */}
          {eco.status === ECO_STATUS.APPROVED && hasRole(ACCESS.CREATE_ECO) && (
            <Button
              onClick={() => setApplyDialog(true)}
              disabled={actionLoading}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Apply Changes
            </Button>
          )}
        </div>
      )}

      {/* ── Approve / Reject Comment Dialog ──────────────────── */}
      <Dialog
        open={commentDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setCommentDialog({ open: false, action: null })
            setComment('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {commentDialog.action === 'approve'
                ? 'Approve ECO'
                : 'Reject ECO'}
            </DialogTitle>
            <DialogDescription>
              {commentDialog.action === 'approve'
                ? 'Add an optional comment for this approval.'
                : 'Please provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter your comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCommentDialog({ open: false, action: null })
                setComment('')
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant={
                commentDialog.action === 'reject' ? 'destructive' : 'default'
              }
              onClick={handleApproveReject}
              disabled={
                actionLoading ||
                (commentDialog.action === 'reject' && !comment.trim())
              }
            >
              {actionLoading
                ? 'Processing...'
                : commentDialog.action === 'approve'
                  ? 'Approve'
                  : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Apply Confirm Dialog ─────────────────────────────── */}
      <ConfirmDialog
        open={applyDialog}
        onOpenChange={setApplyDialog}
        title="Apply Configuration Changes?"
        description={`This will apply all proposed changes to master data.${eco.version_update ? ' A new version will be created, and the old version will be archived.' : ' Changes will be applied in-place without creating a new version.'}`}
        confirmLabel="Apply Changes"
        onConfirm={handleApply}
        isLoading={actionLoading}
      />
    </div>
  )
}
