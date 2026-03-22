import api from './client'

export const getProducts = (params) => api.get('/products/', { params })
export const getProduct = (id) => api.get(`/products/${id}/`)
export const createProduct = (data) => api.post('/products/', data, {
  headers: {
    'Content-Type': undefined
  }
})
export const updateProduct = (id, data) => api.put(`/products/${id}/`, data)
export const getProductVersions = (id) => api.get(`/products/${id}/versions/`)
export const rollbackProductVersion = (id, targetId) => api.post(`/products/${id}/rollback/`, { target_id: targetId })
