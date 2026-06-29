import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { 
  Key, UserCheck, Shield, UploadCloud, Users, BarChart3, 
  Trash2, Plus, Info, RefreshCw, Briefcase, FileSpreadsheet, Check, LogOut, AlertTriangle, Image as ImageIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { Candidate, Student, Position, POSITIONS } from '../types';

interface AdviserSession {
  section: {
    id: string;
    grade_level: string;
    section_name: string;
    adviser_name: string;
    election_id: string;
  };
  election: {
    id: string;
    title: string;
    status: 'active' | 'closed';
  };
}

export default function AdviserPortal() {
  const [passcode, setPasscode] = useState('');
  const [session, setSession] = useState<AdviserSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<{ positions: { [pos: string]: { [candId: string]: number } } } | null>(null);
  
  // Single Candidate Form
  const [candName, setCandName] = useState('');
  const [candChild, setCandChild] = useState('');
  const [candIncomeSource, setCandIncomeSource] = useState<'Business' | 'Employment' | 'Other' | 'None'>('Employment');
  const [candIncomeDetails, setCandIncomeDetails] = useState('');
  const [candPosition, setCandPosition] = useState<Position>('President');
  const [candidatePicture, setCandidatePicture] = useState<string | null>(null);
  
  // Bulk uploads raw text
  const [bulkLrnInput, setBulkLrnInput] = useState('');
  const [bulkCandInput, setBulkCandInput] = useState('');
  
  const [uploadSuccess, setUploadSuccess] = useState({ students: false, candidates: false });
  const [activePortalTab, setActivePortalTab] = useState<'candidates' | 'students' | 'results'>('candidates');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Handle image compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const options = {
      maxSizeMB: 0.05, // 50KB limit to save space
      maxWidthOrHeight: 200,
      useWebWorker: true,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCandidatePicture(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error(error);
      alert("Failed to compress image.");
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setLoadingSession(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/adviser/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data);
        // Save passcode to local storage so advisers remain logged in on refresh
        localStorage.setItem('adviser_passcode', passcode);
      } else {
        setErrorMsg(data.error || 'Login failed. Please verify your passcode.');
      }
    } catch (err) {
      setErrorMsg('Server connection failed.');
    } finally {
      setLoadingSession(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    setPasscode('');
    localStorage.removeItem('adviser_passcode');
  };

  // Fetch Section Data
  const fetchSectionData = async () => {
    if (!session) return;
    try {
      const candRes = await fetch(`/api/sections/${session.section.id}/candidates`);
      const candData = await candRes.json();
      setCandidates(candData);

      const studRes = await fetch(`/api/sections/${session.section.id}/students`);
      const studData = await studRes.json();
      setStudents(studData);

      const resRes = await fetch(`/api/sections/${session.section.id}/results`);
      const resData = await resRes.json();
      setResults(resData);
    } catch (err) {
      console.error('Error loading adviser section data:', err);
    }
  };

  useEffect(() => {
    // Check if passcode already stored
    const savedPass = localStorage.getItem('adviser_passcode');
    if (savedPass) {
      setPasscode(savedPass);
      // Trigger login automatically
      fetch('/api/adviser/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: savedPass })
      })
      .then(res => res.json())
      .then(data => {
        if (data.section) {
          setSession(data);
        } else {
          localStorage.removeItem('adviser_passcode');
        }
      })
      .catch(() => localStorage.removeItem('adviser_passcode'));
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchSectionData();
    }
  }, [session]);

  // Create single candidate
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!candName.trim() || !candChild.trim()) {
      alert('Candidate name and child name are required.');
      return;
    }

    try {
      const res = await fetch(`/api/sections/${session.section.id}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullname: candName,
          child_name: candChild,
          income_source: candIncomeSource,
          income_details: candIncomeDetails,
          position: candPosition,
          picture_data: candidatePicture
        })
      });

      if (res.ok) {
        setCandName('');
        setCandChild('');
        setCandIncomeDetails('');
        setCandidatePicture(null);
        fetchSectionData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to add candidate.');
      }
    } catch (err) {
      console.error('Error adding candidate:', err);
    }
  };

  // Delete Candidate
  const handleDeleteCandidate = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Candidate?',
      message: 'Are you sure you want to remove this candidate? This will delete any votes already cast for them. This action is permanent.',
      onConfirm: async () => {
        try {
          await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
          fetchSectionData();
        } catch (err) {
          console.error('Error deleting candidate:', err);
        }
        setConfirmModal(null);
      }
    });
  };

  // Bulk student parse and upload
  const handleBulkStudentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !bulkLrnInput.trim()) return;

    // Parse: One student per line
    // Format: "123456789011, Juan Dela Cruz" or "123456789011" (name default to "Student [Lrn]")
    const lines = bulkLrnInput.split('\n');
    const studentList: { lrn: string; student_name: string }[] = [];

    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split(',');
      const lrn = parts[0].trim();
      let name = parts[1] ? parts[1].trim() : '';

      if (lrn) {
        if (!name) {
          name = `Student (${lrn.substring(lrn.length - 4)})`;
        }
        studentList.push({ lrn, student_name: name });
      }
    });

    if (studentList.length === 0) {
      alert('Could not parse any valid student LRNS. Make sure each line has at least an LRN.');
      return;
    }

    try {
      const res = await fetch(`/api/sections/${session.section.id}/students/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: studentList })
      });

      if (res.ok) {
        setBulkLrnInput('');
        setUploadSuccess(prev => ({ ...prev, students: true }));
        fetchSectionData();
        setTimeout(() => setUploadSuccess(prev => ({ ...prev, students: false })), 3000);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload student roster.');
      }
    } catch (err) {
      console.error('Error bulk uploading students:', err);
    }
  };

  // Bulk Candidate Parse and upload
  const handleBulkCandidateUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !bulkCandInput.trim()) return;

    // Parse: CSV format
    // Format: Full Name, Child Name, Income Source (Employment/Business/Other/None), Income Details
    const lines = bulkCandInput.split('\n');
    const parsedCandidates: any[] = [];

    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split(',');
      const fullname = parts[0]?.trim();
      const child_name = parts[1]?.trim();
      const income_source = (parts[2]?.trim() || 'None') as 'Business' | 'Employment' | 'Other' | 'None';
      const income_details = parts[3]?.trim() || '';

      if (fullname && child_name) {
        parsedCandidates.push({
          fullname,
          child_name,
          income_source,
          income_details
        });
      }
    });

    if (parsedCandidates.length === 0) {
      alert('Could not parse any candidates. Verify the format is correct (FullName, ChildName, IncomeSource, IncomeDetails).');
      return;
    }

    try {
      const res = await fetch(`/api/sections/${session.section.id}/candidates/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: parsedCandidates })
      });

      if (res.ok) {
        setBulkCandInput('');
        setUploadSuccess(prev => ({ ...prev, candidates: true }));
        fetchSectionData();
        setTimeout(() => setUploadSuccess(prev => ({ ...prev, candidates: false })), 3000);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to bulk upload candidates.');
      }
    } catch (err) {
      console.error('Bulk candidate upload error:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" id="adviser-portal-root">
      {!session ? (
        // Passcode login card
        <div className="max-w-md mx-auto bg-white rounded-[32px] shadow-sm border border-[#e2e8f0] p-8 mt-12">
          <div className="text-center mb-6">
            <div className="mb-4">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Ramon_Magsaysay_%28Cubao%29_High_School.svg/500px-Ramon_Magsaysay_%28Cubao%29_High_School.svg.png" 
                alt="Ramon Magsaysay (Cubao) High School Logo" 
                className="w-16 h-16 mx-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#1e3a8a] tracking-tight">Homeroom Adviser Access</h2>
            <p className="text-sm text-[#475569] mt-1 font-sans">Enter your unique 4-digit room passcode assigned by your PTA organizer.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-widest mb-1.5 font-mono">Classroom Passcode</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••"
                  className="w-full text-center text-lg font-mono tracking-widest border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a]"
                />
                <Key className="absolute left-3 top-3.5 text-[#475569] w-5 h-5 pointer-events-none" />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-lg font-semibold border border-amber-100 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loadingSession}
              className="w-full bg-[#1e3a8a] hover:bg-[#172554] disabled:bg-[#475569] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {loadingSession ? 'Verifying Room...' : 'Authorize Room'}
            </button>
          </form>
        </div>
      ) : (
        // Adviser Room Dashboard
        <div className="space-y-6">
          {/* Adviser Header */}
          <div className="bg-gradient-to-r from-[#1e3a8a] to-[#172554] text-white rounded-[32px] p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Ramon_Magsaysay_%28Cubao%29_High_School.svg/500px-Ramon_Magsaysay_%28Cubao%29_High_School.svg.png" 
                alt="School watermark logo" 
                className="w-48 h-48 object-contain"
              />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] bg-[#d4af37] text-[#0f172a] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full inline-block mb-1.5">Homeroom Room Desk</span>
              <h1 className="text-2xl font-serif font-bold tracking-tight">
                {session.section.grade_level} - {session.section.section_name}
              </h1>
              <p className="text-xs text-[#f1f5f9]/80 mt-1">
                Adviser: <span className="font-semibold text-white">{session.section.adviser_name}</span> | Election: <span className="text-white italic">{session.election.title}</span>
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-3 self-stretch md:self-auto justify-between border-t border-[#172554] md:border-transparent pt-4 md:pt-0">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                session.election.status === 'active' ? 'bg-[#e2e8f0]/20 text-white border border-[#e2e8f0]/30' : 'bg-[#172554] text-[#475569]'
              }`}>
                {session.election.status === 'active' ? 'Election Open' : 'Voting Closed'}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs font-bold text-[#f1f5f9] hover:text-white bg-[#172554]/40 hover:bg-[#172554]/60 border border-[#172554] px-3.5 py-2 rounded-lg transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout Room
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider block">Candidate Pool</span>
                <span className="text-3xl font-serif text-[#1e3a8a] mt-1 block">{candidates.length} parents</span>
              </div>
              <div className="w-10 h-10 bg-[#f1f5f9] text-[#1e3a8a] rounded-xl border border-[#e2e8f0] flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider block">Registered Roster</span>
                <span className="text-3xl font-serif text-[#1e3a8a] mt-1 block">{students.length} students</span>
              </div>
              <div className="w-10 h-10 bg-[#f1f5f9] text-[#1e3a8a] rounded-xl border border-[#e2e8f0] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-[24px] border border-[#e2e8f0] p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider block">Voter turnout</span>
                <span className="text-3xl font-serif text-[#1e3a8a] mt-1 block">
                  {students.filter(s => s.has_voted).length} / {students.length} ({students.length > 0 ? Math.round((students.filter(s => s.has_voted).length / students.length) * 100) : 0}%)
                </span>
              </div>
              <div className="w-10 h-10 bg-[#f1f5f9] text-[#1e3a8a] rounded-xl border border-[#e2e8f0] flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex border-b border-[#e2e8f0] gap-6">
            <button
              onClick={() => setActivePortalTab('candidates')}
              className={`pb-3 font-serif font-bold text-sm tracking-tight border-b-2 transition-all ${
                activePortalTab === 'candidates'
                  ? 'border-[#1e3a8a] text-[#1e3a8a]'
                  : 'border-transparent text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              Candidates Pool ({candidates.length})
            </button>
            <button
              onClick={() => setActivePortalTab('students')}
              className={`pb-3 font-serif font-bold text-sm tracking-tight border-b-2 transition-all ${
                activePortalTab === 'students'
                  ? 'border-[#1e3a8a] text-[#1e3a8a]'
                  : 'border-transparent text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              Authentication student roster ({students.length})
            </button>
            <button
              onClick={() => setActivePortalTab('results')}
              className={`pb-3 font-serif font-bold text-sm tracking-tight border-b-2 transition-all ${
                activePortalTab === 'results'
                  ? 'border-[#1e3a8a] text-[#1e3a8a]'
                  : 'border-transparent text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              Classroom Live Results
            </button>
          </div>

          {/* Tab 1: Candidates Management */}
          {activePortalTab === 'candidates' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form to add candidate */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white border border-[#e2e8f0] rounded-[24px] p-6 shadow-sm">
                  <h3 className="font-serif font-bold text-[#1e3a8a] text-base mb-4 flex items-center gap-1.5">
                    <Plus className="w-5 h-5 text-[#1e3a8a]" /> Nominate Parent Candidate
                  </h3>

                  <form onSubmit={handleCreateCandidate} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Parent's FULLNAME</label>
                      <input
                        type="text"
                        required
                        value={candName}
                        onChange={(e) => setCandName(e.target.value)}
                        placeholder="e.g., Juan dela Cruz"
                        className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] text-[#0f172a]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Name of His/Her Child</label>
                      <input
                        type="text"
                        required
                        value={candChild}
                        onChange={(e) => setCandChild(e.target.value)}
                        placeholder="e.g., Pedro dela Cruz"
                        className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] text-[#0f172a]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Candidate Picture</label>
                      <div className="flex items-center gap-4">
                        <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed border-[#e2e8f0] hover:border-[#1e3a8a] rounded-xl p-3 text-sm text-[#475569] hover:text-[#1e3a8a] transition-all bg-[#f8fafc]">
                          <ImageIcon className="w-5 h-5" />
                          <span>{candidatePicture ? 'Change Picture' : 'Upload Picture'}</span>
                          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                        {candidatePicture && (
                          <img src={candidatePicture} alt="Preview" className="w-12 h-12 rounded-xl object-cover" />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Source of Income</label>
                      <select
                        value={candIncomeSource}
                        onChange={(e: any) => setCandIncomeSource(e.target.value)}
                        className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] text-[#0f172a]"
                      >
                        <option value="Employment">Working (Employment)</option>
                        <option value="Business">Business (Owner)</option>
                        <option value="Other">Other</option>
                        <option value="None">None (N/A)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">
                        {candIncomeSource === 'Business' 
                          ? 'Name of the Business' 
                          : candIncomeSource === 'Employment'
                            ? 'Company Name & Designation'
                            : 'Income Details/Remarks'}
                      </label>
                      <input
                        type="text"
                        value={candIncomeDetails}
                        onChange={(e) => setCandIncomeDetails(e.target.value)}
                        placeholder={candIncomeSource === 'Business' ? 'e.g., Dela Cruz Bakery' : candIncomeSource === 'Employment' ? 'e.g., PLDT - Network Tech' : 'e.g., Freelance tutor'}
                        className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] text-[#0f172a]"
                        disabled={candIncomeSource === 'None'}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">Position to Run For</label>
                      <select
                        value={candPosition}
                        onChange={(e) => setCandPosition(e.target.value as Position)}
                        className="w-full text-sm border border-[#e2e8f0] bg-[#f8fafc] rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] text-[#0f172a]"
                      >
                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-xs"
                    >
                      Nominate Candidate
                    </button>
                  </form>
                </div>

                {/* Bulk nomination form */}
                <div className="bg-white border border-[#e2e8f0] rounded-[24px] p-6 shadow-sm">
                  <h3 className="font-serif font-bold text-[#1e3a8a] text-base mb-2 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-5 h-5 text-[#1e3a8a]" /> Excel / CSV Bulk Candidate Upload
                  </h3>
                  <p className="text-xs text-[#475569] mb-4">Paste candidates comma-separated. One candidate per line.</p>
                  
                  <form onSubmit={handleBulkCandidateUpload} className="space-y-3">
                    <div className="bg-[#f1f5f9] rounded-xl p-3 border border-[#e2e8f0] text-[10px] text-[#475569] leading-normal font-mono mb-2">
                      <span className="font-bold text-[#0f172a] block mb-0.5">Format per line:</span>
                      FullName, ChildName, IncomeSource, IncomeDetails
                      <span className="font-bold text-[#0f172a] block mt-1.5 mb-0.5">Example:</span>
                      Juana Santos, Pedro Santos, Business, Santos Sari-sari Store<br/>
                      Rey Reyes, Amy Reyes, Employment, PLDT - Engineer
                    </div>
                    
                    <textarea
                      value={bulkCandInput}
                      onChange={(e) => setBulkCandInput(e.target.value)}
                      placeholder="Juana Santos, Pedro Santos, Business, Santos Sari-sari Store..."
                      rows={5}
                      className="w-full text-xs font-mono border border-[#e2e8f0] bg-[#f8fafc] rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] text-[#0f172a]"
                    />

                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 bg-[#0f172a] hover:bg-[#172554] text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
                    >
                      {uploadSuccess.candidates ? <Check className="w-4 h-4 text-emerald-400" /> : <UploadCloud className="w-4 h-4" />}
                      {uploadSuccess.candidates ? 'Imported!' : 'Import Candidate List'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Candidates list table */}
              <div className="lg:col-span-7 bg-white rounded-[24px] shadow-sm border border-[#e2e8f0] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
                  <h3 className="font-serif font-bold text-[#1e3a8a] text-base">Classroom Candidate Roster</h3>
                  <button onClick={fetchSectionData} className="text-[#1e3a8a] hover:text-[#172554] p-1.5 rounded-lg hover:bg-[#f8fafc]"><RefreshCw className="w-4 h-4" /></button>
                </div>

                {candidates.length === 0 ? (
                  <div className="py-16 text-center text-[#475569]">
                    <UserCheck className="w-12 h-12 text-[#f1f5f9] mx-auto mb-3" />
                    <p className="font-bold text-[#1e3a8a]">No candidates nominated yet.</p>
                    <p className="text-xs mt-0.5">Use the panels on the left to nominate parent volunteers.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#f1f5f9] max-h-[620px] overflow-y-auto">
                    {candidates.map((c) => (
                      <div key={c.id} className="p-4 flex items-start justify-between hover:bg-[#f8fafc] transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {c.picture_data && (
                              <img 
                                src={c.picture_data} 
                                alt={c.fullname} 
                                className="w-10 h-10 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-[#1e3a8a] transition-all"
                                onClick={() => setEnlargedImage(c.picture_data)}
                              />
                            )}
                            <span className="font-bold text-[#0f172a]">{c.fullname}</span>
                            <span className="text-[10px] font-bold uppercase bg-[#f1f5f9] text-[#1e3a8a] border border-[#e2e8f0] px-2.5 py-0.5 rounded-full">
                              Nominee
                            </span>
                          </div>
                          <div className="text-xs text-[#475569] space-y-0.5">
                            <p>Child: <span className="font-bold text-[#0f172a]">{c.child_name}</span></p>
                            <p className="flex items-center gap-1">
                              <Briefcase className="w-3.5 h-3.5 text-[#475569]/80 inline" />
                              <span>
                                Income: {c.income_source} 
                                {c.income_details && ` (${c.income_details})`}
                              </span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCandidate(c.id)}
                          className="text-[#475569] hover:text-red-600 p-2 rounded-lg hover:bg-[#f1f5f9] transition-all shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: LRN Roster Management */}
          {activePortalTab === 'students' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Upload panel */}
              <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-[24px] p-6 shadow-sm h-fit">
                <h3 className="font-serif font-bold text-[#1e3a8a] text-base mb-2 flex items-center gap-1.5">
                  <UploadCloud className="w-5 h-5 text-[#1e3a8a]" /> Roster / LRN Batch Import
                </h3>
                <p className="text-xs text-[#475569] mb-4 font-sans font-medium">
                  Upload your student list. Parents will authenticate their voter access using their child's 12-digit Learner Reference Number (LRN).
                </p>

                <form onSubmit={handleBulkStudentUpload} className="space-y-4">
                  <div className="bg-[#f1f5f9] rounded-xl p-3 border border-[#e2e8f0] text-[10px] text-[#475569] leading-normal font-mono">
                    <span className="font-bold text-[#0f172a] block mb-1">Format (Excel Copy-Paste Ready):</span>
                    One student per line. Commas separate the LRN and Student Name.<br/>
                    <strong>LRN, StudentName</strong>
                    <span className="font-bold text-[#0f172a] block mt-2">Example:</span>
                    101112131415, Antonio Santos Jr.<br/>
                    101112131416, Angelica Cruz
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1 font-mono">LRN & Student Name List</label>
                    <textarea
                      value={bulkLrnInput}
                      onChange={(e) => setBulkLrnInput(e.target.value)}
                      placeholder="101112131415, Antonio Santos Jr."
                      rows={10}
                      className="w-full text-xs font-mono border border-[#e2e8f0] bg-[#f8fafc] rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] text-[#0f172a]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-xs"
                  >
                    {uploadSuccess.students ? <Check className="w-4 h-4 text-emerald-400" /> : <UploadCloud className="w-4 h-4" />}
                    {uploadSuccess.students ? 'Roster Synced!' : 'Verify and Import Roster'}
                  </button>
                </form>
              </div>

              {/* Roster list */}
              <div className="lg:col-span-7 bg-white rounded-[24px] shadow-sm border border-[#e2e8f0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
                  <h3 className="font-serif font-bold text-[#1e3a8a] text-base">Authorized Student Roster ({students.length})</h3>
                  <button onClick={fetchSectionData} className="text-[#1e3a8a] hover:text-[#172554] p-1.5 rounded-lg hover:bg-[#f8fafc]"><RefreshCw className="w-4 h-4" /></button>
                </div>

                {students.length === 0 ? (
                  <div className="py-20 text-center text-[#475569]">
                    <Users className="w-12 h-12 text-[#f1f5f9] mx-auto mb-3" />
                    <p className="font-bold text-[#1e3a8a]">No student roster uploaded yet.</p>
                    <p className="text-xs mt-0.5">Import your students using the LRN spreadsheet tool on the left.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[580px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#f8fafc] text-[#475569] text-xs font-bold uppercase tracking-widest font-mono">
                          <th className="px-6 py-4 border-b border-[#f1f5f9]">Student Name</th>
                          <th className="px-6 py-4 border-b border-[#f1f5f9]">Voter Key (LRN)</th>
                          <th className="px-6 py-4 border-b border-[#f1f5f9] text-right">Voting Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9] text-sm text-[#0f172a]">
                        {students.map((student) => (
                          <tr key={student.id} className="hover:bg-[#f8fafc] transition-colors">
                            <td className="px-6 py-3.5 font-bold text-[#0f172a]">{student.student_name}</td>
                            <td className="px-6 py-3.5 font-mono text-[#475569] select-all">{student.lrn}</td>
                            <td className="px-6 py-3.5 text-right">
                              <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg border ${
                                student.has_voted 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {student.has_voted ? 'Voted' : 'Not Voted'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Real-Time Live Results */}
          {activePortalTab === 'results' && (
            <div className="bg-white rounded-[32px] shadow-sm border border-[#e2e8f0] p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-[#f1f5f9]">
                <div>
                  <h3 className="font-serif font-bold text-[#1e3a8a] text-xl flex items-center gap-1.5">
                    <BarChart3 className="text-[#1e3a8a] w-5 h-5" /> HRPTA Election Live Room Results
                  </h3>
                  <p className="text-xs text-[#475569]">Secure real-time votes are calculated on-the-fly and refreshed dynamically.</p>
                </div>
                <button
                  onClick={fetchSectionData}
                  className="flex items-center gap-1.5 bg-[#f1f5f9] hover:bg-[#cbd5e1] text-[#1e3a8a] text-xs font-bold px-3 py-1.5 rounded-lg transition-all border border-[#e2e8f0]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Results
                </button>
              </div>

              {candidates.length === 0 ? (
                <div className="py-16 text-center text-[#475569]">
                  No candidates have been nominated yet, so no results can be logged.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {POSITIONS.map((position) => {
                    // Calculate total votes for this position
                    const positionVotesMap = (results?.positions?.[position] || {}) as Record<string, number>;
                    const totalPosVotes = Object.values(positionVotesMap).reduce((a, b) => a + b, 0);

                    // Sort candidates by their vote count for this position
                    const sortedCandidatesForPos = [...candidates].sort((a, b) => {
                      const votesA = positionVotesMap[a.id] || 0;
                      const votesB = positionVotesMap[b.id] || 0;
                      return votesB - votesA;
                    });

                    return (
                      <div key={position} className="bg-[#f8fafc] rounded-2xl p-5 border border-[#e2e8f0] shadow-2xs">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#f1f5f9]">
                          <h4 className="font-serif font-bold text-[#1e3a8a] text-sm tracking-tight">{position}</h4>
                          <span className="text-[10px] bg-[#cbd5e1] text-[#1e3a8a] border border-[#1e3a8a]/10 font-serif font-bold px-2.5 py-0.5 rounded-full">
                            {totalPosVotes} votes cast
                          </span>
                        </div>

                        <div className="space-y-4">
                          {sortedCandidatesForPos.map((c) => {
                            const count = positionVotesMap[c.id] || 0;
                            const percentage = totalPosVotes > 0 ? Math.round((count / totalPosVotes) * 100) : 0;

                            return (
                              <div key={c.id} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <div>
                                    <span className="font-bold text-[#0f172a] block">{c.fullname}</span>
                                    <span className="text-[10px] text-[#475569] block -mt-0.5">Child: {c.child_name}</span>
                                  </div>
                                  <span className="font-bold text-[#0f172a] font-mono text-sm">{count} votes ({percentage}%)</span>
                                </div>
                                <div className="w-full bg-[#f1f5f9] rounded-full h-2">
                                  <div 
                                    className="h-2 rounded-full bg-[#1e3a8a] transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {enlargedImage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setEnlargedImage(null)}>
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={enlargedImage}
            alt="Enlarged"
            className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl"
          />
        </div>
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="confirm-modal-overlay">
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
    </div>
  );
}
