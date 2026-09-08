
export type UserRole = 'student' | 'admin' | 'academy';
export type UserStatus = 'pending' | 'approved' | 'blocked';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  turma_id: string;
  status?: UserStatus;
  isOnline?: boolean;
  lastActive?: string; // ISO string
  residencyLevel?: 'R1' | 'R2' | 'R3';
  // Additional fields
  city?: string;
  address?: string;
  cro?: string;
  cep?: string;
  phone?: string;
  // Academy Fields
  academyAccess?: boolean;
  academyPlan?: 'access' | 'experience' | null;
  academyCategory?: 'student' | 'dentist' | null;
  academyCRO?: string;
  academyStatus?: 'active' | 'inactive' | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any; // Firestore Timestamp
  createdBy: string;
  audience: 'all' | 'R1' | 'R2' | 'R3' | 'admin';
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
  link?: string;
  type?: string;
}

export interface NotificationRead {
  userId: string;
  notificationId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readAt: any;
}

export interface HomeHighlight {
  id: string;
  title: string;
  subtitle: string;
  startDateText: string;
  description?: string;
  isActive: boolean;
  audience: 'all' | 'R1' | 'R2' | 'R3';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt: any;
  updatedBy: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string
  authorName: string;
}

export interface Module {
  id: string;
  name: string;
  description?: string;
  audience?: ('R1' | 'R2' | 'R3')[];
}

export enum ItemType {
  PDF = 'pdf',
  BOOK = 'book',
  PROTOCOL = 'protocol',
  VIDEO = 'video'
}

export interface MaterialItem {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  type: ItemType;
  link: string; // Google Drive or YouTube link
  theme?: string; // Used for surgery categorization
  category?: 'trauma' | 'ortognatica' | 'estetica' | 'atm';
  isImportant?: boolean;
}

export interface Turma {
  id: string;
  name: string; // e.g., "2026/1"
}

export interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  requestedTurma: string;
  date: string;
}

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  liveUrl: string;
  embedUrl?: string;
  videoId?: string;
  thumbnail?: string;
  channelTitle?: string;
  platform: 'youtube' | 'vimeo' | 'other';
  status: 'scheduled' | 'live' | 'ended';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  visible: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any; // Firestore Timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt?: any; // Firestore Timestamp
}

export interface Surgery {
  id: string;
  title: string;
  description: string;
  youtubeVideoId: string;
  thumbnail: string;
  category: 'trauma' | 'ortognatica' | 'estetica' | 'atm';
  isImportant: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any; // Firestore Timestamp
}

export interface Protocol {
  id: string;
  title: string;
  description: string;
  content?: string;
  externalLink?: string;
  accessLevels: ('R1' | 'R2' | 'R3')[];
  isImportant: boolean;
  pdfUrl?: string;
  pdfFileName?: string;
  type: 'text' | 'pdf' | 'mixed';
  createdBy?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt?: any; // Firestore Timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any; // Firestore Timestamp
}

export interface KnowledgeBaseEntry {
  id: string;
  keywords: string[];
  question: string;
  answer: string;
  category?: string;
}

export interface KnowledgeBaseCTBMF {
  id?: string;
  topic: string;
  keywords: string[];
  content: string;
  author: string;
  source: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timestamp: any; // Firestore Timestamp
  active: boolean;
}

export interface AIConfig {
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastUpdated?: any;
  updatedBy?: string;
}

export interface ChefinhoKnowledge {
  id?: string;
  topic: string;
  content: string;
  keywords: string[];
  source: string;
  active: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChefinhoHistory {
  id?: string;
  userId: string;
  question: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timestamp: any; // Firestore Timestamp
  inferredTheme: string;
  residencyLevel: 'R1' | 'R2' | 'R3';
  usedInternalBase: boolean;
}

export interface ChefinhoQuestion {
  id?: string;
  userId: string;
  userName: string;
  userLevel: string;
  question: string;
  answer: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timestamp: any; // Firestore Timestamp
  device: 'mobile' | 'tablet' | 'desktop';
  topicDetected: string;
  isMarkedImportant: boolean;
  adminNotes: string;
}

export type SurgicalPlanStatus = 'draft' | 'submitted' | 'reviewed' | 'approved';

export interface Attachment {
  name: string;
  url: string;
  path: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface Resident {
  id: string;
  name: string;
  role: 'R1' | 'R2' | 'R3';
  active: boolean;
  userId?: string;
  notes?: string;
}

export interface FixedTeam {
  id: string;
  teamName: string;
  r2Members: string[]; // Names or IDs (user wants names usually, but IDs are better for linking)
  r1Members: string[];
  extraMembers: string[];
  active: boolean;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeamShift {
  id: string;
  teamId: string;
  teamName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  active: boolean;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface R3Shift {
  id: string;
  residentId: string;
  residentName: string;
  teamId?: string; // Optional link to a team shift
  teamName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  active: boolean;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SurgicalPlan {
  id: string;
  residentId: string;
  residentName: string;
  residentLevel: string;
  surgeryDate: string; // ISO string
  hospitalUnit: string;
  professorName: string;
  auxiliaryTeam: string;
  patientCode: string;
  procedureName: string;
  diagnosis: string;
  anatomyRegion: string;
  affectedSide: string;
  caseType: string;
  caseSummary: string;
  indication: string;
  anesthesia: string;
  intubation: string;
  positioning: string;
  antisepsis: string;
  surgicalAccess: string;
  surgicalSteps: string;
  fixationMaterials: string;
  criticalStructures: string;
  complications: string;
  postOpCare: string;
  additionalNotes: string;
  attachments?: Attachment[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any; // Firestore Timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt: any; // Firestore Timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submittedAt?: any; // Firestore Timestamp
  status: SurgicalPlanStatus;
  pdfUrl?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  dutyTeamId?: string;
  dutyTeamName?: string;
  linkedTeamId?: string;
  linkedTeamName?: string;
  linkedR3?: string;
  linkedR2Members?: string[];
  linkedR1Members?: string[];
}

export interface AcademyLive {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  platform: 'youtube' | 'vimeo' | 'other';
  status: 'scheduled' | 'live' | 'ended';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  isLesson: boolean; // true = Aula do mês, false = Live cirúrgica
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any; // Firestore Timestamp
}

export interface AcademyLibraryItem {
  id: string;
  title: string;
  description: string;
  category: 'trauma' | 'ortognatica' | 'estetica' | 'atm' | 'outros';
  type: 'pdf' | 'video' | 'book' | 'protocol';
  link: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

export interface AcademyEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  link?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

export interface AcademyAnnouncement {
  id: string;
  title: string;
  content: string;
  date: string; // ISO or YYYY-MM-DD
  authorName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

export interface AcademyObservationalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  requestedDate: string; // YYYY-MM-DD
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  scheduledDateTime?: string; // Date & Time assigned by admin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

