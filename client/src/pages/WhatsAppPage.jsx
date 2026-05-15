import { useState, useEffect, useRef } from 'react';
import { Send, Wand2, RefreshCw, Wifi, WifiOff, MessageCircle, Users, Megaphone, Trash2, Unplug, ChevronLeft, Brain, Sparkles, ExternalLink } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function WhatsAppPage() {
  const { waStatus, qrCode } = useWebSocket();
  const { tutor } = useAuth();
  const [tab, setTab] = useState('send'); // send | broadcast | conversations
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [students, setStudents] = useState([]);
  const [broadcastGrade, setBroadcastGrade] = useState('');
  const [broadcastPaymentStatus, setBroadcastPaymentStatus] = useState('');
  const [broadcastMonth, setBroadcastMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [broadcastYear, setBroadcastYear] = useState(new Date().getFullYear());
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [qrFromPoll, setQrFromPoll] = useState(null);

  // History & Teaching
  const [selectedChat, setSelectedChat] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [teachingMsg, setTeachingMsg] = useState(null);
  const [idealReply, setIdealReply] = useState('');
  const historyEndRef = useRef(null);

  // Fallback: Poll for QR code if WebSocket missed it
  useEffect(() => {
    if (waStatus.status === 'ready' || qrCode) return;
    const pollQR = async () => {
      try {
        const data = await api.getWhatsAppQR();
        if (data.qrCode) setQrFromPoll(data.qrCode);
        else setQrFromPoll(null);
      } catch (e) {}
    };
    pollQR();
    const interval = setInterval(pollQR, 3000);
    return () => clearInterval(interval);
  }, [waStatus.status, qrCode]);

  const displayQR = qrCode || qrFromPoll;

  const loadBaseData = () => {
    api.getStudents({ limit: 1000 }).then(d => setStudents(d.students)).catch(() => {});
    api.getConversations().then(d => setConversations(d.conversations)).catch(() => {});
    api.getTemplates().then(d => setTemplates(d.templates)).catch(() => {});
  };

  useEffect(loadBaseData, []);

  const sendMsg = async () => {
    if (!phone || !message) return toast.error('Phone and message required');
    setSending(true);
    try { 
      await api.sendMessage({ phone, message }); 
      toast.success('Sent ✅'); 
      setMessage(''); 
      if (selectedChat) loadHistory(selectedChat.whatsapp_chat_id);
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const broadcast = async () => {
    if (!broadcastMsg) return toast.error('Message required');
    setSending(true);
    try {
      const data = { message: broadcastMsg };
      if (broadcastGrade) data.grade = broadcastGrade;
      if (broadcastPaymentStatus) {
        data.payment_status = broadcastPaymentStatus;
        data.month = broadcastMonth;
        data.year = broadcastYear;
      }
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

  const loadHistory = async (chatId) => {
    setHistoryLoading(true);
    try {
      const r = await api.getMessageHistory({ whatsapp_chat_id: chatId, limit: 50 });
      setHistory(r.messages.reverse());
    } catch (e) { toast.error('Failed to load history'); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  const selectChat = (chat) => {
    setSelectedChat(chat);
    loadHistory(chat.whatsapp_chat_id);
  };

  const startTeaching = (msg) => {
    setTeachingMsg(msg);
    // Find the next message if it's an AI or outgoing message to suggest as ideal reply
    const msgIndex = history.findIndex(m => m.id === msg.id);
    const nextMsg = history[msgIndex + 1];
    setIdealReply(nextMsg?.direction === 'outgoing' ? nextMsg.content : '');
  };

  const submitTeaching = async () => {
    if (!idealReply) return toast.error('Please provide the ideal reply');
    try {
      await api.teachAI({
        student_message: teachingMsg.content,
        ideal_reply: idealReply,
        intent: teachingMsg.detected_intent || 'GENERAL'
      });
      toast.success('AI learned this pattern! 🧠✨');
      setTeachingMsg(null);
    } catch (e) { toast.error(e.message); }
  };

  const restart = async () => { try { await api.restartWhatsApp(); toast.success('Restarting...'); } catch (e) { toast.error(e.message); } };
  const logoutWA = async () => {
    if (!confirm('⚠️ Disconnect current WhatsApp?')) return;
    try { await api.logoutWhatsApp(); toast.success('WhatsApp disconnected!'); } catch (e) { toast.error(e.message); }
  };

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
          {waStatus.status === 'initializing' && <span className="badge badge-info animate-pulse">Starting up...</span>}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={restart}><RefreshCw size={14}/>Restart</button>
          {isReady && <button className="btn btn-danger btn-sm" onClick={logoutWA}><Unplug size={14}/>Disconnect</button>}
        </div>
      </div>
    </div>

    {/* QR Code */}
    {displayQR && (<div className="card mb-4"><div className="qr-container"><h3>📱 Scan QR Code</h3><img src={displayQR} alt="QR Code"/><p className="text-sm text-muted">Open WhatsApp → Linked Devices → Link a Device</p></div></div>)}

    {/* Tabs */}
    <div className="flex gap-2 mb-4">
      <button className={`btn ${tab==='send'?'btn-primary':'btn-secondary'} btn-sm`} onClick={()=>setTab('send')}><Send size={14}/>Direct Send</button>
      <button className={`btn ${tab==='broadcast'?'btn-primary':'btn-secondary'} btn-sm`} onClick={()=>setTab('broadcast')}><Megaphone size={14}/>Broadcast</button>
      <button className={`btn ${tab==='conversations'?'btn-primary':'btn-secondary'} btn-sm`} onClick={()=>setTab('conversations')}><MessageCircle size={14}/>Chat Logs</button>
    </div>

    {/* Content Area */}
    <div className="animate-in">
      {tab === 'send' && (<div className="card">
        <h3 className="card-title mb-4">📤 Send Direct Message</h3>
        <div className="form-group"><label className="form-label">Student</label>
          <select className="form-select" value={phone} onChange={e=>setPhone(e.target.value)}>
            <option value="">Select student...</option>
            {students.map(s=><option key={s.id} value={s.whatsapp_id || s.phone}>{s.name} ({s.phone})</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Or enter phone</label><input className="form-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+94..."/></div>
        <div className="form-group"><label className="form-label">Message</label><textarea className="form-textarea" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type your message..." rows={4}/></div>
        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={sendMsg} disabled={sending||!isReady}><Send size={16}/>{sending?'Sending...':'Send'}</button>
          <button className="btn btn-secondary" onClick={()=>aiRephrase(message,setMessage)} disabled={aiLoading||!message}><Wand2 size={16}/>AI Rephrase</button>
        </div>
      </div>)}

      {tab === 'broadcast' && (<div className="card">
        <h3 className="card-title mb-4">📢 Broadcast Message</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="form-group"><label className="form-label">Target Grade</label>
            <select className="form-select" value={broadcastGrade} onChange={e=>setBroadcastGrade(e.target.value)}>
              <option value="">All Grades</option>
              {grades.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Payment Status</label>
            <select className="form-select" value={broadcastPaymentStatus} onChange={e=>setBroadcastPaymentStatus(e.target.value)}>
              <option value="">All Active Students</option>
              <option value="paid">Paid Students Only</option>
              <option value="unpaid">Unpaid Students Only</option>
              <option value="pending">Pending Approval Only</option>
            </select>
          </div>
        </div>

        {broadcastPaymentStatus && (
          <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-white-05 rounded-lg border border-white-08">
            <div className="form-group mb-0">
              <label className="form-label text-xs">For Month</label>
              <select className="form-select form-select-sm" value={broadcastMonth} onChange={e=>setBroadcastMonth(e.target.value)}>
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group mb-0">
              <label className="form-label text-xs">For Year</label>
              <select className="form-select form-select-sm" value={broadcastYear} onChange={e=>setBroadcastYear(parseInt(e.target.value))}>
                {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="form-group"><label className="form-label">Message</label><textarea className="form-textarea" value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} rows={5} placeholder="Type announcement..."/></div>
        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={broadcast} disabled={sending||!isReady}><Megaphone size={16}/>{sending?'Sending...':'Broadcast'}</button>
          <button className="btn btn-secondary" onClick={()=>aiRephrase(broadcastMsg,setBroadcastMsg)} disabled={aiLoading||!broadcastMsg}><Wand2 size={16}/>AI Rephrase</button>
        </div>
      </div>)}

      {tab === 'conversations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* List */}
          <div className={`card ${selectedChat ? 'hidden md:block' : ''}`} style={{ padding: 0 }}>
            <div className="p-4 border-b border-white-08">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Recent Conversations</h3>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
              {conversations.map((c, i) => (
                <div 
                  key={i} 
                  className={`p-4 border-b border-white-05 cursor-pointer hover:bg-white-05 transition-colors ${selectedChat?.whatsapp_chat_id === c.whatsapp_chat_id ? 'bg-white-08 border-l-4 border-l-primary' : ''}`}
                  onClick={() => selectChat(c)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm">{c.student_name || c.whatsapp_chat_id}</span>
                    <span className="text-xs text-muted">{c.last_message_time ? new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p className="text-xs text-muted truncate">{c.last_message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`card md:col-span-2 flex flex-col ${!selectedChat ? 'hidden md:flex items-center justify-center text-muted' : ''}`} style={{ padding: 0, height: '600px' }}>
            {!selectedChat ? (
              <div className="text-center">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-20" />
                <p>Select a conversation to view chat logs</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-white-08 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button className="md:hidden btn btn-icon btn-sm" onClick={() => setSelectedChat(null)}><ChevronLeft size={18}/></button>
                    <div>
                      <h3 className="font-bold">{selectedChat.student_name || selectedChat.whatsapp_chat_id}</h3>
                      <p className="text-xs text-muted">{selectedChat.student_phone || 'WhatsApp Direct'}</p>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => loadHistory(selectedChat.whatsapp_chat_id)}><RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-history">
                  {history.map((m, i) => (
                    <div key={i} className={`flex ${m.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl p-3 relative group ${m.direction === 'incoming' ? 'bg-white-08 rounded-tl-none' : 'bg-primary rounded-tr-none text-white'}`}>
                        {m.direction === 'incoming' && tutor?.role === 'developer' && (
                          <button 
                            className="absolute -right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 btn btn-icon btn-sm btn-secondary transition-opacity"
                            title="Teach AI this interaction"
                            onClick={() => startTeaching(m)}
                          >
                            <Brain size={14} />
                          </button>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                        <span className={`text-[10px] block mt-1 opacity-50 ${m.direction === 'incoming' ? 'text-left' : 'text-right'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {m.is_ai ? ' • AI' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={historyEndRef} />
                </div>

                <div className="p-4 border-t border-white-08">
                  <div className="flex gap-2">
                    <input 
                      className="form-input flex-1" 
                      placeholder="Type a message..." 
                      value={message}
                      onChange={e => { setMessage(e.target.value); setPhone(selectedChat.student_phone || selectedChat.whatsapp_chat_id); }}
                      onKeyDown={e => e.key === 'Enter' && sendMsg()}
                    />
                    <button className="btn btn-primary" onClick={sendMsg} disabled={sending || !isReady}><Send size={18}/></button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Teaching Modal */}
    {teachingMsg && (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: 600 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary-10 rounded-lg"><Sparkles className="text-primary" size={24}/></div>
            <h3>Train your Digital Twin</h3>
          </div>
          
          <div className="mb-4">
            <label className="text-xs font-bold text-muted uppercase">Student Said:</label>
            <div className="p-3 bg-white-05 rounded-lg italic mt-1">"{teachingMsg.content}"</div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-bold text-muted uppercase">Category / Intent:</label>
            <select 
              className="form-select mt-1"
              value={teachingMsg.detected_intent || 'GENERAL'}
              onChange={e => setTeachingMsg({...teachingMsg, detected_intent: e.target.value})}
            >
              <option value="GENERAL">General Support</option>
              <option value="GREETING">Greeting & Hello</option>
              <option value="ADMISSION">Admission & Details</option>
              <option value="PAYMENT">Payment & Fees</option>
              <option value="SCHEDULE">Class Schedule</option>
              <option value="TECHNICAL">Technical Help</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="text-xs font-bold text-muted uppercase">How should the AI answer next time?</label>
            <textarea 
              className="form-textarea mt-1" 
              rows={4} 
              value={idealReply}
              onChange={e => setIdealReply(e.target.value)}
              placeholder="Type the perfect professional response..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn btn-secondary" onClick={() => setTeachingMsg(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitTeaching}><Brain size={18}/> Learn Pattern</button>
          </div>
        </div>
      </div>
    )}
  </div>);
}
