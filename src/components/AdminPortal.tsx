import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
  Plus, Trash2, Key, Users, Layers, ShieldCheck, Database, 
  Copy, Check, ToggleLeft, ToggleRight, AlertTriangle, RefreshCw, BarChart3, Eye, EyeOff,
  Printer, Award, FileText, ChevronRight, LogIn, LogOut, Lock, Download, FileSpreadsheet
} from 'lucide-react';
import { motion } from 'motion/react';
import { Election, Section, SectionStats, Candidate } from '../types';

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
  // Admin authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem('admin_logged_in') === 'true';
  });
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

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
  const [bulkSectionText, setBulkSectionText] = useState('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  
  const [copiedSql, setCopiedSql] = useState(false);
  const [showPasscodes, setShowPasscodes] = useState<{ [secId: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState<'elections' | 'database'>('elections');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Results State
  const gradeLevels = Array.from(new Set(sections.map(s => s.grade_level))).sort((a, b) => (a as string).localeCompare(b as string, undefined, { numeric: true }));
  const [adminSubTab, setAdminSubTab] = useState<'manage' | 'results'>('manage');
  const [resultsSubView, setResultsSubView] = useState<'sections' | 'consolidated'>('sections');
  const [selectedResultsSection, setSelectedResultsSection] = useState<Section | null>(null);
  const [resultsBySection, setResultsBySection] = useState<{
    [sectionId: string]: {
      candidates: Candidate[];
      results: { positions?: { [pos: string]: { [candId: string]: number } }; totalVotesCast?: number };
      loading: boolean;
    }
  }>({});
  const [loadingResults, setLoadingResults] = useState(false);
  const [printingSection, setPrintingSection] = useState<Section | null>(null);

  const handleExportAllResults = () => {
    const csvRows = [];
    csvRows.push(['Grade Level', 'Section', 'Position', 'Candidate Name', 'Votes'].join(','));

    sections.forEach(sec => {
      const secResults = resultsBySection[sec.id];
      if (secResults && secResults.results) {
        (['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor'] as const).forEach(pos => {
          const votesMap = (secResults.results?.positions?.[pos] || {}) as Record<string, number>;
          const candidates = secResults.candidates || [];
          
          candidates.forEach(cand => {
            const votes = votesMap[cand.id] || 0;
            if (votes > 0) {
              csvRows.push([
                `"${sec.grade_level}"`,
                `"${sec.section_name}"`,
                `"${pos}"`,
                `"${cand.fullname}"`,
                votes
              ].join(','));
            }
          });
        });
      }
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'election_results.csv');
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsLoggedIn(true);
        sessionStorage.setItem('admin_logged_in', 'true');
        setLoginError('');
        fetchElections();
        fetchDbStatus();
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setLoginError('Error connecting to the login server');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem('admin_logged_in');
    setAdminUsername('');
    setAdminPassword('');
  };

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
    setConfirmModal({
      isOpen: true,
      title: 'Delete Election Campaign?',
      message: 'Are you sure you want to delete this election? This will also delete all associated sections, candidates, and votes. This action is permanent and cannot be undone.',
      onConfirm: async () => {
        try {
          await fetch(`/api/elections/${id}`, { method: 'DELETE' });
          setElections(prev => prev.filter(e => e.id !== id));
          if (selectedElection?.id === id) {
            setSelectedElection(null);
          }
        } catch (err) {
          console.error('Error deleting election:', err);
        }
        setConfirmModal(null);
      }
    });
  };

  const toggleElectionStatus = async (id: string, currentStatus: 'active' | 'closed') => {
    const action = currentStatus === 'active' ? 'close' : 'reopen';
    const result = await Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Election?`,
      text: `Are you sure you want to ${action} this election campaign?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1e3a8a',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Yes, ${action} it!`
    });

    if (!result.isConfirmed) return;

    const nextStatus = currentStatus === 'active' ? 'closed' : 'active';
    try {
      const res = await fetch(`/api/elections/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setElections(prev => prev.map(e => e.id === id ? updated : e));
        if (selectedElection?.id === id) {
          setSelectedElection(updated);
        }
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: `Election has been ${nextStatus === 'active' ? 'reopened' : 'closed'}.`,
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        throw new Error('Failed to update status');
      }
    } catch (err) {
      console.error('Error updating election status:', err);
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: 'Failed to update election status. Please check your connection.'
      });
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
      Swal.fire({
        icon: 'warning',
        title: 'Missing Details',
        text: 'All section details (Name, Adviser, and Passcode) are required.',
        confirmButtonColor: '#1e3a8a'
      });
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
        Swal.fire({
          icon: 'error',
          title: 'Section Creation Failed',
          text: error.error || 'Failed to create section.',
          confirmButtonColor: '#1e3a8a'
        });
      }
    } catch (err) {
      console.error('Error creating section:', err);
    }
  };

  const handleBulkSectionUpload = async () => {
    if (!selectedElection) return;
    if (!bulkSectionText.trim()) {
      Swal.fire({
        icon: 'info',
        title: 'Empty Input',
        text: 'Please paste some section data first.',
        confirmButtonColor: '#1e3a8a'
      });
      return;
    }

    setIsProcessingBulk(true);
    const lines = bulkSectionText.split('\n').filter(line => line.trim());
    let successCount = 0;
    let failCount = 0;

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 4) {
        failCount++;
        continue;
      }

      const [sectionName, gradeLevel, adviserName, passcode] = parts;

      try {
        const res = await fetch(`/api/elections/${selectedElection.id}/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grade_level: gradeLevel,
            section_name: sectionName,
            adviser_name: adviserName,
            adviser_passcode: passcode
          })
        });

        if (res.ok) successCount++;
        else failCount++;
      } catch (err) {
        console.error('Error processing bulk line:', err);
        failCount++;
      }
    }

    setIsProcessingBulk(false);
    setBulkSectionText('');
    fetchElectionData();
    
    Swal.fire({
      icon: successCount > 0 ? 'success' : 'info',
      title: 'Bulk Processing Complete',
      html: `<div class="text-left font-mono text-sm">
              <p class="text-emerald-600 font-bold">Successfully imported: ${successCount}</p>
              <p class="text-rose-600 font-bold">Failed: ${failCount}</p>
             </div>`,
      confirmButtonColor: '#1e3a8a'
    });
  };

  const exportAllResults = async () => {
    if (!selectedElection || sections.length === 0) return;
    
    setLoadingResults(true);
    
    try {
      // Ensure all results are fetched
      await fetchAllSectionResults();
      
      const csvRows = [];
      
      // Header
      const positions = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PRO', 'Sergeant-at-Arms'];
      csvRows.push(['Grade Level', 'Section Name', 'Adviser', 'Voted/Total Students', 'Participation Rate', ...positions].join(','));
      
      // Use the existing gradeLevels array
      gradeLevels.forEach(grade => {
        const gradeSections = sections.filter(s => s.grade_level === (grade as string)).sort((a, b) => a.section_name.localeCompare(b.section_name));
        
        gradeSections.forEach(sec => {
          const stat = sectionStats.find(s => s.section_id === sec.id);
          const participationStr = stat ? `${stat.voted_students}/${stat.total_students}` : 'N/A';
          const rateStr = stat ? `${stat.participation_rate}%` : 'N/A';
          
          const row = [
            grade,
            sec.section_name,
            `"${sec.adviser_name.replace(/"/g, '""')}"`,
            participationStr,
            rateStr
          ];
          
          positions.forEach(pos => {
            const winner = getWinnerForPosition(sec.id, pos);
            row.push(`"${winner.replace(/"/g, '""')}"`);
          });
          
          csvRows.push(row.join(','));
        });
      });
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `HRPTA_Election_Results_${selectedElection.title.replace(/\s+/g, '_')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting results:', err);
      Swal.fire({
        icon: 'error',
        title: 'Export Failed',
        text: 'Failed to export results. Please try again.',
        confirmButtonColor: '#1e3a8a'
      });
    } finally {
      setLoadingResults(false);
    }
  };

  const deleteSection = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Homeroom Section?',
      message: 'Are you sure you want to delete this section? All candidates and students uploaded by this adviser will be lost. This action is permanent and cannot be undone.',
      onConfirm: async () => {
        try {
          await fetch(`/api/sections/${id}`, { method: 'DELETE' });
          fetchElectionData();
        } catch (err) {
          console.error('Error deleting section:', err);
        }
        setConfirmModal(null);
      }
    });
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

  const fetchAllSectionResults = async () => {
    if (!selectedElection || sections.length === 0) return;
    setLoadingResults(true);
    
    // Set all sections to loading state initially
    const initial: typeof resultsBySection = { ...resultsBySection };
    sections.forEach(sec => {
      initial[sec.id] = {
        candidates: resultsBySection[sec.id]?.candidates || [],
        results: resultsBySection[sec.id]?.results || {},
        loading: true
      };
    });
    setResultsBySection(initial);

    try {
      await Promise.all(sections.map(async (sec) => {
        try {
          const candRes = await fetch(`/api/sections/${sec.id}/candidates`);
          const candData = await candRes.json();

          const resRes = await fetch(`/api/sections/${sec.id}/results`);
          const resData = await resRes.json();

          setResultsBySection(prev => ({
            ...prev,
            [sec.id]: {
              candidates: candData,
              results: resData,
              loading: false
            }
          }));
        } catch (err) {
          console.error(`Error fetching results for section ${sec.id}:`, err);
          setResultsBySection(prev => ({
            ...prev,
            [sec.id]: {
              ...prev[sec.id],
              loading: false
            }
          }));
        }
      }));
    } catch (err) {
      console.error('Error fetching all results:', err);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    if (adminSubTab === 'results' && selectedElection && sections.length > 0) {
      fetchAllSectionResults();
    }
  }, [adminSubTab, selectedElection, sections.length]);

  useEffect(() => {
    if (sections.length > 0) {
      if (!selectedResultsSection || !sections.some(s => s.id === selectedResultsSection.id)) {
        setSelectedResultsSection(sections[0]);
      }
    } else {
      setSelectedResultsSection(null);
    }
  }, [sections]);

  const handlePrintSection = (section: Section) => {
    setPrintingSection(section);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const getWinnerForPosition = (sectionId: string, position: string) => {
    const secData = resultsBySection[sectionId];
    if (!secData || !secData.candidates || !secData.results?.positions) return 'No Nominees';
    
    const positionCandidates = secData.candidates;
    if (positionCandidates.length === 0) return 'No Nominees';

    const votesMap = secData.results.positions[position] || {};
    
    let maxVotes = -1;
    let winnerCand: any = null;
    let isTie = false;
    let tieList: any[] = [];

    positionCandidates.forEach(cand => {
      const votes = votesMap[cand.id] || 0;
      if (votes > maxVotes) {
        maxVotes = votes;
        winnerCand = cand;
        isTie = false;
        tieList = [cand];
      } else if (votes === maxVotes && maxVotes >= 0) {
        isTie = true;
        tieList.push(cand);
      }
    });

    if (maxVotes === 0 && positionCandidates.length > 0) {
      return 'No votes cast';
    }

    if (isTie && tieList.length > 1) {
      return `Tie: ${tieList.map(c => c.fullname).join(' & ')} (${maxVotes} votes)`;
    }

    return winnerCand ? `${winnerCand.fullname} (${maxVotes} votes)` : 'No Nominees';
  };

  const togglePasscodeVisibility = (id: string) => {
    setShowPasscodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-16" id="admin-login-container">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-[#1e3a8a] px-6 py-8 text-center text-white relative">
            <div className="absolute top-4 right-4">
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-wider">Secure Gate</span>
            </div>
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-xs">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-serif font-bold tracking-tight">Admin Organizer Sign In</h2>
            <p className="text-xs text-blue-100 mt-1 font-sans">Access of Admin Organizer requires verification</p>
          </div>

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
            {loginError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Username</label>
              <div className="relative">
                <input 
                  type="text"
                  required
                  placeholder="Enter administrator username"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a] transition-all bg-gray-50 text-gray-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Password</label>
              <div className="relative">
                <input 
                  type="password"
                  required
                  placeholder="Enter password credential"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a] transition-all bg-gray-50 text-gray-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-[#1e3a8a] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#152e72] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Authenticate Session</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" id="admin-portal-root">
      {/* Header bar with Sign Out button */}
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

        {/* Database Status Pill & Logout Button */}
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

            <button
              onClick={handleAdminLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 transition-all shadow-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
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

                {/* Sub-tabs Panel */}
                <div className="flex bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('manage')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      adminSubTab === 'manage'
                        ? 'bg-white text-[#1e3a8a] shadow-xs'
                        : 'text-[#475569] hover:text-[#0f172a]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Configure & Monitor Sections
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('results')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      adminSubTab === 'results'
                        ? 'bg-white text-[#1e3a8a] shadow-xs'
                        : 'text-[#475569] hover:text-[#0f172a]'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    View & Print Election Results
                  </button>
                </div>

                {adminSubTab === 'manage' ? (
                  <>
                    {/* Section Creation Form */}
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#e2e8f0]">
                      <h3 className="text-base font-serif font-bold text-[#1e3a8a] mb-4 flex items-center gap-2">
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
                    
                    {/* Bulk Section Upload */}
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#e2e8f0]">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="text-[#1e3a8a] w-5 h-5" />
                        <h3 className="text-base font-serif font-bold text-[#1e3a8a]">
                          Bulk Homeroom Section Upload
                        </h3>
                      </div>
                      
                      <p className="text-sm text-[#475569] mb-4">
                        Paste sections comma-separated. One section per line.
                      </p>

                      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 mb-4">
                        <p className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2 font-mono">Format per line:</p>
                        <p className="text-xs text-[#64748b] font-mono mb-3">SectionName, GradeLevel, AdviserName, Passcode</p>
                        
                        <p className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2 font-mono">Example:</p>
                        <div className="text-xs text-[#64748b] font-mono space-y-1">
                          <p>Diamond, Grade 7, Juana Santos, 1234</p>
                          <p>Emerald, Grade 8, Rey Reyes, 5678</p>
                        </div>
                      </div>

                      <textarea
                        value={bulkSectionText}
                        onChange={(e) => setBulkSectionText(e.target.value)}
                        placeholder="Diamond, Grade 7, Juana Santos, 1234..."
                        className="w-full h-32 text-sm font-mono border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] mb-4"
                      />

                      <button
                        type="button"
                        onClick={handleBulkSectionUpload}
                        disabled={isProcessingBulk || !bulkSectionText.trim()}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 ${
                          isProcessingBulk || !bulkSectionText.trim()
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-[#1e3a8a] hover:bg-[#172554] text-white'
                        }`}
                      >
                        {isProcessingBulk ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Bulk Create Sections
                          </>
                        )}
                      </button>
                    </div>

                    {/* Sections & Monitoring List */}
                    <div className="bg-white rounded-[24px] shadow-sm border border-[#e2e8f0] overflow-hidden">
                      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
                        <h3 className="font-serif font-bold text-[#1e3a8a] text-base flex items-center gap-2">
                          <BarChart3 className="text-[#1e3a8a] w-5 h-5" />
                          Live Voter Participation Monitor
                        </h3>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={exportAllResults}
                            disabled={loadingResults || sections.length === 0}
                            className="text-emerald-600 hover:text-emerald-700 disabled:text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Export all section results to CSV"
                          >
                            {loadingResults ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            )}
                            Export All Results (CSV)
                          </button>
                          <div className="w-px h-4 bg-[#e2e8f0]"></div>
                          <button 
                            onClick={fetchElectionData}
                            className="text-[#1e3a8a] hover:text-[#172554] text-xs font-bold flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" /> Refresh Live Metrics
                          </button>
                        </div>
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
                  /* Elections Results View */
                  <div className="space-y-6">
                    {/* Results Sub Toggles & Refresh */}
                    <div className="bg-white rounded-2xl p-4 border border-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
                      <div className="flex gap-2 bg-[#f1f5f9] p-1 rounded-xl w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setResultsSubView('sections')}
                          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            resultsSubView === 'sections'
                              ? 'bg-white text-[#1e3a8a] shadow-xs'
                              : 'text-[#475569] hover:text-[#0f172a]'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Classroom Section Results
                        </button>
                        <button
                          type="button"
                          onClick={() => setResultsSubView('consolidated')}
                          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            resultsSubView === 'consolidated'
                              ? 'bg-white text-[#1e3a8a] shadow-xs'
                              : 'text-[#475569] hover:text-[#0f172a]'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          Grade-Level Election Summary
                        </button>
                        {resultsSubView === 'consolidated' && (
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-white text-[#1e3a8a] shadow-xs hover:bg-[#f8fafc]"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Print Summary
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={fetchAllSectionResults}
                        disabled={loadingResults}
                        className="w-full sm:w-auto bg-[#1e3a8a] hover:bg-[#172554] disabled:bg-[#cbd5e1] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingResults ? 'animate-spin' : ''}`} />
                        {loadingResults ? 'Loading Section Results...' : 'Refresh All Results'}
                      </button>
                    </div>

                    {sections.length === 0 ? (
                      <div className="bg-white rounded-[24px] border border-[#e2e8f0] py-16 text-center text-[#475569] px-6">
                        No sections created under this election campaign yet. Please configure sections under the "Configure & Monitor" tab.
                      </div>
                    ) : resultsSubView === 'sections' ? (
                      /* Section-by-Section view */
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="section-by-section-results">
                        {/* Left Side: Sections selection */}
                        <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-[24px] p-4 space-y-2 max-h-[500px] overflow-y-auto">
                          <h4 className="text-xs font-bold text-[#475569] uppercase tracking-widest font-mono px-2 mb-3">
                            Select Homeroom Section
                          </h4>
                          {sections.map(sec => {
                            const isSelected = selectedResultsSection?.id === sec.id;
                            const stat = sectionStats.find(s => s.section_id === sec.id);
                            return (
                              <button
                                key={sec.id}
                                type="button"
                                onClick={() => setSelectedResultsSection(sec)}
                                className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between group ${
                                  isSelected
                                    ? 'bg-amber-50 border-amber-200 text-[#1e3a8a] shadow-2xs'
                                    : 'bg-white border-[#f1f5f9] hover:bg-[#f8fafc] text-[#0f172a]'
                                }`}
                              >
                                <div className="truncate">
                                  <span className={`block text-xs font-bold ${isSelected ? 'text-[#1e3a8a]' : 'text-gray-500'}`}>
                                    {sec.grade_level}
                                  </span>
                                  <span className="block font-serif font-bold text-sm truncate">
                                    {sec.section_name}
                                  </span>
                                  <span className="block text-[10px] text-gray-405 truncate mt-0.5">
                                    Adviser: {sec.adviser_name}
                                  </span>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="block text-xs font-bold font-mono">
                                    {stat ? `${stat.voted_students}/${stat.total_students}` : '0/0'}
                                  </span>
                                  <span className="block text-[10px] text-gray-400 font-semibold">
                                    {stat ? `${stat.participation_rate}%` : '0%'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Right Side: Section's detailed results */}
                        <div className="lg:col-span-8 space-y-6">
                          {selectedResultsSection ? (
                            (() => {
                              const secResults = resultsBySection[selectedResultsSection.id];
                              const stat = sectionStats.find(s => s.section_id === selectedResultsSection.id);
                              
                              if (!secResults) {
                                return (
                                  <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-12 text-center text-[#475569]">
                                    <RefreshCw className="w-8 h-8 text-gray-300 mx-auto animate-spin mb-3" />
                                    <p className="font-bold text-sm">Loading classroom results...</p>
                                  </div>
                                );
                              }

                              if (secResults.loading) {
                                return (
                                  <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-12 text-center text-[#475569]">
                                    <RefreshCw className="w-8 h-8 text-[#1e3a8a] mx-auto animate-spin mb-3" />
                                    <p className="font-bold text-sm">Retrieving latest tallies...</p>
                                  </div>
                                );
                              }

                              return (
                                <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-6 space-y-6 shadow-sm">
                                  {/* Section Result Header */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#f1f5f9] gap-4">
                                    <div>
                                      <span className="text-xs font-bold text-amber-600 uppercase tracking-widest font-mono">
                                        {selectedResultsSection.grade_level}
                                      </span>
                                      <h3 className="font-serif font-bold text-[#1e3a8a] text-xl">
                                        Section {selectedResultsSection.section_name} Results
                                      </h3>
                                      <p className="text-xs text-[#475569] mt-0.5">
                                        Adviser: <span className="font-semibold">{selectedResultsSection.adviser_name}</span>
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handlePrintSection(selectedResultsSection)}
                                      className="bg-amber-550 hover:bg-amber-600 text-[#1e3a8a] border border-[#cbd5e1] hover:border-transparent hover:text-white bg-[#f8fafc] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
                                    >
                                      <Printer className="w-4 h-4" />
                                      Print Section Results
                                    </button>
                                  </div>

                                  {/* Participation Summary Row */}
                                  <div className="grid grid-cols-3 gap-4 bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-xl text-center">
                                    <div>
                                      <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Turnout</span>
                                      <span className="block font-mono font-bold text-lg text-[#1e3a8a]">
                                        {stat ? `${stat.voted_students} / ${stat.total_students}` : '0 / 0'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Rate</span>
                                      <span className="block font-mono font-bold text-lg text-amber-600">
                                        {stat ? `${stat.participation_rate}%` : '0%'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Total Positions</span>
                                      <span className="block font-mono font-bold text-lg text-gray-700">5 Positions</span>
                                    </div>
                                  </div>

                                  {/* Positions breakdown */}
                                  {secResults.candidates.length === 0 ? (
                                    <div className="py-12 text-center text-[#475569] italic">
                                      No candidates have been nominated in this section.
                                    </div>
                                  ) : (
                                    <div className="space-y-6">
                                      {(['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor'] as const).map(pos => {
                                        const votesMap = (secResults.results?.positions?.[pos] || {}) as Record<string, number>;
                                        const posCandidates = secResults.candidates.filter(c => (votesMap[c.id] || 0) > 0);
                                        const totalPosVotes = Object.values(votesMap).reduce((a, b) => a + b, 0);

                                        // Sort candidates by vote count
                                        const sorted = [...posCandidates].sort((a, b) => (votesMap[b.id] || 0) - (votesMap[a.id] || 0));

                                        return (
                                          <div key={pos} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 shadow-2xs">
                                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#f1f5f9]">
                                              <span className="font-serif font-bold text-sm text-[#1e3a8a]">{pos}</span>
                                              <span className="text-[10px] bg-slate-200 text-[#1e3a8a] px-2 py-0.5 rounded font-bold font-mono">
                                                {totalPosVotes} votes cast
                                              </span>
                                            </div>

                                            {posCandidates.length === 0 ? (
                                              <p className="text-xs text-gray-400 italic">No nominees for this position.</p>
                                            ) : (
                                              <div className="space-y-3.5">
                                                {sorted.map((cand, idx) => {
                                                  const votes = votesMap[cand.id] || 0;
                                                  const percentage = totalPosVotes > 0 ? Math.round((votes / totalPosVotes) * 100) : 0;
                                                  const isWinner = idx === 0 && votes > 0;

                                                  return (
                                                    <div key={cand.id} className="space-y-1">
                                                      <div className="flex justify-between items-start text-xs">
                                                        <div>
                                                          <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-[#0f172a]">{cand.fullname}</span>
                                                            {isWinner && (
                                                              <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                                                                Leading
                                                              </span>
                                                            )}
                                                          </div>
                                                          <span className="text-[10px] text-[#475569] block -mt-0.5">Child: {cand.child_name}</span>
                                                        </div>
                                                        <span className="font-mono font-bold text-[#0f172a] text-xs">
                                                          {votes} votes ({percentage}%)
                                                        </span>
                                                      </div>
                                                      <div className="w-full bg-[#f1f5f9] rounded-full h-1.5 overflow-hidden">
                                                        <div 
                                                          className={`h-1.5 rounded-full transition-all duration-500 ${isWinner ? 'bg-amber-500' : 'bg-[#1e3a8a]/70'}`}
                                                          style={{ width: `${percentage}%` }}
                                                        />
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-12 text-center text-[#475569]">
                              <FileText className="w-12 h-12 text-[#f1f5f9] mx-auto mb-4" />
                              <h3 className="font-serif font-bold text-[#1e3a8a] mb-1 text-lg">No Section Selected</h3>
                              <p className="text-xs">Select a section from the left sidebar to view its detailed voting counts.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Grade-Level Consolidated Report view */
                      <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-6 space-y-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#f1f5f9] gap-4">
                          <div>
                            <h3 className="font-serif font-bold text-[#1e3a8a] text-lg">
                              Grade-Level Election Summary Report
                            </h3>
                            <p className="text-xs text-[#475569] mt-0.5">
                                Consolidated listing of leading nominees and turnout statistics grouped by Grade Level.
                            </p>
                          </div>
                        </div>

                        {gradeLevels.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-6">No grade levels found.</p>
                        ) : (
                          gradeLevels.map(grade => {
                            const gradeSections = sections.filter(s => s.grade_level === grade);

                            return (
                              <div key={grade} className="border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-2xs">
                                <div className="bg-slate-50 px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                                  <h4 className="font-serif font-bold text-sm text-[#1e3a8a]">
                                    {grade} Elections
                                  </h4>
                                  <span className="text-[10px] uppercase tracking-wider font-mono font-bold bg-[#cbd5e1] text-[#1e3a8a] px-2.5 py-0.5 rounded-full">
                                    {gradeSections.length} Sections
                                  </span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-[#f8fafc] text-[#475569] uppercase font-bold tracking-wider font-mono border-b border-[#e2e8f0]">
                                        <th className="px-4 py-3">Section</th>
                                        <th className="px-4 py-3">President</th>
                                        <th className="px-4 py-3">Vice President</th>
                                        <th className="px-4 py-3">Secretary</th>
                                        <th className="px-4 py-3">Treasurer</th>
                                        <th className="px-4 py-3">Auditor</th>
                                        <th className="px-4 py-3 text-right">Turnout</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
                                      {gradeSections.map(sec => {
                                        const stat = sectionStats.find(s => s.section_id === sec.id);
                                        return (
                                          <tr key={sec.id} className="hover:bg-[#f8fafc]/50 transition-colors">
                                            <td className="px-4 py-3 font-bold text-[#1e3a8a]">
                                              {sec.section_name}
                                            </td>
                                            <td className="px-4 py-3 font-medium truncate max-w-[120px]" title={getWinnerForPosition(sec.id, 'President')}>
                                              {getWinnerForPosition(sec.id, 'President')}
                                            </td>
                                            <td className="px-4 py-3 font-medium truncate max-w-[120px]" title={getWinnerForPosition(sec.id, 'Vice President')}>
                                              {getWinnerForPosition(sec.id, 'Vice President')}
                                            </td>
                                            <td className="px-4 py-3 font-medium truncate max-w-[120px]" title={getWinnerForPosition(sec.id, 'Secretary')}>
                                              {getWinnerForPosition(sec.id, 'Secretary')}
                                            </td>
                                            <td className="px-4 py-3 font-medium truncate max-w-[120px]" title={getWinnerForPosition(sec.id, 'Treasurer')}>
                                              {getWinnerForPosition(sec.id, 'Treasurer')}
                                            </td>
                                            <td className="px-4 py-3 font-medium truncate max-w-[120px]" title={getWinnerForPosition(sec.id, 'Auditor')}>
                                              {getWinnerForPosition(sec.id, 'Auditor')}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold">
                                              {stat ? `${stat.voted_students}/${stat.total_students} (${stat.participation_rate}%)` : '0/0'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                              <button
                                                type="button"
                                                onClick={() => handlePrintSection(sec)}
                                                className="text-[#1e3a8a] hover:text-amber-600 hover:bg-[#1e3a8a]/5 p-1 rounded-lg transition-all"
                                                title="Print official section report"
                                              >
                                                <Printer className="w-4 h-4" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-16 text-center text-[#475569]">
                <Layers className="w-16 h-16 text-[#f1f5f9] mx-auto mb-4" />
                <h2 className="text-xl font-serif font-bold text-[#1e3a8a] mb-2">No Active Election Selected</h2>
                <p className="text-sm max-w-md mx-auto">Please select an existing election campaign from the left sidebar or create a new one to manage its sections and results.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="confirm-modal-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[24px] border border-[#e2e8f0] shadow-xl max-w-md w-full p-6 space-y-4"
            id="confirm-modal-content"
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center border border-red-100 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-bold text-lg text-[#0f172a]">{confirmModal.title}</h3>
            </div>
            
            <p className="text-sm text-[#475569] leading-relaxed font-sans">
              {confirmModal.message}
            </p>
            
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-white hover:bg-[#f8fafc] text-[#475569] border border-[#e2e8f0] rounded-xl text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {printingSection && (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans" id="print-sheet-rmhs">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <div className="flex items-center justify-center gap-4 mb-2">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Ramon_Magsaysay_%28Cubao%29_High_School.svg/500px-Ramon_Magsaysay_%28Cubao%29_High_School.svg.png" 
                alt="Ramon Magsaysay High School" 
                className="w-16 h-16 object-contain"
                referrerPolicy="no-referrer"
              />
              <div className="text-left">
                <h1 className="text-sm font-bold uppercase font-serif tracking-wide text-gray-900">Ramon Magsaysay (Cubao) High School</h1>
                <p className="text-xs text-gray-600 font-mono">PTA Classroom Homeroom Election Official Report</p>
                <p className="text-[10px] text-gray-500 font-mono">S.Y. 2026-2027</p>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold text-gray-500 text-[10px] uppercase font-mono">Election Campaign:</p>
              <p className="text-sm border-b border-gray-300 pb-1 font-semibold">{selectedElection?.title}</p>
            </div>
            <div>
              <p className="font-bold text-gray-500 text-[10px] uppercase font-mono">Grade & Section:</p>
              <p className="text-sm border-b border-gray-300 pb-1 font-semibold">{printingSection.grade_level} - {printingSection.section_name}</p>
            </div>
            <div>
              <p className="font-bold text-gray-500 text-[10px] uppercase font-mono">Homeroom Adviser:</p>
              <p className="text-sm border-b border-gray-300 pb-1 font-semibold">{printingSection.adviser_name}</p>
            </div>
            <div>
              <p className="font-bold text-gray-500 text-[10px] uppercase font-mono">Voter Turnout Metric:</p>
              <p className="text-sm border-b border-gray-300 pb-1 font-mono font-bold text-emerald-800">
                {(() => {
                  const stat = sectionStats.find(s => s.section_id === printingSection.id);
                  return stat ? `${stat.voted_students} voted / ${stat.total_students} registered (${stat.participation_rate}%)` : 'N/A';
                })()}
              </p>
            </div>
          </div>

          <h3 className="text-center font-bold text-xs uppercase tracking-wider mb-4 bg-gray-100 py-1 border border-gray-300">
            Official Election Tally
          </h3>

          <div className="space-y-4">
            {(() => {
              const secResults = resultsBySection[printingSection.id];
              if (!secResults || !secResults.candidates) {
                return <p className="italic text-center text-xs">No result data fetched yet. Please refresh database before printing.</p>;
              }

              return (['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor'] as const).map(pos => {
                const votesMap = (secResults.results?.positions?.[pos] || {}) as Record<string, number>;
                const posCandidates = secResults.candidates.filter(c => (votesMap[c.id] || 0) > 0);
                const totalPosVotes = Object.values(votesMap).reduce((a, b) => a + b, 0);

                // Sort candidates by vote count
                const sorted = [...posCandidates].sort((a, b) => (votesMap[b.id] || 0) - (votesMap[a.id] || 0));

                return (
                  <div key={pos} className="border border-gray-300 rounded-lg p-3">
                    <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-2">
                      <span className="font-bold text-xs uppercase text-gray-800">{pos}</span>
                      <span className="text-[10px] text-gray-500 font-mono font-bold">{totalPosVotes} total votes cast</span>
                    </div>

                    {posCandidates.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No nominees registered.</p>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 uppercase font-bold text-[8px] font-mono">
                            <th className="py-1">Rank</th>
                            <th className="py-1">Parent Nominee Fullname</th>
                            <th className="py-1">Representing Student</th>
                            <th className="py-1 text-right">Votes</th>
                            <th className="py-1 text-right">Share (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-900">
                          {sorted.map((cand, idx) => {
                            const votes = votesMap[cand.id] || 0;
                            const pct = totalPosVotes > 0 ? Math.round((votes / totalPosVotes) * 100) : 0;
                            const isWinner = idx === 0 && votes > 0;
                            return (
                              <tr key={cand.id} className={isWinner ? 'font-bold bg-gray-50' : ''}>
                                <td className="py-1.5">{idx + 1}</td>
                                <td className="py-1.5 flex items-center gap-1">
                                  <span>{cand.fullname}</span>
                                  {isWinner && <span className="text-[8px] border border-black px-1 rounded uppercase tracking-wider font-mono text-[7px] bg-white">LEADING</span>}
                                </td>
                                <td className="py-1.5">{cand.child_name}</td>
                                <td className="py-1.5 text-right font-mono">{votes}</td>
                                <td className="py-1.5 text-right font-mono">{pct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          <div className="mt-10 pt-6 border-t border-dashed border-gray-300 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-black w-48 mx-auto h-8"></div>
              <p className="font-bold mt-1 uppercase text-[10px]">{printingSection.adviser_name}</p>
              <p className="text-gray-500 text-[8px] font-mono">Homeroom Adviser Signature</p>
            </div>
            <div>
              <div className="border-b border-black w-48 mx-auto h-8"></div>
              <p className="font-bold mt-1 uppercase text-[10px]">Election Administrator</p>
              <p className="text-gray-500 text-[8px] font-mono">RMHS PTA Committee</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
