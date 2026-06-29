import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Landmark, ShieldAlert, Award, FileSpreadsheet, Lock } from 'lucide-react';

import AdminPortal from './components/AdminPortal';
import AdviserPortal from './components/AdviserPortal';
import VoterPortal from './components/VoterPortal';

type PortalType = 'voter' | 'adviser' | 'admin';

export default function App() {
  const [activePortal, setActivePortal] = useState<PortalType>('voter');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans flex flex-col justify-between" id="app-viewport">
      {/* App Shell Header */}
      <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* School Branding Logo / Title */}
            <div className="flex items-center gap-3">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Ramon_Magsaysay_%28Cubao%29_High_School.svg/500px-Ramon_Magsaysay_%28Cubao%29_High_School.svg.png" 
                alt="Ramon Magsaysay (Cubao) High School Logo" 
                className="w-11 h-11 object-contain"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="font-serif font-bold text-[#1e3a8a] tracking-tight text-base sm:text-lg block leading-tight">
                  Ramon Magsaysay (Cubao) HS
                </span>
                <span className="text-[10px] text-[#475569] font-mono block -mt-0.5 tracking-wider uppercase font-bold">
                  Homeroom PTA Election Desk
                </span>
              </div>
            </div>

            {/* Portal Switcher Navigation */}
            <nav className="flex bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
              <button
                onClick={() => setActivePortal('voter')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activePortal === 'voter'
                    ? 'bg-[#1e3a8a] text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                Voter Desk
              </button>
              <button
                onClick={() => setActivePortal('adviser')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activePortal === 'adviser'
                    ? 'bg-[#1e3a8a] text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                Adviser Portal
              </button>
              <button
                onClick={() => setActivePortal('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activePortal === 'admin'
                    ? 'bg-[#1e3a8a] text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                Admin Organizer
              </button>
            </nav>

          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 bg-[#f8fafc]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePortal}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full"
          >
            {activePortal === 'voter' && <VoterPortal />}
            {activePortal === 'adviser' && <AdviserPortal />}
            {activePortal === 'admin' && <AdminPortal />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Standard Footer */}
      <footer className="bg-[#f1f5f9] border-t border-[#e2e8f0] py-6 mt-12 text-xs text-[#475569]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-semibold uppercase tracking-[0.05em]">
          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
            <Lock className="w-3.5 h-3.5 text-[#475569]" />
            <span>Secure PTA ballot box conforming to DepEd voter isolation rules.</span>
          </div>
          <div>
            <span>Homeroom PTA voting console &copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
