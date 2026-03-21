import api from './client'

export const getUsers = (params) => api.get('/auth/users/', { params })
export const updateUserRole = (id, role) => api.patch(`/auth/users/${id}/role/`, { role })
