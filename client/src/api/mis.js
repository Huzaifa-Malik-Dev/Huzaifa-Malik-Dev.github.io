import api from './axios';

export const fetchMisRollup = (params) => api.get('/mis/rollup', { params }).then((r) => r.data);
export const fetchAgentPerformance = (id, params) => api.get(`/mis/agent/${id}`, { params }).then((r) => r.data);
export const misExportUrl = (month) => `${api.defaults.baseURL}/mis/export${month ? `?month=${month}` : ''}`;
