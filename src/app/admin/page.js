'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New problem form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');
  const [constraints, setConstraints] = useState('["1 <= n <= 10^5"]');
  const [testCases, setTestCases] = useState([
    { input: '', stdin: '', expected: '', isHidden: false },
    { input: '', stdin: '', expected: '', isHidden: true }
  ]);

  const fetchProblems = async () => {
    try {
      const res = await fetch('/api/admin/problems');
      const data = await res.json();
      setProblems(data.problems || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const handleAddTestCase = () => {
    setTestCases(prev => [...prev, { input: '', stdin: '', expected: '', isHidden: false }]);
  };

  const handleTestCaseChange = (index, field, value) => {
    setTestCases(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveTestCase = (index) => {
    setTestCases(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateProblem = async (e) => {
    e.preventDefault();
    try {
      let parsedConstraints = [];
      try {
        parsedConstraints = JSON.parse(constraints);
      } catch (err) {
        parsedConstraints = [constraints];
      }

      const res = await fetch('/api/admin/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: slug.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description,
          difficulty,
          sampleInput,
          sampleOutput,
          constraints: parsedConstraints,
          templates: {
            javascript: `function solve(input) {\n  // Write your code here\n}`,
            python: `def solve(input):\n    # Write your code here\n    pass`
          },
          testCases: testCases.filter(tc => tc.expected.trim() !== '')
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setTitle('');
        setSlug('');
        setDescription('');
        setSampleInput('');
        setSampleOutput('');
        fetchProblems();
      }
    } catch (err) {
      alert(`Error creating problem: ${err.message}`);
    }
  };

  const handleDeleteProblem = async (id) => {
    if (!confirm('Are you sure you want to delete this problem?')) return;
    try {
      const res = await fetch(`/api/admin/problems?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchProblems();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Admin Problem & Test Case CMS</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Dynamically add or edit contest problems and manage public vs. hidden test cases in real-time.
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="nav-btn primary">
          + Add New Problem
        </button>
      </div>

      {loading ? (
        <p>Loading problems...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {problems.map((p) => {
            const publicCount = p.testCases?.filter(tc => !tc.isHidden).length || 0;
            const hiddenCount = p.testCases?.filter(tc => tc.isHidden).length || 0;

            return (
              <div 
                key={p.id} 
                className="card"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>{p.title}</h3>
                    <span className={`badge ${p.difficulty === 'Easy' ? 'badge-easy' : 'badge-medium'}`}>
                      {p.difficulty}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#818cf8' }}>
                      Slug: <code>{p.slug}</code>
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {p.description.slice(0, 90)}...
                  </p>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                    <span style={{ color: '#38bdf8' }}>🔍 {publicCount} Public Sample Tests</span>
                    <span style={{ color: '#ec4899' }}>🔒 {hiddenCount} Hidden Grading Tests</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link href={`/problems/${p.slug}`} className="nav-btn">
                    View in Editor
                  </Link>
                  <button onClick={() => handleDeleteProblem(p.id)} className="nav-btn" style={{ borderColor: '#ef4444', color: '#f87171' }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Problem Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', background: '#182234' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2>Create New Problem</h2>
              <button onClick={() => setShowAddModal(false)} className="nav-btn">✕ Close</button>
            </div>

            <form onSubmit={handleCreateProblem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Problem Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }}
                  required
                  placeholder="e.g. Valid Parentheses"
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Slug (URL identifier)</label>
                  <input 
                    type="text" 
                    value={slug} 
                    onChange={(e) => setSlug(e.target.value)}
                    required
                    placeholder="valid-parentheses"
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ width: '140px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Difficulty</label>
                  <select 
                    value={difficulty} 
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff' }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Description</label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  required
                  placeholder="Problem description and rules..."
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Sample Input</label>
                  <input 
                    type="text" 
                    value={sampleInput} 
                    onChange={(e) => setSampleInput(e.target.value)}
                    placeholder="s = '()[]{}'"
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Sample Output</label>
                  <input 
                    type="text" 
                    value={sampleOutput} 
                    onChange={(e) => setSampleOutput(e.target.value)}
                    placeholder="true"
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
              </div>

              {/* Test Cases Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 600 }}>Test Cases (Public & Hidden)</label>
                  <button type="button" onClick={handleAddTestCase} className="nav-btn" style={{ fontSize: '0.75rem' }}>
                    + Add Case
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {testCases.map((tc, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                      <input 
                        type="text" 
                        placeholder="Stdin / Input" 
                        value={tc.stdin} 
                        onChange={(e) => handleTestCaseChange(idx, 'stdin', e.target.value)}
                        style={{ flex: 2, padding: '0.35rem', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Expected Output" 
                        value={tc.expected} 
                        onChange={(e) => handleTestCaseChange(idx, 'expected', e.target.value)}
                        required
                        style={{ flex: 1.5, padding: '0.35rem', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={tc.isHidden} 
                          onChange={(e) => handleTestCaseChange(idx, 'isHidden', e.target.checked)}
                        />
                        Hidden
                      </label>
                      <button type="button" onClick={() => handleRemoveTestCase(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="nav-btn primary" style={{ marginTop: '1rem', padding: '0.75rem' }}>
                Save Problem to Database
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
