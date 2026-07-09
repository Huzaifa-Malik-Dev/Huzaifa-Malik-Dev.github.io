import api from './axios';

export const fetchUnreadCount = () => api.get('/notifications/count').then((r) => r.data);
export const fetchNotifications = (afterSeq) => api.get('/notifications', { params: { afterSeq } }).then((r) => r.data);
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all').then((r) => r.data);
export const fetchThreadUnreadCounts = (dsrNos) => api.get('/notifications/thread-unread', { params: { dsrNos: dsrNos.join(',') } }).then((r) => r.data);
export const markThreadRead = (dsrNo) => api.patch(`/notifications/thread-read/${dsrNo}`).then((r) => r.data);
