import api from './axios';

export const fetchDashboardSummary = () => api.get('/dashboard/summary').then((r) => r.data);
