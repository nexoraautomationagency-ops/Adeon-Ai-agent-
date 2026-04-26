import { useState, useEffect } from 'react';
import { CreditCard, Check, AlertCircle, Download } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PaymentsPage() {
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
      .then(([p, s]) => { setPayments(p.payments); setSummary(s.summary); })
      .catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [month, year, statusFilter]);

  const generatePayments = async () => {
    try {
      const r = await api.generatePayments(month, year);
      toast.success(`Generated ${r.created} payment records`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const updateStatus = async (id, status) => {
    try { await api.updatePayment(id, { status }); toast.success('Updated ✅'); load(); } catch (e) { toast.error(e.message); }
  };

  const rate = summary && summary.total_expected > 0 ? Math.round((summary.total_collected/summary.total_expected)*100) : 0;

  return (<div>
    {/* Controls */}
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <select className="form-select" value={month} onChange={e=>setMonth(e.target.value)} style={{width:150}}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select>
        <select className="form-select" value={year} onChange={e=>setYear(parseInt(e.target.value))} style={{width:100}}>
          {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
        </select>
        <select className="form-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{width:130}}>
          <option value="">All Status</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="pending">Pending</option>
        </select>
      </div>
      <button className="btn btn-primary" onClick={generatePayments}><CreditCard size={18}/>Generate Records</button>
    </div>

    {/* Summary Cards */}
    {summary && (
      <div className="stats-grid">
        <div className="stat-card green"><div className="stat-icon"><Check size={22}/></div><div className="stat-value">Rs.{(summary.total_collected||0).toLocaleString()}</div><div className="stat-label">Collected ({summary.paid_count||0} students)</div></div>
        <div className="stat-card orange"><div className="stat-icon"><AlertCircle size={22}/></div><div className="stat-value">Rs.{(summary.total_outstanding||0).toLocaleString()}</div><div className="stat-label">Outstanding ({(summary.unpaid_count||0)+(summary.pending_count||0)} students)</div></div>
        <div className="stat-card purple"><div className="stat-icon"><CreditCard size={22}/></div><div className="stat-value">{rate}%</div><div className="stat-label">Collection Rate</div></div>
      </div>
    )}

    {/* Table */}
    {loading ? <div className="loading-spinner"/> : (
      <div className="table-container"><table className="data-table"><thead><tr><th>Student</th><th>Grade</th><th>Amount</th><th>Status</th><th>Paid Date</th><th>Actions</th></tr></thead><tbody>
        {payments.length===0 ? <tr><td colSpan="6"><div className="empty-state"><h3>No records</h3><p>Click "Generate Records" to create payment entries for {month}</p></div></td></tr> : payments.map(p=>(
          <tr key={p.id}>
            <td style={{color:'var(--text-primary)',fontWeight:600}}>{p.student_name}</td>
            <td><span className="badge badge-neutral">{p.student_grade||'—'}</span></td>
            <td style={{fontWeight:600}}>Rs.{p.amount.toLocaleString()}</td>
            <td><span className={`badge ${p.status==='paid'?'badge-success':p.status==='pending'?'badge-warning':'badge-danger'}`}>{p.status}</span></td>
            <td className="text-sm text-muted">{p.paid_date ? new Date(p.paid_date).toLocaleDateString() : '—'}</td>
            <td><div className="flex gap-2">
              {p.status!=='paid' && <button className="btn btn-sm btn-success" onClick={()=>updateStatus(p.id,'paid')}>✓ Paid</button>}
              {p.status==='unpaid' && <button className="btn btn-sm btn-secondary" onClick={()=>updateStatus(p.id,'pending')}>Pending</button>}
              {p.status==='paid' && <button className="btn btn-sm btn-secondary" onClick={()=>updateStatus(p.id,'unpaid')}>Undo</button>}
            </div></td>
          </tr>
        ))}
      </tbody></table></div>
    )}
  </div>);
}
