import api from './axios';

export const fetchDashboardSummary = () => api.get('/dashboard/summary').then((r) => r.data);
// Orders awaiting the current user's cancellation decision. Lives on the Dashboard because the
// approver is the Sales Head, who has no Back Office module access to browse orders with.
// Returns an empty list for anyone who isn't the Sales Head/admin.
export const fetchPendingCancellations = () => api.get('/dashboard/pending-cancellations').then((r) => r.data);
