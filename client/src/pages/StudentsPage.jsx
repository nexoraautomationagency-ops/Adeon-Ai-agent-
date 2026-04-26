import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, UserCheck, UserX, Phone } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [form, setForm] = useState({ name:'', phone:'', grade:'', school:'', parent_name:'', parent_phone:'', monthly_fee:'', notes:'' });

  const loadStudents = () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (gradeFilter) params.grade = gradeFilter;
    api.getStudents(params).then(d => { setStudents(d.students); setTotal(d.total); }).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { loadStudents(); }, [search, gradeFilter]);

  const openCreate = () => { setEditStudent(null); setForm({ name:'', phone:'', grade:'', school:'', parent_name:'', parent_phone:'', monthly_fee:'', notes:'' }); setShowModal(true); };
  const openEdit = (s) => { setEditStudent(s); setForm({ name:s.name, phone:s.phone, grade:s.grade||'', school:s.school||'', parent_name:s.parent_name||'', parent_phone:s.parent_phone||'', monthly_fee:s.monthly_fee||'', notes:s.notes||'' }); setShowModal(true); };

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
  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();

  return (<div>
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="search-bar"><Search className="search-icon" size={18}/><input className="form-input" placeholder="Search..." style={{paddingLeft:38,width:260}} value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <select className="form-select" value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} style={{width:160}}><option value="">All Grades</option>{grades.map(g=><option key={g} value={g}>{g}</option>)}</select>
      </div>
      <button className="btn btn-primary" onClick={openCreate}><Plus size={18}/>Add Student</button>
    </div>
    <div className="flex gap-4 mb-4"><span className="badge badge-info">Total: {total}</span><span className="badge badge-success">Active: {students.filter(s=>s.status==='active').length}</span></div>
    {loading ? <div className="loading-spinner"/> : (
      <div className="table-container"><table className="data-table"><thead><tr><th>Name</th><th>Phone</th><th>Grade</th><th>School</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {students.length===0 ? <tr><td colSpan="7"><div className="empty-state"><h3>No students</h3></div></td></tr> : students.map(s=>(<tr key={s.id}>
          <td style={{color:'var(--text-primary)',fontWeight:600}}>{s.name}</td>
          <td><Phone size={14}/> {s.phone}</td>
          <td><span className="badge badge-neutral">{s.grade||'—'}</span></td>
          <td>{s.school||'—'}</td>
          <td style={{fontWeight:600}}>Rs.{(s.monthly_fee||0).toLocaleString()}</td>
          <td><span className={`badge ${s.status==='active'?'badge-success':'badge-danger'}`}>{s.status}</span></td>
          <td><div className="flex gap-2">
            <button className="btn btn-ghost btn-icon" onClick={()=>toggleStatus(s)}>{s.status==='active'?<UserX size={16}/>:<UserCheck size={16}/>}</button>
            <button className="btn btn-ghost btn-icon" onClick={()=>openEdit(s)}><Edit2 size={16}/></button>
            <button className="btn btn-ghost btn-icon text-danger" onClick={()=>handleDelete(s.id)}><Trash2 size={16}/></button>
          </div></td></tr>))}
      </tbody></table></div>
    )}
    {showModal && (<div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}><div className="modal"><div className="modal-header"><h3>{editStudent?'Edit Student':'Add Student'}</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}>✕</button></div>
      <form onSubmit={handleSubmit}><div className="modal-body">
        <div className="form-row"><div className="form-group"><label className="form-label">Name *</label><input className="form-input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">Grade</label><input className="form-input" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">School</label><input className="form-input" value={form.school} onChange={e=>setForm({...form,school:e.target.value})}/></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">Parent Name</label><input className="form-input" value={form.parent_name} onChange={e=>setForm({...form,parent_name:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Parent Phone</label><input className="form-input" value={form.parent_phone} onChange={e=>setForm({...form,parent_phone:e.target.value})}/></div></div>
        <div className="form-group"><label className="form-label">Monthly Fee (Rs.)</label><input className="form-input" type="number" value={form.monthly_fee} onChange={e=>setForm({...form,monthly_fee:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}/></div>
      </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">{editStudent?'Update':'Add'}</button></div></form>
    </div></div>)}
  </div>);
}
