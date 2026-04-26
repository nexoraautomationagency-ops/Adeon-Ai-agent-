import { useState, useEffect } from 'react';
import { Users, BookOpen, CreditCard, MessageCircle, TrendingUp, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api';

const PIE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardSummary()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner" />;
  if (!data) return <div className="empty-state"><h3>Failed to load dashboard</h3></div>;

  const { students, payments, classCount, recentMessages, revenueTrend, studentsByGrade } = data;

  const collectionRate = payments.expected > 0
    ? Math.round((payments.collected / payments.expected) * 100)
    : 0;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon"><Users size={22} /></div>
          <div className="stat-value">{students.active}</div>
          <div className="stat-label">Active Students</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><CreditCard size={22} /></div>
          <div className="stat-value">Rs.{(payments.collected || 0).toLocaleString()}</div>
          <div className="stat-label">{payments.month} Collection</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon"><BookOpen size={22} /></div>
          <div className="stat-value">{classCount}</div>
          <div className="stat-label">Active Classes</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon"><MessageCircle size={22} /></div>
          <div className="stat-value">{recentMessages}</div>
          <div className="stat-label">Messages (24h)</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Payment Overview */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">💰 Payment Overview — {payments.month}</h3>
            <span className="badge badge-info">{collectionRate}% collected</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '16px', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#34d399' }}>{payments.paid || 0}</div>
              <div className="text-sm text-muted">Paid</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f87171' }}>{payments.unpaid || 0}</div>
              <div className="text-sm text-muted">Unpaid</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#fbbf24' }}>{payments.pending || 0}</div>
              <div className="text-sm text-muted">Pending</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#818cf8' }}>
                Rs.{(payments.expected || 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted">Expected</div>
            </div>
          </div>
        </div>

        {/* Students by Grade */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📊 Students by Grade</h3>
          </div>
          {studentsByGrade.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={studentsByGrade}
                  dataKey="count"
                  nameKey="grade"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                  label={({ grade, count }) => `${grade}: ${count}`}
                >
                  {studentsByGrade.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>No student data yet</p></div>
          )}
        </div>
      </div>

      {/* Revenue Trend */}
      {revenueTrend.length > 0 && (
        <div className="card mt-4">
          <div className="card-header">
            <h3 className="card-title"><TrendingUp size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Revenue Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueTrend} barGap={8}>
              <XAxis
                dataKey="month"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ background: '#1a1f35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
                formatter={(value) => [`Rs.${value.toLocaleString()}`, '']}
              />
              <Bar dataKey="collected" name="Collected" fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expected" name="Expected" fill="rgba(99,102,241,0.2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
