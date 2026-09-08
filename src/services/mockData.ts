
import { Post, Module, MaterialItem, ItemType, AppUser, Turma, RegistrationRequest } from '../types';

export const mockTurmas: Turma[] = [
  { id: 'r1-2026', name: 'R1- Turma 2026' },
  { id: 'r2-2025', name: 'R2- Turma 2025' },
  { id: 'r3-2024', name: 'R3- Turma 2024' },
];

export const mockUser: AppUser = {
  uid: 'admin123',
  email: 'janioteixeiracd@gmail.com',
  displayName: 'Dr. Jânio',
  photoURL: 'https://lh3.googleusercontent.com/d/1YRNr9wiQMq0uazkWk3KY8ERoabtlTW5O',
  role: 'admin',
  turma_id: 'general'
};

export const mockStudents: AppUser[] = [
  {
    uid: 's1',
    email: 'marcos.v@email.com',
    displayName: 'Dr. Marcos Vinícius',
    photoURL: 'https://i.pravatar.cc/150?u=s1',
    role: 'student',
    turma_id: 'r3-2024',
    isOnline: true,
    lastActive: new Date().toISOString()
  },
  {
    uid: 's2',
    email: 'julia.moraes@email.com',
    displayName: 'Dra. Julia Moraes',
    photoURL: 'https://i.pravatar.cc/150?u=s2',
    role: 'student',
    turma_id: 'r2-2025',
    isOnline: false,
    lastActive: new Date(Date.now() - 1000 * 60 * 45).toISOString() // 45 min ago
  },
  {
    uid: 's3',
    email: 'felipe.silva@email.com',
    displayName: 'Dr. Felipe Silva',
    photoURL: 'https://i.pravatar.cc/150?u=s3',
    role: 'student',
    turma_id: 'r1-2026',
    isOnline: false,
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 24h ago
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
    description: 'Guia completo sobre instrumentais cirúrgicos básicos e avançados para CTBMF.',
    type: ItemType.PDF,
    link: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    isImportant: true
  },
  {
    id: 'i2',
    moduleId: 'mod2',
    title: 'Protocolo ATLS - Cabeça e Pescoço',
    description: 'Resumo dos principais tópicos de trauma bucomaxilofacial conforme o ATLS 10.',
    type: ItemType.PROTOCOL,
    link: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    isImportant: false
  },
  // --- Restauração dos Vídeos Cirúrgicos ---
  {
    id: 'v1',
    moduleId: 'mod3',
    title: 'Planejamento Virtual em Ortognática',
    description: 'Discussão clínica sobre guias cirúrgicos e planejamento 3D.',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/sg78EVdDSiM?feature=share',
    theme: 'Gravações',
    isImportant: true
  },
  {
    id: 'v2',
    moduleId: 'mod2',
    title: 'Tratamento de Fraturas Mandibulares',
    description: 'Acesso e fixação interna rígida em fratura de ângulo e sínfise.',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/q_oAFQ2POVw?feature=share',
    theme: 'Gravações',
    isImportant: false
  },
  {
    id: 'v3',
    moduleId: 'mod2',
    title: 'Acessos Cirúrgicos ao Terço Médio',
    description: 'Demonstração de acessos transconjuntival e subciliar em trauma orbital.',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/pa09Tx-DFEI?feature=share',
    theme: 'Gravações',
    isImportant: false
  },
  {
    id: 'v4',
    moduleId: 'mod3',
    title: 'Osteotomia Le Fort I e Sagital',
    description: 'Técnica passo a passo para correção de deformidades dentofaciais.',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/Jnu9nQnZSuo?feature=share',
    theme: 'Gravações',
    isImportant: true
  },
  {
    id: 'v5',
    moduleId: 'mod3',
    title: 'Manejo de Complicações Transoperatórias',
    description: 'Protocolos de segurança e resolução de intercorrências em cirurgia de grande porte.',
    type: ItemType.VIDEO,
    link: 'https://youtube.com/live/YRVHxk66xeA?feature=share',
    theme: 'Gravações',
    isImportant: false
  },
  {
    id: 'v6',
    moduleId: 'mod1',
    title: 'Biópsias e Cirurgia Oral Menor',
    description: 'Técnicas de exérese e manejo de lesões benignas em ambiente ambulatorial.',
    type: ItemType.VIDEO,
    link: 'https://www.youtube.com/live/wV3vv7yGbbM?si=lxVsJbQ8xUdwiFZg',
    theme: 'Gravações',
    isImportant: false
  },
  {
    id: 'v7',
    moduleId: 'mod3',
    title: 'Expansão Cirúrgica de Maxila (ERAM)',
    description: 'Indicações técnicas e acompanhamento pós-operatório imediato.',
    type: ItemType.VIDEO,
    link: 'https://www.youtube.com/live/R4stAs19HCg?si=iJmhwlvlROM-xRpN',
    theme: 'Gravações',
    isImportant: false
  },
  {
    id: 'v8',
    moduleId: 'mod1',
    title: 'Reconstrução com Enxertos Ósseos',
    description: 'Uso de osso autógeno e biomateriais para reabilitação maxilomandibular.',
    type: ItemType.VIDEO,
    link: 'https://www.youtube.com/live/JXFslTe6228?si=GSvtAfUQnABkixgx',
    theme: 'Gravações',
    isImportant: true
  }
];

export const mockRegistrationRequests: RegistrationRequest[] = [
  {
    id: 'req1',
    name: 'Dr. Ricardo Silva',
    email: 'ricardo.ctbmf@gmail.com',
    requestedTurma: 'R1- Turma 2026',
    date: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'req2',
    name: 'Dra. Ana Beatriz',
    email: 'ana.beatriz@outlook.com',
    requestedTurma: 'R1- Turma 2026',
    date: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];
