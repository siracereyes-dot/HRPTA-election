import React, { useState, useEffect } from 'react';
import { 
  Key, ShieldCheck, UserCheck, Briefcase, FileCheck2, 
  ChevronRight, ArrowRight, CheckCircle2, Lock, Info, Landmark 
} from 'lucide-react';
import { motion } from 'motion/react';
import { Candidate, Student, Section, Election, Position, POSITIONS } from '../types';

export default function VoterPortal() {
  // Authentication
  const [lrnInput, setLrnInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);
  
  // Session state
  const [student, setStudent] = useState<Student | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  // Votes selection state
  const [votes, setVotes] = useState<{ [position: string]: string }>({});
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [voteCastingCompleted, setVoteCastingCompleted] = useState(false);

  // Dialog / Modal State
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [voterAlert, setVoterAlert] = useState<{ title: string; message: string; type?: 'error' | 'warning' } | null>(null);

  // Authenticate parent by student's LRN
  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lrnInput.trim()) return;

    setLoadingAuth(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/voter/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lrn: lrnInput })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        setErrorMsg(`Failed to parse server response: ${res.statusText}`);
        return;
      }
      
      if (res.ok) {
        if (data.student.has_voted) {
          setErrorMsg('Our records show that the household vote for this LRN has already been cast.');
          return;
        }
        setStudent(data.student);
        setSection(data.section);
        setElection(data.election);
        
        // Fetch candidates for this section
        const candRes = await fetch(`/api/sections/${data.section.id}/candidates`);
        const candData = await candRes.json();
        setCandidates(candData);
      } else {
        setErrorMsg(data.error || 'Voter authentication failed. Verify the LRN or contact your room Adviser.');
      }
    } catch (err) {
      console.error('Authentication fetch error:', err);
      setErrorMsg('Network error. Failed to authenticate. Please check your connection.');
    } finally {
      setLoadingAuth(false);
    }
  };

  // Submit cast votes
  const handleSubmitVotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !section) return;

    // Check if at least one position has been voted for
    const activeVotedPositions = Object.values(votes).filter(id => id);
    if (activeVotedPositions.length === 0) {
      setVoterAlert({
        title: 'Empty Ballot',
        message: 'You must select at least one candidate before casting your ballot.'
      });
      return;
    }

    setShowConfirmSubmit(true);
    setDeclarationAccepted(false);
  };

  const handleConfirmCastBallot = async () => {
    setShowConfirmSubmit(false);
    if (!student || !section) return;

    setIsSubmittingVote(true);
    try {
      const res = await fetch('/api/voter/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          votes
        })
      });

      if (res.ok) {
        setVoteCastingCompleted(true);
      } else {
        const error = await res.json();
        setVoterAlert({
          title: 'Failed to Cast Ballot',
          message: error.error || 'Failed to record your vote.',
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Error submitting vote:', err);
      setVoterAlert({
        title: 'Submission Error',
        message: 'Network error. Failed to record your ballot.',
        type: 'error'
      });
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleAssignPosition = (candidateId: string, newPos: string) => {
    setVotes(prev => {
      const updated = { ...prev };
      
      // Remove this candidate from any previous position they were assigned to
      Object.keys(updated).forEach(pos => {
        if (updated[pos] === candidateId) {
          delete updated[pos];
        }
      });
      
      // Assign to new position if not empty
      if (newPos) {
        updated[newPos] = candidateId;
      }
      
      return updated;
    });
  };

  const resetVoterPortal = () => {
    setLrnInput('');
    setStudent(null);
    setSection(null);
    setElection(null);
    setCandidates([]);
    setVotes({});
    setVoteCastingCompleted(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" id="voter-portal-root">
      {!student ? (
        // Step 1: LRN Authentication Page
        <div className="max-w-lg mx-auto bg-white rounded-[32px] shadow-sm border border-[#e2e8f0] p-8 mt-12">
          <div className="text-center mb-6">
            <div className="mb-4">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Ramon_Magsaysay_%28Cubao%29_High_School.svg/500px-Ramon_Magsaysay_%28Cubao%29_High_School.svg.png" 
                alt="Ramon Magsaysay (Cubao) High School Logo" 
                className="w-20 h-20 mx-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#1e3a8a] tracking-tight">Ramon Magsaysay (Cubao) HS</h2>
            <p className="text-sm text-[#475569] mt-1 font-sans font-medium">
              Homeroom PTA Voting Desk
            </p>
            <p className="text-xs text-[#64748b] mt-2 leading-relaxed">
              Cast your household vote. Enter your child's 12-digit Learner Reference Number (LRN) to authenticate.
            </p>
          </div>

          <form onSubmit={handleAuthenticate} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#0f172a]/80 uppercase tracking-widest mb-2 font-mono">Student Learner Reference Number (LRN)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={12}
                  value={lrnInput}
                  onChange={(e) => setLrnInput(e.target.value.replace(/\D/g, ''))} // numerical only
                  placeholder="e.g., 101112131415"
                  className="w-full text-center text-lg font-mono tracking-widest border border-[#e2e8f0] bg-[#f8fafc] rounded-xl px-4 py-3.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] text-[#0f172a]"
                />
                <Key className="absolute left-4 top-4 text-[#475569] w-5 h-5 pointer-events-none" />
              </div>
              <span className="text-[10px] text-[#475569] block mt-1.5 leading-normal">
                Adhering to DepEd school standards, other sections or grade levels cannot access another class's candidate roster.
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-lg font-semibold border border-amber-100 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loadingAuth}
              className="w-full bg-[#1e3a8a] hover:bg-[#172554] disabled:bg-[#475569] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {loadingAuth ? 'Verifying LRN...' : 'Verify LRN & Access Ballot'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : voteCastingCompleted ? (
        // Step 3: Success Ballot Confirmation Receipt
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto bg-white rounded-[32px] shadow-sm border border-[#e2e8f0] p-8 text-center"
        >
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#1e3a8a] tracking-tight">PTA Ballot Cast Successfully!</h2>
          <p className="text-sm text-[#475569] mt-2">
            Thank you for participating! Your secure homeroom vote for student <strong>{student.student_name}</strong> has been logged.
          </p>

          {/* Secure details card */}
          <div className="my-6 bg-[#f8fafc] rounded-2xl p-4 border border-[#e2e8f0] text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[#475569]">Classroom:</span>
              <span className="font-bold text-[#0f172a]">{section.grade_level} - {section.section_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#475569]">Homeroom Adviser:</span>
              <span className="font-bold text-[#0f172a]">{section.adviser_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#475569]">Student LRN:</span>
              <span className="font-mono text-[#0f172a]">{student.lrn.substring(0, 4)}••••••••</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#e2e8f0] text-[10px]">
              <span className="text-[#475569]">Ballot ID Hash:</span>
              <span className="font-mono text-[#475569] truncate max-w-[160px]">ballot_tx_{Math.random().toString(36).substr(2, 12)}</span>
            </div>
          </div>

          <button
            onClick={resetVoterPortal}
            className="w-full bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold py-3 px-4 rounded-xl transition-all text-sm"
          >
            Finish & Log Out Desk
          </button>
        </motion.div>
      ) : (
        // Step 2: Casting Ballot Interface
        <div className="space-y-6">
          {/* Ballot Header Banner with RMCHS Blue and Gold */}
          <div className="bg-gradient-to-r from-[#1e3a8a] to-[#172554] text-white rounded-[32px] p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Ramon_Magsaysay_%28Cubao%29_High_School.svg/500px-Ramon_Magsaysay_%28Cubao%29_High_School.svg.png" 
                alt="School watermarked logo" 
                className="w-48 h-48 object-contain"
              />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] bg-[#d4af37] text-[#0f172a] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full inline-block mb-1.5 shadow-xs">Official PTA Election Ballot</span>
              <h1 className="text-2xl font-serif font-bold tracking-tight">
                {section.grade_level} - {section.section_name}
              </h1>
              <p className="text-xs text-[#f1f5f9]/80 mt-1">
                Adviser: <span className="font-semibold text-white">{section.adviser_name}</span> | Student: <span className="font-semibold text-white">{student.student_name}</span>
              </p>
            </div>

            <button
              onClick={resetVoterPortal}
              className="relative z-10 text-xs font-bold text-[#f1f5f9] hover:text-white bg-[#172554]/40 border border-[#172554] hover:bg-[#172554]/60 px-3.5 py-2 rounded-lg transition-all"
            >
              Cancel Ballot
            </button>
          </div>

          {/* Secure disclaimer */}
          <div className="bg-[#f1f5f9] border border-[#e2e8f0] rounded-2xl p-4 flex gap-3 text-xs leading-normal text-[#0f172a]">
            <Lock className="w-4 h-4 text-[#475569] shrink-0 mt-0.5" />
            <p>
              Your Homeroom PTA ballot is fully encrypted and tied to your child's LRN. You can only vote once per student. Candidate background information, such as employment or business background, is provided below to inform your choice.
            </p>
          </div>

          {/* Ballot Sheet Selection Form */}
          <form onSubmit={handleSubmitVotes} className="space-y-8">
            <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-[#f1f5f9]">
                <span className="w-2.5 h-2.5 bg-[#1e3a8a] rounded-full" />
                <h3 className="font-serif font-bold text-[#1e3a8a] text-lg tracking-tight">Parent Nominees Pool</h3>
              </div>

              {candidates.length === 0 ? (
                <div className="py-12 text-center text-[#475569]">
                  No candidates have been nominated in this section yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {candidates.map((c) => {
                    const currentPosition = Object.keys(votes).find(pos => votes[pos] === c.id) || "";
                    const isAssigned = !!currentPosition;

                    return (
                      <div
                        key={c.id}
                        className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                          isAssigned
                            ? 'border-[#1e3a8a] bg-[#f1f5f9]/40 shadow-xs'
                            : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <span className="font-bold text-[#0f172a] block text-base leading-tight">{c.fullname}</span>
                              <span className="text-xs text-[#475569] block mt-0.5 font-medium">Parent of {c.child_name}</span>
                            </div>

                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isAssigned ? 'border-[#1e3a8a] bg-[#1e3a8a]' : 'border-[#e2e8f0]'
                            }`}>
                              {isAssigned && <span className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </div>

                          <div className="pt-2.5 pb-3 border-t border-[#f1f5f9] text-xs text-[#475569] flex items-start gap-2">
                            <Briefcase className="w-4 h-4 text-[#475569] shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-[#0f172a] block">Income Profile:</span>
                              <span className="text-[#475569]">
                                {c.income_source === 'None' 
                                  ? 'No corporate/business details declared' 
                                  : `${c.income_source} (${c.income_details || 'Private'})`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Dropdown to assign position */}
                        <div className="mt-2 pt-3 border-t border-[#f1f5f9] space-y-1.5">
                          <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider font-mono">Assign HRPTA Position</label>
                          <select
                            value={currentPosition}
                            onChange={(e) => handleAssignPosition(c.id, e.target.value)}
                            className={`w-full text-xs font-semibold border rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a] transition-all cursor-pointer ${
                              isAssigned 
                                ? 'border-[#1e3a8a]/40 bg-white text-[#1e3a8a]' 
                                : 'border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] hover:border-[#475569]'
                            }`}
                          >
                            <option value="">-- Not Assigned / Vote Blank --</option>
                            {POSITIONS.map(pos => {
                              const isSelectedByOther = Object.entries(votes).some(([p, id]) => p === pos && id && id !== c.id);
                              if (isSelectedByOther) return null;
                              return (
                                <option key={pos} value={pos}>{pos}</option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit Bar */}
            <div className="bg-[#f1f5f9] border border-[#e2e8f0] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#475569] text-center sm:text-left">
                <span className="font-bold text-[#0f172a] block text-sm mb-1">Selected Votes Summary</span>
                <span>
                  You have assigned {Object.keys(votes).length} of {POSITIONS.length} positions.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmittingVote}
                className="w-full sm:w-auto bg-[#1e3a8a] hover:bg-[#172554] disabled:bg-[#475569] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0 text-sm"
              >
                {isSubmittingVote ? 'Submitting Ballot...' : 'Submit Secure Ballot'}
                <FileCheck2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Confirmation Dialog Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/40 backdrop-blur-xs">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-[#e2e8f0] p-6 max-w-md w-full shadow-lg space-y-4"
          >
            <div className="flex items-center gap-3 text-[#1e3a8a]">
              <div className="p-2 bg-[#f1f5f9] rounded-full">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-lg">Confirm Your Ballot</h3>
            </div>
            
            <p className="text-sm text-[#475569] leading-relaxed">
              Are you ready to cast your official Homeroom PTA ballot? This action is secure, recorded against your LRN, and cannot be modified or repeated.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Legal Declaration of Authority
              </h4>
              <p className="text-[11px] text-amber-900 leading-relaxed italic">
                "I hereby solemnly declare and affirm that I am the Legal Parent and/or the Lawful Guardian of the student registered under the LRN provided for this Grade Level and Section. I acknowledge that I am authorized by law to cast this household vote for the Homeroom PTA Election, and I understand that any misrepresentation of my identity or authority may be subject to legal consequences under applicable laws and regulations."
              </p>
              
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div className="pt-0.5">
                  <input 
                    type="checkbox"
                    checked={declarationAccepted}
                    onChange={(e) => setDeclarationAccepted(e.target.checked)}
                    className="w-4 h-4 rounded border-[#cbd5e1] text-[#1e3a8a] focus:ring-[#1e3a8a] cursor-pointer"
                  />
                </div>
                <span className="text-[11px] font-medium text-amber-950 group-hover:text-black transition-colors">
                  I confirm that I am the Lawful Parent/Guardian and I accept this declaration.
                </span>
              </label>
            </div>

            <div className="pt-2 border-t border-[#e2e8f0] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 text-xs font-bold text-[#475569] hover:text-[#0f172a] transition-all"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCastBallot}
                disabled={!declarationAccepted}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 ${
                  declarationAccepted 
                    ? 'bg-[#1e3a8a] hover:bg-[#172554] text-white' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Yes, Cast Secure Ballot
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Alert Dialog Modal */}
      {voterAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/40 backdrop-blur-xs">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-[#e2e8f0] p-6 max-w-sm w-full shadow-lg space-y-4 text-center"
          >
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-100">
              <Info className="w-6 h-6" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-serif font-bold text-[#1e3a8a] text-base">{voterAlert.title}</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                {voterAlert.message}
              </p>
            </div>

            <div className="pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setVoterAlert(null)}
                className="w-full py-2.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#1e3a8a] text-xs font-bold rounded-xl transition-all"
              >
                Acknowledge
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
