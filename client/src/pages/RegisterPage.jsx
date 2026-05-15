import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', institute_name: '', registration_key: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.institute_name || !form.registration_key) return toast.error('Please fill in all required fields');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return toast.error('Please enter a valid email address');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.register(form);
      await login(form.email, form.password);
      toast.success('Account created! 🎉');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <div className="login-logo">🎓</div>
        <h2>Create Account</h2>
        <p className="login-sub">Set up your tutor dashboard</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Your Name *</label>
            <input id="reg-name" className="form-input" placeholder="e.g. Mr. J. Perera" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Institute / Class Name *</label>
            <input id="reg-institute" className="form-input" placeholder="e.g. Excel Science Academy" value={form.institute_name} onChange={e => setForm({...form, institute_name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input id="reg-email" type="email" className="form-input" placeholder="you@email.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input id="reg-phone" className="form-input" placeholder="+94771234567" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input id="reg-password" type="password" className="form-input" placeholder="Min 6 characters" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Registration Key *</label>
            <input id="reg-key" type="password" className="form-input" placeholder="Enter your secret key" value={form.registration_key} onChange={e => setForm({...form, registration_key: e.target.value})} />
          </div>
          <button id="reg-submit" type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: 12, marginTop: 8 }}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
