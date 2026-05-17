import { useState, useEffect } from 'react';
import { Truck, Check, Search, MapPin, Trash2, Eye, X, Image as ImageIcon, Package, Clock } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { useWebSocket } from '../context/WebSocketContext';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function TutesPage() {
  const { lastMessage } = useWebSocket();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const [allGrades, setAllGrades] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [shippingModal, setShippingModal] = useState(null); // { id, tracking_code, courier_name }

  const load = () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (gradeFilter) params.grade = gradeFilter;
    if (monthFilter) params.month = monthFilter;
    if (yearFilter) params.year = yearFilter;
    if (statusFilter) params.status = statusFilter;
    
    api.getTutes(params)
      .then(d => { setData(d.deliveries || []); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getGradesList().then(d => setAllGrades(d.grades || [])).catch(() => {});
  }, []);

  useEffect(load, [search, gradeFilter, monthFilter, statusFilter]);

  useEffect(() => {
    if (lastMessage?._type === 'db_update' && lastMessage.table === 'tute_deliveries') {
      load();
    }
  }, [lastMessage]);

  const updateTute = async (id, updates) => {
    try {
      await api.updateTute(id, updates);
      // If we are not doing a bulk load, update local state to reflect change immediately
      setData(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    } catch (err) { toast.error(err.message); }
  };

  const deleteTute = async (id) => {
    if (!confirm('Delete this delivery record?')) return;
    try {
      await api.deleteTute(id);
      toast.success('Removed');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const pendingCount = data.filter(d=>d.status==='pending').length;
  const shippedCount = data.filter(d=>d.status==='shipped').length;
  const deliveredCount = data.filter(d=>d.status==='delivered').length;

  return (
    <div className="animate-in">
      {/* Summary Cards - Premium Style like Payments */}
      <div className="stats-grid mb-8">
        <div className="stat-card blue glass-card">
          <div className="stat-icon" style={{background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee'}}><Package size={22}/></div>
          <div className="stat-value text-accent">{data.length}</div>
          <div className="stat-label">Total Shipments for Period</div>
        </div>
        <div className="stat-card orange glass-card">
          <div className="stat-icon" style={{background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b'}}><Clock size={22}/></div>
          <div className="stat-value text-warning">{pendingCount + shippedCount}</div>
          <div className="stat-label">In Progress ({pendingCount} Pending, {shippedCount} Shipped)</div>
        </div>
        <div className="stat-card green glass-card">
          <div className="stat-icon glow-success"><Check size={22}/></div>
          <div className="stat-value text-success">{deliveredCount}</div>
          <div className="stat-label">Successfully Delivered</div>
        </div>
      </div>

      {/* Controls Header - Premium Glass Look */}
      <div className="glass-card p-6 rounded-2xl mb-8 flex flex-wrap items-center justify-between gap-6 shadow-glow">
        <div className="flex flex-wrap md-flex-nowrap items-center gap-3 w-full md-w-auto">
          <div className="search-bar w-full md-w-260">
            <Search className="search-icon" size={18}/>
            <input 
              className="form-input" 
              placeholder="Search students..." 
              style={{paddingLeft:42, width:'100%', height:44, borderRadius:12}} 
              value={search} 
              onChange={e=>setSearch(e.target.value)}
            />
          </div>
          <select className="form-select flex-1 md-flex-none" value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} style={{minWidth:120, maxWidth:130, height:44, borderRadius:12}}>
            <option value="">All Grades</option>
            {allGrades.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <select className="form-select flex-1 md-flex-none" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{minWidth:120, maxWidth:130, height:44, borderRadius:12}}>
            <option value="">All Months</option>
            {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <select className="form-select flex-1 md-flex-none md-w-year" value={yearFilter} onChange={e=>setYearFilter(parseInt(e.target.value))} style={{height:44, borderRadius:12}}>
            {Array.from({length: new Date().getFullYear() - 2024 + 2}, (_, i) => 2024 + i).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select className="form-select flex-1 md-flex-none" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{minWidth:120, maxWidth:130, height:44, borderRadius:12}}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        
        <button className="btn btn-secondary rounded-xl hover-scale w-full md-w-auto" onClick={load}>
          Refresh Data
        </button>
      </div>

      {/* Table Section - Premium Minimalist Style */}
      {loading ? <div className="loading-spinner m-auto mt-20"/> : (
        <div className="table-container shadow-lg">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Student</th>
                <th>Course Info</th>
                <th>Classes</th>
                <th>Shipping Address</th>
                <th>Status</th>
                <th>Tracking & Evidence</th>
                <th className="text-right pr-6">Operations</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan="7"><div className="empty-state py-20"><h3>No tute records found</h3><p>Records appear here once student payments are approved.</p></div></td></tr>
              ) : (
                data.map((d) => (
                  <tr key={d.id} className="hover:bg-white/5 transition-colors">
                    <td className="pl-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-lg text-white">{d.student_name}</span>
                        <span className="text-xs text-muted">{d.student_phone}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1" style={{ alignItems: 'flex-start' }}>
                        <span className="badge badge-neutral" style={{fontSize:10}}>Grade {d.student_grade}</span>
                        <span className="text-accent font-bold text-sm">{d.month} Tute</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap" style={{maxWidth: '180px'}}>
                        {(d.student_classes_list || '').split(',').filter(Boolean).map((c, i) => (
                          <span key={i} className="badge badge-info" style={{fontSize: '10px', padding: '2px 6px'}}>{c.trim()}</span>
                        ))}
                        {(!d.student_classes_list) && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-start gap-2 max-w-[220px]">
                        <MapPin size={14} className="mt-1 shrink-0 text-accent" />
                        <span className="text-sm leading-relaxed" title={d.student_address}>{d.student_address || 'Address missing'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge py-1 pl-2.5 pr-3 ${
                        d.status === 'delivered' ? 'badge-success glow-success' : 
                        d.status === 'shipped' ? 'badge-warning' : 'badge-neutral'
                      }`}>
                        <div className={`status-dot ${d.status==='delivered'?'bg-success':d.status==='shipped'?'bg-warning':'bg-muted'}`}/>{d.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-2" style={{minWidth: '200px'}}>
                        <div className="flex items-center gap-2">
                          <input 
                            className="form-input" 
                            style={{fontSize: '12px', padding: '6px 12px', height: '36px', width: '150px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)'}}
                            placeholder="Tracking code..."
                            defaultValue={d.tracking_code || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (d.tracking_code || '')) {
                                updateTute(d.id, { tracking_code: e.target.value });
                                toast.success('Tracking code saved');
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateTute(d.id, { tracking_code: e.target.value });
                                toast.success('Tracking code saved');
                                e.target.blur();
                              }
                            }}
                          />
                          {d.photo_url && (
                            <button 
                              className="btn btn-ghost btn-icon hover-scale" 
                              style={{width: '36px', height: '36px', color: 'var(--text-accent)'}}
                              onClick={() => setPreviewImage(d.photo_url)}
                            >
                              <Eye size={18}/>
                            </button>
                          )}
                        </div>
                        
                        {d.status !== 'delivered' && (
                          <div className="flex flex-col gap-1">
                            <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border-2 transition-all hover-scale ${
                              d.photo_url 
                              ? 'bg-success/10 border-success/30 text-success' 
                              : 'bg-primary/5 border-dashed border-white/10 text-muted hover:border-accent hover:text-accent'
                            }`}>
                              <ImageIcon size={16} />
                              <span style={{fontSize: '12px', fontWeight: 700}}>
                                {d.photo_url ? 'Update Evidence' : 'Upload Evidence'}
                              </span>
                              <input type="file" className="hidden" onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  toast.loading('Processing image...', { id: 'tute-up' });
                                  const reader = new FileReader();
                                  reader.onloadend = async () => {
                                    try {
                                      await updateTute(d.id, { photo_url: reader.result });
                                      toast.success('Evidence linked!', { id: 'tute-up' });
                                      load();
                                    } catch (err) {
                                      toast.error('Upload failed', { id: 'tute-up' });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }} />
                            </label>
                            {d.photo_url && <span className="text-[10px] text-success font-bold text-center">✓ Cloud Synced</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="pr-6">
                      <div className="flex justify-end gap-2">
                        {d.status === 'pending' && (
                          <button 
                            className="btn btn-primary glow-primary hover-scale" 
                            style={{height:40, borderRadius:12}}
                            onClick={() => {
                              if (d.tracking_code) {
                                // If tracking code is already there, just ask for courier or confirm
                                setShippingModal({ id: d.id, tracking_code: d.tracking_code, courier_name: d.courier_name || 'Domex' });
                              } else {
                                // If missing, definitely show modal
                                setShippingModal({ id: d.id, tracking_code: '', courier_name: 'Domex' });
                              }
                            }}
                          >
                            <Truck size={16}/> Ship
                          </button>
                        )}
                        {d.status === 'shipped' && (
                          <button 
                            className="btn btn-success glow-success hover-scale" 
                            style={{height:40, borderRadius:12, color: 'white'}}
                            onClick={() => {
                              updateTute(d.id, { status: 'delivered' });
                              toast.success('Marked as delivered!');
                            }}
                          >
                            <Check size={16}/> Deliver
                          </button>
                        )}
                        <button className="btn btn-ghost btn-icon text-danger/50 hover:text-danger hover-scale" onClick={() => deleteTute(d.id)}>
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Shipping Confirmation Modal */}
      {shippingModal && (
        <div className="modal-overlay" onClick={() => setShippingModal(null)}>
          <div className="modal glass-card border-white/10" style={{maxWidth: '450px', borderRadius:24}} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-b border-white/5 pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2"><Truck className="text-accent"/> Dispatch Tute</h3>
              <button className="btn btn-ghost btn-icon rounded-full" onClick={() => setShippingModal(null)}><X size={20}/></button>
            </div>
            <div className="modal-body p-6">
              <div className="form-group mb-4">
                <label className="form-label">Tracking Code</label>
                <input 
                  className="form-input" 
                  value={shippingModal.tracking_code} 
                  onChange={e => setShippingModal({...shippingModal, tracking_code: e.target.value})}
                  placeholder="Enter tracking number..."
                  style={{borderRadius:10}}
                />
              </div>
              <div className="form-group mb-6">
                <label className="form-label">Courier Service</label>
                <select 
                  className="form-select" 
                  value={shippingModal.courier_name} 
                  onChange={e => setShippingModal({...shippingModal, courier_name: e.target.value})}
                  style={{borderRadius:10}}
                >
                  <option value="Domex">Domex</option>
                  <option value="Koombiyo">Koombiyo</option>
                  <option value="Pronto">Pronto</option>
                  <option value="Certis">Certis</option>
                  <option value="Grasshoppers">Grasshoppers</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <button 
                className="btn btn-primary w-full py-4 rounded-xl glow-primary font-bold text-lg"
                disabled={!shippingModal.tracking_code}
                onClick={async () => {
                  toast.loading('Shipping...', { id: 'ship-act' });
                  await updateTute(shippingModal.id, { 
                    status: 'shipped', 
                    tracking_code: shippingModal.tracking_code, 
                    courier_name: shippingModal.courier_name 
                  });
                  setShippingModal(null);
                  toast.success('Shipped successfully! 🚀', { id: 'ship-act' });
                }}
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal - Premium Glass Style */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal glass-card border-white/10" style={{maxWidth: '700px', borderRadius:28}} onClick={e => e.stopPropagation()}>
            <div className="modal-header border-b border-white/5 pb-4">
              <h3 className="text-xl font-extrabold tracking-tight">Shipment Evidence</h3>
              <button className="btn btn-ghost btn-icon rounded-full" onClick={() => setPreviewImage(null)}><X size={20}/></button>
            </div>
            <div className="modal-body p-6">
              <img src={previewImage} alt="Evidence" className="shadow-2xl" style={{width: '100%', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)'}} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
