import api from './client'

export const getBoms = (params) => api.get('/boms/', { params })
export const getBom = (id) => api.get(`/boms/${id}/`)
export const createBom = (data) => api.post('/boms/', data)
export const updateBom = (id, data) => api.put(`/boms/${id}/`, data)
export const archiveBom = (id) => api.patch(`/boms/${id}/`, { is_active: false })
export const restoreBom = (id) => api.patch(`/boms/${id}/`, { is_active: true })
export const getBomVersions = (id) => api.get(`/boms/${id}/versions/`)
