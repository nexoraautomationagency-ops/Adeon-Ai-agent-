import { useState, useEffect } from 'react';
import { Save, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getSettings().then(d => setSettings(d.settings)).catch(e => toast.error(e.message)).finally(() => setLoading(false)); }, []);

  const save = async () => {
    setSaving(true);
    try { await api.updateSettings(settings); toast.success('Settings saved ✅'); } catch (e) { toast.error(e.message); }
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
      <h3 className="card-title mb-4">⚙️ Auto-Reply Settings</h3>
      <Toggle label="Enable Auto-Reply" value={!!settings.auto_reply_enabled} onChange={v=>setSettings({...settings,auto_reply_enabled:v?1:0})}/>
      <div className="form-group mt-4"><label className="form-label">Auto-Reply Message</label><textarea className="form-textarea" value={settings.auto_reply_message||''} onChange={e=>setSettings({...settings,auto_reply_message:e.target.value})} rows={3}/></div>
    </div>
    <div className="card mb-4">
      <h3 className="card-title mb-4">👋 Welcome Message</h3>
      <div className="form-group"><label className="form-label">Message for new students</label><textarea className="form-textarea" value={settings.welcome_message||''} onChange={e=>setSettings({...settings,welcome_message:e.target.value})} rows={3}/></div>
    </div>
    <div className="card mb-4">
      <h3 className="card-title mb-4">💰 Payment Reminders</h3>
      <Toggle label="Enable Payment Reminders" value={!!settings.payment_reminder_enabled} onChange={v=>setSettings({...settings,payment_reminder_enabled:v?1:0})}/>
      <div className="form-group mt-4"><label className="form-label">Reminder Day of Month</label><input className="form-input" type="number" min="1" max="28" value={settings.payment_reminder_day||1} onChange={e=>setSettings({...settings,payment_reminder_day:parseInt(e.target.value)})}/></div>
    </div>
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
    <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={16}/>{saving?'Saving...':'Save Settings'}</button>
  </div>);
}
