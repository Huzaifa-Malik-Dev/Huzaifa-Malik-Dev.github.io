import api from './axios';

export const fetchPermissions = () => api.get('/admin/permissions').then((r) => r.data);
export const updateRolePermission = (body) => api.patch('/admin/permissions/role', body).then((r) => r.data);
export const updateUserOverride = (body) => api.patch('/admin/permissions/user', body).then((r) => r.data);
export const clearUserOverride = (userId) => api.delete(`/admin/permissions/user/${userId}`).then((r) => r.data);
export const updateRoleImportExport = (body) => api.patch('/admin/permissions/role/import-export', body).then((r) => r.data);
export const updateUserImportExportOverride = (body) => api.patch('/admin/permissions/user/import-export', body).then((r) => r.data);
export const updateRoleAction = (body) => api.patch('/admin/permissions/role/action', body).then((r) => r.data);
export const updateUserActionOverride = (body) => api.patch('/admin/permissions/user/action', body).then((r) => r.data);
