
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { KnowledgeBaseEntry, KnowledgeBaseCTBMF, AIConfig, ChefinhoKnowledge, ChefinhoHistory } from '../types';

export const getAiConfig = async (): Promise<AIConfig | null> => {
  try {
    const configRef = doc(db, 'ai_config', 'chefinho');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      return configSnap.data() as AIConfig;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar configuração da IA:", error);
    return null;
  }
};

export const testChefinhoConnection = async (): Promise<{ success: boolean, message: string, details?: unknown }> => {
  console.log("Chefinho: Testing connection via backend...");
  try {
    const response = await fetch("/api/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, message: "Conexão estabelecida com sucesso!", details: `Modelo: ${data.model}` };
  } catch (error: unknown) {
    console.error("Chefinho: Connection test failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
    return { 
      success: false, 
      message: "Falha na conexão com o servidor", 
      details: errorMsg 
    };
  }
};

const detectDevice = (): 'mobile' | 'tablet' | 'desktop' => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

const detectTopic = (question: string): string => {
  const q = question.toLowerCase();
  if (q.includes('condilo') || q.includes('mandibula') || q.includes('parassinfise') || q.includes('angulo')) {
    return 'trauma_mandibular';
  }
  if (q.includes('orbita') || q.includes('blowout') || q.includes('infraorbitario')) {
    return 'trauma_orbitario';
  }
  if (q.includes('zigoma') || q.includes('zigomatico')) {
    return 'terco_medio';
  }
  return 'geral';
};

export const logChefinhoQuestion = async (data: {
  userId: string;
  userName: string;
  userLevel: string;
  question: string;
  answer: string;
}) => {
  try {
    const device = detectDevice();
    const topicDetected = detectTopic(data.question);
    
    await addDoc(collection(db, 'chefinho_questions'), {
      ...data,
      timestamp: serverTimestamp(),
      device,
      topicDetected,
      isMarkedImportant: false,
      adminNotes: ''
    });
  } catch (error) {
    console.error("Erro ao registrar pergunta do Chefinho:", error);
  }
};

export const askChefinho = async (question: string, userId: string, userLevel: 'R1' | 'R2' | 'R3' = 'R1', userName: string = 'Usuário'): Promise<string> => {
  console.log(`Chefinho: Recebendo pergunta de ${userId} (${userLevel}): "${question}"`);
  try {
    const normalizedQuestion = question.toLowerCase();
    const technicalShortTerms = ['atm', 'rx', 'tc', 'rm', 'ct', 'pa', 'ap', 'r1', 'r2', 'r3', 'hof', 'buco'];
    const questionWords = normalizedQuestion.split(/\s+/).filter(w => w.length > 2 || technicalShortTerms.includes(w));

    // 1. Collect all potential matches from knowledge bases
    console.log("Chefinho: Consultando bases de conhecimento...");
    const allMatches: { content: string, source: string, score: number, topic?: string }[] = [];
    let inferredTheme = "Geral";

    // A. Institutional Knowledge Base (chefinho_knowledge) - PRIORITY
    try {
      const chefinhoRef = collection(db, 'chefinho_knowledge');
      const q = query(chefinhoRef, where('active', '==', true));
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach(doc => {
        const entry = doc.data() as ChefinhoKnowledge;
        let score = 0;
        const topic = entry.topic.toLowerCase();
        const content = entry.content.toLowerCase();

        // Topic match
        if (normalizedQuestion.includes(topic) || topic.includes(normalizedQuestion)) {
          score += 15;
          inferredTheme = entry.topic;
        }

        // Keywords match
        entry.keywords?.forEach(kw => {
          const normalizedKw = kw.toLowerCase();
          if (normalizedQuestion.includes(normalizedKw)) {
            score += 10;
            if (questionWords.includes(normalizedKw)) score += 5;
          }
        });

        // Content match
        questionWords.forEach(word => {
          if (content.includes(word)) score += 2;
          if (topic.includes(word)) score += 1;
        });

        if (score >= 5) {
          allMatches.push({ 
            content: `Tópico: ${entry.topic}\nConteúdo: ${entry.content}`, 
            source: 'institucional', 
            score: score * 1.5, // Boost institutional knowledge
            topic: entry.topic 
          });
        }
      });
    } catch (e) {
      console.error("Chefinho: Erro ao consultar base institucional:", e);
    }

    // B. Manual Knowledge Base (knowledge_base)
    try {
      const kbRef = collection(db, 'knowledge_base');
      const kbSnapshot = await getDocs(kbRef);
      kbSnapshot.docs.forEach(doc => {
        const entry = doc.data() as KnowledgeBaseEntry;
        let score = 0;
        const entryQuestion = entry.question.toLowerCase();
        
        if (normalizedQuestion === entryQuestion) score += 20;
        else if (normalizedQuestion.includes(entryQuestion) || entryQuestion.includes(normalizedQuestion)) score += 12;
        
        entry.keywords?.forEach(kw => {
          const normalizedKw = kw.toLowerCase();
          if (normalizedQuestion.includes(normalizedKw)) {
            score += 8;
          }
        });

        if (score >= 5) {
          allMatches.push({ content: `Pergunta: ${entry.question}\nResposta: ${entry.answer}`, source: 'manual', score });
        }
      });
    } catch (e) {
      console.error("Chefinho: Erro ao consultar base manual:", e);
    }

    // C. WhatsApp Knowledge Base (knowledge_base_ctbmf)
    try {
      const ctbmfRef = collection(db, 'knowledge_base_ctbmf');
      const q = query(ctbmfRef, where('active', '==', true));
      const ctbmfSnapshot = await getDocs(q);
      ctbmfSnapshot.docs.forEach(doc => {
        const entry = doc.data() as KnowledgeBaseCTBMF;
        let score = 0;
        const entryTopic = entry.topic.toLowerCase();

        if (normalizedQuestion.includes(entryTopic) || entryTopic.includes(normalizedQuestion)) score += 10;

        entry.keywords?.forEach(kw => {
          const normalizedKw = kw.toLowerCase();
          if (normalizedQuestion.includes(normalizedKw)) {
            score += 6;
          }
        });

        if (score >= 5) {
          allMatches.push({ content: entry.content, source: 'whatsapp', score, topic: entry.topic });
        }
      });
    } catch (e) {
      console.error("Chefinho: Erro ao consultar base WhatsApp:", e);
    }

    // Sort by score and take top 5
    const topMatches = allMatches.sort((a, b) => b.score - a.score).slice(0, 5);
    const usedInternalBase = topMatches.length > 0;
    
    // 2. Synthesis using Backend API
    console.log("Chefinho: Sintetizando resposta final via backend...");
    const context = usedInternalBase 
      ? topMatches.map(m => `[Fonte: ${m.source}${m.topic ? ` - Assunto: ${m.topic}` : ''}] ${m.content}`).join('\n\n---\n\n')
      : "Nenhuma informação interna específica encontrada.";

    const aiConfig = await getAiConfig();
    
    // Level-specific instructions
    const levelInstructions = {
      'R1': 'O usuário é um residente R1. Forneça uma resposta mais básica, explicativa e didática, focando nos fundamentos e na anatomia básica.',
      'R2': 'O usuário é um residente R2. Forneça uma resposta intermediária, com mais raciocínio clínico, foco em conduta e tomada de decisão.',
      'R3': 'O usuário é um residente R3. Forneça uma resposta avançada, abordando planejamento cirúrgico complexo, nuances técnicas e manejo de complicações.'
    };

    // Simulation mode detection
    const isSimulationRequest = normalizedQuestion.includes('simule') || 
                               normalizedQuestion.includes('caso clínico') || 
                               normalizedQuestion.includes('plantão') ||
                               normalizedQuestion.includes('treinar');

    const basePrompt = aiConfig?.systemPrompt || `Você é o Chefinho, mentor digital da residência de Cirurgia e Traumatologia Bucomaxilofacial do Instituto Andreoni.
Seu papel é agir como um preceptor experiente, orientando os residentes com linguagem técnica, clara e prática.`;

    const systemPrompt = `${basePrompt}

INFORMAÇÃO DO USUÁRIO:
- Nível: ${userLevel}
- Instrução de Nível: ${levelInstructions[userLevel]}

MODO DE OPERAÇÃO:
${isSimulationRequest ? 
  'MODO SIMULADOR DE PLANTÃO ATIVADO: O usuário quer treinar. Gere um caso clínico curto, realista e desafiador. Descreva o quadro e pergunte ao residente qual seria a conduta. Após a resposta dele, corrija ou comente.' : 
  'MODO MENTORIA CLÍNICA: Responda de forma organizada seguindo este roteiro quando aplicável:\n1. avaliação inicial\n2. hipótese/diagnóstico\n3. exames\n4. conduta\n5. complicações\n6. observações práticas'}

CONTEXTO INSTITUCIONAL (Priorize estas informações):
${context}

DIRETRIZES GERAIS:
- Priorize sempre os protocolos do Instituto Andreoni.
- Mantenha a postura de um preceptor: encoraje o raciocínio clínico.
- Se usou a base interna, fundamente sua resposta nela.`;

    const response = await fetch("/api/chefinho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        systemPrompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    let answer = data.choices?.[0]?.message?.content || "";

    if (usedInternalBase && !answer.includes("Baseado em protocolos")) {
      answer += "\n\n*Baseado em protocolos e discussões do serviço.*";
    }

    // 3. Record History (Legacy)
    try {
      await addDoc(collection(db, 'chefinho_history'), {
        userId,
        question,
        timestamp: serverTimestamp(),
        inferredTheme,
        residencyLevel: userLevel,
        usedInternalBase
      });
    } catch (historyError) {
      console.error("Chefinho: Erro ao gravar histórico:", historyError);
    }

    // 4. Record Detailed Question (New)
    logChefinhoQuestion({
      userId,
      userName,
      userLevel,
      question,
      answer
    });

    return answer;

  } catch (error: unknown) {
    console.error("Chefinho: Erro crítico na função askChefinho:", error);
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
    return `Ocorreu um erro ao tentar falar com o Chefinho. Detalhe técnico: ${errorMsg}. Por favor, tente novamente mais tarde.`;
  }
};

export const getResidentTopThemes = async (userId: string, limitCount: number = 5): Promise<string[]> => {
  try {
    const historyRef = collection(db, 'chefinho_history');
    const q = query(
      historyRef, 
      where('userId', '==', userId), 
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const snapshot = await getDocs(q);
    const themes = snapshot.docs.map(doc => (doc.data() as ChefinhoHistory).inferredTheme);
    
    // Count occurrences
    const counts: Record<string, number> = {};
    themes.forEach(t => {
      if (t && t !== "Geral") counts[t] = (counts[t] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitCount)
      .map(entry => entry[0]);
  } catch (error) {
    console.error("Erro ao buscar temas frequentes:", error);
    return [];
  }
};

export const askGemini = async (question: string): Promise<string> => {
  // Keeping the function name for compatibility but using backend
  console.log(`Chefinho (Backend): Recebendo pergunta: "${question}"`);
  try {
    const aiConfig = await getAiConfig();
    const systemPrompt = aiConfig?.systemPrompt || `Você é o Chefinho, assistente clínico da residência de Cirurgia e Traumatologia Bucomaxilofacial do Instituto Andreoni.

Seu papel é ajudar residentes R1, R2 e R3 com respostas objetivas, técnicas, seguras e didáticas.

Sempre que possível, organize a resposta em:
1. avaliação inicial
2. hipótese/diagnóstico
3. exames complementares
4. conduta
5. possíveis complicações
6. observações práticas

Priorize temas de:
- trauma facial
- fraturas mandibulares
- fraturas orbitárias
- infecções odontogênicas
- abscessos cervicofaciais
- antibioticoterapia
- vias de acesso cirúrgico
- rotina hospitalar da residência

Quando a pergunta envolver urgência, destaque primeiro os riscos imediatos, especialmente via aérea, sangramento, infecção disseminada e déficit visual.

Não invente condutas específicas quando não tiver segurança. Nesses casos, diga que a resposta precisa ser confirmada com avaliação clínica e supervisão do serviço.

Use linguagem técnica, mas clara e prática, como um preceptor orientando um residente.`;

    const response = await fetch("/api/chefinho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        systemPrompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta no momento.";
  } catch (error: unknown) {
    console.error("Chefinho (Backend): Erro ao consultar servidor:", error);
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
    return `Ocorreu um erro ao consultar o servidor. Detalhe: ${errorMsg}`;
  }
};
