import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Key, Users, Layers, ShieldCheck, Database, 
  Copy, Check, ToggleLeft, ToggleRight, AlertTriangle, Play, RefreshCw, BarChart3, Eye, EyeOff
} from 'lucide-react';
import { motion } from 'motion/react';
import { Election, Section, SectionStats } from '../types';

interface DbStatus {
  configured: boolean;
  connected: boolean;
  tablesExist: boolean;
  currentMode: 'supabase' | 'sandbox';
  url: string;
  sql: string;
  error?: string;
}

export default function AdminPortal() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionStats, setSectionStats] = useState<SectionStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  
  // Forms state
  const [newElectionTitle, setNewElectionTitle] = useState('');
  const [newGradeLevel, setNewGradeLevel] = useState('Grade 7');
  const [newSectionName, setNewSectionName] = useState('');
  const [newAdviserName, setNewAdviserName] = useState('');
  const [newAdviserPasscode, setNewAdviserPasscode] = useState('');
  
  const [copiedSql, setCopiedSql] = useState(false);
  const [showPasscodes, setShowPasscodes] = useState<{ [secId: string]: boolean }>({});
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'elections' | 'database'>('elections');

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/db-status');
      const data = await res.json();
      setDbStatus(data);
    } catch (err) {
      console.error('Error fetching db status:', err);
    }
  };

  const toggleDbMode = async () => {
    if (!dbStatus) return;
    const targetMode = dbStatus.currentMode === 'supabase' ? 'sandbox' : 'supabase';
    try {
      const res = await fetch('/api/db-status/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: targetMode })
      });
      const data = await res.json();
      fetchDbStatus();
      fetchElections();
    } catch (err) {
      console.error('Error toggling DB mode:', err);
    }
  };

  const fetchElections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/elections');
      const data = await res.json();
      setElections(data);
      if (data.length > 0 && !selectedElection) {
        setSelectedElection(data[0]);
      }
    } catch (err) {
      console.error('Error fetching elections:', err);
    } finally {
      setLoading(false);
    }
  };

  const createElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newElectionTitle.trim()) return;

    try {
      const res = await fetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newElectionTitle })
      });
      const newElec = await res.json();
      setElections(prev => [newElec, ...prev]);
      setSelectedElection(newElec);
      setNewElectionTitle('');
    } catch (err) {
      console.error('Error creating election:', err);
    }
  };

  const deleteElection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this election? This will also delete all associated sections, candidates, and votes.')) return;
    try {
      await fetch(`/api/elections/${id}`, { method: 'DELETE' });
      setElections(prev => prev.filter(e => e.id !== id));
      if (selectedElection?.id === id) {
        setSelectedElection(null);
      }
    } catch (err) {
      console.error('Error deleting election:', err);
    }
  };

  const toggleElectionStatus = async (id: string, currentStatus: 'active' | 'closed') => {
    const nextStatus = currentStatus === 'active' ? 'closed' : 'active';
    try {
      const res = await fetch(`/api/elections/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const updated = await res.json();
      setElections(prev => prev.map(e => e.id === id ? updated : e));
      if (selectedElection?.id === id) {
        setSelectedElection(updated);
      }
    } catch (err) {
      console.error('Error updating election status:', err);
    }
  };

  const fetchElectionData = async () => {
    if (!selectedElection) return;
    try {
      // Fetch sections
      const secRes = await fetch(`/api/elections/${selectedElection.id}/sections`);
      const secData = await secRes.json();
      setSections(secData);

      // Fetch monitoring/participation stats
      const statsRes = await fetch(`/api/admin/overview/${selectedElection.id}`);
      const statsData = await statsRes.json();
      setSectionStats(statsData);
    } catch (err) {
      console.error('Error fetching election sections/stats:', err);
    }
  };

  const createSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedElection) return;
    if (!newSectionName.trim() || !newAdviserName.trim() || !newAdviserPasscode.trim()) {
      alert('All section details are required.');
      return;
    }

    try {
      const res = await fetch(`/api/elections/${selectedElection.id}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade_level: newGradeLevel,
          section_name: newSectionName,
          adviser_name: newAdviserName,
          adviser_passcode: newAdviserPasscode
        })
      });
      if (res.ok) {
        setNewSectionName('');
        setNewAdviserName('');
        setNewAdviserPasscode('');
        fetchElectionData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create section');
      }
    } catch (err) {
      console.error('Error creating section:', err);
    }
  };

  const deleteSection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this section? All candidates and students uploaded by this adviser will be lost.')) return;
    try {
      await fetch(`/api/sections/${id}`, { method: 'DELETE' });
      fetchElectionData();
    } catch (err) {
      console.error('Error deleting section:', err);
    }
  };

  const handleCopySql = () => {
    if (!dbStatus) return;
    navigator.clipboard.writeText(dbStatus.sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  useEffect(() => {
    fetchDbStatus();
    fetchElections();
  }, []);

  useEffect(() => {
    fetchElectionData();
  }, [selectedElection]);

  const togglePasscodeVisibility = (id: string) => {
    setShowPasscodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" id="admin-portal-root">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-[#e2e8f0]">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#1e3a8a] tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-[#1e3a8a] w-8 h-8" />
            Homeroom PTA Election Organizer Portal
          </h1>
          <p className="text-sm text-[#475569] mt-1 font-sans">
            Configure elections, create and assign advisers, and monitor live voting metrics.
          </p>
        </div>

        {/* Database Status Pill */}
        {dbStatus && (
          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <button
              onClick={() => setActiveTab(activeTab === 'database' ? 'elections' : 'database')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border shadow-xs transition-all ${
                dbStatus.currentMode === 'supabase'
                  ? 'bg-emerald-50 text-emerald-850 border-emerald-200 hover:bg-emerald-100/50'
                  : 'bg-amber-50 text-amber-850 border-amber-200 hover:bg-amber-100/50'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>
                Mode: {dbStatus.currentMode === 'supabase' ? 'Live Supabase DB' : 'Local Sandbox Mode'}
              </span>
              <RefreshCw className="w-3.5 h-3.5 ml-1 animate-spin-hover" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('elections')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'elections'
              ? 'bg-[#1e3a8a] text-white shadow-xs'
              : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]'
          }`}
        >
          <Layers className="w-4 h-4 inline-block mr-2" />
          Elections & Sections
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'database'
              ? 'bg-[#1e3a8a] text-white shadow-xs'
              : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]'
          }`}
        >
          <Database className="w-4 h-4 inline-block mr-2" />
          Supabase Setup
        </button>
      </div>

      {activeTab === 'database' && dbStatus && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[32px] shadow-sm border border-[#e2e8f0] p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif font-bold text-[#1e3a8a] flex items-center gap-2">
              <Database className="text-[#1e3a8a] w-5 h-5" />
              Supabase Configuration Dashboard
            </h2>
            <button 
              onClick={toggleDbMode}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#1e3a8a] border border-[#e2e8f0] rounded-xl text-xs font-semibold transition-all"
            >
              {dbStatus.currentMode === 'supabase' ? <ToggleRight className="text-[#1e3a8a] w-6 h-6" /> : <ToggleLeft className="text-[#475569] w-6 h-6" />}
              Switch to {dbStatus.currentMode === 'supabase' ? 'Sandbox Mode' : 'Live Supabase'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-[#f8fafc] rounded-2xl p-5 border border-[#e2e8f0]">
              <h3 className="font-serif font-bold text-[#1e3a8a] text-sm mb-3">Connection Information</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#475569] block font-mono">SUPABASE_URL</span>
                  <span className="text-[#0f172a] font-mono select-all bg-white px-2 py-1 rounded border border-[#e2e8f0] inline-block mt-0.5">{dbStatus.url}</span>
                </div>
                <div className="pt-2">
                  <span className="text-[#475569] block">Current Operating State</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${dbStatus.connected && dbStatus.tablesExist ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="font-semibold text-[#0f172a]">
                      {dbStatus.connected && dbStatus.tablesExist ? 'Active & Ready' : 'Running Sandbox Fallback'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#f8fafc] rounded-2xl p-5 border border-[#e2e8f0] flex flex-col justify-between">
              <div>
                <h3 className="font-serif font-bold text-[#1e3a8a] text-sm mb-2">Diagnostics Status</h3>
                <p className="text-xs text-[#475569] leading-relaxed">
                  {dbStatus.connected && dbStatus.tablesExist 
                    ? 'Connected successfully to Supabase! All HRPTA tables have been verified in your schema. Live voter authentication, student logs, and real-time outcomes are synced automatically.'
                    : 'The server is currently running in Sandbox Mode. You can fully test elections, candidates, LRNS, and voting out-of-the-box. To sync with your personal Supabase project, copy and run the SQL schema script on your Supabase dashboard.'}
                </p>
              </div>

              {dbStatus.error && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded text-[11px] font-mono flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{dbStatus.error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#e2e8f0] pt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-serif font-bold text-[#1e3a8a] text-base">Setup Your Supabase Tables</h3>
                <p className="text-xs text-[#475569]">Run this PostgreSQL script in your Supabase SQL Editor to bootstrap tables and row-level policies.</p>
              </div>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedSql ? 'Copied!' : 'Copy Schema SQL'}
              </button>
            </div>

            <div className="relative bg-slate-950 rounded-xl border border-slate-900 max-h-[320px] overflow-y-auto">
              <pre className="p-4 text-xs font-mono text-[#e2e8f0] leading-relaxed select-all">
                {dbStatus.sql}
              </pre>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'elections' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Election List & Form */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[24px] shadow-sm border border-[#e2e8f0] p-5">
              <h2 className="text-lg font-serif font-bold text-[#1e3a8a] mb-4 flex items-center gap-2">
                <Layers className="text-[#1e3a8a] w-5 h-5" />
                Election Campaigns
              </h2>

              <form onSubmit={createElection} className="mb-5">
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-widest mb-1.5 font-mono">Create New Campaign</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newElectionTitle}
                    onChange={(e) => setNewElectionTitle(e.target.value)}
                    placeholder="e.g., SY 2026-2027 PTA"
                    className="flex-1 text-sm border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a]"
                  />
                  <button
                    type="submit"
                    className="bg-[#1e3a8a] hover:bg-[#172554] text-white rounded-xl p-2.5 transition-all shadow-xs"
                    title="Create Election"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </form>

              {loading ? (
                <div className="py-8 text-center text-[#475569] text-sm">Loading elections...</div>
              ) : elections.length === 0 ? (
                <div className="py-8 text-center text-[#475569] text-sm border-2 border-dashed border-[#e2e8f0] rounded-xl">
                  No elections configured yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {elections.map((election) => (
                    <div
                      key={election.id}
                      onClick={() => setSelectedElection(election)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedElection?.id === election.id
                          ? 'border-[#1e3a8a] bg-[#f8fafc] ring-1 ring-[#1e3a8a]'
                          : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#0f172a] block truncate max-w-[160px]">
                          {election.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleElectionStatus(election.id, election.status);
                            }}
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              election.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]'
                            }`}
                          >
                            {election.status === 'active' ? 'Active' : 'Closed'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteElection(election.id);
                            }}
                            className="text-[#475569] hover:text-red-500 p-1 rounded-md hover:bg-[#f1f5f9] transition-all"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#475569] block mt-1 font-mono">ID: {election.id.substring(0, 8)}...</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedElection && (
              <div className="bg-[#1e3a8a] text-[#f1f5f9] rounded-[24px] p-6 shadow-sm">
                <h3 className="font-serif font-bold text-sm uppercase tracking-wider text-[#cbd5e1] mb-2">Instructions for Advisers</h3>
                <p className="text-xs leading-relaxed text-[#cbd5e1]/90 mb-3 font-sans font-medium">
                  Advisers will require a <strong>passcode</strong> assigned below to access their specific homeroom dashboard. Provide them with their unique code.
                </p>
                <div className="bg-[#172554]/40 border border-[#172554] rounded-xl p-3.5 text-xs leading-relaxed text-[#f1f5f9]">
                  <div className="font-semibold text-white mb-1">Adviser portal will:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Upload lists of parents willing to run</li>
                    <li>Upload Student Learner Reference Numbers (LRN)</li>
                    <li>Access real-time local room results</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sections Setup & Live Monitor */}
          <div className="lg:col-span-8 space-y-6">
            {selectedElection ? (
              <>
                {/* Active Election Banner */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#e2e8f0]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-[#475569] uppercase tracking-widest font-mono">Active Focus Campaign</span>
                      <h2 className="text-2xl font-serif font-bold text-[#1e3a8a] mt-0.5">{selectedElection.title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        selectedElection.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]'
                      }`}>
                        Status: {selectedElection.status}
                      </span>
                      <button
                        onClick={() => toggleElectionStatus(selectedElection.id, selectedElection.status)}
                        className={`text-xs font-semibold px-4 py-1.5 rounded-lg border transition-all ${
                          selectedElection.status === 'active' 
                            ? 'bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#1e3a8a] border-[#e2e8f0]' 
                            : 'bg-[#1e3a8a] hover:bg-[#172554] text-white border-transparent'
                        }`}
                      >
                        {selectedElection.status === 'active' ? 'Close Election' : 'Reopen Election'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section Creation Form */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#e2e8f0]">
                  <h3 className="text-lg font-serif font-bold text-[#1e3a8a] mb-4 flex items-center gap-2">
                    <Users className="text-[#1e3a8a] w-5 h-5" />
                    Create and Assign Homeroom Adviser
                  </h3>

                  <form onSubmit={createSection} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Grade Level</label>
                      <select
                        value={newGradeLevel}
                        onChange={(e) => setNewGradeLevel(e.target.value)}
                        className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a]"
                      >
                        <option value="Grade 7">Grade 7</option>
                        <option value="Grade 8">Grade 8</option>
                        <option value="Grade 9">Grade 9</option>
                        <option value="Grade 10">Grade 10</option>
                        <option value="Grade 11">Grade 11</option>
                        <option value="Grade 12">Grade 12</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Section Name</label>
                      <input
                        type="text"
                        required
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        placeholder="e.g., Amber, Birch"
                        className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Adviser Name</label>
                      <input
                        type="text"
                        required
                        value={newAdviserName}
                        onChange={(e) => setNewAdviserName(e.target.value)}
                        placeholder="e.g., Mrs. Smith"
                        className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a]"
                      />
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Adviser Passcode</label>
                        <input
                          type="text"
                          required
                          value={newAdviserPasscode}
                          onChange={(e) => setNewAdviserPasscode(e.target.value)}
                          placeholder="e.g., 4-digit code"
                          className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-[#1e3a8a] hover:bg-[#172554] text-white rounded-xl p-2.5 transition-all shadow-xs shrink-0 self-end"
                        title="Add Section"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Sections & Monitoring List */}
                <div className="bg-white rounded-[24px] shadow-sm border border-[#e2e8f0] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
                    <h3 className="font-serif font-bold text-[#1e3a8a] text-base flex items-center gap-2">
                      <BarChart3 className="text-[#1e3a8a] w-5 h-5" />
                      Live Voter Participation Monitor
                    </h3>
                    <button 
                      onClick={fetchElectionData}
                      className="text-[#1e3a8a] hover:text-[#172554] text-xs font-bold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" /> Refresh Live Metrics
                    </button>
                  </div>

                  {sections.length === 0 ? (
                    <div className="py-12 text-center text-[#475569]">
                      No sections created under this election campaign yet. Fill the form above to add a room.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#f8fafc] text-[#475569] text-xs uppercase tracking-widest font-bold font-mono">
                            <th className="px-6 py-4 border-b border-[#f1f5f9]">Grade & Section</th>
                            <th className="px-6 py-4 border-b border-[#f1f5f9]">Adviser</th>
                            <th className="px-6 py-4 border-b border-[#f1f5f9]">Portal Passcode</th>
                            <th className="px-6 py-4 border-b border-[#f1f5f9]">Participation Ratio</th>
                            <th className="px-6 py-4 border-b border-[#f1f5f9] text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9] text-sm">
                          {sections.map((section) => {
                            const stat = sectionStats.find(st => st.section_id === section.id) || {
                              total_students: 0,
                              voted_students: 0,
                              participation_rate: 0
                            };
                            return (
                              <tr key={section.id} className="hover:bg-[#f8fafc] transition-colors">
                                <td className="px-6 py-4 font-bold text-[#0f172a]">
                                  {section.grade_level} - {section.section_name}
                                </td>
                                <td className="px-6 py-4 text-[#475569]">
                                  {section.adviser_name}
                                </td>
                                <td className="px-6 py-4 text-[#475569] font-mono">
                                  <div className="flex items-center gap-1.5">
                                    <span>
                                      {showPasscodes[section.id] ? section.adviser_passcode : '••••'}
                                    </span>
                                    <button 
                                      onClick={() => togglePasscodeVisibility(section.id)}
                                      className="text-[#475569] hover:text-[#0f172a]"
                                    >
                                      {showPasscodes[section.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div>
                                    <div className="flex items-center justify-between text-xs font-semibold text-[#0f172a] mb-1">
                                      <span>{stat.voted_students} / {stat.total_students} students</span>
                                      <span>{stat.participation_rate}%</span>
                                    </div>
                                    <div className="w-full bg-[#f1f5f9] rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full transition-all duration-500 ${
                                          stat.participation_rate >= 80 
                                            ? 'bg-[#1e3a8a]' 
                                            : stat.participation_rate >= 50 
                                              ? 'bg-[#cbd5e1]' 
                                              : 'bg-[#475569]'
                                        }`}
                                        style={{ width: `${Math.min(stat.participation_rate, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => deleteSection(section.id)}
                                    className="text-[#475569] hover:text-red-600 p-1.5 rounded-lg hover:bg-[#f1f5f9] transition-all inline-block"
                                    title="Delete Section Room"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-[32px] border border-[#e2e8f0] p-12 text-center text-[#475569]">
                <Layers className="w-12 h-12 text-[#f1f5f9] mx-auto mb-4" />
                <h3 className="font-serif font-bold text-[#1e3a8a] mb-1 text-lg">No Active Campaign Selected</h3>
                <p className="text-xs">Create or select an election from the left column to configure its rooms and monitor metrics.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
