'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [uploadTab, setUploadTab] = useState('form'); // 'form' | 'file'
  const [uploadStatus, setUploadStatus] = useState(null);

  // New problem form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');
  const [constraints, setConstraints] = useState('["1 <= n <= 10^5"]');
  const [newProblemTestCases, setNewProblemTestCases] = useState([
    { input: '', stdin: '', expected: '', isHidden: false }
  ]);

  // Upload test case state
  const [manualCases, setManualCases] = useState([
    { input: '', stdin: '', expected: '', isHidden: false }
  ]);
  const [jsonPaste, setJsonPaste] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const fileInputRef = useRef(null);

  const fetchProblems = async () => {
    try {
      const res = await fetch('/api/admin/problems', { cache: 'no-store' });
      const data = await res.json();
      setProblems(data.problems || []);
      // If modal is open, keep selectedProblem synchronized
      if (selectedProblem) {
        const updated = (data.problems || []).find(p => p.id === selectedProblem.id);
        if (updated) setSelectedProblem(updated);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();

    // Listen to real-time events via SSE
    let es;
    try {
      es = new EventSource('/api/events');
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'TESTCASE_UPLOADED' || payload.type === 'TESTCASE_DELETED' || payload.type === 'CMS_UPDATE') {
            fetchProblems();
          }
        } catch (err) {}
      };
    } catch (e) {}

    // Listen via BroadcastChannel
    let ch;
    try {
      ch = new BroadcastChannel('platform_cms_channel');
      ch.onmessage = () => fetchProblems();
    } catch (e) {}

    return () => {
      if (es) es.close();
      if (ch) ch.close();
    };
  }, []);

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
          testCases: newProblemTestCases.filter(tc => tc.expected.trim() !== '')
        })
      });

      if (res.ok) {
        try {
          const ch = new BroadcastChannel('platform_cms_channel');
          ch.postMessage({ type: 'CMS_UPDATE', action: 'create', title });
          ch.close();
        } catch (e) {}

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
      if (res.ok) {
        try {
          const ch = new BroadcastChannel('platform_cms_channel');
          ch.postMessage({ type: 'CMS_UPDATE', action: 'delete', id });
          ch.close();
        } catch (e) {}

        fetchProblems();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Open Upload Test Case Modal for a problem
  const openUploadModal = (problem) => {
    setSelectedProblem(problem);
    setManualCases([{ input: '', stdin: '', expected: '', isHidden: false }]);
    setJsonPaste('');
    setJsonError(null);
    setUploadStatus(null);
    setShowUploadModal(true);
  };

  const handleAddManualRow = () => {
    setManualCases(prev => [...prev, { input: '', stdin: '', expected: '', isHidden: false }]);
  };

  const handleManualRowChange = (index, field, value) => {
    setManualCases(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveManualRow = (index) => {
    setManualCases(prev => prev.filter((_, i) => i !== index));
  };

  // File upload handler (.json)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        setJsonPaste(content);
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          setJsonError('JSON file must contain an array of test cases');
        } else {
          setJsonError(null);
        }
      } catch (err) {
        setJsonError(`Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Upload Test Cases to API
  const handleUploadTestCases = async () => {
    if (!selectedProblem) return;
    setUploadStatus('Uploading test cases to Supabase...');

    let casesToSubmit = [];
    if (uploadTab === 'form') {
      casesToSubmit = manualCases.filter(c => c.expected.trim() !== '');
    } else {
      try {
        const parsed = JSON.parse(jsonPaste);
        casesToSubmit = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        setJsonError(`JSON Syntax Error: ${err.message}`);
        setUploadStatus(null);
        return;
      }
    }

    if (casesToSubmit.length === 0) {
      alert('Please provide at least one valid test case with expected output.');
      setUploadStatus(null);
      return;
    }

    try {
      const res = await fetch('/api/admin/testcases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: selectedProblem.id,
          testCases: casesToSubmit
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Broadcast across open tabs
        try {
          const ch = new BroadcastChannel('platform_cms_channel');
          ch.postMessage({
            type: 'TESTCASE_UPLOADED',
            problemId: selectedProblem.id,
            slug: selectedProblem.slug,
            title: selectedProblem.title,
            count: data.count,
            message: `⚡ ${data.count} test case(s) uploaded for ${selectedProblem.title}!`
          });
          ch.close();
        } catch (e) {}

        setUploadStatus(`✓ Successfully uploaded ${data.count} test case(s) live!`);
        setTimeout(() => {
          setUploadStatus(null);
          setShowUploadModal(false);
        }, 1200);

        fetchProblems();
      } else {
        alert(`Failed to upload test cases: ${data.error}`);
        setUploadStatus(null);
      }
    } catch (err) {
      alert(`Upload error: ${err.message}`);
      setUploadStatus(null);
    }
  };

  // Delete individual test case
  const handleDeleteTestCase = async (tcId) => {
    if (!confirm('Delete this test case?')) return;
    try {
      const res = await fetch(`/api/admin/testcases?id=${tcId}`, { method: 'DELETE' });
      if (res.ok) {
        try {
          const ch = new BroadcastChannel('platform_cms_channel');
          ch.postMessage({
            type: 'TESTCASE_DELETED',
            testCaseId: tcId,
            problemId: selectedProblem.id,
            slug: selectedProblem.slug
          });
          ch.close();
        } catch (e) {}

        fetchProblems();
      }
    } catch (e) {
      alert(`Error deleting test case: ${e.message}`);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Admin Problem & Test Case CMS</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Add problems and upload public/hidden test cases with instant real-time sync to all participant portals.
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
                  <button 
                    onClick={() => openUploadModal(p)} 
                    className="nav-btn primary"
                    style={{ background: '#4f46e5', borderColor: '#6366f1' }}
                  >
                    📤 Upload Test Cases
                  </button>
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

      {/* Upload Test Cases Modal */}
      {showUploadModal && selectedProblem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '92vh', overflowY: 'auto', background: '#131b2e', border: '1px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #1f293d', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#fff' }}>
                  Upload Test Cases: <span style={{ color: '#60a5fa' }}>{selectedProblem.title}</span>
                </h2>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#38bdf8' }}>
                    🔍 {selectedProblem.testCases?.filter(t => !t.isHidden).length || 0} Public Cases
                  </span>
                  <span style={{ color: '#f472b6' }}>
                    🔒 {selectedProblem.testCases?.filter(t => t.isHidden).length || 0} Hidden Cases
                  </span>
                  <span style={{ color: '#34d399' }}>
                    ⚡ Real-time SSE Sync Enabled
                  </span>
                </div>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="nav-btn">✕ Close</button>
            </div>

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button 
                onClick={() => setUploadTab('form')}
                className={`nav-btn ${uploadTab === 'form' ? 'primary' : ''}`}
                style={{ fontSize: '0.85rem' }}
              >
                📝 Manual Form Input
              </button>
              <button 
                onClick={() => setUploadTab('file')}
                className={`nav-btn ${uploadTab === 'file' ? 'primary' : ''}`}
                style={{ fontSize: '0.85rem' }}
              >
                📁 Batch File / JSON Upload
              </button>
            </div>

            {/* Tab 1: Manual Form Input */}
            {uploadTab === 'form' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Add test case inputs and expected outputs:
                  </span>
                  <button type="button" onClick={handleAddManualRow} className="nav-btn" style={{ fontSize: '0.75rem' }}>
                    + Add Another Case
                  </button>
                </div>

                {manualCases.map((tc, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.5rem', 
                      background: '#0a0f1d', 
                      padding: '0.75rem', 
                      borderRadius: '6px',
                      border: '1px solid #1e293b'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#60a5fa' }}>
                        Case #{idx + 1}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: tc.isHidden ? '#f472b6' : '#38bdf8' }}>
                          <input 
                            type="checkbox" 
                            checked={tc.isHidden} 
                            onChange={(e) => handleManualRowChange(idx, 'isHidden', e.target.checked)}
                          />
                          {tc.isHidden ? '🔒 Hidden (Submission Grading)' : '🔍 Public (Sample Case)'}
                        </label>
                        {manualCases.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveManualRow(idx)}
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                          Input Description (Visual)
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. nums = [2,7,11,15], target = 9" 
                          value={tc.input} 
                          onChange={(e) => handleManualRowChange(idx, 'input', e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                          Stdin (Standard Execution Input)
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. 4\n2 7 11 15\n9" 
                          value={tc.stdin} 
                          onChange={(e) => handleManualRowChange(idx, 'stdin', e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                        Expected Output (Exact string or JSON)
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g. [0,1]" 
                        value={tc.expected} 
                        onChange={(e) => handleManualRowChange(idx, 'expected', e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', background: '#1e293b', border: '1px solid #334155', color: '#4ade80', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Tab 2: Batch File / JSON Upload */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: '#0a0f1d', padding: '1rem', borderRadius: '6px', border: '1px dashed #3b82f6', textAlign: 'center' }}>
                  <input 
                    type="file" 
                    accept=".json,.txt"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="nav-btn primary"
                    style={{ marginBottom: '0.5rem' }}
                  >
                    📂 Choose Test Cases File (.json)
                  </button>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    Upload a JSON file containing an array of test cases.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Or Paste Test Cases JSON:</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setJsonPaste(JSON.stringify([
                        { "input": "nums = [1, 2, 3], target = 5", "stdin": "3\\n1 2 3\\n5", "expected": "[1,2]", "isHidden": false },
                        { "input": "nums = [10, 20, 30], target = 50", "stdin": "3\\n10 20 30\\n50", "expected": "[1,2]", "isHidden": true }
                      ], null, 2));
                      setJsonError(null);
                    }}
                    className="nav-btn"
                    style={{ fontSize: '0.75rem' }}
                  >
                    Load Sample Format
                  </button>
                </div>

                <textarea 
                  rows="8"
                  value={jsonPaste}
                  onChange={(e) => {
                    setJsonPaste(e.target.value);
                    setJsonError(null);
                  }}
                  placeholder='[ { "input": "...", "stdin": "...", "expected": "...", "isHidden": false } ]'
                  style={{ width: '100%', padding: '0.5rem', background: '#0a0f1d', border: '1px solid #334155', borderRadius: '4px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.85rem' }}
                />

                {jsonError && (
                  <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>
                    ⚠️ {jsonError}
                  </p>
                )}
              </div>
            )}

            {/* Upload Action Button */}
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#34d399' }}>
                {uploadStatus || '⚡ Instant reflection: Participants will receive updates automatically.'}
              </div>
              <button 
                onClick={handleUploadTestCases} 
                className="nav-btn primary"
                disabled={Boolean(uploadStatus)}
                style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem', background: '#2563eb' }}
              >
                🚀 Upload Test Cases to Supabase
              </button>
            </div>

            {/* Existing Test Cases List for this problem */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #1f293d', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.75rem' }}>
                Existing Test Cases for this Problem ({selectedProblem.testCases?.length || 0})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {selectedProblem.testCases?.map((tc, i) => (
                  <div 
                    key={tc.id || i}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: '#0a0f1d', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div>
                      <span style={{ color: tc.isHidden ? '#f472b6' : '#38bdf8', fontWeight: 600, marginRight: '0.5rem' }}>
                        {tc.isHidden ? '🔒 Hidden' : '🔍 Public'}
                      </span>
                      <span style={{ color: '#cbd5e1' }}>
                        Input: <code>{tc.input || tc.stdin}</code>
                      </span>
                      <span style={{ color: '#4ade80', marginLeft: '0.5rem' }}>
                        &rarr; Expected: <code>{tc.expected}</code>
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteTestCase(tc.id)}
                      className="nav-btn"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: '#ef4444', color: '#f87171' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Problem Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
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
                  <label style={{ fontWeight: 600 }}>Initial Test Cases</label>
                  <button 
                    type="button" 
                    onClick={() => setNewProblemTestCases(prev => [...prev, { input: '', stdin: '', expected: '', isHidden: false }])} 
                    className="nav-btn" 
                    style={{ fontSize: '0.75rem' }}
                  >
                    + Add Case
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {newProblemTestCases.map((tc, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                      <input 
                        type="text" 
                        placeholder="Stdin / Input" 
                        value={tc.stdin} 
                        onChange={(e) => {
                          const copy = [...newProblemTestCases];
                          copy[idx].stdin = e.target.value;
                          setNewProblemTestCases(copy);
                        }}
                        style={{ flex: 2, padding: '0.35rem', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Expected Output" 
                        value={tc.expected} 
                        onChange={(e) => {
                          const copy = [...newProblemTestCases];
                          copy[idx].expected = e.target.value;
                          setNewProblemTestCases(copy);
                        }}
                        style={{ flex: 1.5, padding: '0.35rem', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={tc.isHidden} 
                          onChange={(e) => {
                            const copy = [...newProblemTestCases];
                            copy[idx].isHidden = e.target.checked;
                            setNewProblemTestCases(copy);
                          }}
                        />
                        Hidden
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setNewProblemTestCases(prev => prev.filter((_, i) => i !== idx))} 
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
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
