import { useState, useEffect } from 'react'
import {
  getStages,
  createStage,
  updateStage,
  deleteStage,
  getStageApprovers,
  addStageApprover,
  removeStageApprover,
  getStageRule,
  updateStageRule,
} from '@/api/stages'
import { getUsers } from '@/api/users'
import { ROLES } from '@/lib/constants'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import PageHeader from '@/components/shared/PageHeader'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import FormField from '@/components/shared/FormField'

import { Plus, Trash2, Settings2, Users, X } from 'lucide-react'

// ── Sample data (until backend Stage endpoints are ready) ────
const SAMPLE_STAGES = [
  { id: 1, name: 'Manager Review', sequence: 1, is_active: true, approver_count: 2 },
  { id: 2, name: 'Quality Check', sequence: 2, is_active: true, approver_count: 1 },
  { id: 3, name: 'Final Approval', sequence: 3, is_active: false, approver_count: 0 },
]

const SAMPLE_APPROVERS = {
  1: [
    { id: 1, user_id: 2, username: 'Sarah Chen', role: 'approver', category: 'required' },
    { id: 2, user_id: 3, username: 'Mike Johnson', role: 'approver', category: 'optional' },
  ],
  2: [
    { id: 3, user_id: 4, username: 'Lisa Wang', role: 'approver', category: 'required' },
  ],
  3: [],
}

const SAMPLE_USERS = [
  { id: 2, username: 'Sarah Chen', role: 'approver' },
  { id: 3, username: 'Mike Johnson', role: 'approver' },
  { id: 4, username: 'Lisa Wang', role: 'approver' },
  { id: 5, username: 'Alex Rivera', role: 'approver' },
]

export default function StageSettings() {
  const [stages, setStages] = useState([])
  const [selectedStage, setSelectedStage] = useState(null)
  const [approvers, setApprovers] = useState([])
  const [rule, setRule] = useState({ approval_mode: 'all' })
  const [allUsers, setAllUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // New-stage dialog
  const [newDialog, setNewDialog] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [newStageSeq, setNewStageSeq] = useState(1)

  // Add-approver dialog
  const [addApproverDialog, setAddApproverDialog] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [approverCategory, setApproverCategory] = useState('required')

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, stageId: null })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadStages()
    loadUsers()
  }, [])

  const loadStages = async () => {
    setIsLoading(true)
    try {
      const res = await getStages()
      const stagesData = res.data?.results || res.data || []
      const sortedStages = (Array.isArray(stagesData) && stagesData.length > 0 ? stagesData : SAMPLE_STAGES).sort((a, b) => a.sequence - b.sequence)
      setStages(sortedStages)
    } catch {
      setStages([...SAMPLE_STAGES])
    } finally {
      setIsLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const res = await getUsers({ role: ROLES.APPROVER })
      const usersData = res.data?.results || res.data || []
      setAllUsers(Array.isArray(usersData) && usersData.length > 0 ? usersData : SAMPLE_USERS)
    } catch {
      setAllUsers([...SAMPLE_USERS])
    }
  }

  const selectStage = async (stage) => {
    setSelectedStage(stage)
    try {
      const [approversRes, ruleRes] = await Promise.allSettled([
        getStageApprovers(stage.id),
        getStageRule(stage.id),
      ])
      const approversData = approversRes.status === 'fulfilled' ? (approversRes.value.data || []) : (SAMPLE_APPROVERS[stage.id] || [])
      const ruleData = ruleRes.status === 'fulfilled' ? (ruleRes.value.data || { approval_mode: 'all' }) : { approval_mode: 'all' }
      setApprovers(approversData)
      setRule(ruleData)
    } catch {
      setApprovers(SAMPLE_APPROVERS[stage.id] || [])
      setRule({ approval_mode: 'all' })
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────

  const handleCreateStage = async () => {
    if (!newStageName.trim()) return
    setSaving(true)
    try {
      await createStage({ name: newStageName, sequence: newStageSeq, is_active: true })
      setNewDialog(false)
      setNewStageName('')
      setNewStageSeq(stages.length + 1)
      await loadStages()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStage = async () => {
    if (!deleteConfirm.stageId) return
    setSaving(true)
    try {
      await deleteStage(deleteConfirm.stageId)
      if (selectedStage?.id === deleteConfirm.stageId) {
        setSelectedStage(null)
        setApprovers([])
      }
      setDeleteConfirm({ open: false, stageId: null })
      await loadStages()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (stage) => {
    try {
      await updateStage(stage.id, { ...stage, is_active: !stage.is_active })
      await loadStages()
      if (selectedStage?.id === stage.id) {
        setSelectedStage({ ...stage, is_active: !stage.is_active })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveEditor = async () => {
    if (!selectedStage) return
    setSaving(true)
    try {
      await updateStage(selectedStage.id, {
        name: selectedStage.name,
        sequence: selectedStage.sequence,
        is_active: selectedStage.is_active,
      })
      await updateStageRule(selectedStage.id, rule)
      await loadStages()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // ── Approver management ──────────────────────────────────────

  const handleAddApprover = async () => {
    if (!selectedUserId || !selectedStage) return
    setSaving(true)
    try {
      await addStageApprover(selectedStage.id, {
        user_id: selectedUserId,
        category: approverCategory,
      })
      setAddApproverDialog(false)
      setSelectedUserId('')
      setApproverCategory('required')
      const res = await getStageApprovers(selectedStage.id)
      setApprovers(res.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveApprover = async (approverId) => {
    if (!selectedStage) return
    try {
      await removeStageApprover(selectedStage.id, approverId)
      const res = await getStageApprovers(selectedStage.id)
      setApprovers(res.data || [])
    } catch (e) {
      console.error(e)
    }
  }

  // Filter out users already added as approvers
  const availableUsers = allUsers.filter(
    (u) => !approvers.some((a) => a.user_id === u.id)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="ECO Stage Settings"
        description="Configure approval stages, assign approvers, and set approval rules."
      >
        <Button onClick={() => { setNewStageName(''); setNewStageSeq(stages.length + 1); setNewDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Stage
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left Pane: Stage List ──────────────────────────── */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Stages
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : stages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No stages configured yet.
                </p>
              ) : (
                <div className="divide-y">
                  {stages.map((stage) => (
                    <div
                      key={stage.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedStage?.id === stage.id
                          ? 'bg-muted/70 border-l-2 border-primary'
                          : ''
                      }`}
                      onClick={() => selectStage(stage)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {stage.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Seq: {stage.sequence} &middot;{' '}
                          {stage.approver_count ?? '?'} approvers
                        </p>
                      </div>
                      <Switch
                        checked={stage.is_active}
                        onCheckedChange={() => handleToggleActive(stage)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm({ open: true, stageId: stage.id })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Pane: Stage Editor ───────────────────────── */}
        <div className="lg:col-span-3">
          {selectedStage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Edit: {selectedStage.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic fields */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Stage Name">
                    <Input
                      value={selectedStage.name}
                      onChange={(e) =>
                        setSelectedStage((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Sequence">
                    <Input
                      type="number"
                      min="1"
                      value={selectedStage.sequence}
                      onChange={(e) =>
                        setSelectedStage((prev) => ({
                          ...prev,
                          sequence: parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                  </FormField>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={selectedStage.is_active}
                    onCheckedChange={(checked) =>
                      setSelectedStage((prev) => ({
                        ...prev,
                        is_active: checked,
                      }))
                    }
                  />
                  <label className="text-sm font-medium">Active</label>
                </div>

                <FormField label="Approval Mode">
                  <Select
                    value={rule.approval_mode || 'all'}
                    onValueChange={(val) =>
                      setRule((prev) => ({ ...prev, approval_mode: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All must approve
                      </SelectItem>
                      <SelectItem value="any">
                        Any one can approve
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <Separator />

                {/* Approvers Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" /> Approvers
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddApproverDialog(true)}
                      disabled={availableUsers.length === 0}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Approver
                    </Button>
                  </div>

                  {approvers.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center bg-muted/30 rounded-md">
                      No approvers assigned.
                    </p>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {approvers.map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium">
                                {a.username || a.user_name || '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {a.role || 'approver'}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-muted">
                                  {a.category || 'Required'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-red-600"
                                  onClick={() =>
                                    handleRemoveApprover(a.id)
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={handleSaveEditor} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Settings2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">
                    Select a stage from the left to configure it.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── New Stage Dialog ─────────────────────────────────── */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Stage Name">
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="e.g., Manager Review"
              />
            </FormField>
            <FormField label="Sequence">
              <Input
                type="number"
                min="1"
                value={newStageSeq}
                onChange={(e) => setNewStageSeq(parseInt(e.target.value) || 1)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStage}
              disabled={saving || !newStageName.trim()}
            >
              {saving ? 'Creating...' : 'Create Stage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Approver Dialog ──────────────────────────────── */}
      <Dialog open={addApproverDialog} onOpenChange={setAddApproverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Approver</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Select User">
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.username} — {u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Category">
              <Select
                value={approverCategory}
                onValueChange={setApproverCategory}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddApproverDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddApprover}
              disabled={saving || !selectedUserId}
            >
              {saving ? 'Adding...' : 'Add Approver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ───────────────────────────────────── */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm({ open, stageId: open ? deleteConfirm.stageId : null })
        }
        title="Delete Stage?"
        description="This will permanently remove this stage and all its approver assignments. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteStage}
        isLoading={saving}
      />
    </div>
  )
}
