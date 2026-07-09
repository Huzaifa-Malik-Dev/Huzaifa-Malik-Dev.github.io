import api from './axios';

export const login = (username, password) => api.post('/auth/login', { username, password }).then((r) => r.data);
export const logout = () => api.post('/auth/logout').then((r) => r.data);
export const me = () => api.get('/auth/me').then((r) => r.data);
export const updateProfile = (body) => api.patch('/auth/me', body).then((r) => r.data);
