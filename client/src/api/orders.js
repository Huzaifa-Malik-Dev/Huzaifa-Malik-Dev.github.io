import api from './axios';

export const fetchOrderList = (params) => api.get('/orders', { params }).then((r) => r.data);
export const createDirectOrder = (body) => api.post('/orders', body).then((r) => r.data);
export const fetchAssignableEmployees = () => api.get('/orders/assignable-employees').then((r) => r.data);
export const updateOrderStatus = (id, body) => api.patch(`/orders/${id}/status`, body).then((r) => r.data);
export const updateOrderLinked = (id, linked) => api.patch(`/orders/${id}/linked`, { linked }).then((r) => r.data);
export const sendOrderBack = (id) => api.post(`/orders/${id}/send-back`).then((r) => r.data);
export const updateOrder = (id, body) => api.patch(`/orders/${id}`, body).then((r) => r.data);
// Cancellation works off the order's own id, so it covers direct orders too (which have no
// Pipeline deal behind them). Served by the lightly-gated routes/orderCancellations.js, so a Sales
// Head - who has no backoffice module access - can still approve/reject.
export const requestOrderCancellation = (id, reason) => api.post(`/orders/${id}/request-cancellation`, { reason }).then((r) => r.data);
export const approveOrderCancellation = (id) => api.post(`/orders/${id}/approve-cancellation`).then((r) => r.data);
export const rejectOrderCancellation = (id, reason) => api.post(`/orders/${id}/reject-cancellation`, { reason }).then((r) => r.data);
export const exportOrders = (params) => api.get('/orders/export', { params, responseType: 'blob' }).then((r) => r.data);
export const importOrders = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/orders/import', form).then((r) => r.data);
};
