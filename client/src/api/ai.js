import api from './axios';

export const fetchAiReport = (period) => api.get('/ai/report', { params: { period } }).then((r) => r.data);
