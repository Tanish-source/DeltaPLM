import api from './client'

export const getProducts = (params) => api.get('/products/', { params })
export const getProduct = (id) => api.get(`/products/${id}/`)
export const createProduct = (data) => api.post('/products/', data, {
  headers: {
    'Content-Type': undefined
  }
})
export const updateProduct = (id, data) => api.put(`/products/${id}/`, data)
export const archiveProduct = (id) => api.patch(`/products/${id}/`, { is_active: false })
export const restoreProduct = (id) => api.patch(`/products/${id}/`, { is_active: true })
export const getProductVersions = (id) => api.get(`/products/${id}/versions/`)
