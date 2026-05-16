import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, UserCheck, UserX, Phone, Users, UserPlus, UserMinus } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [form, setForm] = useState({ name:'', phone:'', grade:'', school:'', address:'', parent_name:'', parent_phone:'', monthly_fee:'', notes:'' });
  const [allGrades, setAllGrades] = useState([]);
  
  const { lastMessage } = useWebSocket();
  const { tutor } = useAuth();

  const loadStudents = () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (gradeFilter) params.grade = gradeFilter;
    if (statusFilter) params.status = statusFilter;
    api.getStudents(params).then(d => { setStudents(d.students); setTotal(d.total); }).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { 
    api.getGradesList().then(d => setAllGrades(d.grades || [])).catch(() => {});
  }, []);

  useEffect(() => { loadStudents(); }, [search, gradeFilter, statusFilter]);
  useEffect(() => { 
    if (lastMessage?._type === 'db_update' && lastMessage.table === 'students') {
      loadStudents(); 
    }
  }, [lastMessage]);

  const openCreate = () => { setEditStudent(null); setForm({ name:'', phone:'', grade:'', school:'', address:'', parent_name:'', parent_phone:'', monthly_fee:'', notes:'' }); setShowModal(true); };
  const openEdit = (s) => { setEditStudent(s); setForm({ name:s.name, phone:s.phone, grade:s.grade||'', school:s.school||'', address:s.address||'', parent_name:s.parent_name||'', parent_phone:s.parent_phone||'', monthly_fee:s.monthly_fee||'', notes:s.notes||'' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, monthly_fee: parseFloat(form.monthly_fee) || 0 };
      if (editStudent) { await api.updateStudent(editStudent.id, payload); toast.success('Updated ✅'); }
      else { await api.createStudent(payload); toast.success('Added 🎉'); }
      setShowModal(false); loadStudents();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => { if (!confirm('Delete this student?')) return; try { await api.deleteStudent(id); toast.success('Removed'); loadStudents(); } catch (e) { toast.error(e.message); } };
  const toggleStatus = async (s) => { try { await api.updateStudent(s.id, { status: s.status === 'active' ? 'inactive' : 'active' }); loadStudents(); } catch (e) { toast.error(e.message); } };

  const activeCount = (students || []).filter(s=>s.status==='active').length;
  const inactiveCount = (students || []).filter(s=>s.status==='inactive').length;

  return (
    <div className="animate-in">
      {/* Stats Section */}
      <div className="stats-grid mb-8">
        <div className="stat-card blue glass-card">
          <div className="stat-icon glow-primary"><Users size={22}/></div>
          <div className="stat-value text-accent">{total}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-card green glass-card">
          <div className="stat-icon glow-success"><UserPlus size={22}/></div>
          <div className="stat-value text-success">{activeCount}</div>
          <div className="stat-label">Active Enrollments</div>
        </div>
        <div className="stat-card orange glass-card">
          <div className="stat-icon" style={{background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444'}}><UserMinus size={22}/></div>
          <div className="stat-value text-danger">{inactiveCount}</div>
          <div className="stat-label">Inactive Students</div>
        </div>
      </div>

      {/* Controls Header */}
      <div className="glass-card p-6 rounded-2xl mb-8 flex flex-wrap items-center justify-between gap-6 shadow-glow">
        <div className="flex flex-wrap md-flex-nowrap items-center gap-3 w-full md-w-auto">
          <div className="search-bar w-full md-w-260">
            <Search className="search-icon" size={18}/>
            <input 
              className="form-input" 
              placeholder="Search by name or phone..." 
              style={{paddingLeft:42, width:'100%', height:44, borderRadius:12}} 
              value={search} 
              onChange={e=>setSearch(e.target.value)}
            />
          </div>
          <select className="form-select flex-1 md-flex-none" value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} style={{minWidth:120, maxWidth:130, height:44, borderRadius:12}}>
            <option value="">All Grades</option>
            {allGrades.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <select className="form-select flex-1 md-flex-none" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{minWidth:120, maxWidth:130, height:44, borderRadius:12}}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
          </select>
        </div>
        
        <button className="btn btn-primary glow-primary rounded-xl hover-scale px-6 w-full md-w-auto" onClick={openCreate} style={{height:44}}>
          <Plus size={20}/> Add New Student
        </button>
      </div>

      {loading ? <div className="loading-spinner m-auto mt-20"/> : (
        <div className="table-container shadow-lg">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Student</th>
                <th>Contact</th>
                <th>Grade</th>
                <th>Classes</th>
                <th>School</th>
                <th>Monthly Fee</th>
                <th>Status</th>
                <th className="text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(!students || students.length===0) ? (
                <tr><td colSpan="8"><div className="empty-state py-20"><h3>No student records found</h3></div></td></tr>
              ) : students.map(s=>(
                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                  <td className="pl-6 py-5">
                    <div className="font-bold text-lg text-white">{s.name}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={14} className="text-muted"/>
                      {s.phone}
                    </div>
                  </td>
                  <td><span className="badge badge-neutral" style={{fontSize:11}}>Grade {s.grade||'—'}</span></td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {(s.classes || '').split(',').filter(Boolean).map((c, i) => (
                        <span key={i} className="badge badge-info" style={{fontSize: '10px', padding: '2px 6px'}}>{c.trim()}</span>
                      ))}
                      {(!s.classes) && <span className="text-muted">—</span>}
                    </div>
                  </td>
                  <td className="text-sm">{s.school||'—'}</td>
                  <td className="font-bold text-white">Rs.{(s.monthly_fee||0).toLocaleString()}</td>
                  <td>
                    <span className={`badge py-1 px-3 ${s.status==='active'?'badge-success glow-success':'badge-danger'}`}>
                      <div className={`status-dot ${s.status==='active'?'bg-success':'bg-danger'}`}/>
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="pr-6 text-right">
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn-ghost btn-icon hover-scale" onClick={()=>toggleStatus(s)} title={s.status==='active'?'Deactivate':'Activate'}>
                        {s.status==='active'?<UserX size={18} className="text-danger/70"/>:<UserCheck size={18} className="text-success"/>}
                      </button>
                      <button className="btn btn-ghost btn-icon hover-scale" onClick={()=>openEdit(s)}><Edit2 size={18}/></button>
                      <button className="btn btn-ghost btn-icon text-danger/50 hover:text-danger hover-scale" onClick={()=>handleDelete(s.id)}><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal - Premium Glass Style */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal glass-card animate-in border-white/10" style={{borderRadius: 24, maxWidth: 600}}>
            <div className="modal-header border-b border-white/5 pb-4">
              <h3 className="text-xl font-bold">{editStudent?'Edit Student Profile':'Register New Student'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}><Trash2 size={20}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body p-8">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" style={{borderRadius:10}} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
                  <div className="form-group"><label className="form-label">Phone Number *</label><input className="form-input" style={{borderRadius:10}} required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Grade</label><input className="form-input" style={{borderRadius:10}} value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}/></div>
                  <div className="form-group"><label className="form-label">School</label><input className="form-input" style={{borderRadius:10}} value={form.school} onChange={e=>setForm({...form,school:e.target.value})}/></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Parent Name</label><input className="form-input" style={{borderRadius:10}} value={form.parent_name} onChange={e=>setForm({...form,parent_name:e.target.value})}/></div>
                  <div className="form-group"><label className="form-label">Parent Phone</label><input className="form-input" style={{borderRadius:10}} value={form.parent_phone} onChange={e=>setForm({...form,parent_phone:e.target.value})}/></div>
                </div>
                <div className="form-group"><label className="form-label">Monthly Fee (Rs.)</label><input className="form-input" style={{borderRadius:10}} type="number" value={form.monthly_fee} onChange={e=>setForm({...form,monthly_fee:e.target.value})}/></div>
                <div className="form-group"><label className="form-label">Full Address</label><textarea className="form-textarea" style={{borderRadius:10}} placeholder="Street, City, Zip" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} rows={2}/></div>
              </div>
              <div className="modal-footer p-8 pt-0 flex gap-3">
                <button type="button" className="btn btn-secondary rounded-xl px-6" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary glow-primary rounded-xl px-8">{editStudent?'Update Profile':'Complete Registration'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
