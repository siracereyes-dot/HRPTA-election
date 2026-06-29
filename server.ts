import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { POSITIONS } from './src/types';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Supabase configuration
const cleanEnvVar = (val: string | undefined) => {
  if (!val) return '';
  let cleaned = val.trim();
  cleaned = cleaned.replace(/^['"]|['"]$/g, '');
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/\/+$/, ''); // strip trailing slashes
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, ''); // strip /rest/v1 or /rest/v1/
  cleaned = cleaned.replace(/\/+$/, ''); // strip trailing slashes again
  return cleaned.trim();
};

const supabaseUrl = cleanEnvVar(process.env.SUPABASE_URL) || 'https://ndtnlsdorhpmyspzjpfg.supabase.co';
const supabaseKey = cleanEnvVar(process.env.SUPABASE_ANON_KEY);

console.log('SUPABASE_URL raw:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY raw length:', process.env.SUPABASE_ANON_KEY?.length);
console.log('supabaseUrl cleaned:', supabaseUrl);
console.log('supabaseKey cleaned length:', supabaseKey?.length);

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

// In-Memory Database (Realistic Sandbox Fallback)
let mockElections: any[] = [
  { id: 'e1', title: 'PTA Election SY 2026-2027', status: 'active', created_at: new Date().toISOString() }
];

let mockSections: any[] = [
  { id: 's1', election_id: 'e1', grade_level: 'Grade 7', section_name: 'Amber', adviser_name: 'Mrs. Sarah Miller', adviser_passcode: '1234', created_at: new Date().toISOString() },
  { id: 's2', election_id: 'e1', grade_level: 'Grade 7', section_name: 'Birch', adviser_name: 'Mr. Robert Davis', adviser_passcode: '5678', created_at: new Date().toISOString() },
  { id: 's3', election_id: 'e1', grade_level: 'Grade 8', section_name: 'Cedar', adviser_name: 'Miss Clara Jones', adviser_passcode: '4321', created_at: new Date().toISOString() }
];

let mockCandidates: any[] = [
  // Section Amber
  { id: 'c1', section_id: 's1', fullname: 'Antonio Santos Sr.', child_name: 'Antonio Santos Jr.', income_source: 'Employment', income_details: 'Meralco - Senior Engineer', position: 'President' },
  { id: 'c2', section_id: 's1', fullname: 'Maria Leonor Cruz', child_name: 'Angelica Cruz', income_source: 'Business', income_details: 'Cruz Mini-Mart - Owner', position: 'President' },
  { id: 'c3', section_id: 's1', fullname: 'Joseph Reyes', child_name: 'Mark Reyes', income_source: 'Employment', income_details: 'PLDT - Technician', position: 'Vice President' },
  { id: 'c4', section_id: 's1', fullname: 'Grace Dela Cruz', child_name: 'John Dela Cruz', income_source: 'Other', income_details: 'Freelance Writer', position: 'Secretary' },
  { id: 'c5', section_id: 's1', fullname: 'Fernando Jose', child_name: 'Therese Jose', income_source: 'Business', income_details: 'Jose Bakery', position: 'Treasurer' },
  { id: 'c6', section_id: 's1', fullname: 'Christina Almeda', child_name: 'Christian Almeda', income_source: 'None', income_details: 'Full-time Parent', position: 'Auditor' },
  
  // Section Birch
  { id: 'c201', section_id: 's2', fullname: 'David Vance', child_name: 'James Vance', income_source: 'Employment', income_details: 'BPI - Bank Teller', position: 'President' },
  { id: 'c202', section_id: 's2', fullname: 'Jane Carter', child_name: 'Sarah Carter', income_source: 'Business', income_details: 'Carter Tailoring', position: 'President' }
];

let mockStudents: any[] = [
  // Section Amber (s1) - LRNS
  { id: 'st1', section_id: 's1', lrn: '101112131415', student_name: 'Antonio Santos Jr.', has_voted: false, voted_at: null },
  { id: 'st2', section_id: 's1', lrn: '101112131416', student_name: 'Angelica Cruz', has_voted: false, voted_at: null },
  { id: 'st3', section_id: 's1', lrn: '101112131417', student_name: 'Mark Reyes', has_voted: false, voted_at: null },
  { id: 'st4', section_id: 's1', lrn: '101112131418', student_name: 'John Dela Cruz', has_voted: false, voted_at: null },
  { id: 'st5', section_id: 's1', lrn: '101112131419', student_name: 'Therese Jose', has_voted: false, voted_at: null },
  { id: 'st6', section_id: 's1', lrn: '101112131420', student_name: 'Christian Almeda', has_voted: false, voted_at: null },
  { id: 'st7', section_id: 's1', lrn: '101112131421', student_name: 'Raymond Valenzuela', has_voted: false, voted_at: null },
  { id: 'st8', section_id: 's1', lrn: '101112131422', student_name: 'Elise Garcia', has_voted: false, voted_at: null }
];

let mockVotes: any[] = [];

// Helper to determine if we should use Supabase or mock
let useSupabaseMode = false;

// Check database status and tables
async function checkSupabaseStatus() {
  if (!supabase) {
    useSupabaseMode = false;
    return { configured: false, connected: false, error: 'Supabase client not initialized (missing environment variables)' };
  }

  try {
    // Simple test query
    const { data, error } = await supabase.from('hrpta_elections').select('id').limit(1);
    if (error) {
      if (error.code === 'P0001' || error.message?.includes('does not exist')) {
        useSupabaseMode = false;
        return { configured: true, connected: true, tablesExist: false, error: 'Database connected, but hrpta_elections table does not exist. Please run the migration SQL.' };
      }
      throw error;
    }
    useSupabaseMode = true;
    return { configured: true, connected: true, tablesExist: true };
  } catch (err: any) {
    useSupabaseMode = false;
    return { configured: true, connected: false, error: err.message || String(err) };
  }
}

// Check database status on startup
checkSupabaseStatus().then(status => {
  console.log('Database Initialization Check:', status);
});

// Display SQL Script for setup
const SQL_SCHEMA = `
-- HRPTA VOTING SYSTEM DATABASE SCHEMA
-- Copy and run this script in your Supabase SQL Editor

-- 1. Elections Table
CREATE TABLE IF NOT EXISTS hrpta_elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Sections Table
CREATE TABLE IF NOT EXISTS hrpta_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID REFERENCES hrpta_elections(id) ON DELETE CASCADE,
  grade_level TEXT NOT NULL,
  section_name TEXT NOT NULL,
  adviser_name TEXT NOT NULL,
  adviser_passcode TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Candidates Table
CREATE TABLE IF NOT EXISTS hrpta_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES hrpta_sections(id) ON DELETE CASCADE,
  fullname TEXT NOT NULL,
  child_name TEXT NOT NULL,
  income_source TEXT NOT NULL,
  income_details TEXT,
  position TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Students/LRN Table
CREATE TABLE IF NOT EXISTS hrpta_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES hrpta_sections(id) ON DELETE CASCADE,
  lrn TEXT NOT NULL,
  student_name TEXT NOT NULL,
  has_voted BOOLEAN DEFAULT false,
  voted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_section_lrn UNIQUE (section_id, lrn)
);

-- 5. Votes Table
CREATE TABLE IF NOT EXISTS hrpta_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES hrpta_sections(id) ON DELETE CASCADE,
  student_id UUID REFERENCES hrpta_students(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  candidate_id UUID REFERENCES hrpta_candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_student_position UNIQUE (student_id, position)
);

-- Enable RLS on all tables (allow public reads/writes via Service Role / Anon for simplicity in this demo system)
ALTER TABLE hrpta_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrpta_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrpta_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrpta_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrpta_votes ENABLE ROW LEVEL SECURITY;

-- Disable restrict rules for public anonymous access to make implementation straightforward
CREATE POLICY "Allow public select" ON hrpta_elections FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON hrpta_elections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON hrpta_elections FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON hrpta_sections FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON hrpta_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON hrpta_sections FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON hrpta_candidates FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON hrpta_candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON hrpta_candidates FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON hrpta_students FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON hrpta_students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON hrpta_students FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON hrpta_students FOR DELETE USING (true);

CREATE POLICY "Allow public select" ON hrpta_votes FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON hrpta_votes FOR INSERT WITH CHECK (true);
`;

// ================= API ENDPOINTS =================

// Database status check
app.get('/api/db-status', async (req, res) => {
  const status = await checkSupabaseStatus();
  res.json({
    ...status,
    sql: SQL_SCHEMA,
    currentMode: useSupabaseMode ? 'supabase' : 'sandbox',
    url: supabaseUrl
  });
});

// Force toggle to Sandbox mode (for testing)
app.post('/api/db-status/toggle', (req, res) => {
  const { mode } = req.body;
  if (mode === 'sandbox') {
    useSupabaseMode = false;
  } else if (mode === 'supabase' && supabase) {
    useSupabaseMode = true;
  }
  res.json({ success: true, currentMode: useSupabaseMode ? 'supabase' : 'sandbox' });
});

// 1. ELECTIONS
app.get('/api/elections', async (req, res) => {
  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_elections').select('*').order('created_at', { ascending: false });
    if (!error) return res.json(data);
    console.error('Supabase fetch elections failed:', error);
  }
  res.json(mockElections);
});

app.post('/api/elections', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_elections').insert([{ title, status: 'active' }]).select();
    if (!error) return res.json(data[0]);
    console.error('Supabase create election failed:', error);
  }

  const newElection = {
    id: 'e_' + Math.random().toString(36).substr(2, 9),
    title,
    status: 'active',
    created_at: new Date().toISOString()
  };
  mockElections.unshift(newElection);
  res.json(newElection);
});

app.delete('/api/elections/:id', async (req, res) => {
  const { id } = req.params;
  if (useSupabaseMode) {
    const { error } = await supabase.from('hrpta_elections').delete().eq('id', id);
    if (!error) return res.json({ success: true });
    console.error('Supabase delete election failed:', error);
  }

  mockElections = mockElections.filter(e => e.id !== id);
  mockSections = mockSections.filter(s => s.election_id !== id);
  res.json({ success: true });
});

// Toggle Election Status
app.patch('/api/elections/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'active' | 'closed'

  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_elections').update({ status }).eq('id', id).select();
    if (!error) return res.json(data[0]);
    console.error('Supabase update election status failed:', error);
  }

  const idx = mockElections.findIndex(e => e.id === id);
  if (idx !== -1) {
    mockElections[idx].status = status;
    return res.json(mockElections[idx]);
  }
  res.status(404).json({ error: 'Election not found' });
});

// 2. SECTIONS
app.get('/api/elections/:electionId/sections', async (req, res) => {
  const { electionId } = req.params;
  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_sections').select('*').eq('election_id', electionId).order('grade_level', { ascending: true });
    if (!error) return res.json(data);
    console.error('Supabase fetch sections failed:', error);
  }

  const filtered = mockSections.filter(s => s.election_id === electionId);
  res.json(filtered);
});

app.post('/api/elections/:electionId/sections', async (req, res) => {
  const { electionId } = req.params;
  const { grade_level, section_name, adviser_name, adviser_passcode } = req.body;

  if (!grade_level || !section_name || !adviser_name || !adviser_passcode) {
    return res.status(400).json({ error: 'All section fields are required' });
  }

  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_sections').insert([{
      election_id: electionId,
      grade_level,
      section_name,
      adviser_name,
      adviser_passcode
    }]).select();
    if (!error) return res.json(data[0]);
    console.error('Supabase create section failed:', error);
  }

  const newSection = {
    id: 's_' + Math.random().toString(36).substr(2, 9),
    election_id: electionId,
    grade_level,
    section_name,
    adviser_name,
    adviser_passcode,
    created_at: new Date().toISOString()
  };
  mockSections.push(newSection);
  res.json(newSection);
});

app.delete('/api/sections/:id', async (req, res) => {
  const { id } = req.params;
  if (useSupabaseMode) {
    const { error } = await supabase.from('hrpta_sections').delete().eq('id', id);
    if (!error) return res.json({ success: true });
    console.error('Supabase delete section failed:', error);
  }

  mockSections = mockSections.filter(s => s.id !== id);
  mockCandidates = mockCandidates.filter(c => c.section_id !== id);
  mockStudents = mockStudents.filter(st => st.section_id !== id);
  res.json({ success: true });
});

// 3. ADVISER PORTAL & ACTIONS
app.post('/api/adviser/login', async (req, res) => {
  const { passcode } = req.body;
  if (!passcode) return res.status(400).json({ error: 'Passcode is required' });

  // Find section by passcode
  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_sections').select('*, hrpta_elections(title, status)').eq('adviser_passcode', passcode).single();
    if (!error && data) {
      return res.json({
        section: data,
        election: data.hrpta_elections
      });
    }
    console.error('Supabase adviser login failed:', error);
  }

  // Fallback to mock search
  const foundSection = mockSections.find(s => s.adviser_passcode === passcode);
  if (foundSection) {
    const election = mockElections.find(e => e.id === foundSection.election_id);
    return res.json({
      section: foundSection,
      election
    });
  }

  res.status(401).json({ error: 'Invalid adviser passcode.' });
});

// Candidates lists for section
app.get('/api/sections/:sectionId/candidates', async (req, res) => {
  const { sectionId } = req.params;
  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_candidates').select('*').eq('section_id', sectionId);
    if (!error) return res.json(data);
    console.error('Supabase fetch candidates failed:', error);
  }

  const filtered = mockCandidates.filter(c => c.section_id === sectionId);
  res.json(filtered);
});

app.post('/api/sections/:sectionId/candidates', async (req, res) => {
  const { sectionId } = req.params;
  const { fullname, child_name, income_source, income_details, position } = req.body;

  if (!fullname || !child_name || !income_source || !position) {
    return res.status(400).json({ error: 'All candidate fields are required' });
  }

  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_candidates').insert([{
      section_id: sectionId,
      fullname,
      child_name,
      income_source,
      income_details: income_details || '',
      position
    }]).select();
    if (!error) return res.json(data[0]);
    console.error('Supabase save candidate failed:', error);
  }

  const newCand = {
    id: 'c_' + Math.random().toString(36).substr(2, 9),
    section_id: sectionId,
    fullname,
    child_name,
    income_source,
    income_details: income_details || '',
    position,
    created_at: new Date().toISOString()
  };
  mockCandidates.push(newCand);
  res.json(newCand);
});

// Clear candidate
app.delete('/api/candidates/:id', async (req, res) => {
  const { id } = req.params;
  if (useSupabaseMode) {
    const { error } = await supabase.from('hrpta_candidates').delete().eq('id', id);
    if (!error) return res.json({ success: true });
    console.error('Supabase delete candidate failed:', error);
  }

  mockCandidates = mockCandidates.filter(c => c.id !== id);
  res.json({ success: true });
});

// Upload list of candidates (Bulk)
app.post('/api/sections/:sectionId/candidates/bulk', async (req, res) => {
  const { sectionId } = req.params;
  const { candidates } = req.body; // Array of Candidates

  if (!candidates || !Array.isArray(candidates)) {
    return res.status(400).json({ error: 'Candidates array is required' });
  }

  if (useSupabaseMode) {
    const rows = candidates.map(c => ({
      section_id: sectionId,
      fullname: c.fullname,
      child_name: c.child_name,
      income_source: c.income_source,
      income_details: c.income_details || '',
      position: c.position
    }));
    const { data, error } = await supabase.from('hrpta_candidates').insert(rows).select();
    if (!error) return res.json(data);
    console.error('Supabase bulk save candidates failed:', error);
  }

  const added = [];
  for (const c of candidates) {
    const newCand = {
      id: 'c_' + Math.random().toString(36).substr(2, 9),
      section_id: sectionId,
      fullname: c.fullname,
      child_name: c.child_name,
      income_source: c.income_source,
      income_details: c.income_details || '',
      position: c.position,
      created_at: new Date().toISOString()
    };
    mockCandidates.push(newCand);
    added.push(newCand);
  }
  res.json(added);
});

// Student LRN management for section
app.get('/api/sections/:sectionId/students', async (req, res) => {
  const { sectionId } = req.params;
  if (useSupabaseMode) {
    const { data, error } = await supabase.from('hrpta_students').select('*').eq('section_id', sectionId).order('student_name', { ascending: true });
    if (!error) return res.json(data);
    console.error('Supabase fetch students failed:', error);
  }

  const filtered = mockStudents.filter(st => st.section_id === sectionId);
  res.json(filtered);
});

app.post('/api/sections/:sectionId/students/bulk', async (req, res) => {
  const { sectionId } = req.params;
  const { students } = req.body; // Array of { lrn, student_name }

  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ error: 'Students list is required' });
  }

  if (useSupabaseMode) {
    const rows = students.map(st => ({
      section_id: sectionId,
      lrn: st.lrn.trim(),
      student_name: st.student_name.trim(),
      has_voted: false
    }));

    // First delete existing students to refresh list, or insert/ignore. Let's delete existing first for this upload refresh.
    await supabase.from('hrpta_students').delete().eq('section_id', sectionId);

    const { data, error } = await supabase.from('hrpta_students').insert(rows).select();
    if (!error) return res.json(data);
    console.error('Supabase bulk save students failed:', error);
  }

  // Sandbox mode: Clear existing students in section and upload new
  mockStudents = mockStudents.filter(st => st.section_id !== sectionId);
  const added = [];
  for (const st of students) {
    const newStudent = {
      id: 'st_' + Math.random().toString(36).substr(2, 9),
      section_id: sectionId,
      lrn: st.lrn.trim(),
      student_name: st.student_name.trim(),
      has_voted: false,
      voted_at: null,
      created_at: new Date().toISOString()
    };
    mockStudents.push(newStudent);
    added.push(newStudent);
  }
  res.json(added);
});

// 4. VOTER PORTAL ACTIONS
app.post('/api/voter/authenticate', async (req, res) => {
  const { lrn } = req.body;
  if (!lrn) return res.status(400).json({ error: 'Student LRN is required' });

  const cleanLrn = lrn.trim();

  if (useSupabaseMode) {
    // Lookup student by LRN
    const { data: student, error: studErr } = await supabase
      .from('hrpta_students')
      .select('*, hrpta_sections(*)')
      .eq('lrn', cleanLrn)
      .limit(1);

    if (!studErr && student && student.length > 0) {
      const targetStudent = student[0];
      const targetSection = targetStudent.hrpta_sections;
      
      if (targetStudent.has_voted) {
        return res.status(403).json({ error: 'Our records show that the household vote for this LRN has already been cast.' });
      }
      
      // Fetch election info
      const { data: election, error: elecErr } = await supabase
        .from('hrpta_elections')
        .select('*')
        .eq('id', targetSection.election_id)
        .single();

      if (!elecErr && election) {
        if (election.status === 'closed') {
          return res.status(403).json({ error: 'This election has already closed.' });
        }
        return res.json({
          student: targetStudent,
          section: targetSection,
          election
        });
      }
    }
    console.error('Supabase voter authentication failed:', studErr);
  }

  // Sandbox Fallback
  const foundStudent = mockStudents.find(st => st.lrn === cleanLrn);
  if (foundStudent) {
    if (foundStudent.has_voted) {
      return res.status(403).json({ error: 'Our records show that the household vote for this LRN has already been cast.' });
    }

    const section = mockSections.find(s => s.id === foundStudent.section_id);
    if (!section) return res.status(404).json({ error: 'Student section not found' });

    const election = mockElections.find(e => e.id === section.election_id);
    if (!election) return res.status(404).json({ error: 'Election not found' });

    if (election.status === 'closed') {
      return res.status(403).json({ error: 'This election has already closed.' });
    }

    return res.json({
      student: foundStudent,
      section,
      election
    });
  }

  res.status(404).json({ error: 'Student LRN not found. Please contact your Homeroom Adviser.' });
});

app.post('/api/voter/vote', async (req, res) => {
  const { studentId, votes } = req.body; // votes is { President: 'cand-id', 'Vice President': 'cand-id', ... }

  if (!studentId || !votes) {
    return res.status(400).json({ error: 'Student ID and votes submission are required' });
  }

  if (useSupabaseMode) {
    try {
      // 1. Verify student hasn't voted yet
      const { data: student, error: studErr } = await supabase
        .from('hrpta_students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (studErr || !student) {
        return res.status(404).json({ error: 'Student record not found.' });
      }

      if (student.has_voted) {
        return res.status(403).json({ error: 'This student has already cast a vote.' });
      }

      // 2. Prepare vote rows
      const voteRows = Object.entries(votes).map(([position, candidateId]) => ({
        section_id: student.section_id,
        student_id: studentId,
        position,
        candidate_id: candidateId
      })).filter(row => row.candidate_id); // Skip empty/unvoted positions

      if (voteRows.length === 0) {
        return res.status(400).json({ error: 'You must vote for at least one candidate.' });
      }

      // 3. Insert votes
      const { error: voteErr } = await supabase.from('hrpta_votes').insert(voteRows);
      if (voteErr) throw voteErr;

      // 4. Mark student as voted
      const { error: updateErr } = await supabase
        .from('hrpta_students')
        .update({ has_voted: true, voted_at: new Date().toISOString() })
        .eq('id', studentId);
      
      if (updateErr) throw updateErr;

      return res.json({ success: true });
    } catch (err: any) {
      console.error('Supabase casting vote failed:', err);
      return res.status(500).json({ error: 'Failed to record your votes: ' + (err.message || String(err)) });
    }
  }

  // Sandbox Mode
  const studIdx = mockStudents.findIndex(st => st.id === studentId);
  if (studIdx === -1) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  if (mockStudents[studIdx].has_voted) {
    return res.status(403).json({ error: 'This student has already cast a vote.' });
  }

  // Add votes to database
  const student = mockStudents[studIdx];
  Object.entries(votes).forEach(([position, candidateId]) => {
    if (candidateId) {
      mockVotes.push({
        id: 'v_' + Math.random().toString(36).substr(2, 9),
        section_id: student.section_id,
        student_id: studentId,
        position,
        candidate_id: candidateId,
        created_at: new Date().toISOString()
      });
    }
  });

  // Mark voted
  mockStudents[studIdx].has_voted = true;
  mockStudents[studIdx].voted_at = new Date().toISOString();

  res.json({ success: true });
});

// Real-time Results & Stats for a specific section
app.get('/api/sections/:sectionId/results', async (req, res) => {
  const { sectionId } = req.params;

  if (useSupabaseMode) {
    try {
      // Fetch votes for the section
      const { data: votes, error: votesErr } = await supabase
        .from('hrpta_votes')
        .select('*, hrpta_candidates(id, fullname)')
        .eq('section_id', sectionId);

      // Fetch candidates for the section
      const { data: candidates, error: candErr } = await supabase
        .from('hrpta_candidates')
        .select('*')
        .eq('section_id', sectionId);

      // Fetch student voting summary
      const { data: students, error: studErr } = await supabase
        .from('hrpta_students')
        .select('has_voted');

      if (votesErr || candErr || studErr) {
        throw new Error('Supabase retrieval error');
      }

      // Group votes by candidate and positions
      const results: { [pos: string]: { [candId: string]: number } } = {};
      
      // Initialize with 0 for all candidates under all positions
      POSITIONS.forEach(pos => {
        results[pos] = {};
        candidates.forEach((c: any) => {
          results[pos][c.id] = 0;
        });
      });

      // Count votes
      votes.forEach((v: any) => {
        if (results[v.position] && results[v.position][v.candidate_id] !== undefined) {
          results[v.position][v.candidate_id]++;
        }
      });

      return res.json({
        positions: results,
        totalVotesCast: votes.length / POSITIONS.length // approximate
      });
    } catch (err) {
      console.error('Supabase fetch results failed:', err);
    }
  }

  // Fallback / Sandbox Mode Results
  const sectionVotes = mockVotes.filter(v => v.section_id === sectionId);
  const sectionCandidates = mockCandidates.filter(c => c.section_id === sectionId);

  const results: { [pos: string]: { [candId: string]: number } } = {};
  
  POSITIONS.forEach(pos => {
    results[pos] = {};
    sectionCandidates.forEach(c => {
      results[pos][c.id] = 0;
    });
  });

  sectionVotes.forEach(v => {
    if (results[v.position] && results[v.position][v.candidate_id] !== undefined) {
      results[v.position][v.candidate_id]++;
    }
  });

  res.json({
    positions: results,
    totalVotesCast: sectionVotes.length
  });
});

// 5. MONITOR OVERALL MONITORING (ADMIN OVERVIEW)
app.get('/api/admin/overview/:electionId', async (req, res) => {
  const { electionId } = req.params;

  if (useSupabaseMode) {
    try {
      // 1. Get all sections for this election
      const { data: sections, error: secErr } = await supabase
        .from('hrpta_sections')
        .select('*')
        .eq('election_id', electionId);

      if (secErr) throw secErr;

      const summaryStats = [];

      for (const section of sections) {
        // Fetch students counts
        const { data: students, error: studErr } = await supabase
          .from('hrpta_students')
          .select('has_voted')
          .eq('section_id', section.id);

        if (studErr) throw studErr;

        const total_students = students.length;
        const voted_students = students.filter((s: any) => s.has_voted).length;

        summaryStats.push({
          section_id: section.id,
          section_name: section.section_name,
          grade_level: section.grade_level,
          adviser_name: section.adviser_name,
          total_students,
          voted_students,
          participation_rate: total_students > 0 ? Math.round((voted_students / total_students) * 100) : 0
        });
      }

      return res.json(summaryStats);
    } catch (err) {
      console.error('Supabase monitor stats failed:', err);
    }
  }

  // Sandbox Mode Stats
  const sections = mockSections.filter(s => s.election_id === electionId);
  const summaryStats = sections.map(sec => {
    const students = mockStudents.filter(st => st.section_id === sec.id);
    const total_students = students.length;
    const voted_students = students.filter(st => st.has_voted).length;

    return {
      section_id: sec.id,
      section_name: sec.section_name,
      grade_level: sec.grade_level,
      adviser_name: sec.adviser_name,
      total_students,
      voted_students,
      participation_rate: total_students > 0 ? Math.round((voted_students / total_students) * 100) : 0
    };
  });

  res.json(summaryStats);
});


// ================= VITE OR STATIC SERVING =================

async function start() {
  // Serve Vite Assets in Dev, Static in Prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
