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
    cost_price: ''
  })
  
  const [bomChanges, setBomChanges] = useState([])

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
        
      } else if (type === ECO_TYPE.BOM) {
        const res = await getBom(targetId)
        const target = res.data
        setTargetData(target)
        
        let initialComponents = (target.components || []).map(c => ({
          component_id: c.component_product,
          name: c.component_product_name || `Product ${c.component_product}`,
          old_qty: c.quantity,
          new_qty: c.quantity,
          change_type: 'modify'
        }))
        
        if (isEdit && ecoData?.bom_component_changes?.length > 0) {
          const changeMap = {}
          ecoData.bom_component_changes.forEach(c => {
            changeMap[c.component_product.toString()] = c.new_quantity
          })
          
          initialComponents = initialComponents.map(comp => {
            const newQty = changeMap[comp.component_id.toString()]
            if (newQty !== undefined) {
              return { ...comp, new_qty: newQty }
            }
            return comp
          })
        }
        setBomChanges(initialComponents)
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
  }, [product, bom, ecoType, isEdit, ecoData])

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
        status: ECO_STATUS.NEW,
      }
      
      if (ecoType === ECO_TYPE.PRODUCT) {
        payload.product_changes = changesArr
      } else if (ecoType === ECO_TYPE.BOM) {
        payload.bom_component_changes = changesArr
      }
      
      if (isEdit) {
        await updateEco(id, payload)
      } else {
        await createEco(payload)
      }
      
      navigate('/ecos')
    } catch (error) {
      console.error('Failed to save ECO:', error)
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
                <SelectValue placeholder="Select responsible user">
                  {responsibleUser ? (users.find(u => u.id.toString() === responsibleUser)?.username || ecoData?.responsible_user_username || `User ${responsibleUser}`) : 'Select responsible user'}
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
                  if (ecoType === ECO_TYPE.BOM) setBom('')
                }}
                disabled={isReadOnly || isSubmitting || !products.length || (isEdit && ecoType === ECO_TYPE.PRODUCT)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select Product...">
                    {product ? (products.find(p => p.id.toString() === product)?.name || ecoData?.product_name || `Product ${product}`) : "Select Product..."}
                  </SelectValue>
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
                    <SelectValue placeholder={product ? "Select BoM..." : "Select Product first"}>
                      {bom ? (boms.find(b => b.id.toString() === bom)?.reference || ecoData?.bom_reference || `BoM ${bom}`) : (product ? "Select BoM..." : "Select Product first")}
                    </SelectValue>
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
          <Button variant="outline" type="button" onClick={() => navigate('/ecos')} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !title || (!product && !bom)}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
          {!isEdit && (
            <Button type="button" variant="default" className="bg-green-600 hover:bg-green-700 text-white" disabled={isSubmitting || !title || (!product && !bom)} onClick={async (e) => {
              e.preventDefault()
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
