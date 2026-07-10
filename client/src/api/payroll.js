import api from './axios';

export const fetchPayrollPreview = (month) => api.get('/payroll/preview', { params: { month } }).then((r) => r.data);
export const processPayrollRun = (body) => api.post('/payroll/runs', body).then((r) => r.data);
export const fetchPayrollRuns = (params) => api.get('/payroll/runs', { params }).then((r) => r.data);
export const fetchPayrollRun = (id) => api.get(`/payroll/runs/${id}`).then((r) => r.data);
export const deletePayrollRun = (id) => api.delete(`/payroll/runs/${id}`).then((r) => r.data);

export const fetchLedger = (params) => api.get('/payroll/ledger', { params }).then((r) => r.data);
export const createLedgerEntry = (body) => api.post('/payroll/ledger', body).then((r) => r.data);
export const updateLedgerEntry = (id, body) => api.patch(`/payroll/ledger/${id}`, body).then((r) => r.data);
export const deleteLedgerEntry = (id) => api.delete(`/payroll/ledger/${id}`).then((r) => r.data);

export const fetchCommissionTiers = (employee) => api.get('/payroll/commission-tiers', { params: { employee } }).then((r) => r.data);
export const createCommissionTier = (body) => api.post('/payroll/commission-tiers', body).then((r) => r.data);
export const updateCommissionTier = (id, body) => api.patch(`/payroll/commission-tiers/${id}`, body).then((r) => r.data);
export const deleteCommissionTier = (id) => api.delete(`/payroll/commission-tiers/${id}`).then((r) => r.data);
