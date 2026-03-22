import api from './client'

export const getBoms = (params) => api.get('/boms/', { params })
export const getBom = (id) => api.get(`/boms/${id}/`)
export const createBom = (data) => api.post('/boms/', data)
export const updateBom = (id, data) => api.put(`/boms/${id}/`, data)
export const getBomVersions = (id) => api.get(`/boms/${id}/versions/`)
export const rollbackBomVersion = (id, targetId) => api.post(`/boms/${id}/rollback/`, { target_id: targetId })
