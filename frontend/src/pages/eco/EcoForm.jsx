import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getEco, createEco, updateEco } from '@/api/ecos'
import { getProducts, getProduct } from '@/api/products'
import { getBoms, getBom } from '@/api/boms'
import { getUsers } from '@/api/users'
import { ECO_TYPE, ECO_STATUS, ROLES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import PageHeader from '@/components/shared/PageHeader'
import FormField from '@/components/shared/FormField'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function EcoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const { hasRole } = useAuth()
  const canEdit = hasRole([ROLES.ENGINEERING, ROLES.ADMIN])

  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false) // New state for submission
  const [ecoData, setEcoData] = useState(null) // Original ECO data if editing

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
  
  // Local changes editor state
  const [productChanges, setProductChanges] = useState({
    name: '',
    sale_price: '',
    cost_price: ''
  })
  
  // BoM changes MVP: array of components with old/new
  const [bomChanges, setBomChanges] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch active master data and users
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

          // Set initial changes for editing
          if (data.eco_type === ECO_TYPE.PRODUCT && data.product_changes && data.product_changes.length > 0) {
            const nameChange = data.product_changes.find(c => c.field_name === 'name')
            const salePriceChange = data.product_changes.find(c => c.field_name === 'sale_price')
            const costPriceChange = data.product_changes.find(c => c.field_name === 'cost_price')
            setProductChanges({
              name: nameChange ? nameChange.new_value : '',
              sale_price: salePriceChange ? salePriceChange.new_value : '',
              cost_price: costPriceChange ? costPriceChange.new_value : ''
            })
          } else if (data.eco_type === ECO_TYPE.BOM && data.bom_component_changes && data.bom_component_changes.length > 0) {
            setBomChanges(data.bom_component_changes.map(c => ({
              component_id: c.component_product,
              name: c.component_product_name || `Product ${c.component_product}`,
              old_qty: c.old_quantity,
              new_qty: c.new_quantity,
              change_type: 'modify'
            })))
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id, isEdit])

  useEffect(() => {
    if (ecoType === ECO_TYPE.BOM && product) {
      // Filter boms based on selected product
      // This logic is now handled by `availableBoms` getter
    } else {
      // if (ecoType === ECO_TYPE.BOM) {
      //   setBom('') // Clear BOM if product is cleared or type changes from BOM
      // }
    }
  }, [product, ecoType])

  const loadTargetData = async (type, targetId) => {
    if (!targetId) {
      setTargetData(null)
      return
    }
    try {
      if (type === ECO_TYPE.PRODUCT) {
        const res = await getProduct(targetId)
        setTargetData(res.data)
        // Only set productChanges if not in edit mode or if changes haven't been loaded from ecoData
        if (!isEdit || !ecoData?.product_changes?.length) {
          setProductChanges({
            name: res.data.name,
            sale_price: res.data.sale_price || '',
            cost_price: res.data.cost_price || ''
          })
        }
      } else if (type === ECO_TYPE.BOM) {
        const res = await getBom(targetId)
        setTargetData(res.data)
        // Only set bomChanges if not in edit mode or if changes haven't been loaded from ecoData
        if (!isEdit || !ecoData?.bom_component_changes?.length) {
          setBomChanges((res.data.components || []).map(c => ({
            component_id: c.component_product,
            name: c.component_product_name || `Product ${c.component_product}`,
            old_qty: c.quantity,
            new_qty: c.quantity,
            change_type: 'modify'
          })))
        }
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
      setBomChanges([])
    }
  }, [product, bom, ecoType, isEdit, ecoData]) // Added ecoData to dependencies to ensure initial load for edit

  const handleProductChangeSelect = (field, val) => {
    setProductChanges(prev => ({ ...prev, [field]: val }))
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
    if (ecoType === ECO_TYPE.BOM && targetData) {
      return bomChanges.filter(c => Number(c.old_qty) !== Number(c.new_qty)).map(c => ({
        component_product: c.component_id,
        old_quantity: c.old_qty,
        new_quantity: c.new_qty,
        change_type: 'modify'
      }))
    }
    return []
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const changesArr = generateChangesPayload()
      const payload = {
        title,
        eco_type: ecoType,
        product: product || null,
        bom: bom || null,
        responsible_user: responsibleUser || null,
        effective_date: effectiveDate || null,
        version_update: versionUpdate,
        status: ECO_STATUS.NEW, // Always create/save as NEW
      }
      
      if (ecoType === ECO_TYPE.PRODUCT) {
        payload.product_changes = changesArr
      } else if (ecoType === ECO_TYPE.BOM) {
        payload.bom_component_changes = changesArr
      }
      
      let savedEcoId = id;
      if (isEdit) {
        await updateEco(id, payload)
      } else {
        const res = await createEco(payload)
        savedEcoId = res.data.id
      }
      
      navigate('/ecos')
    } catch (error) {
      console.error('Failed to save ECO:', error)
      // Optionally show an error message to the user
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-10">
      <PageHeader
        title={isEdit ? 'Edit ECO Draft' : 'Create New ECO'}
        description="Define changes before submitting for approval."
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
                  setProduct('') // Clear product when ECO type changes
                  setBom('') // Clear BOM when ECO type changes
                }}
                disabled={isReadOnly || isSubmitting || isEdit} // Cannot change type on edit
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
                <SelectValue placeholder="Select responsible user">
                  {responsibleUser ? (users.find(u => u.id.toString() === responsibleUser)?.username || `User ${responsibleUser}`) : 'Select responsible user'}
                </SelectValue>
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
              Increment Version on Apply
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
                  if (ecoType === ECO_TYPE.BOM) setBom('') // Clear BOM selection if product changes
                }}
                disabled={isReadOnly || isSubmitting || !products.length || (isEdit && ecoType === ECO_TYPE.PRODUCT)}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select Product..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {product && (
                <Button variant="outline" asChild size="sm">
                  <Link to={`/products/${product}`} target="_blank">Open Product</Link>
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
                  <SelectTrigger className="flex-1"><SelectValue placeholder={product ? "Select BoM..." : "Select Product first"} /></SelectTrigger>
                  <SelectContent>
                    {availableBoms.map(b => <SelectItem key={b.id} value={b.id.toString()}>Version {b.version} ({b.reference})</SelectItem>)}
                  </SelectContent>
                </Select>
                {bom && (
                  <Button variant="outline" asChild size="sm">
                    <Link to={`/boms/${bom}`} target="_blank">Open BoM</Link>
                  </Button>
                )}
              </div>
            </FormField>
          )}
        </CardContent>
      </Card>

      {targetData && (
        <Card>
          <CardHeader><CardTitle>3. Proposed Changes</CardTitle></CardHeader>
          <CardContent>
            {ecoType === ECO_TYPE.PRODUCT ? (
               <div className="space-y-4">
                 <FormField label="Product Name">
                    <Input 
                      value={productChanges.name} 
                      onChange={(e) => handleProductChangeSelect('name', e.target.value)} 
                      disabled={isReadOnly || isSubmitting}
                    />
                 </FormField>
                 <div className="grid grid-cols-2 gap-4">
                   <FormField label="Sale Price">
                      <Input 
                        type="number"
                        value={productChanges.sale_price} 
                        onChange={(e) => handleProductChangeSelect('sale_price', e.target.value)} 
                        disabled={isReadOnly || isSubmitting}
                      />
                   </FormField>
                   <FormField label="Cost Price">
                      <Input 
                        type="number"
                        value={productChanges.cost_price} 
                        onChange={(e) => handleProductChangeSelect('cost_price', e.target.value)} 
                        disabled={isReadOnly || isSubmitting}
                      />
                   </FormField>
                 </div>
               </div>
            ) : (
               <div className="space-y-2">
                 <p className="text-sm text-muted-foreground font-medium mb-3">Modify Component Quantities</p>
                 {bomChanges.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-muted/30 p-2 rounded-md border">
                      <div className="flex-1 font-medium">{comp.name}</div>
                      <div className="text-sm text-muted-foreground w-20">Old: {comp.old_qty}</div>
                      <Input 
                        type="number" 
                        min="0"
                        className="w-24" 
                        value={comp.new_qty} 
                        onChange={(e) => {
                          const val = e.target.value
                          setBomChanges(prev => {
                            const n = [...prev]
                            n[idx].new_qty = val
                            return n
                          })
                        }} 
                        disabled={isReadOnly || isSubmitting}
                      />
                    </div>
                 ))}
                 {bomChanges.length === 0 && <p className="text-sm text-muted-foreground">No components in selected BoM.</p>}
               </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isReadOnly && (
        <div className="flex items-center justify-end gap-3 mt-8 border-t pt-4">
          <Button variant="outline" onClick={() => navigate('/ecos')} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !title || (!product && !bom)}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
          {!isEdit && (
            <Button type="button" variant="default" className="bg-green-600 hover:bg-green-700 text-white" disabled={isSubmitting || !title || (!product && !bom)} onClick={async (e) => {
              // Submit and then go to detail page to start the approval flow
              e.preventDefault()
              // Just use the regular submit, user will do "Start" on Details page. 
              // Or if we want to mimic start, let's call it "Save & View"
              await handleSubmit(e)
            }}>
              Start
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
