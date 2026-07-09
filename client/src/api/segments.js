import api from './axios';

export const fetchSegments = () => api.get('/segments').then((r) => r.data);
export const createSegment = (body) => api.post('/segments', body).then((r) => r.data);
export const updateSegment = (id, body) => api.patch(`/segments/${id}`, body).then((r) => r.data);
export const deleteSegment = (id) => api.delete(`/segments/${id}`).then((r) => r.data);
