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

function ensureUser() {
  const user = getUser();
  if (!user?.uid) {
    throw new Error("Usuário não autenticado.");
  }
  return user;
}

function sanitizeTarefa(payload) {
  return {
    titulo: (payload.titulo || "").trim(),
    projetoId: (payload.projetoId || "").trim(),
    projetoNome: (payload.projetoNome || "").trim(),
    responsavel: (payload.responsavel || "").trim(),
    dataInicio: payload.dataInicio || "",
    dataVencimento: payload.dataVencimento || "",
    status: payload.status || "a_fazer",
    prioridade: payload.prioridade || "media",
    descricao: (payload.descricao || "").trim(),
    arquivada: Boolean(payload.arquivada)
  };
}

function validateTarefa(payload) {
  if (!payload.titulo) {
    throw new Error("Informe o título da tarefa.");
  }

  if (!payload.projetoId) {
    throw new Error("Selecione um projeto.");
  }
}

function normalizeTarefa(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    titulo: data.titulo || data.nome || "",
    projetoId: data.projetoId || "",
    projetoNome: data.projetoNome || "",
    responsavel: data.responsavel || "",
    dataInicio: data.dataInicio || "",
    dataVencimento: data.dataVencimento || "",
    status: data.status || "a_fazer",
    prioridade: data.prioridade || "media",
    descricao: data.descricao || "",
    arquivada: Boolean(data.arquivada),
    uid: data.uid || "",
    ownerEmail: data.ownerEmail || "",
    createdAt: data.createdAt || data.criadoEm || null,
    updatedAt: data.updatedAt || null
  };
}

function sortTarefas(items) {
  return [...items].sort((a, b) => {
    const aDate = a.dataVencimento || "9999-12-31";
    const bDate = b.dataVencimento || "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);

    const aTitulo = (a.titulo || "").toLowerCase();
    const bTitulo = (b.titulo || "").toLowerCase();
    return aTitulo.localeCompare(bTitulo, "pt-BR");
  });
}

export function listenTarefas(onChange, onError) {
  const db = ensureDb();
  const user = ensureUser();

  return db
    .collection("tarefas")
    .where("uid", "==", user.uid)
    .onSnapshot(
      (snapshot) => {
        const items = snapshot.docs.map(normalizeTarefa);
        onChange(sortTarefas(items));
      },
      (error) => {
        console.error("Erro ao ouvir tarefas:", error);
        if (typeof onError === "function") onError(error);
      }
    );
}

export async function criarTarefa(payload) {
  const db = ensureDb();
  const user = ensureUser();
  const data = sanitizeTarefa(payload);
  validateTarefa(data);

  const now = getServerTimestamp();

  await db.collection("tarefas").add({
    ...data,
    uid: user.uid,
    ownerEmail: user.email || "",
    criadoEm: now,
    updatedAt: now
  });
}

export async function atualizarTarefa(id, payload) {
  if (!id) throw new Error("Tarefa inválida para atualização.");

  const db = ensureDb();
  const user = ensureUser();
  const data = sanitizeTarefa(payload);
  validateTarefa(data);

  await db.collection("tarefas").doc(id).update({
    ...data,
    uid: user.uid,
    ownerEmail: user.email || "",
    updatedAt: getServerTimestamp()
  });
}

export async function arquivarTarefa(id) {
  if (!id) throw new Error("Tarefa inválida para arquivamento.");

  const db = ensureDb();
  await db.collection("tarefas").doc(id).update({
    arquivada: true,
    updatedAt: getServerTimestamp()
  });
}

export async function desarquivarTarefa(id) {
  if (!id) throw new Error("Tarefa inválida para desarquivamento.");

  const db = ensureDb();
  await db.collection("tarefas").doc(id).update({
    arquivada: false,
    updatedAt: getServerTimestamp()
  });
}
