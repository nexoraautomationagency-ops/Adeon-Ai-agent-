import { useState, useEffect } from 'react';
import { Save, ToggleLeft, ToggleRight, Landmark, CreditCard, Building2, User, Plus, Trash2, Edit2, X, Check, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { Search, Copy } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const clearCache = async () => {
    if (!confirm('Clear all AI cached responses? This may slightly increase response time temporarily.')) return;
    try { await api.resetAICache(); toast.success('AI Cache Cleared ✨'); } catch (e) { toast.error(e.message); }
  };

  const resetConvs = async () => {
    if (!confirm('ERASE all conversation history? The AI will "forget" past chats with students. This cannot be undone!')) return;
    try { await api.resetConversations(); toast.success('History Erased 🧹'); } catch (e) { toast.error(e.message); }
  };

  const { tutor } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [primaryAdmin, setPrimaryAdmin] = useState(null);
  const [systemAdmins, setSystemAdmins] = useState([]);
  const [waGroups, setWaGroups] = useState([]);
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [devAdminGroups, setDevAdminGroups] = useState([]);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [gradeMappings, setGradeMappings] = useState({ '6': '', '7': '', '8': '', '9': '', '10': '', '11': '' });
  const [editingPrimary, setEditingPrimary] = useState(false);
  const [newPrimaryPhone, setNewPrimaryPhone] = useState('');
  
  // New: Class & Mapping states
  const [classes, setClasses] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1];

  const updatePrimaryPhone = async () => {
    if (!newPrimaryPhone) return;
    try {
      await api.updateTutorPhone(newPrimaryPhone);
      toast.success('Primary phone updated');
      setEditingPrimary(false);
      api.getTutorAdmins().then(d => {
        setAdmins(d.secondary || []);
        setPrimaryAdmin(d.primary);
        setSystemAdmins(d.system || []);
      });
    } catch (e) { toast.error(e.message); }
  };

  const runYearEnd = async () => {
    if (!confirm(`🚨 WARNING: This will graduate all Grade ${settings.final_grade || 11} students and promote all others by one grade. This action is IRREVERSIBLE. Are you sure?`)) return;
    try {
      const res = await api.yearEndProcess();
      toast.success(res.message || 'Year-end process completed!');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const fetchAdminGroups = async () => {
    setFetchingGroups(true);
    try {
      const data = await api.getAdminGroups();
      setDevAdminGroups(data.groups || []);
      if (data.groups?.length === 0) toast.error('No groups found where bot is admin.');
      else toast.success(`Found ${data.groups.length} admin groups`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setFetchingGroups(false);
    }
  };

  useEffect(() => { 
    api.getSettings().then(d => setSettings(d.settings)).catch(e => toast.error(e.message)).finally(() => setLoading(false));
    api.getTutorAdmins().then(d => {
      setAdmins(d.secondary || []);
      setPrimaryAdmin(d.primary);
      setSystemAdmins(d.system || []);
    }).catch(() => {});
    api.getGroups().then(d => {
      const map = { '6': '', '7': '', '8': '', '9': '', '10': '', '11': '' };
      d.groups.forEach(g => { if (map.hasOwnProperty(g.grade)) map[g.grade] = g.whatsapp_group_id || ''; });
      setGradeMappings(map);
    }).catch(() => {});
    api.getWhatsAppGroups().then(d => setWaGroups(d.groups)).catch(() => {});
    
    // Fetch Classes and Mappings
    api.getClasses().then(d => setClasses(d.classes || [])).catch(() => {});
    api.getGroupMappings().then(d => setMappings(d.mappings || [])).catch(() => {});
  }, []);

  const addAdmin = async () => {
    if (!newAdminPhone) return;
    try { await api.addTutorAdmin(newAdminPhone); toast.success('Admin added'); setNewAdminPhone(''); api.getTutorAdmins().then(d => setAdmins(d.admins)); } catch (e) { toast.error(e.message); }
  };

  const removeAdmin = async (id) => {
    try { await api.removeTutorAdmin(id); toast.success('Admin removed'); api.getTutorAdmins().then(d => setAdmins(d.admins)); } catch (e) { toast.error(e.message); }
  };

  const save = async () => {
    setSaving(true);
    try { 
      await api.updateSettings(settings); 
      toast.success('Settings saved ✅'); 
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading || !settings) return <div className="loading-spinner"/>;

  const Toggle = ({ value, onChange, label }) => (
    <div className="flex items-center justify-between" style={{padding:'12px 0',borderBottom:'1px solid var(--border-color)'}}>
      <span style={{fontWeight:500}}>{label}</span>
      <button className="btn btn-ghost" onClick={()=>onChange(!value)} style={{color:value?'var(--accent-success)':'var(--text-muted)'}}>
        {value ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
      </button>
    </div>
  );

  return (<div style={{maxWidth:700}}>
    <div className="card mb-4">
      <h3 className="card-title mb-4">🏢 Institute Profile</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="form-group">
          <label className="form-label">Institute / School Name</label>
          <input className="form-input" value={settings.institute_name||''} onChange={e=>setSettings({...settings,institute_name:e.target.value})} placeholder="e.g. Excel Science Academy"/>
        </div>
        <div className="form-group">
          <label className="form-label">Tutor Name (Sir/Teacher)</label>
          <input className="form-input" value={settings.tutor_name||''} onChange={e=>setSettings({...settings,tutor_name:e.target.value})} placeholder="e.g. Sir Saman"/>
        </div>
      </div>
    </div>
    <div className="card mb-4">
      <h3 className="card-title mb-4">💰 Global Fee Configuration</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="form-group"><label className="form-label">Default Monthly Fee (Rs.)</label><input className="form-input" type="number" value={settings.basic_fee||0} onChange={e=>setSettings({...settings,basic_fee:parseFloat(e.target.value)})}/></div>
        <div className="form-group"><label className="form-label">Tute Fee (Rs.)</label><input className="form-input" type="number" value={settings.tute_fee||0} onChange={e=>setSettings({...settings,tute_fee:parseFloat(e.target.value)})}/></div>
      </div>
      <p className="text-sm text-muted mt-2">Note: These are default values. You can still set custom fees for individual students in the Students page.</p>
    </div>

    {tutor?.role === 'developer' && (
      <div className="card mb-4">
        <h3 className="card-title mb-4">🎓 Academic Cycle</h3>
        <div className="form-group mb-4">
          <label className="form-label">Graduation Grade (Final Year)</label>
          <input 
            className="form-input" 
            type="number" 
            placeholder="e.g. 11 for O/L, 13 for A/L"
            value={settings.final_grade || 11} 
            onChange={e => setSettings({...settings, final_grade: parseInt(e.target.value)})}
          />
          <p className="text-xs text-muted mt-1">Students at this grade will be marked as "Graduated" when the year ends.</p>
        </div>
        
        <div style={{padding: '16px', background: 'rgba(99,102,241,0.05)', borderRadius: '12px', border: '1px dashed var(--accent-primary)'}}>
          <h4 style={{margin: '0 0 12px 0', fontSize: '15px', color: 'var(--accent-primary)', display:'flex', alignItems:'center', gap:8}}>
            🚀 Year-End Promotion
          </h4>
          <button className="btn btn-secondary" style={{width: '100%', justifyContent: 'center', borderColor:'var(--accent-primary)', color:'var(--accent-primary)'}} onClick={runYearEnd}>
            Run Year-End Student Promotion
          </button>
          <p className="text-[10px] text-muted mt-2 text-center uppercase tracking-wider">
            Warning: This action is irreversible. It will promote all active students by one grade.
          </p>
        </div>
      </div>
    )}
    <div className="card mb-4">
      <h3 className="card-title mb-4">⚙️ Auto-Reply Settings</h3>
      <Toggle label="Enable Auto-Reply" value={!!settings.auto_reply_enabled} onChange={v=>setSettings({...settings,auto_reply_enabled:v?1:0})}/>
      <div className="form-group mt-4"><label className="form-label">Auto-Reply Message</label><textarea className="form-textarea" value={settings.auto_reply_message||''} onChange={e=>setSettings({...settings,auto_reply_message:e.target.value})} rows={3}/></div>
    </div>
    <div className="card mb-4">
      <h3 className="card-title mb-4">👋 Welcome Message</h3>
      <div className="form-group"><label className="form-label">Message for new students</label><textarea className="form-textarea" value={settings.welcome_message||''} onChange={e=>setSettings({...settings,welcome_message:e.target.value})} rows={3}/></div>
    </div>

    {/* 💳 Payment / Bank Details Section */}
    <div className="card mb-4">
      <h3 className="card-title mb-4" style={{display:'flex',alignItems:'center',gap:8}}>
        <Landmark size={20} style={{color:'var(--accent-primary)'}} />
        Payment / Bank Details
      </h3>
      <p className="text-sm text-muted mb-4" style={{marginTop: -8}}>
        These details will be shared by the AI assistant when students ask about payment.
      </p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="form-group">
          <label className="form-label" style={{display:'flex',alignItems:'center',gap:6}}>
            <Building2 size={14}/> Bank Name
          </label>
          <input
            id="settings-bank-name"
            className="form-input"
            placeholder="e.g. Bank of Ceylon (BOC)"
            value={settings.bank_name||''}
            onChange={e=>setSettings({...settings,bank_name:e.target.value})}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{display:'flex',alignItems:'center',gap:6}}>
            <CreditCard size={14}/> Account Number
          </label>
          <input
            id="settings-bank-account"
            className="form-input"
            placeholder="e.g. 1234567890"
            value={settings.bank_account||''}
            onChange={e=>setSettings({...settings,bank_account:e.target.value})}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{display:'flex',alignItems:'center',gap:6}}>
            <User size={14}/> Account Holder Name
          </label>
          <input
            id="settings-bank-holder"
            className="form-input"
            placeholder="e.g. Mr. J. Perera"
            value={settings.bank_account_holder||''}
            onChange={e=>setSettings({...settings,bank_account_holder:e.target.value})}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{display:'flex',alignItems:'center',gap:6}}>
            <Landmark size={14}/> Branch
          </label>
          <input
            id="settings-bank-branch"
            className="form-input"
            placeholder="e.g. Colombo"
            value={settings.bank_branch||''}
            onChange={e=>setSettings({...settings,bank_branch:e.target.value})}
          />
        </div>
      </div>
      <div className="text-sm text-muted mt-3" style={{padding:'10px 14px',background:'rgba(99,102,241,0.08)',borderRadius:10,border:'1px solid rgba(99,102,241,0.15)'}}>
        💡 <strong>Tip:</strong> When a student asks "How do I pay?" or "Bank details?", the AI will automatically send these details.
      </div>
    </div>

    <div className="card mb-4">
      <h3 className="card-title mb-4">💰 Payment Reminders</h3>
      <Toggle label="Enable Payment Reminders" value={!!settings.payment_reminder_enabled} onChange={v=>setSettings({...settings,payment_reminder_enabled:v?1:0})}/>
      <div className="form-group mt-4"><label className="form-label">Reminder Day of Month</label><input className="form-input" type="number" min="1" max="28" value={settings.payment_reminder_day||1} onChange={e=>setSettings({...settings,payment_reminder_day:parseInt(e.target.value)})}/></div>
    </div>
    {tutor?.role === 'developer' && (
      <div className="card mb-4">
        <h3 className="card-title mb-4">🤖 AI Tone</h3>
        <div className="form-group"><label className="form-label">Communication Style</label>
          <select className="form-select" value={settings.ai_tone||'friendly_sinhala_english'} onChange={e=>setSettings({...settings,ai_tone:e.target.value})}>
            <option value="friendly_sinhala_english">Friendly Sinhala-English Mix 🇱🇰</option>
            <option value="formal_english">Formal English</option>
            <option value="casual_english">Casual English</option>
          </select>
        </div>
      </div>
    )}
    {tutor?.role === 'developer' && (
      <div className="card mb-4">
        <h3 className="card-title mb-4">👥 Secondary Admins (WhatsApp)</h3>
      <p className="text-sm text-muted mb-4">These phone numbers can also control the bot via WhatsApp commands.</p>
      <div className="flex gap-2 mb-4">
        <input className="form-input" placeholder="e.g. 94771234567" value={newAdminPhone} onChange={e=>setNewAdminPhone(e.target.value)}/>
        <button className="btn btn-secondary btn-sm" onClick={addAdmin}><Plus size={16}/>Add Admin</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Role / Source</th><th>Phone Number</th><th>Actions</th></tr></thead>
          <tbody>
            {/* Primary Admin */}
            {primaryAdmin && (
              <tr>
                <td><span className="badge badge-info">Primary</span></td>
                <td>
                  {editingPrimary ? (
                    <input className="form-input form-input-sm" value={newPrimaryPhone} onChange={e=>setNewPrimaryPhone(e.target.value)} style={{width:160, fontSize:12}} />
                  ) : primaryAdmin.phone}
                </td>
                <td>
                  {tutor?.role === 'developer' ? (
                    editingPrimary ? (
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-icon btn-xs text-success" onClick={updatePrimaryPhone}><Check size={14}/></button>
                        <button className="btn btn-ghost btn-icon btn-xs text-danger" onClick={()=>setEditingPrimary(false)}><X size={14}/></button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-icon btn-xs" title="Edit Primary Phone" onClick={()=>{setNewPrimaryPhone(primaryAdmin.phone); setEditingPrimary(true);}}>
                        <Edit2 size={14}/>
                      </button>
                    )
                  ) : <span className="text-muted text-xs">Owner</span>}
                </td>
              </tr>
            )}
            
            {/* System Admins */}
            {systemAdmins.map((p, i) => (
              <tr key={`sys-${i}`}>
                <td><span className="badge badge-secondary">System Config</span></td>
                <td>{p}</td>
                <td><span className="text-muted text-xs">Read-only</span></td>
              </tr>
            ))}

            {/* Secondary Admins */}
            {admins.map(a=>(
              <tr key={a.id}>
                <td><span className="badge">Secondary</span></td>
                <td>{a.phone}</td>
                <td><button className="btn btn-ghost btn-icon text-danger" onClick={()=>removeAdmin(a.id)}><Trash2 size={16}/></button></td>
              </tr>
            ))}
            
            {admins.length===0 && systemAdmins.length === 0 && !primaryAdmin && (
              <tr><td colSpan="3" className="text-center text-muted">No admins found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    )}

    <div className="card mb-4">
      <h3 className="card-title mb-4">🔗 WhatsApp Group Mapping</h3>
      <p className="text-sm text-muted mb-4">Link specific classes and months to your WhatsApp groups.</p>
      
      <div className="flex gap-3 mb-4 p-3 bg-secondary rounded-lg">
        <div style={{flex: 1}}>
          <label className="text-xs font-bold uppercase text-muted mb-1 block">Year</label>
          <select className="form-select form-select-sm" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{flex: 2}}>
          <label className="text-xs font-bold uppercase text-muted mb-1 block">Month</label>
          <select className="form-select form-select-sm" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Class</th><th>Group Mapping ({selectedMonth} {selectedYear})</th><th>Action</th></tr></thead>
          <tbody>
            {classes.map(c => {
              const mapping = mappings.find(m => m.class_id === c.id && m.month === selectedMonth && m.year === selectedYear);
              return (
                <tr key={c.id}>
                  <td>
                    <div className="font-bold">{c.grade} - {c.subject}</div>
                    <div className="text-xs text-muted">{c.name}</div>
                  </td>
                  <td>
                    <input 
                      className="form-input form-input-sm" 
                      placeholder="Paste Group ID..." 
                      style={{fontSize: '11px'}}
                      value={mapping?.whatsapp_group_id || ''}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setMappings(prev => {
                          const other = prev.filter(m => !(m.class_id === c.id && m.month === selectedMonth && m.year === selectedYear));
                          return [...other, { class_id: c.id, month: selectedMonth, year: selectedYear, whatsapp_group_id: val }];
                        });
                        try {
                          await api.updateGroupMapping({ classId: c.id, month: selectedMonth, year: selectedYear, groupId: val });
                        } catch (err) { toast.error(err.message); }
                      }}
                    />
                  </td>
                  <td>
                    {mapping?.whatsapp_group_id ? (
                      <div className="flex items-center gap-1 text-success font-bold text-xs">
                        <CheckCircle size={14} /> Linked
                      </div>
                    ) : (
                      <button 
                        className="btn btn-ghost btn-xs text-accent"
                        disabled={isCreatingGroup}
                        onClick={async () => {
                          if (!confirm(`Create new WhatsApp group for ${c.grade} ${c.subject} (${selectedMonth})?`)) return;
                          setIsCreatingGroup(true);
                          try {
                            const groupName = `${c.grade} ${c.subject} - ${selectedMonth} ${selectedYear}`;
                            const res = await api.createWhatsAppGroup({ classId: c.id, month: selectedMonth, year: selectedYear, groupName });
                            toast.success('Group Created & Mapped! ✅');
                            api.getGroupMappings().then(d => setMappings(d.mappings || []));
                          } catch (err) {
                            toast.error(err.message);
                          } finally {
                            setIsCreatingGroup(false);
                          }
                        }}
                      >
                        {isCreatingGroup ? '...' : <Plus size={14} />} Create
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tutor?.role === 'developer' && (
        <div className="mt-4" style={{padding: '16px', background: 'rgba(99,102,241,0.05)', borderRadius: '12px', border: '1px dashed var(--accent-primary)'}}>
          <div className="flex justify-between items-center mb-3">
            <h4 style={{margin: 0, fontSize: '15px', color: 'var(--accent-primary)', display:'flex', alignItems:'center', gap:8}}>
              <Search size={16}/> Developer: Bot Admin Groups
            </h4>
            <button className="btn btn-sm btn-secondary" onClick={fetchAdminGroups} disabled={fetchingGroups}>
              {fetchingGroups ? 'Fetching...' : 'Fetch Admin Groups'}
            </button>
          </div>
          {devAdminGroups.length > 0 ? (
            <div style={{maxHeight: '250px', overflowY: 'auto', fontSize: '12px', background:'var(--bg-card)', borderRadius:8, padding:8, border:'1px solid var(--border-color)'}}>
              {devAdminGroups.map(g => (
                <div key={g.id} className="flex justify-between items-center py-2 px-2" style={{borderBottom: '1px solid var(--border-color)'}}>
                  <div className="flex flex-col">
                    <span style={{fontWeight: 600, fontSize:'13px'}}>{g.name}</span>
                    <span className="text-muted" style={{fontSize:'11px'}}>{g.participantCount} participants</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code style={{background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '4px', border:'1px solid var(--border-color)', color:'var(--text-main)'}}>
                       {g.id}
                    </code>
                    <button className="btn btn-ghost btn-icon btn-xs" title="Copy ID" onClick={() => {navigator.clipboard.writeText(g.id); toast.success('ID Copied!');}}>
                      <Copy size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted py-2 text-sm">Click fetch to see groups where the bot is an admin.</p>
          )}
        </div>
      )}
    </div>

    {tutor?.role === 'developer' && (
      <div className="card mb-4" style={{borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)'}}>
        <h3 className="card-title text-danger mb-4">⚠️ Developer Danger Zone</h3>
        <p className="text-sm text-muted mb-4" style={{marginTop: -8}}>System-wide actions for developers only. Use with extreme caution.</p>
        <div className="flex gap-3">
          <button className="btn btn-secondary btn-sm" onClick={clearCache}>Clear Global AI Cache</button>
          <button className="btn btn-danger btn-sm" onClick={resetConvs}>Reset All Conversations</button>
        </div>
      </div>
    )}
    <button className="btn btn-primary" onClick={save} disabled={saving} style={{width: '100%', padding: '14px'}}><Save size={18}/>{saving?'Saving...':'Save Settings'}</button>
  </div>);
}
