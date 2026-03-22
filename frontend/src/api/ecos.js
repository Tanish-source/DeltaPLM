import api from './client';

export const getEcos = (params) => {
  return api.get('/ecos/', { params });
};

export const getEco = (id) => {
  return api.get(`/ecos/${id}/`);
};

export const createEco = (data) => {
  return api.post('/ecos/', data);
};

export const updateEco = (id, data) => {
  return api.put(`/ecos/${id}/`, data);
};

export const patchEco = (id, data) => {
  return api.patch(`/ecos/${id}/`, data);
};

export const getEcoChanges = (id) => {
  return api.get(`/ecos/${id}/changes/`);
};

export const submitEco = (id) => {
  return api.post(`/ecos/${id}/submit/`);
};

export const approveEco = (id, comment) => {
  return api.post(`/ecos/${id}/approve/`, { comment });
};

export const rejectEco = (id, comment) => {
  return api.post(`/ecos/${id}/reject/`, { comment });
};

export const validateEco = (id) => {
  return api.post(`/ecos/${id}/validate/`);
};

export const getEcoDiff = (id) => {
  return api.get(`/ecos/${id}/diff/`);
};

export const applyEco = (id) => {
  return api.post(`/ecos/${id}/apply/`);
};

export const getEcoAttachmentChanges = (id) => {
  return api.get(`/ecos/${id}/attachment-changes/`);
};

export const addEcoAttachmentChange = (id, data) => {
  return api.post(`/ecos/${id}/attachment-changes/`, data, {
    headers: {
      'Content-Type': undefined,
    },
  });
};

export const deleteEcoAttachmentChange = (id, changeId) => {
  return api.delete(`/ecos/${id}/attachment-changes/${changeId}/`);
};
