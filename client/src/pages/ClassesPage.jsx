import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Clock, MapPin, Users } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [form, setForm] = useState({ subject:'', grade:'', day_of_week:'Monday', start_time:'', end_time:'', location:'', max_students:50 });

  const load = () => { setLoading(true); api.getClasses().then(d=>setClasses(d.classes)).catch(e=>toast.error(e.message)).finally(()=>setLoading(false)); };
  useEffect(load, []);

  const openCreate = () => { setEditClass(null); setForm({ subject:'', grade:'', day_of_week:'Monday', start_time:'', end_time:'', location:'', max_students:50, fee: 0 }); setShowModal(true); };
  const openEdit = (c) => { setEditClass(c); setForm({ subject:c.subject, grade:c.grade, day_of_week:c.day_of_week, start_time:c.start_time, end_time:c.end_time||'', location:c.location||'', max_students:c.max_students, fee: c.fee || 0 }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editClass) { await api.updateClass(editClass.id, form); toast.success('Updated ✅'); }
      else { await api.createClass(form); toast.success('Created 🎉'); }
      setShowModal(false); load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => { if (!confirm('Delete this class?')) return; try { await api.deleteClass(id); toast.success('Deleted'); load(); } catch(e) { toast.error(e.message); } };
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const dayColors = { Monday:'#6366f1', Tuesday:'#06b6d4', Wednesday:'#10b981', Thursday:'#f59e0b', Friday:'#ef4444', Saturday:'#8b5cf6', Sunday:'#ec4899' };

  return (<div>
    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div className="flex gap-3"><span className="badge badge-info">Total: {classes.length}</span><span className="badge badge-success">Active: {classes.filter(c=>c.is_active).length}</span></div>
      <button className="btn btn-primary glow-primary rounded-xl hover-scale px-6 w-full md-w-auto" onClick={openCreate} style={{height:44}}><Plus size={18}/>Add Class</button>
    </div>
    {loading ? <div className="loading-spinner"/> : classes.length === 0 ? <div className="empty-state"><div className="empty-icon">📚</div><h3>No classes yet</h3><p>Create your first class schedule</p><button className="btn btn-primary" onClick={openCreate}><Plus size={18}/>Add Class</button></div> : (
      <div className="classes-grid">
        {classes.map(c => (
          <div className="card class-card-wrapper" key={c.id} style={{position:'relative',overflow:'hidden'}}>
            <div className="class-top-bar" style={{position:'absolute',top:0,left:0,right:0,height:3,background:dayColors[c.day_of_week]||'#6366f1'}}/>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{fontSize:18,fontWeight:700}}>{c.subject}</h3>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-icon" onClick={()=>openEdit(c)}><Edit2 size={16}/></button>
                <button className="btn btn-ghost btn-icon text-danger" onClick={()=>handleDelete(c.id)}><Trash2 size={16}/></button>
              </div>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="badge badge-neutral">{c.grade}</span>
              <span style={{fontSize:16,fontWeight:700,color:'var(--accent)'}}>Rs.{c.fee || 0}</span>
            </div>
            <div className="flex flex-col gap-2 mt-2" style={{fontSize:14,color:'var(--text-secondary)'}}>
              <div className="flex items-center gap-2"><Clock size={15}/>{c.day_of_week} • {c.start_time}{c.end_time ? ` - ${c.end_time}` : ''}</div>
              <div className="flex items-center gap-2"><MapPin size={15}/>{c.location||'Online'}</div>
              <div className="flex items-center gap-2"><Users size={15}/>{c.student_count||0} / {c.max_students} students</div>
            </div>
          </div>
        ))}
      </div>
    )}
    {showModal && (<div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}><div className="modal"><div className="modal-header"><h3>{editClass?'Edit Class':'Add Class'}</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}>✕</button></div>
      <form onSubmit={handleSubmit}><div className="modal-body">
        <div className="form-row"><div className="form-group"><label className="form-label">Subject *</label><input className="form-input" required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Grade *</label><input className="form-input" required value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}/></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">Day *</label><select className="form-select" value={form.day_of_week} onChange={e=>setForm({...form,day_of_week:e.target.value})}>{days.map(d=><option key={d}>{d}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Start Time *</label><input className="form-input" type="time" required value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></div></div>
        <div className="form-row"><div className="form-group"><label className="form-label">End Time</label><input className="form-input" type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Main Hall"/></div></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Max Students</label><input className="form-input" type="number" value={form.max_students} onChange={e=>setForm({...form,max_students:parseInt(e.target.value)||50})}/></div>
          <div className="form-group"><label className="form-label">Monthly Fee (Rs.)</label><input className="form-input" type="number" value={form.fee} onChange={e=>setForm({...form,fee:parseInt(e.target.value)||0})}/></div>
        </div>
      </div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">{editClass?'Update':'Create'}</button></div></form>
    </div></div>)}
  </div>);
}
