
export type UserRole = 'student' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  turma_id: string;
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
  type: ItemType;
  link: string; // Google Drive or YouTube link
  theme?: string; // Used for surgery categorization
}

export interface Turma {
  id: string;
  name: string; // e.g., "2026/1"
}
