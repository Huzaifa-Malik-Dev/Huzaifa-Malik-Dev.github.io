import api from './axios';

export const fetchEmployees = (params) => api.get('/users', { params }).then((r) => r.data);
export const fetchEmployee = (id) => api.get(`/users/${id}`).then((r) => r.data);
export const createEmployee = (body) => api.post('/users', body).then((r) => r.data);
export const updateEmployee = (id, body) => api.patch(`/users/${id}`, body).then((r) => r.data);
export const fetchEmployeeHistory = (id) => api.get(`/users/${id}/history`).then((r) => r.data);

export const uploadEmployeeDoc = (id, field, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api
    .post(`/users/${id}/upload/${field}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};
