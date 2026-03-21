import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEco, createEco, updateEco, submitEco } from '@/api/ecos'
import { getProducts, getProduct } from '@/api/products'
import { getBoms, getBom } from '@/api/boms'
import { ECO_TYPE, ECO_STATUS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import PageHeader from '@/components/shared/PageHeader'
import FormField from '@/components/shared/FormField'

export default function EcoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    eco_type: ECO_TYPE.PRODUCT,
    product: '',
    bom: '',
    effective_date: '',
    version_update: true,
    status: ECO_STATUS.NEW,
    changes: []
  })

  const [products, setProducts] = useState([])
  const [boms, setBoms] = useState([])
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
    fetchProducts()
    if (isEdit) {
      loadEco()
    }
  }, [id])

  useEffect(() => {
    if (formData.eco_type === ECO_TYPE.BOM && formData.product) {
      fetchBoms(formData.product)
    } else {
      setBoms([])
      if (formData.eco_type === ECO_TYPE.BOM) {
        setFormData(prev => ({ ...prev, bom: '' }))
      }
    }
  }, [formData.product, formData.eco_type])

  const fetchProducts = async () => {
    try {
      const res = await getProducts({ is_active: true })
      const list = res.data?.results || res.data || []
      setProducts(Array.isArray(list) ? list : [])
    } catch {
      console.error('Failed to fetch products')
    }
  }

  const fetchBoms = async (productId) => {
    try {
      const res = await getBoms({ product: productId, is_active: true })
      const list = res.data?.results || res.data || []
      setBoms(Array.isArray(list) ? list : [])
    } catch {
      console.error('Failed to fetch boms')
    }
  }

  const loadTargetData = async (type, targetId) => {
    if (!targetId) {
      setTargetData(null)
      return
    }
    try {
      if (type === ECO_TYPE.PRODUCT) {
        const res = await getProduct(targetId)
        setTargetData(res.data)
        setProductChanges({
          name: res.data.name,
          sale_price: res.data.sale_price || '',
          cost_price: res.data.cost_price || ''
        })
      } else if (type === ECO_TYPE.BOM) {
        const res = await getBom(targetId)
        setTargetData(res.data)
        setBomChanges((res.data.components || []).map(c => ({
          component_id: c.product.id,
          name: c.product.name,
          old_qty: c.quantity,
          new_qty: c.quantity,
          change_type: 'modify'
        })))
      }
    } catch (e) {
      console.error('Failed to load target:', e)
    }
  }

  useEffect(() => {
    if (formData.eco_type === ECO_TYPE.PRODUCT && formData.product) {
      loadTargetData(ECO_TYPE.PRODUCT, formData.product)
    } else if (formData.eco_type === ECO_TYPE.BOM && formData.bom) {
      loadTargetData(ECO_TYPE.BOM, formData.bom)
    }
  }, [formData.product, formData.bom, formData.eco_type])

  const loadEco = async () => {
    try {
      const res = await getEco(id)
      setFormData({
        title: res.data.title,
        eco_type: res.data.eco_type,
        product: res.data.product?.toString() || '',
        bom: res.data.bom?.toString() || '',
        effective_date: res.data.effective_date || '',
        version_update: res.data.version_update !== false,
        status: res.data.status,
        changes: res.data.changes || []
      })
    } catch (error) {
      console.error('Failed to load ECO:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleProductChangeSelect = (field, val) => {
    setProductChanges(prev => ({ ...prev, [field]: val }))
  }

  const generateChangesPayload = () => {
    if (formData.eco_type === ECO_TYPE.PRODUCT && targetData) {
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
    if (formData.eco_type === ECO_TYPE.BOM && targetData) {
      return bomChanges.filter(c => Number(c.old_qty) !== Number(c.new_qty)).map(c => ({
        target_product_id: c.component_id,
        old_quantity: c.old_qty,
        new_quantity: c.new_qty,
        change_type: 'modify'
      }))
    }
    return []
  }

  const handleSave = async (submitNow = false) => {
    setIsLoading(true)
    try {
      const changesArr = generateChangesPayload()
      const payload = {
        ...formData,
        changes: changesArr
      }
      
      let savedEcoId = id;
      if (isEdit) {
        await updateEco(id, payload)
      } else {
        const res = await createEco(payload)
        savedEcoId = res.data.id
      }
      
      if (submitNow && savedEcoId) {
        await submitEco(savedEcoId)
        navigate(`/ecos/${savedEcoId}/detail`)
      } else {
        navigate('/ecos')
      }
    } catch {
      // Backend not ready — still navigate back to show the list
      navigate('/ecos')
    } finally {
      setIsLoading(false)
    }
  }

  const isEditable = formData.status === ECO_STATUS.NEW

  if (!isEditable && isEdit) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        This ECO is no longer in Draft status. <Button variant="link" onClick={() => navigate(`/ecos/${id}/detail`)}>View Detail instead</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <PageHeader
        title={isEdit ? 'Edit ECO Draft' : 'Create New ECO'}
        description="Define changes before submitting for approval."
      />

      <Card>
        <CardHeader><CardTitle>1. General Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="ECO Title">
            <Input name="title" value={formData.title} onChange={handleChange} placeholder="e.g. Update Chassis Material" />
          </FormField>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="ECO Type">
              <Select 
                value={formData.eco_type} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, eco_type: val, product: '', bom: '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ECO_TYPE.PRODUCT}>Product Change</SelectItem>
                  <SelectItem value={ECO_TYPE.BOM}>BoM Change</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Effective Date (Optional)">
              <Input type="date" name="effective_date" value={formData.effective_date} onChange={handleChange} />
            </FormField>
          </div>
          
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="v-flip" 
              checked={formData.version_update} 
              onCheckedChange={(c) => setFormData(p => ({ ...p, version_update: c === true }))} 
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
            <Select 
              value={formData.product} 
              onValueChange={(val) => setFormData(prev => ({ ...prev, product: val }))}
              disabled={!products.length}
            >
              <SelectTrigger><SelectValue placeholder="Select Product..." /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          {formData.eco_type === ECO_TYPE.BOM && (
            <FormField label="Bill of Materials">
              <Select 
                value={formData.bom} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, bom: val }))}
                disabled={!formData.product || !boms.length}
              >
                <SelectTrigger><SelectValue placeholder="Select BoM..." /></SelectTrigger>
                <SelectContent>
                  {boms.map(b => <SelectItem key={b.id} value={b.id.toString()}>Version {b.version}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </CardContent>
      </Card>

      {targetData && (
        <Card>
          <CardHeader><CardTitle>3. Proposed Changes</CardTitle></CardHeader>
          <CardContent>
            {formData.eco_type === ECO_TYPE.PRODUCT ? (
               <div className="space-y-4">
                 <FormField label="Product Name">
                    <Input 
                      value={productChanges.name} 
                      onChange={(e) => handleProductChangeSelect('name', e.target.value)} 
                    />
                 </FormField>
                 <div className="grid grid-cols-2 gap-4">
                   <FormField label="Sale Price">
                      <Input 
                        type="number"
                        value={productChanges.sale_price} 
                        onChange={(e) => handleProductChangeSelect('sale_price', e.target.value)} 
                      />
                   </FormField>
                   <FormField label="Cost Price">
                      <Input 
                        type="number"
                        value={productChanges.cost_price} 
                        onChange={(e) => handleProductChangeSelect('cost_price', e.target.value)} 
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
                      />
                    </div>
                 ))}
                 {bomChanges.length === 0 && <p className="text-sm text-muted-foreground">No components in selected BoM.</p>}
               </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3 mt-8 border-t pt-4">
        <Button variant="outline" onClick={() => navigate('/ecos')} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => handleSave(false)} disabled={isLoading || !formData.title}>
          Save Default
        </Button>
        <Button onClick={() => handleSave(true)} disabled={isLoading || !formData.title || (!formData.product && !formData.bom)}>
          Submit for Approval
        </Button>
      </div>
    </div>
  )
}
