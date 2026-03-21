import api from './client';

export const getStages = () => api.get('/stages/');
export const createStage = (data) => api.post('/stages/', data);
export const updateStage = (id, data) => api.put(`/stages/${id}/`, data);
export const deleteStage = (id) => api.delete(`/stages/${id}/`);
export const getStageApprovers = (id) => api.get(`/stages/${id}/approvers/`);
export const addStageApprover = (id, data) => api.post(`/stages/${id}/approvers/`, data);
export const removeStageApprover = (stageId, approverId) => api.delete(`/stages/${stageId}/approvers/${approverId}/`);
export const getStageRule = (id) => api.get(`/stages/${id}/rule/`);
export const updateStageRule = (id, data) => api.put(`/stages/${id}/rule/`, data);
