import api from './client'

export const getAuditLogs = (params) => api.get('/audit/', { params })
export const getEcoAuditLogs = (ecoId) => api.get(`/ecos/${ecoId}/audit/`)
