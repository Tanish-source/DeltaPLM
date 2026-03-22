import api from './client'

export const getDashboardSummary = (params) => api.get('/reports/dashboard-summary/', { params })
export const getEcoSummaryReport = (params) => api.get('/reports/eco-summary/', { params })
export const getApprovalMetrics = (params) => api.get('/reports/approval-metrics/', { params })
export const getProductChangeReport = (params) => api.get('/reports/product-changes/', { params })
