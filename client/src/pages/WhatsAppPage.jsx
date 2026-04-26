import { useState, useEffect } from 'react';
import { Send, Wand2, RefreshCw, Wifi, WifiOff, MessageCircle, Users, Megaphone } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function WhatsAppPage() {
  const { waStatus, qrCode } = useWebSocket();
  const [tab, setTab] = useState('send'); // send | broadcast | conversations
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [students, setStudents] = useState([]);
  const [broadcastGrade, setBroadcastGrade] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    api.getStudents({ limit: 1000 }).then(d => setStudents(d.students)).catch(() => {});
    api.getConversations().then(d => setConversations(d.conversations)).catch(() => {});
    api.getTemplates().then(d => setTemplates(d.templates)).catch(() => {});
  }, []);

  const sendMsg = async () => {
    if (!phone || !message) return toast.error('Phone and message required');
    setSending(true);
    try { await api.sendMessage({ phone, message }); toast.success('Sent ✅'); setMessage(''); } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const broadcast = async () => {
    if (!broadcastMsg) return toast.error('Message required');
    setSending(true);
    try {
      const data = { message: broadcastMsg };
      if (broadcastGrade) data.grade = broadcastGrade;
      const r = await api.broadcastMessage(data);
      toast.success(`Sent to ${r.sent}/${r.total} students`);
      setBroadcastMsg('');
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const aiRephrase = async (text, setter) => {
    if (!text) return;
    setAiLoading(true);
    try { const r = await api.rephraseAI(text); setter(r.rephrased); toast.success('AI rephrased ✨'); } catch (e) { toast.error(e.message); }
    finally { setAiLoading(false); }
  };

  const aiGenerate = async (instruction, setter) => {
    setAiLoading(true);
    try { const r = await api.generateAI({ instruction }); setter(r.message); toast.success('AI generated ✨'); } catch (e) { toast.error(e.message); }
    finally { setAiLoading(false); }
  };

  const restart = async () => { try { await api.restartWhatsApp(); toast.success('Restarting...'); } catch (e) { toast.error(e.message); } };
  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();
  const isReady = waStatus.status === 'ready';

  return (<div>
    {/* Status Bar */}
    <div className="card mb-4" style={{padding:16}}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isReady ? <Wifi size={20} style={{color:'var(--accent-success)'}}/> : <WifiOff size={20} style={{color:'var(--accent-danger)'}}/>}
          <span style={{fontWeight:600}}>WhatsApp: {waStatus.status?.replace('_',' ').toUpperCase()}</span>
          {waStatus.status === 'qr_pending' && <span className="badge badge-warning">Scan QR below</span>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={restart}><RefreshCw size={14}/>Restart</button>
      </div>
    </div>

    {/* QR Code */}
    {qrCode && (<div className="card mb-4"><div className="qr-container"><h3>📱 Scan QR Code with WhatsApp</h3><img src={qrCode} alt="QR Code"/><p className="text-sm text-muted">Open WhatsApp → Settings → Linked Devices → Link a Device</p></div></div>)}

    {/* Tabs */}
    <div className="flex gap-2 mb-4">
      <button className={`btn ${tab==='send'?'btn-primary':'btn-secondary'} btn-sm`} onClick={()=>setTab('send')}><Send size={14}/>Direct Send</button>
      <button className={`btn ${tab==='broadcast'?'btn-primary':'btn-secondary'} btn-sm`} onClick={()=>setTab('broadcast')}><Megaphone size={14}/>Broadcast</button>
      <button className={`btn ${tab==='conversations'?'btn-primary':'btn-secondary'} btn-sm`} onClick={()=>setTab('conversations')}><MessageCircle size={14}/>Chat Logs</button>
    </div>

    {/* Direct Send */}
    {tab === 'send' && (<div className="card">
      <h3 className="card-title mb-4">📤 Send Direct Message</h3>
      <div className="form-group"><label className="form-label">Student</label>
        <select className="form-select" value={phone} onChange={e=>setPhone(e.target.value)}>
          <option value="">Select student or type number...</option>
          {students.map(s=><option key={s.id} value={s.phone}>{s.name} ({s.phone})</option>)}
        </select>
      </div>
      <div className="form-group"><label className="form-label">Or enter phone</label><input className="form-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+94771234567"/></div>
      <div className="form-group"><label className="form-label">Message</label><textarea className="form-textarea" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type your message..." rows={4}/></div>
      <div className="flex gap-3">
        <button className="btn btn-primary" onClick={sendMsg} disabled={sending||!isReady}><Send size={16}/>{sending?'Sending...':'Send'}</button>
        <button className="btn btn-secondary" onClick={()=>aiRephrase(message,setMessage)} disabled={aiLoading||!message}><Wand2 size={16}/>AI Rephrase</button>
      </div>
      {/* Templates */}
      {templates.length > 0 && (<div className="mt-4"><label className="form-label">Quick Templates</label><div className="flex gap-2" style={{flexWrap:'wrap'}}>{templates.map(t=>(<button key={t.id} className="btn btn-secondary btn-sm" onClick={()=>setMessage(t.template)}>{t.name}</button>))}</div></div>)}
    </div>)}

    {/* Broadcast */}
    {tab === 'broadcast' && (<div className="card">
      <h3 className="card-title mb-4">📢 Broadcast Message</h3>
      <div className="form-group"><label className="form-label">Target</label>
        <select className="form-select" value={broadcastGrade} onChange={e=>setBroadcastGrade(e.target.value)}>
          <option value="">All Active Students</option>
          {grades.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className="form-group"><label className="form-label">Message</label><textarea className="form-textarea" value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} rows={5} placeholder="Type announcement..."/></div>
      <div className="flex gap-3">
        <button className="btn btn-primary" onClick={broadcast} disabled={sending||!isReady}><Megaphone size={16}/>{sending?'Sending...':'Broadcast'}</button>
        <button className="btn btn-secondary" onClick={()=>aiRephrase(broadcastMsg,setBroadcastMsg)} disabled={aiLoading||!broadcastMsg}><Wand2 size={16}/>AI Rephrase</button>
        <button className="btn btn-secondary" onClick={()=>aiGenerate('Write a class announcement for tuition students.',setBroadcastMsg)} disabled={aiLoading}><Wand2 size={16}/>AI Generate</button>
      </div>
    </div>)}

    {/* Conversations */}
    {tab === 'conversations' && (<div className="card">
      <h3 className="card-title mb-4">💬 Recent Conversations</h3>
      {conversations.length === 0 ? <div className="empty-state"><p>No conversations yet</p></div> : (
        <div className="table-container"><table className="data-table"><thead><tr><th>Student</th><th>Last Message</th><th>Direction</th><th>Time</th></tr></thead><tbody>
          {conversations.map((c,i)=>(<tr key={i}>
            <td style={{fontWeight:600,color:'var(--text-primary)'}}>{c.student_name||c.whatsapp_chat_id}</td>
            <td style={{maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.last_message}</td>
            <td><span className={`badge ${c.last_direction==='incoming'?'badge-info':'badge-neutral'}`}>{c.last_direction}</span></td>
            <td className="text-sm text-muted">{c.last_message_time ? new Date(c.last_message_time).toLocaleString() : '—'}</td>
          </tr>))}
        </tbody></table></div>
      )}
    </div>)}
  </div>);
}
