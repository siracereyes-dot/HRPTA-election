export interface Election {
  id: string;
  title: string;
  status: 'active' | 'closed';
  created_at?: string;
}

export interface Section {
  id: string;
  election_id: string;
  grade_level: string;
  section_name: string;
  adviser_name: string;
  adviser_passcode: string;
  created_at?: string;
}

export type Position =
  | 'President'
  | 'Vice President'
  | 'Secretary'
  | 'Treasurer'
  | 'Auditor';

export const POSITIONS: Position[] = [
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Auditor'
];

export interface Candidate {
  id: string;
  section_id: string;
  fullname: string;
  child_name: string;
  position?: Position;
  picture_data?: string; // base64 compressed image
  created_at?: string;
}

export interface Student {
  id: string;
  section_id: string;
  lrn: string;
  student_name: string;
  has_voted: boolean;
  voted_at?: string | null;
  created_at?: string;
}

export interface Vote {
  id: string;
  section_id: string;
  student_id: string;
  position: Position;
  candidate_id: string;
  created_at?: string;
}

export interface SectionStats {
  section_id: string;
  section_name: string;
  grade_level: string;
  adviser_name: string;
  total_students: number;
  voted_students: number;
  participation_rate: number;
}

export interface ActivityLog {
  id: string;
  election_id?: string;
  activity_type: string;
  details: string;
  created_at: string;
}
