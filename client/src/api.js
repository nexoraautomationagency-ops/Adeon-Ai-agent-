const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('tutor');
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  getMe: () => request('/auth/me'),

  // Students
  getStudents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/students?${qs}`);
  },
  getStudent: (id) => request(`/students/${id}`),
  createStudent: (data) => request('/students', { method: 'POST', body: data }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: 'PUT', body: data }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
  enrollStudent: (id, classId) => request(`/students/${id}/enroll`, { method: 'POST', body: { class_id: classId } }),

  // Classes
  getClasses: () => request('/classes'),
  getClass: (id) => request(`/classes/${id}`),
  createClass: (data) => request('/classes', { method: 'POST', body: data }),
  updateClass: (id, data) => request(`/classes/${id}`, { method: 'PUT', body: data }),
  deleteClass: (id) => request(`/classes/${id}`, { method: 'DELETE' }),

  // Payments
  getPayments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/payments?${qs}`);
  },
  getPaymentSummary: (month, year) => {
    const qs = new URLSearchParams({ month, year }).toString();
    return request(`/payments/summary?${qs}`);
  },
  createPayment: (data) => request('/payments', { method: 'POST', body: data }),
  updatePayment: (id, data) => request(`/payments/${id}`, { method: 'PUT', body: data }),
  generatePayments: (month, year) => request('/payments/generate', { method: 'POST', body: { month, year } }),

  // Groups
  getGroups: () => request('/groups'),
  createGroup: (data) => request('/groups', { method: 'POST', body: data }),
  updateGroup: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: data }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  addGroupMembers: (id, studentIds) => request(`/groups/${id}/members`, { method: 'POST', body: { student_ids: studentIds } }),
  getGroupMembers: (id) => request(`/groups/${id}/members`),
  removeGroupMember: (groupId, studentId) => request(`/groups/${groupId}/members/${studentId}`, { method: 'DELETE' }),

  // WhatsApp
  getWhatsAppStatus: () => request('/whatsapp/status'),
  getWhatsAppQR: () => request('/whatsapp/qr'),
  sendMessage: (data) => request('/whatsapp/send', { method: 'POST', body: data }),
  broadcastMessage: (data) => request('/whatsapp/broadcast', { method: 'POST', body: data }),
  getWhatsAppGroups: () => request('/whatsapp/groups'),
  restartWhatsApp: () => request('/whatsapp/restart', { method: 'POST' }),

  // Messages
  getMessages: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/messages?${qs}`);
  },
  getConversations: () => request('/messages/conversations'),

  // AI
  generateAI: (data) => request('/ai/generate', { method: 'POST', body: data }),
  rephraseAI: (message) => request('/ai/rephrase', { method: 'POST', body: { message } }),
  getTemplates: () => request('/ai/templates'),
  createTemplate: (data) => request('/ai/templates', { method: 'POST', body: data }),
  fillTemplate: (id, variables) => request(`/ai/templates/${id}/fill`, { method: 'POST', body: { variables } }),

  // Dashboard
  getDashboardSummary: () => request('/dashboard/summary'),
  getSettings: () => request('/dashboard/settings'),
  updateSettings: (data) => request('/dashboard/settings', { method: 'PUT', body: data }),
};

export default api;
