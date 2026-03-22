import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getEco,
  createEco,
  updateEco,
  submitEco,
  addEcoAttachmentChange,
  deleteEcoAttachmentChange,
} from '@/api/ecos'
import { getProducts, getProduct } from '@/api/products'
import { getBoms, getBom } from '@/api/boms'
import { getUsers } from '@/api/users'
import { ECO_TYPE, ECO_STATUS, ROLES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import PageHeader from '@/components/shared/PageHeader'
import FormField from '@/components/shared/FormField'
import { useAuth } from '@/contexts/AuthContext'
import { File, Loader2, Plus, Trash2, Undo2, UploadCloud, X } from 'lucide-react'

function parseDurationParts(duration) {
  if (!duration) {
    return { d: '', h: '', m: '' }
  }

  let days = ''
  let timePart = duration
  if (duration.includes(' ')) {
    const [dayPart, rest] = duration.split(' ')
    days = dayPart === '0' ? '' : dayPart
    timePart = rest || '00:00:00'
  }

  const [hours = '00', minutes = '00'] = timePart.split(':')
  return {
    d: days,
    h: String(parseInt(hours, 10) || 0),
    m: String(parseInt(minutes, 10) || 0),
  }
}

function formatDurationFromParts({ d, h, m }) {
  const days = parseInt(d || '0', 10)
  const hours = String(parseInt(h || '0', 10)).padStart(2, '0')
  const minutes = String(parseInt(m || '0', 10)).padStart(2, '0')
  return days > 0 ? `${days} ${hours}:${minutes}:00` : `${hours}:${minutes}:00`
}

export default function EcoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const { hasRole } = useAuth()
  const canEdit = hasRole([ROLES.ENGINEERING, ROLES.ADMIN])

  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ecoData, setEcoData] = useState(null)

  // Form states
  const [title, setTitle] = useState('')
  const [ecoType, setEcoType] = useState(ECO_TYPE.PRODUCT)
  const [product, setProduct] = useState('')
  const [bom, setBom] = useState('')
  const [responsibleUser, setResponsibleUser] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [versionUpdate, setVersionUpdate] = useState(true)

  const [products, setProducts] = useState([])
  const [boms, setBoms] = useState([])
  const [users, setUsers] = useState([])
  const [targetData, setTargetData] = useState(null)
  
  const [productChanges, setProductChanges] = useState({
    name: '',
    sale_price: '',
    cost_price: '',
  })
  const [productAttachmentRemovals, setProductAttachmentRemovals] = useState([])
  const [productAttachmentAdds, setProductAttachmentAdds] = useState([])
  const [attachmentChangeIdsToDelete, setAttachmentChangeIdsToDelete] = useState([])
  
  const [bomComponentChanges, setBomComponentChanges] = useState([])
  const [bomOperationChanges, setBomOperationChanges] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [prodRes, bomRes, userRes] = await Promise.all([
          getProducts({ is_active: true }),
          getBoms({ is_active: true }),
          getUsers()
        ])
        
        setProducts(prodRes.data?.results || prodRes.data || [])
        setBoms(bomRes.data?.results || bomRes.data || [])
        setUsers(userRes.data?.results || userRes.data || [])

        if (isEdit) {
          const { data } = await getEco(id)
          setEcoData(data)
          setTitle(data.title || '')
          setEcoType(data.eco_type || ECO_TYPE.PRODUCT)
          setProduct(data.product?.id?.toString() || data.product?.toString() || '')
          setBom(data.bom?.id?.toString() || data.bom?.toString() || '')
          setResponsibleUser(data.responsible_user?.id?.toString() || data.created_by?.id?.toString() || '')
          setEffectiveDate(data.effective_date || '')
          setVersionUpdate(data.version_update ?? true)
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id, isEdit])

  const loadTargetData = async (type, targetId) => {
    if (!targetId) {
      setTargetData(null)
      return
    }
    try {
      if (type === ECO_TYPE.PRODUCT) {
        const res = await getProduct(targetId)
        const target = res.data
        setTargetData(target)
        
        const initialChanges = {
          name: target.name || '',
          sale_price: target.sale_price !== null && target.sale_price !== undefined ? target.sale_price : '',
          cost_price: target.cost_price !== null && target.cost_price !== undefined ? target.cost_price : ''
        }
        
        if (isEdit && ecoData?.product_changes?.length > 0) {
          ecoData.product_changes.forEach(c => {
             if (c.field_name === 'name') initialChanges.name = c.new_value
             if (c.field_name === 'sale_price') initialChanges.sale_price = c.new_value
             if (c.field_name === 'cost_price') initialChanges.cost_price = c.new_value
          })
        }
        setProductChanges(initialChanges)

        const removalRows = (target.attachments || []).map((attachment) => ({
          row_id: `existing-attachment-${attachment.id}`,
          attachment_id: attachment.id,
          attachment_name: attachment.name,
          file_url: attachment.file,
          marked_for_removal: false,
          uploaded_change_id: null,
        }))
        const addRows = []

        if (isEdit) {
          ;(ecoData?.product_attachment_changes || []).forEach((change) => {
            if (change.change_type === 'remove') {
              const existingIndex = removalRows.findIndex(
                (row) => String(row.attachment_id) === String(change.original_attachment)
              )
              if (existingIndex >= 0) {
                removalRows[existingIndex] = {
                  ...removalRows[existingIndex],
                  marked_for_removal: true,
                  uploaded_change_id: change.id,
                }
              }
              return
            }

            if (change.change_type === 'add') {
              addRows.push({
                row_id: `added-attachment-${change.id}`,
                attachment_name: change.attachment_name || 'Attachment',
                file: null,
                file_url: change.file || '',
                uploaded_change_id: change.id,
              })
            }
          })
        }

        setProductAttachmentRemovals(removalRows)
        setProductAttachmentAdds(addRows)
        setAttachmentChangeIdsToDelete([])
        
      } else if (type === ECO_TYPE.BOM) {
        const res = await getBom(targetId)
        const target = res.data
        setTargetData(target)

        const componentRows = (target.components || []).map((component) => ({
          row_id: `existing-component-${component.id}`,
          source: 'existing',
          component_product: String(component.component_product),
          component_name: component.component_product_name || `Product ${component.component_product}`,
          old_quantity: component.quantity?.toString?.() || String(component.quantity || ''),
          new_quantity: component.quantity?.toString?.() || String(component.quantity || ''),
          change_type: 'modify',
        }))

        const operationRows = (target.operations || []).map((operation) => {
          const parts = parseDurationParts(operation.duration)
          return {
            row_id: `existing-operation-${operation.id}`,
            source: 'existing',
            operation_name: operation.name || '',
            original_operation_name: operation.name || '',
            old_duration: operation.duration || '',
            new_duration: operation.duration || '',
            change_type: 'modify',
            old_work_center: operation.work_center || '',
            new_work_center: operation.work_center || '',
            ...parts,
          }
        })

        if (isEdit) {
          ;(ecoData?.bom_component_changes || []).forEach((change) => {
            const existingIndex = componentRows.findIndex(
              (row) => row.component_product === String(change.component_product)
            )

            if (existingIndex >= 0) {
              componentRows[existingIndex] = {
                ...componentRows[existingIndex],
                change_type: change.change_type,
                new_quantity:
                  change.change_type === 'remove'
                    ? ''
                    : change.new_quantity?.toString?.() || componentRows[existingIndex].new_quantity,
              }
              return
            }

            if (change.change_type === 'add') {
              componentRows.push({
                row_id: `added-component-${change.id}`,
                source: 'new',
                component_product: String(change.component_product || ''),
                component_name: change.component_product_name || `Product ${change.component_product}`,
                old_quantity: '',
                new_quantity: change.new_quantity?.toString?.() || '',
                change_type: 'add',
              })
            }
          })

          ;(ecoData?.bom_operation_changes || []).forEach((change) => {
            const existingIndex = operationRows.findIndex(
              (row) => row.original_operation_name === change.operation_name
            )

            if (existingIndex >= 0) {
              const durationValue =
                change.change_type === 'remove'
                  ? ''
                  : change.new_duration || operationRows[existingIndex].new_duration
              operationRows[existingIndex] = {
                ...operationRows[existingIndex],
                change_type: change.change_type,
                operation_name: change.new_operation_name || operationRows[existingIndex].operation_name,
                new_duration: durationValue,
                old_work_center: change.old_work_center || operationRows[existingIndex].old_work_center,
                new_work_center: change.change_type === 'remove'
                  ? ''
                  : (change.new_work_center || operationRows[existingIndex].new_work_center),
                ...parseDurationParts(durationValue),
              }
              return
            }

            if (change.change_type === 'add') {
              const durationValue = change.new_duration || ''
              operationRows.push({
                row_id: `added-operation-${change.id}`,
                source: 'new',
                operation_name: change.operation_name || '',
                original_operation_name: '',
                old_duration: '',
                new_duration: durationValue,
                change_type: 'add',
                old_work_center: '',
                new_work_center: change.new_work_center || '',
                ...parseDurationParts(durationValue),
              })
            }
          })
        }

        setBomComponentChanges(componentRows)
        setBomOperationChanges(operationRows)
      }
    } catch (e) {
      console.error('Failed to load target:', e)
    }
  }

  useEffect(() => {
    if (ecoType === ECO_TYPE.PRODUCT && product) {
      loadTargetData(ECO_TYPE.PRODUCT, product)
    } else if (ecoType === ECO_TYPE.BOM && bom) {
      loadTargetData(ECO_TYPE.BOM, bom)
    } else {
      setTargetData(null)
      setProductChanges({ name: '', sale_price: '', cost_price: '' })
      setProductAttachmentRemovals([])
      setProductAttachmentAdds([])
      setAttachmentChangeIdsToDelete([])
      setBomComponentChanges([])
      setBomOperationChanges([])
    }
  }, [product, bom, ecoType, isEdit, ecoData])

  const handleProductChangeSelect = (field, val) => {
    setProductChanges(prev => ({ ...prev, [field]: val }))
  }

  const handleAttachmentFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) {
      return
    }

    setProductAttachmentAdds((prev) => [
      ...prev,
      ...files.map((file, index) => ({
        row_id: `new-attachment-${Date.now()}-${index}`,
        attachment_name: file.name,
        file,
        file_url: '',
        uploaded_change_id: null,
      })),
    ])

    e.target.value = ''
  }

  const updateAddedAttachmentName = (rowId, value) => {
    setProductAttachmentAdds((prev) =>
      prev.map((row) => (row.row_id === rowId ? { ...row, attachment_name: value } : row))
    )
  }

  const markAttachmentForRemoval = (attachmentId) => {
    setProductAttachmentRemovals((prev) =>
      prev.map((row) =>
        row.attachment_id === attachmentId
          ? { ...row, marked_for_removal: true }
          : row
      )
    )
  }

  const undoAttachmentRemoval = (attachmentId) => {
    const targetRow = productAttachmentRemovals.find((row) => row.attachment_id === attachmentId)
    if (targetRow?.uploaded_change_id) {
      setAttachmentChangeIdsToDelete((ids) =>
        ids.includes(targetRow.uploaded_change_id) ? ids : [...ids, targetRow.uploaded_change_id]
      )
    }
    setProductAttachmentRemovals((prev) =>
      prev.map((row) =>
        row.attachment_id === attachmentId
          ? { ...row, marked_for_removal: false, uploaded_change_id: null }
          : row
      )
    )
  }

  const deleteAddedAttachment = (rowId) => {
    setProductAttachmentAdds((prev) => {
      const targetRow = prev.find((row) => row.row_id === rowId)
      if (targetRow?.uploaded_change_id) {
        setAttachmentChangeIdsToDelete((ids) =>
          ids.includes(targetRow.uploaded_change_id) ? ids : [...ids, targetRow.uploaded_change_id]
        )
      }
      return prev.filter((row) => row.row_id !== rowId)
    })
  }

  const addBomComponentRow = () => {
    setBomComponentChanges((prev) => [
      ...prev,
      {
        row_id: `new-component-${Date.now()}-${prev.length}`,
        source: 'new',
        component_product: '',
        component_name: '',
        old_quantity: '',
        new_quantity: '',
        change_type: 'add',
      },
    ])
  }

  const updateBomComponentRow = (rowId, field, value) => {
    setBomComponentChanges((prev) =>
      prev.map((row) => {
        if (row.row_id !== rowId) {
          return row
        }
        const nextRow = { ...row, [field]: value }
        if (field === 'component_product') {
          nextRow.component_name =
            products.find((item) => String(item.id) === String(value))?.name || row.component_name
        }
        if (nextRow.source === 'existing' && nextRow.change_type !== 'remove') {
          nextRow.change_type = 'modify'
        }
        return nextRow
      })
    )
  }

  const markBomComponentForRemoval = (rowId) => {
    setBomComponentChanges((prev) =>
      prev.map((row) =>
        row.row_id === rowId
          ? {
              ...row,
              change_type: 'remove',
              new_quantity: '',
            }
          : row
      )
    )
  }

  const restoreBomComponentRow = (rowId) => {
    setBomComponentChanges((prev) =>
      prev.map((row) =>
        row.row_id === rowId
          ? {
              ...row,
              change_type: row.source === 'new' ? 'add' : 'modify',
              new_quantity: row.old_quantity,
            }
          : row
      )
    )
  }

  const deleteBomComponentRow = (rowId) => {
    setBomComponentChanges((prev) => prev.filter((row) => row.row_id !== rowId))
  }

  const addBomOperationRow = () => {
    setBomOperationChanges((prev) => [
      ...prev,
      {
        row_id: `new-operation-${Date.now()}-${prev.length}`,
        source: 'new',
        operation_name: '',
        original_operation_name: '',
        old_duration: '',
        new_duration: '',
        change_type: 'add',
        old_work_center: '',
        new_work_center: '',
        d: '',
        h: '',
        m: '',
      },
    ])
  }

  const updateBomOperationRow = (rowId, field, value) => {
    setBomOperationChanges((prev) =>
      prev.map((row) => {
        if (row.row_id !== rowId) {
          return row
        }
        const nextRow = { ...row, [field]: value }
        if (['d', 'h', 'm'].includes(field)) {
          nextRow.new_duration = formatDurationFromParts(nextRow)
        }
        if (row.source === 'existing' && nextRow.change_type !== 'remove') {
          nextRow.change_type = 'modify'
        }
        return nextRow
      })
    )
  }

  const markBomOperationForRemoval = (rowId) => {
    setBomOperationChanges((prev) =>
      prev.map((row) =>
        row.row_id === rowId
          ? {
              ...row,
              change_type: 'remove',
              d: '',
              h: '',
              m: '',
              new_duration: '',
              new_work_center: '',
            }
          : row
      )
    )
  }

  const restoreBomOperationRow = (rowId) => {
    setBomOperationChanges((prev) =>
      prev.map((row) => {
        if (row.row_id !== rowId) {
          return row
        }
        const durationValue = row.old_duration || row.new_duration
        return {
          ...row,
          change_type: row.source === 'new' ? 'add' : 'modify',
          operation_name: row.original_operation_name || row.operation_name,
          new_duration: durationValue,
          new_work_center: row.old_work_center,
          ...parseDurationParts(durationValue),
        }
      })
    )
  }

  const deleteBomOperationRow = (rowId) => {
    setBomOperationChanges((prev) => prev.filter((row) => row.row_id !== rowId))
  }

  const generateChangesPayload = () => {
    if (ecoType === ECO_TYPE.PRODUCT && targetData) {
      const payload = []
      if (productChanges.name !== targetData.name) {
        payload.push({ field_name: 'name', old_value: targetData.name, new_value: productChanges.name })
      }
      if (productChanges.sale_price != targetData.sale_price) {
        payload.push({ field_name: 'sale_price', old_value: targetData.sale_price, new_value: productChanges.sale_price })
      }
      if (productChanges.cost_price != targetData.cost_price) {
        payload.push({ field_name: 'cost_price', old_value: targetData.cost_price, new_value: productChanges.cost_price })
      }
      return payload
    }
    return []
  }

  const generateBomComponentPayload = () => {
    if (ecoType !== ECO_TYPE.BOM || !targetData) {
      return []
    }

    return bomComponentChanges
      .filter((row) => {
        if (row.change_type === 'remove') {
          return !!row.component_product
        }
        if (row.change_type === 'add') {
          return !!row.component_product && !!row.new_quantity
        }
        return (
          !!row.component_product &&
          row.old_quantity !== '' &&
          row.new_quantity !== '' &&
          Number(row.old_quantity) !== Number(row.new_quantity)
        )
      })
      .map((row) => ({
        component_product: Number(row.component_product),
        old_quantity: row.old_quantity || null,
        new_quantity: row.change_type === 'remove' ? null : row.new_quantity,
        change_type: row.change_type,
      }))
  }

  const generateBomOperationPayload = () => {
    if (ecoType !== ECO_TYPE.BOM || !targetData) {
      return []
    }

    return bomOperationChanges
      .filter((row) => {
        if (row.change_type === 'remove') {
          return !!(row.original_operation_name || row.operation_name)
        }
        if (row.change_type === 'add') {
          return !!row.operation_name && !!row.new_duration
        }
        return !!row.operation_name && (
          row.old_duration !== row.new_duration ||
          row.original_operation_name !== row.operation_name ||
          (row.old_work_center || '') !== (row.new_work_center || '')
        )
      })
      .map((row) => ({
        operation_name: row.original_operation_name || row.operation_name,
        new_operation_name: row.change_type === 'remove' ? '' : row.operation_name,
        old_duration: row.old_duration || null,
        new_duration: row.change_type === 'remove' ? null : row.new_duration,
        old_work_center: row.old_work_center || '',
        new_work_center: row.change_type === 'remove' ? '' : (row.new_work_center || ''),
        change_type: row.change_type,
      }))
  }

  const buildPayload = () => {
    const productChangePayload = generateChangesPayload()
    const bomComponentPayload = generateBomComponentPayload()
    const bomOperationPayload = generateBomOperationPayload()
    const payload = {
      title,
      eco_type: ecoType,
      product: product || null,
      bom: bom || null,
      responsible_user: responsibleUser || null,
      effective_date: effectiveDate || null,
      version_update: versionUpdate,
      status: ECO_STATUS.NEW,
    }

    if (ecoType === ECO_TYPE.PRODUCT) {
      payload.product_changes = productChangePayload
    } else if (ecoType === ECO_TYPE.BOM) {
      payload.bom_component_changes = bomComponentPayload
      payload.bom_operation_changes = bomOperationPayload
    }

    return payload
  }

  const syncProductAttachmentChanges = async (ecoId) => {
    if (ecoType !== ECO_TYPE.PRODUCT) {
      return
    }

    const nextRemovalRows = [...productAttachmentRemovals]
    const nextAddRows = [...productAttachmentAdds]

    for (const changeId of attachmentChangeIdsToDelete) {
      await deleteEcoAttachmentChange(ecoId, changeId)
    }

    for (const row of nextRemovalRows) {
      if (row.marked_for_removal && !row.uploaded_change_id) {
        const formData = new FormData()
        formData.append('change_type', 'remove')
        formData.append('original_attachment', row.attachment_id)
        const { data } = await addEcoAttachmentChange(ecoId, formData)
        row.uploaded_change_id = data?.id || null
      }
    }

    for (const row of nextAddRows) {
      if (!row.file || row.uploaded_change_id) {
        continue
      }
      const formData = new FormData()
      formData.append('change_type', 'add')
      formData.append('attachment_name', row.attachment_name || row.file.name)
      formData.append('file', row.file)
      const { data } = await addEcoAttachmentChange(ecoId, formData)
      row.uploaded_change_id = data?.id || null
      row.file_url = data?.file || ''
    }

    setProductAttachmentRemovals(nextRemovalRows)
    setProductAttachmentAdds(nextAddRows)
    setAttachmentChangeIdsToDelete([])
  }

  const persistEcoDraft = async () => {
    const payload = buildPayload()
    let ecoId = id

    if (isEdit) {
      await updateEco(id, payload)
    } else {
      const { data } = await createEco(payload)
      ecoId = data?.id
    }

    if (!ecoId) {
      throw new Error('Unable to determine ECO id after save.')
    }

    await syncProductAttachmentChanges(ecoId)
    return ecoId
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      await persistEcoDraft()
      navigate('/ecos')
    } catch (error) {
      console.error('Failed to save ECO:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStart = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const ecoId = await persistEcoDraft()
      await submitEco(ecoId)
      navigate(`/ecos/${ecoId}/detail`)
    } catch (error) {
      console.error('Failed to start ECO:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isReadOnly = !canEdit || (isEdit && ecoData?.status !== ECO_STATUS.NEW)
  const availableBoms = boms.filter(b => b.product?.toString() === product)

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  }

  if (!isReadOnly && isEdit && ecoData?.status !== ECO_STATUS.NEW) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        This ECO is no longer in Draft status. <Button variant="link" onClick={() => navigate(`/ecos/${id}/detail`)}>View Detail instead</Button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6 max-w-4xl mx-auto pb-10">
      <PageHeader
        title={isEdit ? 'Edit ECO Draft' : 'Create New ECO'}
        description="Define changes in draft, then start the ECO lifecycle."
      />

      <Card>
        <CardHeader><CardTitle>1. General Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="ECO Title">
            <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Update Chassis Material" disabled={isReadOnly || isSubmitting} />
          </FormField>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="ECO Type">
              <Select 
                value={ecoType} 
                onValueChange={(val) => {
                  setEcoType(val)
                  setProduct('')
                  setBom('')
                }}
                disabled={isReadOnly || isSubmitting || isEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ECO_TYPE.PRODUCT}>Product Change</SelectItem>
                  <SelectItem value={ECO_TYPE.BOM}>BoM Change</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Effective Date (Optional)">
              <Input type="date" name="effective_date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} disabled={isReadOnly || isSubmitting} />
            </FormField>
          </div>

          <FormField label="Responsible User">
            <Select 
              value={responsibleUser} 
              onValueChange={setResponsibleUser} 
              disabled={isReadOnly || isSubmitting}
            >
              <SelectTrigger className={!responsibleUser ? 'text-muted-foreground' : ''}>
                <SelectValue placeholder="Select responsible user" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>{u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="v-flip" 
              checked={versionUpdate} 
              onCheckedChange={setVersionUpdate} 
              disabled={isReadOnly || isSubmitting}
            />
            <label htmlFor="v-flip" className="text-sm font-medium leading-none">
              Increment Version on Final Apply
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Target Selection</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Product">
            <div className="flex items-center gap-2">
              <Select 
                value={product} 
                onValueChange={(val) => {
                  setProduct(val)
                  if (ecoType === ECO_TYPE.BOM) setBom('')
                }}
                disabled={isReadOnly || isSubmitting || !products.length || (isEdit && ecoType === ECO_TYPE.PRODUCT)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select Product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {product && (
                <Button variant="outline" asChild size="sm">
                  <Link to={`/products/${product}`} target="_blank" rel="noopener noreferrer">Open Product</Link>
                </Button>
              )}
            </div>
          </FormField>

          {ecoType === ECO_TYPE.BOM && (
            <FormField label="Bill of Materials">
              <div className="flex items-center gap-2">
                <Select 
                  value={bom} 
                  onValueChange={setBom}
                  disabled={isReadOnly || isSubmitting || !product || !availableBoms.length || isEdit}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={product ? "Select BoM..." : "Select Product first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBoms.map(b => <SelectItem key={b.id} value={b.id.toString()}>Version {b.version} ({b.reference})</SelectItem>)}
                  </SelectContent>
                </Select>
                {bom && (
                  <Button variant="outline" asChild size="sm">
                    <Link to={`/boms/${bom}`} target="_blank" rel="noopener noreferrer">Open BoM</Link>
                  </Button>
                )}
              </div>
            </FormField>
          )}
        </CardContent>
      </Card>

      {targetData && (
        <Card>
          <CardHeader>
            <CardTitle>3. Proposed Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {ecoType === ECO_TYPE.PRODUCT ? (
              <div className="space-y-6">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Product Name</p>
                      <p className="mt-1 font-medium">{targetData.name}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Version</p>
                      <p className="mt-1 font-medium">v{targetData.version}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Sale Price</p>
                      <p className="mt-1 font-medium">${targetData.sale_price}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Cost Price</p>
                      <p className="mt-1 font-medium">${targetData.cost_price}</p>
                    </div>
                  </div>
                </div>

                <FormField label="Product Name">
                  <Input 
                    value={productChanges.name} 
                    onChange={(e) => handleProductChangeSelect('name', e.target.value)} 
                    disabled={isReadOnly || isSubmitting}
                  />
                </FormField>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Sale Price">
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={productChanges.sale_price} 
                      onChange={(e) => handleProductChangeSelect('sale_price', e.target.value)} 
                      disabled={isReadOnly || isSubmitting}
                    />
                  </FormField>
                  <FormField label="Cost Price">
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={productChanges.cost_price} 
                      onChange={(e) => handleProductChangeSelect('cost_price', e.target.value)} 
                      disabled={isReadOnly || isSubmitting}
                    />
                  </FormField>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Current Attachments</p>
                      <p className="text-xs text-muted-foreground">
                        Mark existing files for removal or add new files to this ECO.
                      </p>
                    </div>
                    {!isReadOnly && (
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50">
                        <UploadCloud className="h-4 w-4" />
                        Add Attachments
                        <Input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleAttachmentFileChange}
                          disabled={isSubmitting}
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-2">
                    {productAttachmentRemovals.length ? (
                      productAttachmentRemovals.map((attachment) => (
                        <div
                          key={attachment.row_id}
                          className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                            attachment.marked_for_removal ? 'border-red-200 bg-red-50/40' : 'bg-secondary/20'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <File className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              {attachment.file_url ? (
                                <a
                                  href={attachment.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate text-sm font-medium text-blue-600 hover:underline"
                                >
                                  {attachment.attachment_name}
                                </a>
                              ) : (
                                <p className="truncate text-sm font-medium">{attachment.attachment_name}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {attachment.marked_for_removal ? 'Will be removed on apply' : 'Will be kept'}
                              </p>
                            </div>
                          </div>
                          {!isReadOnly && (
                            attachment.marked_for_removal ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => undoAttachmentRemoval(attachment.attachment_id)}
                              >
                                <Undo2 className="mr-1 h-4 w-4" /> Undo Remove
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => markAttachmentForRemoval(attachment.attachment_id)}
                              >
                                <Trash2 className="mr-1 h-4 w-4" /> Remove
                              </Button>
                            )
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No attachments on the current product version.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">New Attachments to Add</p>
                    {productAttachmentAdds.length ? (
                      productAttachmentAdds.map((attachment) => (
                        <div
                          key={attachment.row_id}
                          className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50/30 p-3 md:grid-cols-[1fr_auto]"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <File className="h-4 w-4 text-muted-foreground" />
                              <p className="text-sm font-medium">
                                {attachment.file?.name || attachment.attachment_name}
                              </p>
                            </div>
                            <FormField label="Attachment Name">
                              <Input
                                value={attachment.attachment_name}
                                onChange={(e) => updateAddedAttachmentName(attachment.row_id, e.target.value)}
                                disabled={isReadOnly || isSubmitting}
                              />
                            </FormField>
                          </div>
                          {!isReadOnly && (
                            <div className="flex items-start justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteAddedAttachment(attachment.row_id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No new attachments staged for this ECO.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold">Components</p>
                        <p className="text-sm text-muted-foreground">Add, modify, or remove BoM components.</p>
                      </div>
                      {!isReadOnly && (
                        <Button type="button" variant="outline" size="sm" onClick={addBomComponentRow}>
                          <Plus className="h-4 w-4 mr-1" /> Add Component
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {bomComponentChanges.length === 0 && (
                        <p className="text-sm text-muted-foreground">No component rows available.</p>
                      )}
                      {bomComponentChanges.map((row) => (
                        <div
                          key={row.row_id}
                          className={`rounded-lg border p-4 space-y-3 ${
                            row.change_type === 'remove'
                              ? 'border-red-200 bg-red-50/40'
                              : row.change_type === 'add'
                                ? 'border-emerald-200 bg-emerald-50/40'
                                : 'bg-background'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="capitalize">
                              {row.change_type}
                            </Badge>
                            {!isReadOnly && (
                              <div className="flex items-center gap-2">
                                {row.source === 'existing' ? (
                                  row.change_type === 'remove' ? (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => restoreBomComponentRow(row.row_id)}>
                                      <Undo2 className="h-4 w-4 mr-1" /> Undo Remove
                                    </Button>
                                  ) : (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => markBomComponentForRemoval(row.row_id)}>
                                      <Trash2 className="h-4 w-4 mr-1" /> Remove
                                    </Button>
                                  )
                                ) : (
                                  <Button type="button" variant="ghost" size="sm" onClick={() => deleteBomComponentRow(row.row_id)}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          <FormField label="Component Product">
                            <Select
                              value={row.component_product}
                              onValueChange={(value) => updateBomComponentRow(row.row_id, 'component_product', value)}
                              disabled={isReadOnly || isSubmitting || row.source === 'existing'}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select component product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products
                                  .filter((item) => String(item.id) !== String(product))
                                  .map((item) => (
                                    <SelectItem key={item.id} value={String(item.id)}>
                                      {item.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </FormField>

                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField label="Old Quantity">
                              <Input value={row.old_quantity || '-'} disabled />
                            </FormField>
                            <FormField label={row.change_type === 'remove' ? 'New Quantity' : 'Updated Quantity'}>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.new_quantity}
                                onChange={(e) => updateBomComponentRow(row.row_id, 'new_quantity', e.target.value)}
                                disabled={isReadOnly || isSubmitting || row.change_type === 'remove'}
                                placeholder={row.change_type === 'add' ? 'Enter quantity' : 'Updated quantity'}
                              />
                            </FormField>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold">Operations</p>
                        <p className="text-sm text-muted-foreground">Add, modify, or remove BoM operations.</p>
                      </div>
                      {!isReadOnly && (
                        <Button type="button" variant="outline" size="sm" onClick={addBomOperationRow}>
                          <Plus className="h-4 w-4 mr-1" /> Add Operation
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {bomOperationChanges.length === 0 && (
                        <p className="text-sm text-muted-foreground">No operation rows available.</p>
                      )}
                      {bomOperationChanges.map((row) => (
                        <div
                          key={row.row_id}
                          className={`rounded-lg border p-4 space-y-3 ${
                            row.change_type === 'remove'
                              ? 'border-red-200 bg-red-50/40'
                              : row.change_type === 'add'
                                ? 'border-emerald-200 bg-emerald-50/40'
                                : 'bg-background'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="capitalize">
                              {row.change_type}
                            </Badge>
                            {!isReadOnly && (
                              <div className="flex items-center gap-2">
                                {row.source === 'existing' ? (
                                  row.change_type === 'remove' ? (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => restoreBomOperationRow(row.row_id)}>
                                      <Undo2 className="h-4 w-4 mr-1" /> Undo Remove
                                    </Button>
                                  ) : (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => markBomOperationForRemoval(row.row_id)}>
                                      <Trash2 className="h-4 w-4 mr-1" /> Remove
                                    </Button>
                                  )
                                ) : (
                                  <Button type="button" variant="ghost" size="sm" onClick={() => deleteBomOperationRow(row.row_id)}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          <FormField label="Operation Name">
                            <Input
                              value={row.operation_name}
                              onChange={(e) => updateBomOperationRow(row.row_id, 'operation_name', e.target.value)}
                              disabled={isReadOnly || isSubmitting || row.change_type === 'remove'}
                              placeholder="Assembly - Line 1"
                            />
                          </FormField>

                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField label="Old Duration">
                              <Input value={row.old_duration || '-'} disabled />
                            </FormField>
                            <FormField label="Current Work Center">
                              <Input value={row.old_work_center || '-'} disabled />
                            </FormField>
                          </div>

                          <FormField label="Updated Work Center">
                            <Input
                              value={row.new_work_center}
                              onChange={(e) => updateBomOperationRow(row.row_id, 'new_work_center', e.target.value)}
                              disabled={isReadOnly || isSubmitting || row.change_type === 'remove'}
                              placeholder="Line 1"
                            />
                          </FormField>

                          <div className="grid grid-cols-3 gap-3">
                            <FormField label="Days">
                              <Input
                                type="number"
                                min="0"
                                value={row.d}
                                onChange={(e) => updateBomOperationRow(row.row_id, 'd', e.target.value)}
                                disabled={isReadOnly || isSubmitting || row.change_type === 'remove'}
                              />
                            </FormField>
                            <FormField label="Hours">
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                value={row.h}
                                onChange={(e) => updateBomOperationRow(row.row_id, 'h', e.target.value)}
                                disabled={isReadOnly || isSubmitting || row.change_type === 'remove'}
                              />
                            </FormField>
                            <FormField label="Minutes">
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                value={row.m}
                                onChange={(e) => updateBomOperationRow(row.row_id, 'm', e.target.value)}
                                disabled={isReadOnly || isSubmitting || row.change_type === 'remove'}
                              />
                            </FormField>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isReadOnly && (
        <div className="flex items-center justify-end gap-3 mt-8 border-t pt-4">
          <Button variant="outline" type="button" onClick={() => navigate('/ecos')} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSubmitting || !title || (!product && !bom)}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Draft
          </Button>
          <Button type="button" variant="default" className="bg-green-600 hover:bg-green-700 text-white" disabled={isSubmitting || !title || (!product && !bom)} onClick={handleStart}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start
          </Button>
        </div>
      )}
    </form>
  )
}
