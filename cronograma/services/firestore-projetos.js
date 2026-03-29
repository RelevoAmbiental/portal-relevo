function getFirebaseCompat() {
  return window.firebase || window.__RELEVO_FIREBASE__ || null;
}

function getDb() {
  return window.__RELEVO_DB__ || window.db || null;
}

function getUser() {
  return window.__RELEVO_USER__ || null;
}

function getServerTimestamp() {
  const firebaseCompat = getFirebaseCompat();
  return firebaseCompat?.firestore?.FieldValue?.serverTimestamp?.() || new Date();
}

function ensureDb() {
  const db = getDb();
  if (!db) {
    throw new Error("Firestore não está disponível no Portal.");
  }
  return db;
}

function sanitizeProjeto(payload) {
  return {
    nome: (payload.nome || "").trim(),
    cliente: (payload.cliente || "").trim(),
    numeroProposta: (payload.propostaNumero || payload.numeroProposta || "").trim(),
    responsavel: (payload.responsavel || "").trim(),
    dataInicio: payload.dataInicio || "",
    prazoExecucao: payload.prazoFinal || payload.prazoExecucao || "",
    status: payload.status || "planejamento",
    cor: payload.cor || "#0b2e1b",
    descricao: (payload.descricao || "").trim(),
    arquivado: Boolean(payload.arquivado)
  };
}

function validateProjeto(payload) {
  if (!payload.nome) {
    throw new Error("Informe o nome do projeto.");
  }
}

function normalizeProjeto(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    nome: data.nome || "",
    cliente: data.cliente || "",
    propostaNumero: data.propostaNumero || data.numeroProposta || "",
    responsavel: data.responsavel || data.ownerEmail || "",
    dataInicio: data.dataInicio || "",
    prazoFinal: data.prazoFinal || data.prazoExecucao || "",
    status: data.status || "planejamento",
    cor: data.cor || "#0b2e1b",
    descricao: data.descricao || "",
    arquivado: Boolean(data.arquivado),
    createdAt: data.createdAt || data.criadoEm || null,
    updatedAt: data.updatedAt || null,
    uid: data.uid || "",
    ownerEmail: data.ownerEmail || ""
  };
}

function sortProjetos(items) {
  return [...items].sort((a, b) => {
    const aNome = (a.nome || "").toLowerCase();
    const bNome = (b.nome || "").toLowerCase();
    return aNome.localeCompare(bNome, "pt-BR");
  });
}

export function listenProjetos(onChange, onError) {
  const db = ensureDb();

  return db.collection("projetos").onSnapshot(
    (snapshot) => {
      const items = snapshot.docs.map(normalizeProjeto);
      onChange(sortProjetos(items));
    },
    (error) => {
      console.error("Erro ao ouvir projetos:", error);
      if (typeof onError === "function") onError(error);
    }
  );
}

export async function criarProjeto(payload) {
  const db = ensureDb();
  const user = getUser();
  const data = sanitizeProjeto(payload);
  validateProjeto(data);

  const now = getServerTimestamp();

  await db.collection("projetos").add({
    ...data,
    uid: user?.uid || "",
    ownerEmail: user?.email || "",
    criadoEm: now,
    updatedAt: now
  });
}

export async function atualizarProjeto(id, payload) {
  if (!id) throw new Error("Projeto inválido para atualização.");

  const db = ensureDb();
  const data = sanitizeProjeto(payload);
  validateProjeto(data);

  await db.collection("projetos").doc(id).update({
    ...data,
    updatedAt: getServerTimestamp()
  });
}

export async function arquivarProjeto(id) {
  if (!id) throw new Error("Projeto inválido para arquivamento.");

  const db = ensureDb();
  await db.collection("projetos").doc(id).update({
    arquivado: true,
    updatedAt: getServerTimestamp()
  });
}

export async function desarquivarProjeto(id) {
  if (!id) throw new Error("Projeto inválido para desarquivamento.");

  const db = ensureDb();
  await db.collection("projetos").doc(id).update({
    arquivado: false,
    updatedAt: getServerTimestamp()
  });
}
