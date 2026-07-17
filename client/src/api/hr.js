import api from './axios';

export const fetchEmployees = (params) => api.get('/users', { params }).then((r) => r.data);
export const fetchEmployee = (id) => api.get(`/users/${id}`).then((r) => r.data);
// Human-facing lookup for the employee detail page's URL - accepts the bare number or full
// "DC16" (server resolves either), unlike fetchEmployee above which needs the raw _id.
export const fetchEmployeeByEmployeeId = (employeeId) => api.get(`/users/by-employee-id/${employeeId}`).then((r) => r.data);
export const createEmployee = (body) => api.post('/users', body).then((r) => r.data);
export const updateEmployee = (id, body) => api.patch(`/users/${id}`, body).then((r) => r.data);
export const fetchEmployeeHistory = (id) => api.get(`/users/${id}/history`).then((r) => r.data);
// Admin only. The server generates the password and returns it exactly once - it is never stored
// in plaintext or recoverable afterwards, so if it's lost before being handed over, reset again.
export const resetEmployeePassword = (id) => api.post(`/users/${id}/reset-password`).then((r) => r.data);

export const uploadEmployeeDoc = (id, field, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api
    .post(`/users/${id}/upload/${field}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

export const fetchComplianceSummary = () => api.get('/users/compliance-summary').then((r) => r.data);

export const exportEmployees = (params) => api.get('/users/export', { params, responseType: 'blob' }).then((r) => r.data);
export const importEmployees = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/users/import', form).then((r) => r.data);
};
