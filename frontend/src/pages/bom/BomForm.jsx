import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getBom, createBom, updateBom } from '@/api/boms'
import { getProducts } from '@/api/products'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/lib/constants'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, ArrowLeft, Loader2, Plus, X } from 'lucide-react'
import VersionHistory from '@/components/shared/VersionHistory'

export default function BomForm() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  
  const canEdit = hasRole([ROLES.ENGINEERING, ROLES.ADMIN])
  
  const [products, setProducts] = useState([])
  const [bomData, setBomData] = useState(null)
  
  const [product, setProduct] = useState('')
  const [components, setComponents] = useState([])
  const [operations, setOperations] = useState([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch active products for dropdowns
        const prodRes = await getProducts({ is_active: true })
        const productsList = prodRes.data.results || prodRes.data || []
        setProducts(productsList)

        if (isEditing) {
          const { data } = await getBom(id)
          setBomData(data)
          setProduct(data.product?.id?.toString() || data.product?.toString() || '')
          setComponents(data.components || [])
          setOperations(data.operations?.map(op => {
            let durStr = op.duration || ''
            let d = ''
            let timeStr = durStr
            if (durStr.includes(' ')) {
              const parts = durStr.split(' ')
              d = parts[0]
              timeStr = parts[1] || ''
            }
            const timeParts = timeStr.split(':')
            const h = timeParts[0] ? parseInt(timeParts[0], 10).toString() : ''
            const m = timeParts[1] ? parseInt(timeParts[1], 10).toString() : ''
            return {
              id: op.id,
              name: op.name,
              work_center: op.work_center,
              d: d === '0' ? '' : d,
              h: h === '0' ? '' : h,
              m: m === '0' ? '' : m
            }
          }) || [])
        } else {
          // Initialize empty row for new BoM
          setComponents([{ component_product: '', quantity: '' }])
          setOperations([{ name: '', d: '', h: '', m: '', work_center: '' }])
        }
      } catch (err) {
        setError('Failed to load data.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id, isEditing])

  // Component Actions
  const addComponent = () => {
    setComponents([...components, { component_product: '', quantity: '' }])
  }
  const updateComponent = (index, field, value) => {
    const newComps = [...components]
    newComps[index][field] = value
    setComponents(newComps)
  }
  const removeComponent = (index) => {
    setComponents(components.filter((_, i) => i !== index))
  }

  // Operation Actions
  const addOperation = () => {
    setOperations([...operations, { name: '', d: '', h: '', m: '', work_center: '' }])
  }
  const updateOperation = (index, field, value) => {
    const newOps = [...operations]
    newOps[index][field] = value
    setOperations(newOps)
  }
  const removeOperation = (index) => {
    setOperations(operations.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!product) {
      setError('Please select a parent product.')
      return
    }

    // Clean data before sending (filter out totally empty rows)
    const validComps = components.filter(c => c.component_product && c.quantity)
    const validOps = operations.filter(o => o.name && (parseInt(o.d||'0',10)>0 || parseInt(o.h||'0',10)>0 || parseInt(o.m||'0',10)>0))

    setIsSubmitting(true)
    try {
      const payload = {
        product: parseInt(product, 10),
        components: validComps.map(c => ({
          component_product: parseInt(c.component_product, 10),
          quantity: parseInt(c.quantity, 10)
        })),
        operations: validOps.map(op => {
          const days = parseInt(op.d || '0', 10)
          const hrs = parseInt(op.h || '0', 10).toString().padStart(2, '0')
          const mins = parseInt(op.m || '0', 10).toString().padStart(2, '0')
          return {
            name: op.name,
            duration: days > 0 ? `${days} ${hrs}:${mins}:00` : `${hrs}:${mins}:00`,
            work_center: op.work_center
          }
        })
      }
      
      if (isEditing) {
        await updateBom(id, payload)
      } else {
        await createBom(payload)
      }
      navigate('/boms')
    } catch (err) {
      setError('Failed to save Bill of Materials. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // If archived, we can still show the badge
  const isArchived = bomData?.is_active === false
  // All existing BoMs are read-only
  const isReadOnly = isEditing

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/boms')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader 
          title={isEditing ? (isReadOnly ? 'View Bill of Materials' : 'Edit Bill of Materials') : 'Create Bill of Materials'} 
        />
      </div>

      {isArchived && (
        <div className="rounded-lg bg-yellow-100 p-4 text-sm text-yellow-800 flex items-center gap-2 dark:bg-yellow-900/30 dark:text-yellow-400">
          <AlertCircle className="h-4 w-4" />
          <span>This BoM is archived and cannot be edited. Viewing in read-only mode.</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Parent Product Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 max-w-md">
              <label className="text-sm font-semibold">Target Product</label>
              <Select 
                value={product} 
                onValueChange={setProduct} 
                disabled={isReadOnly || isSubmitting || isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product...">
                    {product ? (products.find(p => p.id.toString() === product)?.name || `Product ${product}`) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name || `Un-named Product (${p.id})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The product that this Bill of Materials belongs to.</p>
            </div>
          </CardContent>
        </Card>

        {/* Components Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg">Components</CardTitle>
            {!isReadOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={addComponent} className="flex flex-row items-center gap-1.5">
                <Plus className="h-4 w-4" /> <span>Add Component</span>
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {components.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">No components added.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground px-1 uppercase tracking-wider text-xs">
                  <div className="col-span-8">Component Product</div>
                  <div className="col-span-3">Quantity</div>
                  <div className="col-span-1"></div>
                </div>
                {components.map((comp, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-8">
                      <Select 
                        value={comp.component_product?.toString()} 
                        onValueChange={(val) => updateComponent(idx, 'component_product', val)}
                        disabled={isReadOnly || isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select component...">
                            {comp.component_product ? (products.find(p => p.id.toString() === comp.component_product.toString())?.name || `Product ${comp.component_product}`) : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {products.filter(p => p.id.toString() !== product).map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name || `Un-named Product (${p.id})`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input 
                        type="number" 
                        min="1" 
                        placeholder="1"
                        value={comp.quantity}
                        onChange={(e) => updateComponent(idx, 'quantity', e.target.value)}
                        disabled={isReadOnly || isSubmitting}
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      {!isReadOnly && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => removeComponent(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operations Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg">Operations</CardTitle>
            {!isReadOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={addOperation} className="flex flex-row items-center gap-1.5">
                <Plus className="h-4 w-4" /> <span>Add Operation</span>
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {operations.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">No operations added.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground px-1 uppercase tracking-wider text-xs">
                  <div className="col-span-5">Operation Name</div>
                  <div className="col-span-4">Duration (d / h / m)</div>
                  <div className="col-span-2">Work Center</div>
                  <div className="col-span-1"></div>
                </div>
                {operations.map((op, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5">
                      <Input 
                        placeholder="Assembly"
                        value={op.name}
                        onChange={(e) => updateOperation(idx, 'name', e.target.value)}
                        disabled={isReadOnly || isSubmitting}
                      />
                    </div>
                    <div className="col-span-4 flex items-center gap-1.5">
                      <Input 
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-14 h-9 px-2 text-center"
                        value={op.d}
                        onChange={(e) => updateOperation(idx, 'd', e.target.value)}
                        disabled={isReadOnly || isSubmitting}
                      />
                      <span className="text-xs text-muted-foreground mr-1">d</span>
                      <Input 
                        type="number"
                        min="0"
                        max="23"
                        placeholder="0"
                        className="w-14 h-9 px-2 text-center"
                        value={op.h}
                        onChange={(e) => updateOperation(idx, 'h', e.target.value)}
                        disabled={isReadOnly || isSubmitting}
                      />
                      <span className="text-xs text-muted-foreground mr-1">h</span>
                      <Input 
                        type="number"
                        min="0"
                        max="59"
                        placeholder="0"
                        className="w-14 h-9 px-2 text-center"
                        value={op.m}
                        onChange={(e) => updateOperation(idx, 'm', e.target.value)}
                        disabled={isReadOnly || isSubmitting}
                      />
                      <span className="text-xs text-muted-foreground">m</span>
                    </div>
                    <div className="col-span-2">
                      <Input 
                        placeholder="Line 1"
                        value={op.work_center}
                        onChange={(e) => updateOperation(idx, 'work_center', e.target.value)}
                        disabled={isReadOnly || isSubmitting}
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      {!isReadOnly && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => removeOperation(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex justify-end gap-3 pb-10">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/boms')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex flex-row items-center gap-1.5">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isEditing ? 'Save Changes' : 'Create BoM'}</span>
            </Button>
          </div>
        )}
      </form>

      {/* Phase 6 — Version History (only shown when viewing existing BoM) */}
      {isEditing && bomData && (
        <div className="mt-8">
          <VersionHistory
            productId={bomData.product?.id || bomData.product}
            productName={products.find(p => p.id.toString() === product)?.name || `Product ${product}`}
          />
        </div>
      )}
    </div>
  )
}
