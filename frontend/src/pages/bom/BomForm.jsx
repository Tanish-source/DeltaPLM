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
          setOperations(data.operations || [])
        } else {
          // Initialize empty row for new BoM
          setComponents([{ component_product: '', quantity: '' }])
          setOperations([{ operation_name: '', duration: '', work_center: '' }])
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
    setOperations([...operations, { operation_name: '', duration: '', work_center: '' }])
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
    const validOps = operations.filter(o => o.operation_name && o.duration)

    setIsSubmitting(true)
    try {
      const payload = {
        product: parseInt(product, 10),
        components: validComps.map(c => ({
          component_product: parseInt(c.component_product, 10),
          quantity: parseInt(c.quantity, 10)
        })),
        operations: validOps
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

  // If archived, read-only mode
  const isArchived = bomData?.is_active === false
  const isReadOnly = !canEdit || isArchived

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
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
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
              <Button type="button" variant="ghost" size="sm" onClick={addComponent}>
                <Plus className="h-4 w-4 mr-1" /> Add Component
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
                          <SelectValue placeholder="Select component..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.filter(p => p.id.toString() !== product).map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
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
              <Button type="button" variant="ghost" size="sm" onClick={addOperation}>
                <Plus className="h-4 w-4 mr-1" /> Add Operation
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
                  <div className="col-span-3">Duration (e.g. 01:30:00)</div>
                  <div className="col-span-3">Work Center</div>
                  <div className="col-span-1"></div>
                </div>
                {operations.map((op, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5">
                      <Input 
                        placeholder="Assembly"
                        value={op.operation_name}
                        onChange={(e) => updateOperation(idx, 'operation_name', e.target.value)}
                        disabled={isReadOnly || isSubmitting}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input 
                        placeholder="hh:mm:ss"
                        value={op.duration}
                        onChange={(e) => updateOperation(idx, 'duration', e.target.value)}
                        disabled={isReadOnly || isSubmitting}
                      />
                    </div>
                    <div className="col-span-3">
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create BoM'}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
