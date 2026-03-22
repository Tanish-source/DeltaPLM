import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getEco,
  getEcoDiff,
  submitEco,
  approveEco,
  rejectEco,
  validateEco,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import StageProgress from '@/components/shared/StageProgress'

import {
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  Diff,
  Equal,
  ExternalLink,
  FastForward,
  Layers,
  Minus,
  Plus,
  Send,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react'

function ChangePill({ type }) {
  if (type === 'add') {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Added
      </span>
    )
  }

  if (type === 'remove') {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Removed
      </span>
    )
  }

  if (type === 'modify') {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Modified
      </span>
    )
  }

  return null
}

export default function EcoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const [eco, setEco] = useState(null)
  const [diff, setDiff] = useState(null)
  const [stages, setStages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [ecoRes, diffRes, stagesRes] = await Promise.allSettled([
        getEco(id),
        getEcoDiff(id),
        getStages(),
      ])

      if (ecoRes.status === 'fulfilled' && ecoRes.value.data) {
        setEco(ecoRes.value.data)
      } else {
        setEco(null)
      }

      if (diffRes.status === 'fulfilled' && diffRes.value.data) {
        setDiff(diffRes.value.data)
      } else {
        setDiff(null)
      }

      if (stagesRes.status === 'fulfilled' && stagesRes.value.data) {
        const stagesData = stagesRes.value.data?.results || stagesRes.value.data || []
        setStages(Array.isArray(stagesData) ? stagesData : [])
      } else {
        setStages([])
      }
    } catch (error) {
      console.error('Failed to fetch ECO details:', error)
      setEco(null)
      setDiff(null)
      setStages([])
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      await submitEco(id)
      await fetchData()
    } catch (error) {
      setActionError(error?.response?.data?.error || 'Start failed.')
      console.error('Start failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveReject = async (action) => {
    setActionLoading(true)
    setActionError('')
    try {
      if (action === 'approve') {
        await approveEco(id, '')
      } else {
        await rejectEco(id, '')
      }
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

  const isCreator =
    eco && user && (eco.created_by === user.id || eco.created_by_username === user.username)

  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence)
  const currentStageConfig =
    sortedStages.find((stage) => String(stage.id) === String(eco?.current_stage)) || null
  const stageSummaryById = new Map(
    (eco?.stage_summary || []).map((summary) => [String(summary.stage_id), summary])
  )
  const approvalsByStageId = (eco?.approvals || []).reduce((acc, approval) => {
    const key = String(approval.stage)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(approval)
    return acc
  }, {})
  const currentStageAssignments = currentStageConfig?.approvers || []
  const stageHasNoApprovers = currentStageAssignments.length === 0
  const isCurrentStageApprover = currentStageAssignments.some(
    (assignment) => String(assignment.user) === String(user?.id)
  )
  const isOps = hasRole(ROLES.OPERATIONS)
  const canReviewApprovalStage = eco?.status === ECO_STATUS.APPROVAL && !isOps
  const canApproveReject =
    canReviewApprovalStage && eco?.can_approve && eco?.can_reject && isCurrentStageApprover
  const canValidateCurrentStage =
    canReviewApprovalStage && eco?.can_validate && stageHasNoApprovers
  const isProductDiff = diff?.type === 'product'
  const isBomDiff = diff?.type === 'bom'

  const getStageStatusMeta = (stage) => {
    const summary = stageSummaryById.get(String(stage.id))
    const status = summary?.status || 'upcoming'

    if (status === 'approved') {
      return {
        label: 'Approved',
        classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      }
    }
    if (status === 'rejected') {
      return {
        label: 'Rejected',
        classes: 'bg-red-100 text-red-800 border-red-200',
      }
    }
    if (status === 'in_progress') {
      return {
        label: 'In Review',
        classes: 'bg-amber-100 text-amber-800 border-amber-200',
      }
    }
    if (String(stage.id) === String(eco?.current_stage) && eco?.status === ECO_STATUS.APPROVAL) {
      return {
        label: 'Current',
        classes: 'bg-blue-100 text-blue-800 border-blue-200',
      }
    }
    return {
      label: 'Upcoming',
      classes: 'bg-muted text-muted-foreground border-border',
    }
  }

  const getStageApproverRows = (stage) => {
    const configuredApprovers = stage.approvers || []
    const stageApprovals = approvalsByStageId[String(stage.id)] || []

    if (!configuredApprovers.length) {
      return stageApprovals
    }

    return configuredApprovers.map((assignment) => {
      const approval = stageApprovals.find(
        (entry) => String(entry.user) === String(assignment.user)
      )
      return {
        id: assignment.id,
        user: assignment.user,
        username: assignment.username,
        category: assignment.category,
        decision: approval?.decision || 'pending',
        comment: approval?.comment || '',
        decided_at: approval?.decided_at || null,
      }
    })
  }

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
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground -ml-2"
        onClick={() => navigate('/ecos')}
      >
        <ArrowLeft className="h-4 w-4" /> Back to ECOs
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{eco.title}</h1>
            <StatusBadge status={eco.status} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              {ECO_TYPE_LABELS[eco.eco_type] || eco.eco_type} - {eco.product_name || `Product ${eco.product}`}
              {eco.eco_type === 'bom' &&
                (eco.bom_reference ? ` (BoM: ${eco.bom_reference})` : ` (BoM: ${eco.bom})`)}
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

        {eco.status === ECO_STATUS.NEW && !isOps && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/ecos/${id}/edit`)}>
            Edit Draft
          </Button>
        )}
      </div>

      <Separator />

      {actionError && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="py-3 text-sm text-red-700">{actionError}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <StageProgress
            stages={stages}
            currentStageId={eco.current_stage}
            ecoStatus={eco.status}
            rejectedStageId={eco.rejected_stage}
          />

          <div className="grid gap-4 md:grid-cols-2">
            {sortedStages.map((stage) => {
              const stageMeta = getStageStatusMeta(stage)
              const stageApproverRows = getStageApproverRows(stage)
              const isCurrentStage = String(stage.id) === String(eco?.current_stage)
              const approvalMode =
                stage.rule?.approval_mode === 'any'
                  ? 'Any one can approve'
                  : 'All required approvers must approve'

              return (
                <div
                  key={stage.id}
                  className={`space-y-3 rounded-lg border p-4 ${
                    isCurrentStage ? 'border-blue-200 bg-blue-50/40' : 'bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{stage.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Step {stage.sequence} - {approvalMode}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${stageMeta.classes}`}
                    >
                      {stageMeta.label}
                    </span>
                  </div>

                  {stageApproverRows.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      No approvers assigned. This stage can be validated to move forward.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stageApproverRows.map((approvalRow) => (
                        <div
                          key={`${stage.id}-${approvalRow.user}-${approvalRow.id}`}
                          className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {approvalRow.username || `User ${approvalRow.user}`}
                            </p>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              {approvalRow.category || 'required'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-xs font-medium uppercase tracking-wide ${
                                approvalRow.decision === 'approved'
                                  ? 'text-emerald-700'
                                  : approvalRow.decision === 'rejected'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                              }`}
                            >
                              {approvalRow.decision || 'pending'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {approvalRow.decided_at
                                ? new Date(approvalRow.decided_at).toLocaleString()
                                : 'Awaiting action'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isCurrentStage && eco.status === ECO_STATUS.APPROVAL && (
                    <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                      {stageApproverRows.length === 0 ? (
                        <>
                          <FastForward className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            This stage has no assigned approvers, so an approval-capable user can
                            validate and advance it.
                          </span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            {isCurrentStageApprover
                              ? 'You are assigned to this stage and can review it now.'
                              : 'This stage is waiting on its assigned approvers.'}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Diff className="h-4 w-4" /> Change Comparison
          </CardTitle>
          {diff && (
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
          {!diff ? (
            <p className="text-sm italic text-muted-foreground">No comparison details available.</p>
          ) : isProductDiff && diff.fields ? (
            <div className="space-y-6">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-48">Field</TableHead>
                      <TableHead className="bg-red-50/50">
                        <div className="flex items-center gap-1.5">
                          <Minus className="h-3.5 w-3.5 text-red-500" />
                          Before
                          {diff.old_version ? ` (v${diff.old_version})` : ''}
                        </div>
                      </TableHead>
                      <TableHead className="bg-emerald-50/50">
                        <div className="flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5 text-emerald-500" />
                          After
                          {diff.new_version ? ` (v${diff.new_version})` : ''}
                        </div>
                      </TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diff.fields.map((field) => (
                      <TableRow key={field.field} className={field.changed ? 'bg-amber-50/30' : ''}>
                        <TableCell className="font-medium">{field.label}</TableCell>
                        <TableCell
                          className={field.changed ? 'text-red-600 line-through' : 'text-muted-foreground'}
                        >
                          {field.old || '—'}
                        </TableCell>
                        <TableCell
                          className={field.changed ? 'font-semibold text-emerald-700' : 'text-muted-foreground'}
                        >
                          {field.new || '—'}
                        </TableCell>
                        <TableCell>
                          {field.changed ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Changed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Equal className="h-3 w-3" /> Same
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Attachment Changes</h3>
                {!diff.attachments?.length ? (
                  <p className="text-sm italic text-muted-foreground">No attachment changes.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Attachment</TableHead>
                          <TableHead>Before</TableHead>
                          <TableHead>After</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diff.attachments.map((attachment) => (
                          <TableRow
                            key={attachment.id}
                            className={
                              attachment.change === 'add'
                                ? 'bg-emerald-50/30'
                                : 'bg-red-50/30'
                            }
                          >
                            <TableCell className="font-medium">
                              {attachment.name || attachment.new_name || attachment.old_name || 'Attachment'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {attachment.old_name || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {attachment.new_name || '—'}
                            </TableCell>
                            <TableCell>
                              <ChangePill type={attachment.change} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : isBomDiff ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">Components</h3>
                  {diff.bom_version && (
                    <span className="text-xs text-muted-foreground">Version {diff.bom_version}</span>
                  )}
                </div>
                {!diff.components?.length ? (
                  <p className="text-sm italic text-muted-foreground">No component changes.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead className="text-center bg-red-50/50">Old Qty</TableHead>
                          <TableHead className="text-center bg-emerald-50/50">New Qty</TableHead>
                          <TableHead className="text-center">Delta</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diff.components.map((component, index) => {
                          const delta = (component.new_qty || 0) - (component.old_qty || 0)
                          return (
                            <TableRow
                              key={`${component.name}-${index}`}
                              className={
                                component.change === 'add'
                                  ? 'bg-emerald-50/30'
                                  : component.change === 'remove'
                                    ? 'bg-red-50/30'
                                    : delta !== 0
                                      ? 'bg-amber-50/30'
                                      : ''
                              }
                            >
                              <TableCell className="font-medium">{component.name}</TableCell>
                              <TableCell className="text-center">{component.old_qty ?? '—'}</TableCell>
                              <TableCell className="text-center">{component.new_qty ?? '—'}</TableCell>
                              <TableCell className="text-center">
                                {delta > 0 ? (
                                  <span className="font-semibold text-emerald-600">+{delta}</span>
                                ) : delta < 0 ? (
                                  <span className="font-semibold text-red-600">{delta}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <ChangePill type={component.change} />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Operations</h3>
                {!diff.operations?.length ? (
                  <p className="text-sm italic text-muted-foreground">No operation changes.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Operation</TableHead>
                          <TableHead className="bg-red-50/50">Old Work Center</TableHead>
                          <TableHead className="bg-emerald-50/50">New Work Center</TableHead>
                          <TableHead className="bg-red-50/50">Old Duration</TableHead>
                          <TableHead className="bg-emerald-50/50">New Duration</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diff.operations.map((operation, index) => (
                          <TableRow
                            key={`${operation.name}-${index}`}
                            className={
                              operation.change === 'add'
                                ? 'bg-emerald-50/30'
                                : operation.change === 'remove'
                                  ? 'bg-red-50/30'
                                  : operation.changed
                                    ? 'bg-amber-50/30'
                                    : ''
                            }
                          >
                            <TableCell className="font-medium">{operation.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {operation.old_work_center ?? '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {operation.new_work_center ?? '—'}
                            </TableCell>
                            <TableCell
                              className={operation.changed ? 'text-red-600 line-through' : 'text-muted-foreground'}
                            >
                              {operation.old_duration ?? '—'}
                            </TableCell>
                            <TableCell
                              className={operation.changed ? 'font-semibold text-emerald-700' : 'text-muted-foreground'}
                            >
                              {operation.new_duration ?? '—'}
                            </TableCell>
                            <TableCell>
                              {operation.change ? (
                                <ChangePill type={operation.change} />
                              ) : operation.changed ? (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  Changed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Equal className="h-3 w-3" /> Same
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No comparison details available.</p>
          )}
        </CardContent>
      </Card>

      {eco.status === ECO_STATUS.APPLIED && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-emerald-800">Changes have been applied.</p>
              <p className="text-sm text-emerald-700">
                Updated to Version {eco.new_version || 'N+1'}.
              </p>
            </div>
            <div className="flex gap-2">
              {eco.eco_type === 'bom' && (eco.applied_record_id || eco.bom) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/boms/${eco.applied_record_id || eco.bom}`)}
                >
                  View BoM
                </Button>
              ) : (eco.applied_record_id || eco.product) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/products/${eco.applied_record_id || eco.product}`)}
                >
                  View Product
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {!isOps && (
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          {eco.status === ECO_STATUS.NEW && isCreator && (
            <Button onClick={handleSubmit} disabled={actionLoading} className="gap-1.5">
              <Send className="h-4 w-4" /> Start
            </Button>
          )}

          {canApproveReject && (
            <>
              <Button
                variant="outline"
                onClick={() => handleApproveReject('reject')}
                disabled={actionLoading}
                className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button
                onClick={() => handleApproveReject('approve')}
                disabled={actionLoading}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            </>
          )}

          {canValidateCurrentStage && (
            <Button
              variant="secondary"
              onClick={handleValidate}
              disabled={actionLoading}
              className="gap-1.5"
            >
              <FastForward className="h-4 w-4" /> Validate and Advance
            </Button>
          )}
        </div>
      )}

    </div>
  )
}
