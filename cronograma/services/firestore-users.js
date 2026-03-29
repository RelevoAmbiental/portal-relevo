function getDb() {
  return window.__RELEVO_DB__ || window.db || null;
}

function getUser() {
  return window.__RELEVO_USER__ || null;
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

function normalizeUser(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    uid: doc.id,
    nome: data.nome || data.username || data.email || "Usuário",
    username: data.username || "",
    email: data.email || "",
    tipo: data.tipo || ""
  };
}

function sortUsers(items) {
  return [...items].sort((a, b) => {
    const aNome = (a.nome || "").toLowerCase();
    const bNome = (b.nome || "").toLowerCase();
    return aNome.localeCompare(bNome, "pt-BR");
  });
}

export function listenUsers(onChange, onError) {
  const db = ensureDb();
  ensureUser();

  return db.collection("users").onSnapshot(
    (snapshot) => {
      const items = snapshot.docs.map(normalizeUser);
      onChange(sortUsers(items));
    },
    (error) => {
      console.error("Erro ao ouvir users:", error);
      if (typeof onError === "function") onError(error);
    }
  );
}
