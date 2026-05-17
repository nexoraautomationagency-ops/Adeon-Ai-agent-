import { useState, useEffect } from 'react';
import { CreditCard, Check, AlertCircle, Download, Calendar, Search } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { useWebSocket } from '../context/WebSocketContext';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PaymentsPage() {
  const { lastMessage } = useWebSocket();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toLocaleString('en-US',{month:'long'}));
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    const params = { month, year };
    if (statusFilter) params.status = statusFilter;
    Promise.all([api.getPayments(params), api.getPaymentSummary(month, year)])
      .then(([p, s]) => { setPayments(p.payments || []); setSummary(s.summary); })
      .catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };
  
  useEffect(load, [month, year, statusFilter]);

  // Listen for real-time updates - optimized for only relevant tables
  useEffect(() => {
    if (lastMessage?._type === 'db_update' && (lastMessage.table === 'payments' || lastMessage.table === 'students')) {
      load();
    }
  }, [lastMessage]);

  const generatePayments = async () => {
    try {
      const r = await api.generatePayments(month, year);
      toast.success(`Generated ${r.created} payment records`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const updateStatus = async (id, status, notes = null) => {
    try { 
      await api.updatePayment(id, { status, notes }); 
      toast.success(`Marked as ${status} ✅`); 
      load(); 
    } catch (e) { toast.error(e.message); }
  };

  const handleReject = (id) => {
    const reason = prompt("Enter rejection reason (sent to student):", "Blurry receipt");
    if (reason !== null) {
      updateStatus(id, 'unpaid', reason);
    }
  };

  const rate = summary && summary.total_expected > 0 ? Math.round((summary.total_collected/summary.total_expected)*100) : 0;

  return (
    <div className="animate-in">
      {/* Summary Cards - Premium Redesign */}
      {summary && (
        <div className="stats-grid mb-6">
          <div className="stat-card green glass-card animate-in">
            <div className="stat-icon glow-success"><Check size={22}/></div>
            <div className="stat-value text-success">Rs.{(summary.total_collected||0).toLocaleString()}</div>
            <div className="stat-label">Collected from {summary.paid_count||0} students</div>
          </div>
          <div className="stat-card orange glass-card animate-in" style={{animationDelay: '0.1s'}}>
            <div className="stat-icon" style={{background: 'rgba(245,158,11,0.1)', color: '#f59e0b'}}><AlertCircle size={22}/></div>
            <div className="stat-value text-warning">Rs.{(summary.total_outstanding||0).toLocaleString()}</div>
            <div className="stat-label">Pending/Unpaid ({(summary.unpaid_count||0)+(summary.pending_count||0)} total)</div>
          </div>
          <div className="stat-card purple glass-card animate-in" style={{animationDelay: '0.2s'}}>
            <div className="stat-icon glow-primary"><CreditCard size={22}/></div>
            <div className="stat-value text-accent">{rate}%</div>
            <div className="stat-label">Monthly Collection Rate</div>
            <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
               <div className="h-full bg-accent glow-primary transition-all duration-1000" style={{width: `${rate}%`}} />
            </div>
          </div>
        </div>
      )}

      {/* Premium Header Controls */}
      <div className="glass-card p-6 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-6 shadow-glow">
        <div className="flex flex-wrap md-flex-nowrap items-center gap-3 w-full md-w-auto">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5 w-full md-w-auto" style={{height:44}}>
            <select className="form-select border-0" value={month} onChange={e=>setMonth(e.target.value)} style={{minWidth:110, height:38, backgroundColor:'transparent'}}>
              {MONTHS.map(m=><option key={m}>{m}</option>)}
            </select>
            <div style={{width:1, height:20, background:'rgba(255,255,255,0.1)'}}/>
            <select className="form-select border-0" value={year} onChange={e=>setYear(parseInt(e.target.value))} style={{width:85, height:38, backgroundColor:'transparent', paddingRight:25}}>
              {Array.from({length: new Date().getFullYear() - 2024 + 2}, (_, i) => 2024 + i).map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <select className="form-select flex-1 md-flex-none" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{minWidth:120, maxWidth:130, height:44, borderRadius:12}}>
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md-w-auto">
          <button className="btn btn-secondary rounded-xl hover-scale flex-1 md-flex-none" onClick={async () => {
            if (!confirm(`Send WhatsApp reminders to all unpaid students for ${month}?`)) return;
            toast.loading('Sending reminders...', { id: 'remind' });
            try {
              const r = await api.sendReminders({ month });
              toast.success(`Sent ${r.sent} reminders! 📢`, { id: 'remind' });
            } catch (e) { toast.error(e.message, { id: 'remind' }); }
          }} disabled={loading}><AlertCircle size={18}/>Remind All</button>
          <button className="btn btn-primary glow-primary rounded-xl hover-scale flex-1 md-flex-none" onClick={generatePayments}><CreditCard size={18}/>Generate</button>
          <button className="btn btn-secondary rounded-xl hover-scale flex-1 md-flex-none" onClick={() => api.exportPayments(month, year)}><Download size={18}/>Export</button>
        </div>
      </div>

      {/* Table - Premium Layout */}
      {loading ? <div className="loading-spinner m-auto mt-20"/> : (
        <div className="table-container shadow-xl bg-card/30 backdrop-blur-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Student</th>
                <th>Grade</th>
                <th>Amount</th>
                <th>Payment Status</th>
                <th>Paid Date</th>
                <th className="text-right pr-6">Management</th>
              </tr>
            </thead>
            <tbody>
              {payments.length===0 ? (
                <tr><td colSpan="6"><div className="empty-state py-24"><h3>No payment records found</h3><p>Click "Generate Records" to create entries for {month}.</p></div></td></tr>
              ) : payments.map(p=>(
                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                  <td className="pl-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-lg text-white">{p.student_name}</span>
                      <span className="text-xs text-muted">{p.student_phone}</span>
                      {p.notes && p.status === 'unpaid' && (
                        <span className="text-[10px] text-danger mt-1 bg-danger/10 px-2 py-0.5 rounded w-fit">
                          Reason: {p.notes}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><span className="badge badge-neutral" style={{fontSize:11}}>Grade {p.student_grade||'—'}</span></td>
                  <td className="font-extrabold text-white">Rs.{p.amount.toLocaleString()}</td>
                  <td>
                    <span className={`badge py-1 pl-2.5 pr-3 ${
                      p.status==='paid'?'badge-success glow-success':
                      p.status==='pending'?'badge-warning':'badge-danger'
                    }`}>
                      <div className={`status-dot ${p.status==='paid'?'bg-success':p.status==='pending'?'bg-warning':'bg-danger'}`}/>{p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-sm text-muted">
                    {p.paid_date ? (
                      <div className="flex items-center gap-2">
                        <Calendar size={14}/>
                        {new Date(p.paid_date).toLocaleDateString()}
                      </div>
                    ) : 'Not paid'}
                  </td>
                  <td className="pr-6">
                    <div className="flex justify-end gap-2">
                      {p.receipt_url && p.receipt_url.split(',').map((url, idx, arr) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn btn-sm btn-secondary hover-scale" 
                          style={{height:36, borderRadius:10}}
                        >
                          👁️ {arr.length > 1 ? `Slip ${idx + 1}` : 'View Slip'}
                        </a>
                      ))}
                      {p.status!=='paid' && (
                        <button className="btn btn-sm btn-success glow-success hover-scale" style={{height:36, borderRadius:10}} onClick={()=>updateStatus(p.id,'paid')}>
                          <Check size={16}/> Approve
                        </button>
                      )}
                      {p.status==='pending' && (
                        <button className="btn btn-sm btn-danger hover-scale" style={{height:36, borderRadius:10}} onClick={()=>handleReject(p.id)}>
                          Reject
                        </button>
                      )}
                      {p.status==='paid' && (
                        <button className="btn btn-sm btn-ghost hover-scale" style={{height:36, borderRadius:10}} onClick={()=>updateStatus(p.id,'unpaid')}>
                          Undo
                        </button>
                      )}
                    </div>
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
