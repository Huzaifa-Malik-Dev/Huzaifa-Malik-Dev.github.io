import api from './axios';

export const fetchThread = (dsrNo) => api.get(`/threads/${dsrNo}`).then((r) => r.data);
export const postThreadMessage = (dsrNo, body) => api.post(`/threads/${dsrNo}/messages`, body).then((r) => r.data);
export const postThreadAttachment = (dsrNo, file, mentionIds) => {
  const form = new FormData();
  form.append('file', file);
  form.append('mentionIds', JSON.stringify(mentionIds || []));
  return api.post(`/threads/${dsrNo}/attachment`, form).then((r) => r.data);
};
