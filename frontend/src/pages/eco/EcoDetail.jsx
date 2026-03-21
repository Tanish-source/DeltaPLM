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

export default function EcoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const [eco, setEco] = useState(null)
  const [changes, setChanges] = useState([])
  const [stages, setStages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

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
        setEco(null)
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
        setChanges([])
      }

      // Stages
      if (stagesRes.status === 'fulfilled' && stagesRes.value.data) {
        const s = stagesRes.value.data
        setStages(Array.isArray(s) ? s : [])
      } else {
        setStages([])
      }
    } catch (error) {
      console.error('Failed to fetch ECO details:', error)
      setEco(null)
      setChanges([])
      setStages([])
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
    setActionError('')
    try {
      await submitEco(id)
      await fetchData()
    } catch (error) {
      setActionError(error?.response?.data?.error || 'Submit failed.')
      console.error('Submit failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveReject = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      if (commentDialog.action === 'approve') {
        await approveEco(id, comment)
      } else {
        await rejectEco(id, comment)
      }
      setCommentDialog({ open: false, action: null })
      setComment('')
      await fetchData()
    } catch (error) {
      setActionError(error?.response?.data?.error || 'Action failed.')
      console.error('Action failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleValidate = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      await validateEco(id)
      await fetchData()
    } catch (error) {
      setActionError(error?.response?.data?.error || 'Validation failed.')
      console.error('Validation failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApply = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      await applyEco(id)
      setApplyDialog(false)
      await fetchData()
    } catch (error) {
      setActionError(error?.response?.data?.error || 'Apply failed.')
      console.error('Apply failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  // ── Derived state ────────────────────────────────────────────
  const isCreator =
    eco && user && (eco.created_by === user.id || eco.created_by_username === user.username)

  const currentStageApprovers = (eco?.approvals || []).filter(
    (a) => String(a.stage) === String(eco?.current_stage)
  )
  const stageHasNoApprovers = currentStageApprovers.length === 0
  const isOps = hasRole(ROLES.OPERATIONS)
  const canReviewApprovalStage = eco?.status === ECO_STATUS.APPROVAL && !isOps

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
              {ECO_TYPE_LABELS[eco.eco_type] || eco.eco_type} &mdash; {eco.product_name || `Product ${eco.product}`} 
              {eco.eco_type === 'bom' && (eco.bom_reference ? ` (BoM: ${eco.bom_reference})` : ` (BoM: ${eco.bom})`)}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {eco.created_by_username || 'Unknown'}
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

      {actionError && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="py-3 text-sm text-red-700">
            {actionError}
          </CardContent>
        </Card>
      )}

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
      {canReviewApprovalStage && (
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
                Updated to Version {eco.new_version || 'N+1'}.
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
          {canReviewApprovalStage && eco?.can_approve && eco?.can_reject && (
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
          {canReviewApprovalStage && eco?.can_validate && stageHasNoApprovers && (
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
          {eco?.can_apply && (
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
