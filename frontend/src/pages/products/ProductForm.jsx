import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProduct, createProduct, updateProduct } from '@/api/products'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/lib/constants'
import PageHeader from '@/components/shared/PageHeader'
import VersionHistory from '@/components/shared/VersionHistory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, ArrowLeft, Loader2, UploadCloud, File, X } from 'lucide-react'

export default function ProductForm() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  
  const canEdit = hasRole([ROLES.ENGINEERING, ROLES.ADMIN])
  
  const [form, setForm] = useState({
    name: '',
    sale_price: '',
    cost_price: '',
  })
  
  const [productData, setProductData] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [newFiles, setNewFiles] = useState([])
  
  const [isLoading, setIsLoading] = useState(isEditing)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEditing) {
      const fetchProduct = async () => {
        try {
          const { data } = await getProduct(id)
          setProductData(data)
          setForm({
            name: data.name || '',
            sale_price: data.sale_price || '',
            cost_price: data.cost_price || '',
          })
          setAttachments(data.attachments || [])
        } catch (err) {
          setError('Failed to load product details.')
        } finally {
          setIsLoading(false)
        }
      }
      fetchProduct()
    }
  }, [id, isEditing])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!form.name || !form.sale_price || !form.cost_price) {
      setError('Please fill in all required fields.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditing) {
        // Read-only, no update allowed
        navigate('/products')
        return
      }

      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('sale_price', form.sale_price)
      formData.append('cost_price', form.cost_price)
      formData.append('is_active', 'true')
      
      newFiles.forEach((file) => {
        formData.append('attachments', file)
      })

      await createProduct(formData)
      navigate('/products')
    } catch (err) {
      setError('Failed to save product. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleFileChange = (e) => {
    if (e.target.files) {
      setNewFiles([...newFiles, ...Array.from(e.target.files)])
    }
  }

  const removeNewFile = (index) => {
    setNewFiles(newFiles.filter((_, i) => i !== index))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // The view should be strictly read-only if it's an existing item
  const isReadOnly = isEditing

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/products')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader 
          title={isEditing ? (isReadOnly ? 'View Product' : 'Edit Product') : 'Create Product'} 
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-6">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold">Product Name</label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ex: iPhone 17 Pro"
                disabled={isReadOnly || isSubmitting}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="sale_price" className="text-sm font-semibold">Sale Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    id="sale_price"
                    name="sale_price"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={form.sale_price}
                    onChange={handleChange}
                    placeholder="500.00"
                    disabled={isReadOnly || isSubmitting}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="cost_price" className="text-sm font-semibold">Cost Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    id="cost_price"
                    name="cost_price"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={form.cost_price}
                    onChange={handleChange}
                    placeholder="340.00"
                    disabled={isReadOnly || isSubmitting}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="space-y-3 pt-2">
              <label className="text-sm font-semibold">Attachments</label>
              
              {!isReadOnly && (
                <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center relative cursor-pointer hover:bg-muted/50 transition-colors">
                  <Input 
                    type="file" 
                    multiple 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                  <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Drop files here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF up to 10MB</p>
                </div>
              )}

              {(attachments.length > 0 || newFiles.length > 0) && (
                <div className="space-y-2 mt-4">
                  {attachments.map((file, idx) => (
                    <div key={`existing-${idx}`} className="flex items-center justify-between p-3 border rounded-md bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <a 
                            href={file.file} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {file.name}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                  {newFiles.map((file, idx) => (
                    <div key={`new-${idx}`} className="flex items-center justify-between p-3 border rounded-md bg-secondary/30 border-primary/20">
                      <div className="flex items-center gap-3">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeNewFile(idx)}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex justify-end gap-3 mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/products')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        )}
      </form>

      {/* Phase 6 — Version History (only shown when viewing existing product) */}
      {isEditing && productData && (
        <div className="mt-8">
          <VersionHistory productId={id} productName={productData.name} />
        </div>
      )}
    </div>
  )
}

