import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { LayoutDashboard, Users, BookOpen, CreditCard, MessageSquare, Settings, LogOut, CheckCircle, Truck } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import ClassesPage from './pages/ClassesPage';
import PaymentsPage from './pages/PaymentsPage';
import WhatsAppPage from './pages/WhatsAppPage';
import SettingsPage from './pages/SettingsPage';
import RegisterPage from './pages/RegisterPage';
import AttendancePage from './pages/AttendancePage';
import KnowledgePage from './pages/KnowledgePage';
import TutesPage from './pages/TutesPage';
import './index.css';

function ProtectedRoute({ children }) {
  const { tutor, loading } = useAuth();
  if (loading) return <div className="loading-spinner" style={{ marginTop: '40vh' }} />;
  return tutor ? children : <Navigate to="/login" />;
}

const NAV = [
  { section: 'Main', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/classes', icon: BookOpen, label: 'Classes' },
    { to: '/payments', icon: CreditCard, label: 'Payments' },
    { to: '/attendance', icon: CheckCircle, label: 'Attendance' },
    { to: '/tutes', icon: Truck, label: 'Tutes' },
  ]},
  { section: 'AI & Communication', items: [
    { to: '/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
    { to: '/knowledge', icon: BookOpen, label: 'AI Knowledge' },
  ]},
  { section: 'System', items: [
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]},
];

const PAGE_TITLES = { 
  '/': 'Dashboard', 
  '/students': 'Students', 
  '/classes': 'Classes', 
  '/payments': 'Payments', 
  '/whatsapp': 'WhatsApp', 
  '/settings': 'Settings', 
  '/attendance': 'Attendance',
  '/tutes': 'Tute Deliveries',
  '/knowledge': 'AI Knowledge Center'
};

function AppLayout() {
  const { tutor, logout } = useAuth();
  const { waStatus } = useWebSocket();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Dashboard';

  // Close mobile menu on route change
  useEffect(() => { setIsMobileMenuOpen(false); }, [location]);

  return (
    <div className={`app-layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {/* Sidebar Overlay */}
      {isMobileMenuOpen && <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />}
      
      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">🎓</div>
          <div><h1>TutorSaaS</h1><div className="brand-sub">{tutor?.institute_name || 'Dashboard'}</div></div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(sec => {
            const filteredItems = sec.items.filter(item => {
              if (item.to === '/knowledge' && tutor?.role !== 'developer') return false;
              return true;
            });

            if (filteredItems.length === 0) return null;

            return (
              <div className="nav-section" key={sec.section}>
                <div className="nav-section-title">{sec.section}</div>
                {filteredItems.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.to==='/'} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <item.icon className="nav-icon" size={20} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="wa-status-pill mb-3">
            <div className={`wa-status-dot ${waStatus.status}`} />
            <span>WA: {waStatus.status === 'ready' ? 'Connected' : waStatus.status?.replace('_',' ')}</span>
          </div>
          <button className="btn btn-ghost w-full" onClick={logout} style={{justifyContent:'flex-start',gap:8}}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="main-header">
          <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(true)}>
            <div /><div /><div />
          </button>
          <h2>{title}</h2>
          <div className="header-actions">
            <span className="text-sm text-muted">Welcome, {tutor?.name}</span>
          </div>
        </header>
        <div className="main-body">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/knowledge" element={tutor?.role === 'developer' ? <KnowledgePage /> : <Navigate to="/" />} />
            <Route path="/tutes" element={<TutesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <Toaster position="top-right" toastOptions={{ style: { background: '#1a1f35', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}} />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
