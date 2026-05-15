import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, Save, Users } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getClasses().then(d => {
      setClasses(d.classes);
      if (d.classes.length > 0) setSelectedClass(d.classes[0].id);
    }).catch(e => toast.error(e.message));
  }, []);

  useEffect(() => {
    if (selectedClass && date) {
      setLoading(true);
      api.getAttendance(selectedClass, date)
        .then(d => setStudents(d.attendance))
        .catch(e => toast.error(e.message))
        .finally(() => setLoading(false));
    }
  }, [selectedClass, date]);

  const toggleStatus = (studentId) => {
    setStudents(prev => prev.map(s => {
      if (s.student_id === studentId) {
        const nextStatus = s.status === 'present' ? 'absent' : 'present';
        return { ...s, status: nextStatus };
      }
      return s;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveAttendance({
        class_id: selectedClass,
        date,
        records: students.map(s => ({ student_id: s.student_id, status: s.status || 'present', notes: s.notes }))
      });
      toast.success('Attendance saved ✅');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = students.filter(s => s.status === 'present' || !s.status).length;
  const absentCount = students.filter(s => s.status === 'absent').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <select 
            className="form-select" 
            value={selectedClass} 
            onChange={e => setSelectedClass(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="">Select Class</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.grade} - {c.subject}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border">
            <Calendar size={16} className="text-muted" />
            <input 
              type="date" 
              className="form-input border-none p-0 bg-transparent" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
          </div>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={saving || !selectedClass}
        >
          <Save size={18} /> {saving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon"><Users size={22} /></div>
          <div className="stat-value">{students.length}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><CheckCircle size={22} /></div>
          <div className="stat-value">{presentCount}</div>
          <div className="stat-label">Present</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon"><XCircle size={22} /></div>
          <div className="stat-value">{absentCount}</div>
          <div className="stat-label">Absent</div>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner" />
      ) : students.length === 0 ? (
        <div className="empty-state">
          <h3>No students enrolled in this class</h3>
          <p>Please enroll students to start tracking attendance.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.student_id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.student_name}</td>
                  <td>
                    <span className={`badge ${(!s.status || s.status === 'present') ? 'badge-success' : 'badge-danger'}`}>
                      {s.status || 'present'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={`btn btn-sm ${(!s.status || s.status === 'present') ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => toggleStatus(s.student_id)}
                    >
                      {(!s.status || s.status === 'present') ? <XCircle size={14} /> : <CheckCircle size={14} />}
                      {(!s.status || s.status === 'present') ? ' Mark Absent' : ' Mark Present'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
