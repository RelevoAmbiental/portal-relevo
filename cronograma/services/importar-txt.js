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

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function normalizeCompare(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugifyFase(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return "planejamento";

  const mapa = {
    planejamento: "planejamento",
    campo: "campo",
    gabinete: "gabinete",
    entrega: "entrega",
    administrativo: "administrativo",
    acompanhamento: "administrativo",
    "a definir": "planejamento"
  };

  return mapa[raw] || raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

function getFaseLabel(value) {
  const mapa = {
    planejamento: "Planejamento",
    campo: "Campo",
    gabinete: "Gabinete",
    entrega: "Entrega",
    administrativo: "Administrativo"
  };

  return mapa[value] || value;
}

function parsePrioridadeToken(token) {
  const value = String(token || "").trim().toLowerCase();

  const mapa = {
    baixa: "baixa",
    media: "media",
    média: "media",
    alta: "alta",
    critica: "critica",
    crítica: "critica"
  };

  return mapa[value] || "";
}

function parseDuracaoToken(token) {
  const value = String(token || "").trim().toLowerCase();

  if (!value) return null;

  const matchDias = value.match(/^(\d+)\s*d$/i);
  if (matchDias) {
    return Number(matchDias[1]);
  }

  const matchDiaExtenso = value.match(/^(\d+)\s*dias?$/i);
  if (matchDiaExtenso) {
    return Number(matchDiaExtenso[1]);
  }

  return null;
}

function parseIsoDateToken(token) {
  const value = String(token || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return value;
}

function parseResponsavelToken(token) {
  const value = String(token || "").trim();

  const match = value.match(/^(resp|responsavel|responsável)\s*:\s*(.+)$/i);
  if (!match) return "";

  return String(match[2] || "").trim();
}

function buildDescricaoImportada(item) {
  const partes = [];

  if (item.duracaoDias) {
    partes.push(`Duração estimada importada: ${item.duracaoDias} dia(s).`);
  }

  if (item.descricao) {
    partes.push(item.descricao.trim());
  }

  return partes.join("\n\n").trim();
}

function addDaysIso(isoDate, daysToAdd) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(daysToAdd || 0));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function applyCascadeDates(items, dataInicioBase) {
  if (!dataInicioBase) return items;

  let cursor = dataInicioBase;

  return items.map((item) => {
    const clone = { ...item };

    if (!clone.dataInicio) {
      clone.dataInicio = cursor;
    }

    if (!clone.dataVencimento && clone.duracaoDias) {
      clone.dataVencimento = addDaysIso(clone.dataInicio, clone.duracaoDias - 1);
    }

    if (clone.duracaoDias) {
      cursor = addDaysIso(clone.dataInicio, clone.duracaoDias);
    } else if (clone.dataVencimento) {
      cursor = addDaysIso(clone.dataVencimento, 1);
    } else {
      cursor = addDaysIso(clone.dataInicio, 1);
    }

    return clone;
  });
}

export function resolveResponsavelByTexto(texto, users = []) {
  const termo = normalizeCompare(texto);
  if (!termo) return null;

  return (
    users.find((item) => {
      const nome = normalizeCompare(item?.nome);
      const email = normalizeCompare(item?.email);
      const username = normalizeCompare(item?.username);
      return nome === termo || email === termo || username === termo;
    }) || null
  );
}

export function parseTxtCronograma(texto) {
  const raw = normalizeText(texto);

  const result = {
    meta: {
      projetoNome: "",
      responsavelPadraoTexto: "",
      dataInicioBase: ""
    },
    itens: [],
    erros: [],
    avisos: []
  };

  if (!raw) {
    result.erros.push("Cole um conteúdo TXT antes de validar.");
    return result;
  }

  const linhas = raw.split("\n");
  let faseAtual = "planejamento";

  linhas.forEach((linhaOriginal, index) => {
    const numeroLinha = index + 1;
    const linha = linhaOriginal.trim();

    if (!linha) return;
    if (linha.startsWith("//") || linha.startsWith("# ")) return;

    const matchFase = linha.match(/^\[FASE\]\s*(.+)$/i);
    if (matchFase) {
      faseAtual = slugifyFase(matchFase[1]);
      return;
    }

    const matchProjeto = linha.match(/^\[PROJETO\]\s*(.+)$/i);
    if (matchProjeto) {
      result.meta.projetoNome = matchProjeto[1].trim();
      return;
    }

    const matchResponsavel = linha.match(/^\[RESPONSAVEL_PADRAO\]\s*(.+)$/i);
    if (matchResponsavel) {
      result.meta.responsavelPadraoTexto = matchResponsavel[1].trim();
      return;
    }

    const matchInicio = linha.match(/^\[INICIO\]\s*(.+)$/i);
    if (matchInicio) {
      const data = parseIsoDateToken(matchInicio[1]);
      if (!data) {
        result.erros.push(`Linha ${numeroLinha}: data de [INICIO] inválida. Use YYYY-MM-DD.`);
      } else {
        result.meta.dataInicioBase = data;
      }
      return;
    }

    if (!linha.startsWith("-")) {
      result.avisos.push(`Linha ${numeroLinha}: ignorada por não seguir o padrão de tarefa.`);
      return;
    }

    const semMarcador = linha.replace(/^-+\s*/, "").trim();
    if (!semMarcador) {
      result.erros.push(`Linha ${numeroLinha}: tarefa vazia.`);
      return;
    }

    const partes = semMarcador
      .split("|")
      .map((parte) => parte.trim())
      .filter(Boolean);

    const titulo = (partes.shift() || "").trim();

    if (!titulo) {
      result.erros.push(`Linha ${numeroLinha}: tarefa sem título.`);
      return;
    }

    let duracaoDias = null;
    let prioridade = "media";
    let dataVencimento = "";
    let responsavelTexto = "";
    const descricaoExtras = [];

    partes.forEach((parte) => {
      const duracao = parseDuracaoToken(parte);
      if (duracao !== null) {
        duracaoDias = duracao;
        return;
      }

      const prioridadeToken = parsePrioridadeToken(parte);
      if (prioridadeToken) {
        prioridade = prioridadeToken;
        return;
      }

      const isoDate = parseIsoDateToken(parte);
      if (isoDate) {
        dataVencimento = isoDate;
        return;
      }

      const responsavelToken = parseResponsavelToken(parte);
      if (responsavelToken) {
        responsavelTexto = responsavelToken;
        return;
      }

      descricaoExtras.push(parte);
    });

    result.itens.push({
      linha: numeroLinha,
      titulo,
      fase: faseAtual,
      faseLabel: getFaseLabel(faseAtual),
      prioridade,
      duracaoDias,
      dataInicio: "",
      dataVencimento,
      descricao: descricaoExtras.join(" | ").trim(),
      responsavelTexto
    });
  });

  if (result.meta.dataInicioBase) {
    result.itens = applyCascadeDates(result.itens, result.meta.dataInicioBase);
    result.avisos.push("Datas em cascata aplicadas a partir de [INICIO].");
  }

  if (!result.itens.length && !result.erros.length) {
    result.erros.push("Nenhuma tarefa válida foi encontrada no TXT.");
  }

  return result;
}

export async function salvarImportacaoLote({ itens, projeto, responsavel }) {
  if (!Array.isArray(itens) || !itens.length) {
    throw new Error("Não há tarefas válidas para salvar.");
  }

  if (!projeto?.id) {
    throw new Error("Selecione um projeto válido.");
  }

  if (!responsavel?.uid) {
    throw new Error("Selecione um responsável válido.");
  }

  const db = ensureDb();
  const user = ensureUser();
  const batch = db.batch();
  const now = getServerTimestamp();

  itens.forEach((item, index) => {
    const titulo = String(item?.titulo || "").trim();

    if (!titulo) {
      throw new Error("Uma das tarefas da prévia está sem título.");
    }

    const responsavelFinal =
      item?.responsavelUid
        ? {
            uid: item.responsavelUid,
            nome: item.responsavel || "",
            email: item.responsavelEmail || ""
          }
        : responsavel;

    if (!responsavelFinal?.uid) {
      throw new Error(`A tarefa "${titulo}" está sem responsável válido.`);
    }

    const ref = db.collection("tarefas").doc();

    batch.set(ref, {
      titulo,
      projetoId: projeto.id,
      projetoNome: projeto.nome || "",
      fase: item.fase || "planejamento",
      responsavel: responsavelFinal.nome || "",
      responsavelUid: responsavelFinal.uid,
      responsavelEmail: responsavelFinal.email || "",
      dataInicio: item.dataInicio || "",
      dataVencimento: item.dataVencimento || "",
      status: "a_fazer",
      prioridade: item.prioridade || "media",
      descricao: buildDescricaoImportada(item),
      duracaoEstimadaDias: item.duracaoDias || null,
      subtarefas: [],
      arquivada: false,
      uid: user.uid,
      ownerEmail: user.email || "",
      origemCadastro: "importacao_txt",
      ordemImportacao: index + 1,
      criadoEm: now,
      updatedAt: now
    });
  });

  await batch.commit();

  return {
    quantidade: itens.length
  };
}
