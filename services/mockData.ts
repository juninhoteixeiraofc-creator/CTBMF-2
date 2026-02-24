
import { Post, Module, MaterialItem, ItemType, AppUser, Turma } from '../types';

export const mockTurmas: Turma[] = [
  { id: 'r1-2026', name: 'R1- Turma 2026' },
  { id: 'r2-2025', name: 'R2- Turma 2025' },
  { id: 'r3-2024', name: 'R3- Turma 2024' },
];

export const mockUser: AppUser = {
  uid: 'admin123',
  email: 'andreoni@instituto.com',
  displayName: 'Dr. Andreoni',
  photoURL: 'https://picsum.photos/100/100',
  role: 'admin',
  turma_id: 'general',
  approved: true
};

// Usuários Pendentes
export const mockPendingUsers: AppUser[] = [
  {
    uid: 'u-pending-1',
    email: 'residente.teste@email.com',
    displayName: 'Dr. Ricardo Silva',
    photoURL: 'https://ui-avatars.com/api/?name=Ricardo+Silva&background=c89b3c&color=fff',
    role: 'student',
    turma_id: 'r1-2026',
    approved: false
  },
  {
    uid: 'u-pending-2',
    email: 'marcos.bmf@email.com',
    displayName: 'Dr. Marcos Oliveira',
    photoURL: 'https://ui-avatars.com/api/?name=Marcos+Oliveira&background=c89b3c&color=fff',
    role: 'student',
    turma_id: 'r2-2025',
    approved: false
  }
];

// Usuários já Aprovados/Ativos
export const mockActiveUsers: AppUser[] = [
  {
    uid: 'u-active-1',
    email: 'ana.costa@email.com',
    displayName: 'Dra. Ana Costa',
    photoURL: 'https://ui-avatars.com/api/?name=Ana+Costa&background=343a40&color=fff',
    role: 'student',
    turma_id: 'r3-2024',
    approved: true
  }
];

export const mockPosts: Post[] = [
  {
    id: '1',
    title: 'Boas-vindas à Turma 2026/1',
    content: 'Sejam bem-vindos à nova especialização. Iniciamos as atividades na próxima segunda-feira.',
    date: new Date().toISOString(),
    authorName: 'Dr. Andreoni'
  },
  {
    id: '2',
    title: 'Aviso: Aula de Anatomia Aplicada',
    content: 'O material de anatomia já está disponível no módulo de Fundamentos.',
    date: new Date(Date.now() - 86400000).toISOString(),
    authorName: 'Dr. Andreoni'
  }
];

export const mockModules: Module[] = [
  { id: 'mod1', name: 'Fundamentos da Cirurgia', description: 'Bases biológicas e técnicas' },
  { id: 'mod2', name: 'Traumatologia Facial', description: 'Tratamento de fraturas complexas' },
  { id: 'mod3', name: 'Cirurgia Ortognática', description: 'Planejamento e execução' }
];

export const mockItems: MaterialItem[] = [
  {
    id: 'i1',
    moduleId: 'mod1',
    title: 'Apostila de Instrumental',
    type: ItemType.PDF,
    link: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  },
  {
    id: 'i2',
    moduleId: 'mod2',
    title: 'Protocolo ATLS - Cabeça e Pescoço',
    type: ItemType.PROTOCOL,
    link: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  },
  {
    id: 'v1',
    moduleId: 'mod3',
    title: 'CIRURGIA ORTOGNÁTICA',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/sg78EVdDSiM',
    theme: 'Gravações'
  },
  {
    id: 'v2',
    moduleId: 'mod2',
    title: 'FRATURA DE MANDÍBULA',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/q_oAFQ2POVw',
    theme: 'Gravações'
  },
  {
    id: 'v3',
    moduleId: 'mod2',
    title: 'ACESSOS CIRÚRGICOS',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/pa09Tx-DFEI',
    theme: 'Gravações'
  },
  {
    id: 'v4',
    moduleId: 'mod3',
    title: 'OSTEOTOMIA LE FORT I',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/Jnu9nQnZSuo',
    theme: 'Gravações'
  },
  {
    id: 'v5',
    moduleId: 'mod1',
    title: 'TERCEIROS MOLARES',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/YRVHxk66xeA',
    theme: 'Gravações'
  },
  {
    id: 'v6',
    moduleId: 'mod3',
    title: 'MENTOPLASTIA',
    type: ItemType.VIDEO,
    link: 'https://www.youtube.com/live/wV3vv7yGbbM',
    theme: 'Gravações'
  },
  {
    id: 'v7',
    moduleId: 'mod2',
    title: 'FRATURA DE ZIGOMA',
    type: ItemType.VIDEO,
    link: 'https://www.youtube.com/live/R4stAs19HCg',
    theme: 'Gravações'
  },
  {
    id: 'v8',
    moduleId: 'mod1',
    title: 'PATOLOGIA BUCOMAXILOFACIAL',
    type: ItemType.VIDEO,
    link: 'https://www.youtube.com/live/JXFslTe6228',
    theme: 'Gravações'
  }
];
