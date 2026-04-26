import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('tutor');
    if (token && stored) {
      setTutor(JSON.parse(stored));
      // Verify token is still valid
      api.getMe().then(data => {
        setTutor(data.tutor);
        localStorage.setItem('tutor', JSON.stringify(data.tutor));
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('tutor');
        setTutor(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('tutor', JSON.stringify(data.tutor));
    setTutor(data.tutor);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tutor');
    setTutor(null);
  };

  return (
    <AuthContext.Provider value={{ tutor, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
