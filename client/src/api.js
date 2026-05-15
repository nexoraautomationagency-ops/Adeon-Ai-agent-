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
  getGradesList: () => request('/students/grades/list'),
  yearEndProcess: () => request('/students/year-end', { method: 'POST' }),

  // Classes
  getClasses: () => request('/classes'),
  getClass: (id) => request(`/classes/${id}`),
  createClass: (data) => request('/classes', { method: 'POST', body: data }),
  updateClass: (id, data) => request(`/classes/${id}`, { method: 'PUT', body: data }),
  deleteClass: (id) => request(`/classes/${id}`, { method: 'DELETE' }),

  // Attendance
  getAttendance: (classId, date) => request(`/attendance?class_id=${classId}&date=${date}`),
  saveAttendance: (data) => request('/attendance/bulk', { method: 'POST', body: data }),
  getAttendanceSummary: () => request('/attendance/summary'),

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
  exportPayments: async (month, year) => {
    const token = localStorage.getItem('token');
    const qs = new URLSearchParams({ month, year }).toString();
    
    const res = await fetch(`${API_BASE}/payments/export?${qs}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error('Export failed');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_${month || 'all'}_${year || 'all'}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Groups
  getGroups: () => request('/groups'),
  createGroup: (data) => request('/groups', { method: 'POST', body: data }),
  updateGroup: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: data }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  addGroupMembers: (id, studentIds) => request(`/groups/${id}/members`, { method: 'POST', body: { student_ids: studentIds } }),
  getGroupMembers: (id) => request(`/groups/${id}/members`),
  removeGroupMember: (groupId, studentId) => request(`/groups/${groupId}/members/${studentId}`, { method: 'DELETE' }),
  updateGroupMappings: (mappings) => request('/groups/mapping', { method: 'POST', body: { mappings } }),

  // WhatsApp
  getWhatsAppStatus: () => request('/whatsapp/status'),
  getWhatsAppQR: () => request('/whatsapp/qr'),
  sendMessage: (data) => request('/whatsapp/send', { method: 'POST', body: data }),
  broadcastMessage: (data) => request('/whatsapp/broadcast', { method: 'POST', body: data }),
  getWhatsAppGroups: () => request('/whatsapp/groups'),
  getAdminGroups: () => request('/whatsapp/admin-groups'),
  restartWhatsApp: () => request('/whatsapp/restart', { method: 'POST' }),
  sendReminders: (data) => request('/whatsapp/remind', { method: 'POST', body: data }),
  logoutWhatsApp: () => request('/whatsapp/logout', { method: 'POST' }),

  // Messages
  getMessages: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/messages?${qs}`);
  },
  getConversations: () => request('/messages/conversations'),
  getMessageHistory: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/messages?${q}`);
  },

  // AI & Knowledge
  getFacts: () => request('/knowledge/facts'),
  addFact: (data) => request('/knowledge/facts', { method: 'POST', body: data }),
  clearFacts: (category, subCategory) => request('/knowledge/facts/clear', { method: 'POST', body: { category, subCategory } }),
  deleteFact: (id) => request(`/knowledge/facts/${id}`, { method: 'DELETE' }),
  getExamples: () => request('/knowledge/examples'),
  teachAI: (data) => request('/knowledge/teach', { method: 'POST', body: data }),
  deleteExample: (id) => request(`/knowledge/examples/${id}`, { method: 'DELETE' }),
  rephraseAI: (message, tone) => request('/ai/rephrase', { method: 'POST', body: { message, tone } }),
  generateAI: (data) => request('/ai/generate', { method: 'POST', body: data }),
  getTemplates: () => request('/messages/templates'),
  saveTemplate: (data) => request('/messages/templates', { method: 'POST', body: data }),
  deleteTemplate: (id) => request(`/messages/templates/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboardSummary: () => request('/dashboard/summary'),
  getSettings: () => request('/dashboard/settings'),
  updateSettings: (data) => request('/dashboard/settings', { method: 'PUT', body: data }),
  resetAICache: () => request('/dashboard/reset-ai-cache', { method: 'POST' }),
  resetConversations: () => request('/dashboard/reset-conversations', { method: 'POST' }),
  getTutorAdmins: () => request('/dashboard/admins'),
  addTutorAdmin: (phone) => request('/dashboard/admins', { method: 'POST', body: { phone } }),
  removeTutorAdmin: (id) => request(`/dashboard/admins/${id}`, { method: 'DELETE' }),
  updateTutorPhone: (phone) => request('/dashboard/tutor/phone', { method: 'PUT', body: { phone } }),
  getGroupMappings: () => request('/dashboard/group-mappings'),
  createWhatsAppGroup: (data) => request('/dashboard/create-group', { method: 'POST', body: data }),
  updateGroupMapping: (data) => request('/dashboard/update-mapping', { method: 'POST', body: data }),
  
  // Tutes
  getTutes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tutes?${qs}`);
  },
  updateTute: (id, data) => request(`/tutes/${id}`, { method: 'PATCH', body: data }),
  deleteTute: (id) => request(`/tutes/${id}`, { method: 'DELETE' }),
  syncTutes: (month, year) => request('/tutes/sync', { method: 'POST', body: { month, year } }),
};

export default api;
