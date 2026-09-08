import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SurgicalPlan } from '../types';

const formatDate = (dateVal: unknown) => {
  if (!dateVal) return 'N/A';
  
  // Handle YYYY-MM-DD strings directly to avoid TZ issues
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    const [y, m, d] = dateVal.split('-');
    return `${d}/${m}/${y}`;
  }

  if (typeof dateVal === 'object' && dateVal !== null && 'toDate' in dateVal) {
    return (dateVal as { toDate: () => Date }).toDate().toLocaleDateString('pt-BR');
  }
  const d = new Date(dateVal as string | number | Date);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('pt-BR');
};

const createSurgicalPlanDoc = (plan: Partial<SurgicalPlan>): jsPDF => {
  const doc = new jsPDF();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFillColor(10, 25, 41); // brand-dark
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANEJAMENTO CIRÚRGICO', margin, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(212, 175, 55); // brand-gold
  doc.text('INSTITUTO ANDREONI - ESPECIALIZAÇÃO EM CTBMF', margin, 30);
  doc.text('COORDENAÇÃO: PROF. DR. ANDREONI', margin, 35);

  y = 50;
  doc.setTextColor(0, 0, 0);
  
  // Identification
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. IDENTIFICAÇÃO E EQUIPE', margin, y);
  y += 8;
  
  const idData = [
    ['Residente:', plan.residentName || '', 'Nível:', plan.residentLevel || ''],
    ['Data Cirurgia:', formatDate(plan.surgeryDate), 'Hospital:', plan.hospitalUnit || ''],
    ['Professor:', plan.professorName || '', 'Paciente:', plan.patientCode || ''],
    ['Auxiliares:', plan.auxiliaryTeam || 'N/A', 'Status:', plan.status === 'submitted' ? 'ENVIADO' : 'APROVADO']
  ];

  autoTable(doc, {
    startY: y,
    body: idData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', width: 30 }, 2: { fontStyle: 'bold', width: 25 } },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // Procedure
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. DIAGNÓSTICO E PROCEDIMENTO', margin, y);
  y += 8;

  const procData = [
    ['Procedimento:', plan.procedureName || ''],
    ['Diagnóstico:', plan.diagnosis || ''],
    ['Região Anatômica:', plan.anatomyRegion || ''],
    ['Lado Afetado:', plan.affectedSide || 'N/A'],
    ['Tipo de Caso:', plan.caseType || 'N/A']
  ];

  autoTable(doc, {
    startY: y,
    body: procData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // Planning
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. PLANEJAMENTO TÉCNICO DETALHADO', margin, y);
  y += 8;

  const planFields = [
    { label: 'Resumo do Caso / História Clínica', value: plan.caseSummary },
    { label: 'Indicação Cirúrgica', value: plan.indication },
    { label: 'Técnica Anestésica', value: plan.anesthesia },
    { label: 'Via de Intubação', value: plan.intubation },
    { label: 'Posicionamento do Paciente', value: plan.positioning },
    { label: 'Antissepsia e Campos', value: plan.antisepsis },
    { label: 'Acesso Cirúrgico', value: plan.surgicalAccess },
    { label: 'Passo a Passo da Técnica', value: plan.surgicalSteps },
    { label: 'Materiais de Fixação / Enxertos', value: plan.fixationMaterials },
    { label: 'Estruturas Nobres / Críticas', value: plan.criticalStructures },
    { label: 'Possíveis Complicações', value: plan.complications },
    { label: 'Cuidados Pós-Operatórios', value: plan.postOpCare },
    { label: 'Observações Adicionais', value: plan.additionalNotes }
  ];

  planFields.forEach(field => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${field.label}:`, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(field.value || 'N/A', 170);
    doc.text(lines, margin, y);
    y += (lines.length * 5) + 6;
  });

  // Footer with timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} - Página ${i} de ${pageCount}`, margin, 285);
  }

  return doc;
};

export const generateSurgicalPlanPDF = (plan: Partial<SurgicalPlan>) => {
  try {
    const doc = createSurgicalPlanDoc(plan);
    const safePatientCode = (plan.patientCode || 'S_COD').replace(/\s+/g, '_');
    const safeProcedureName = (plan.procedureName || 'S_PROC').replace(/\s+/g, '_');
    doc.save(`Planejamento_${safePatientCode}_${safeProcedureName}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
  }
};

export const generateSurgicalPlanPDFBlob = (plan: Partial<SurgicalPlan>): Blob => {
  const doc = createSurgicalPlanDoc(plan);
  return doc.output('blob');
};
