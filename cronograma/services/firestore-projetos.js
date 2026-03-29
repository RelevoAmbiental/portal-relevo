function getFirebaseCompat() {
  return window.firebase || window.__RELEVO_FIREBASE__ || null;
}

function getDb() {
  return window.__RELEVO_DB__ || window.db || null;
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
    propostaNumero: (payload.propostaNumero || "").trim(),
    responsavel: (payload.responsavel || "").trim(),
    dataInicio: payload.dataInicio || "",
    prazoFinal: payload.prazoFinal || "",
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

function sortProjetos(items) {
  return [...items].sort((a, b) => {
    const aNome = (a.nome || "").toLowerCase();
    const bNome = (b.nome || "").toLowerCase();
    return aNome.localeCompare(bNome, "pt-BR");
  });
}

export function listenProjetos(onChange, onError) {
  const db = ensureDb();

  return db.collection("cronograma_projetos").onSnapshot(
    (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
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
  const data = sanitizeProjeto(payload);
  validateProjeto(data);

  const now = getServerTimestamp();

  await db.collection("cronograma_projetos").add({
    ...data,
    createdAt: now,
    updatedAt: now
  });
}

export async function atualizarProjeto(id, payload) {
  if (!id) throw new Error("Projeto inválido para atualização.");

  const db = ensureDb();
  const data = sanitizeProjeto(payload);
  validateProjeto(data);

  await db.collection("cronograma_projetos").doc(id).update({
    ...data,
    updatedAt: getServerTimestamp()
  });
}

export async function arquivarProjeto(id) {
  if (!id) throw new Error("Projeto inválido para arquivamento.");

  const db = ensureDb();
  await db.collection("cronograma_projetos").doc(id).update({
    arquivado: true,
    updatedAt: getServerTimestamp()
  });
}

export async function desarquivarProjeto(id) {
  if (!id) throw new Error("Projeto inválido para desarquivamento.");

  const db = ensureDb();
  await db.collection("cronograma_projetos").doc(id).update({
    arquivado: false,
    updatedAt: getServerTimestamp()
  });
}
