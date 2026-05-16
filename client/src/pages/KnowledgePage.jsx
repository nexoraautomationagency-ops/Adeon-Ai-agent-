import { useState, useEffect } from 'react';
import { Brain, Trash2, Plus, MessageSquare, BookOpen, Search, Filter, Sparkles, Download } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function KnowledgePage() {
  const { tutor } = useAuth();
  
  // FINAL SAFETY GATE: Redirect if not developer
  if (tutor?.role !== 'developer') {
    return <Navigate to="/" />;
  }

  const [facts, setFacts] = useState([]);
  const [examples, setExamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('facts'); // facts | examples
  const [search, setSearch] = useState('');
  const [filterLayer, setFilterLayer] = useState('ALL'); // ALL | FAQ | SOP | STYLE
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState('FAQ');
  const [newSubCategory, setNewSubCategory] = useState('ADMISSION');
  const [newTopic, setNewTopic] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.getFacts(), api.getExamples()])
      .then(([f, e]) => { 
        setFacts(f.facts || []); 
        setExamples(e.examples || []); 
      })
      .catch(err => toast.error('Failed to load knowledge base'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deleteFact = async (id) => {
    if (!confirm('Are you sure you want the AI to forget this fact?')) return;
    try { await api.deleteFact(id); toast.success('Fact deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  const deleteExample = async (id) => {
    if (!confirm('Are you sure?')) return;
    try { await api.deleteExample(id); toast.success('Example removed'); load(); } catch (e) { toast.error(e.message); }
  };

  const clearCategory = async (category) => {
    let subCategory = null;
    let message = `Are you sure you want to delete ALL ${category} facts? This cannot be undone.`;

    if (category === 'STYLE') {
      const choice = prompt("Which STYLE sub-category to clear?\n(ADMISSION, PAYMENT, SCHEDULE, TECHNICAL, GREETING, or type 'ALL' for everything)", "ALL");
      if (!choice) return;
      if (choice.toUpperCase() !== 'ALL') {
        subCategory = choice.toUpperCase();
        message = `Are you sure you want to delete all ${subCategory} style examples?`;
      }
    }

    if (!confirm(message)) return;
    setLoading(true);
    try {
      await api.clearFacts(category, subCategory);
      toast.success(`Cleared ${subCategory || 'all'} ${category} knowledge!`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredFacts = facts.filter(f => {
    const matchesSearch = f.content.toLowerCase().includes(search.toLowerCase()) || 
                         (f.metadata?.sub_category || '').toLowerCase().includes(search.toLowerCase()) ||
                         (f.metadata?.topic || '').toLowerCase().includes(search.toLowerCase());
    const matchesLayer = filterLayer === 'ALL' || f.category === filterLayer;
    return matchesSearch && matchesLayer;
  });
  const filteredExamples = examples.filter(e => 
    e.student_message.toLowerCase().includes(search.toLowerCase()) || 
    e.ideal_reply.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Brain className="text-primary" /> AI Knowledge Center
          </h1>
          <p className="text-muted text-sm">Manage what your AI knows and how it talks.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={() => {
            const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/knowledge/export`;
            window.open(url, '_blank');
            toast.success('Downloading your chat logs... 📥');
          }}>
            <Download size={18} /> Backup Chats
          </button>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search facts, topics..." 
              style={{ paddingLeft: 40, width: 220 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {tab === 'facts' && (
            <div className="relative">
              <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <select 
                className="form-select" 
                style={{ paddingLeft: 40, width: 150 }}
                value={filterLayer}
                onChange={e => setFilterLayer(e.target.value)}
              >
                <option value="ALL">All Layers</option>
                <option value="FAQ">FAQ Layer</option>
                <option value="SOP">SOP Layer</option>
                <option value="STYLE">STYLE Layer</option>
              </select>
            </div>
          )}
          {tab === 'facts' && (
            <div className="flex gap-2">
              <button className="btn btn-danger btn-sm" onClick={() => clearCategory('FAQ')}>
                <Trash2 size={14} /> Clear FAQ
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => clearCategory('SOP')}>
                <Trash2 size={14} /> Clear SOP
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => clearCategory('STYLE')}>
                <Trash2 size={14} /> Clear STYLE
              </button>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={18} /> Add New Fact
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="stats-grid mb-6">
        <div className="stat-card blue">
          <div className="stat-icon"><BookOpen size={20} /></div>
          <div className="stat-value">{facts.length}</div>
          <div className="stat-label">Total Facts Stored</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon"><MessageSquare size={20} /></div>
          <div className="stat-value">{examples.length}</div>
          <div className="stat-label">Training Examples</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><Sparkles size={20} /></div>
          <div className="stat-value">High</div>
          <div className="stat-label">Accuracy Level</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button 
          className={`btn ${tab === 'facts' ? 'btn-primary' : 'btn-secondary'} btn-sm`} 
          onClick={() => setTab('facts')}
        >
          <BookOpen size={14} /> Knowledge Base (Facts)
        </button>
        <button 
          className={`btn ${tab === 'examples' ? 'btn-primary' : 'btn-secondary'} btn-sm`} 
          onClick={() => setTab('examples')}
        >
          <MessageSquare size={14} /> Training Conversations (Style)
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="loading-spinner mb-4" />
          <p className="text-muted">Loading AI Brain...</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {tab === 'facts' ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fact / Content</th>
                    <th>Category</th>
                    <th>Source</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFacts.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-10 text-muted">No facts found.</td></tr>
                  ) : filteredFacts.map(f => (
                    <tr key={f.id}>
                      <td style={{ maxWidth: 600 }} className="text-sm">{f.content}</td>
                      <td>
                        <span className={`badge ${f.category === 'SOP' ? 'badge-primary' : f.category === 'STYLE' ? 'badge-info' : 'badge-neutral'}`}>{f.category || 'FAQ'}</span>
                        {f.metadata?.sub_category && <span className="badge badge-neutral ml-1" style={{ marginLeft: 4 }}>{f.metadata.sub_category}</span>}
                        {f.metadata?.topic && <span className="badge badge-neutral ml-1" style={{ marginLeft: 4 }}>{f.metadata.topic}</span>}
                      </td>
                      <td><span className="badge badge-neutral">{f.metadata?.source?.split(/[\\/]/).pop() || 'Manual'}</span></td>
                      <td className="text-right">
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteFact(f.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Query</th>
                    <th>AI Response (Your Style)</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExamples.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-10 text-muted">No training examples yet.</td></tr>
                  ) : filteredExamples.map(e => (
                    <tr key={e.id}>
                      <td className="text-sm italic">"{e.student_message}"</td>
                      <td className="text-sm font-bold text-primary-light">{e.ideal_reply}</td>
                      <td className="text-right">
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteExample(e.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Fact Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <h3 className="mb-4">Add Manual Fact</h3>
            <div className="form-group mb-3">
              <label className="form-label">Category</label>
              <select 
                className="form-select"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                <option value="FAQ">General Knowledge (FAQ)</option>
                <option value="SOP">Operating Rules (SOP)</option>
                <option value="STYLE">Tone & Examples (STYLE)</option>
              </select>
            </div>

            {newCategory === 'STYLE' ? (
              <div className="form-group mb-3">
                <label className="form-label">Sub-Category (Intent)</label>
                <select 
                  className="form-select"
                  value={newSubCategory}
                  onChange={e => setNewSubCategory(e.target.value)}
                >
                  <option value="ADMISSION">ADMISSION (Joining & Registration)</option>
                  <option value="PAYMENT">PAYMENT (Fees & Receipts)</option>
                  <option value="SCHEDULE">SCHEDULE (Class Times)</option>
                  <option value="TECHNICAL">TECHNICAL (Zoom & App Issues)</option>
                  <option value="GREETING">GREETING (Basic Hellos)</option>
                </select>
              </div>
            ) : (
              <div className="form-group mb-3">
                <label className="form-label">Topic (Optional)</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g. Paper Class, Recordings, etc."
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                />
              </div>
            )}
            <div className="form-group mb-4">
              <label className="form-label">Knowledge Content</label>
              <textarea 
                className="form-textarea" 
                rows={5} 
                placeholder="Enter a fact the AI should remember..."
                value={newFact}
                onChange={e => setNewFact(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!newFact) return;
                setLoading(true);
                try {
                  await api.addFact({ 
                    content: newFact, 
                    category: newCategory,
                    subCategory: newCategory === 'STYLE' ? newSubCategory : undefined,
                    topic: newCategory !== 'STYLE' ? newTopic : undefined
                  });
                  toast.success('AI learned the new fact! ✨');
                  setNewFact('');
                  setNewTopic('');
                  setShowAddModal(false);
                  load();
                } catch(e) {
                  toast.error(e.message);
                } finally {
                  setLoading(false);
                }
              }}>Save Fact</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
