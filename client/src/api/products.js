import api from './axios';

export const fetchProducts = (params) => api.get('/products', { params }).then((r) => r.data);
export const createProduct = (body) => api.post('/products', body).then((r) => r.data);
export const updateProduct = (id, body) => api.patch(`/products/${id}`, body).then((r) => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data);
