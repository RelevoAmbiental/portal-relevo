===== INICIO app.js =====
// =======================================
// INVENTÁRIO RELEVO – LÓGICA PRINCIPAL
// Patrimônio + Movimentação + Operacional
// =======================================

// Usar serviços já inicializados pelo firebase-init-guard.js
const app = window.__RELEVO_APP__ || (window.firebase && firebase.app());
const db = window.__RELEVO_DB__ || (window.firebase && firebase.firestore());
const auth = window.__RELEVO_AUTH__ || (window.firebase && firebase.auth());
const storage = window.__RELEVO_STORAGE__ || (window.firebase && firebase.storage && firebase.storage());

if (!db || !auth || !storage) {
  console.error("❌ Inventário: Firebase não foi inicializado corretamente.");
}

// Nome da coleção principal de itens de patrimônio
const COLECAO_ITENS = "inventario"; // reaproveitando a coleção que já havíamos definido

// Siglas de categoria para código interno
const SIGLAS = {
  "EPI e Segurança": "EPI",
  "Iluminação": "ILU",
  "Espeleologia": "ESP",
  "Progressão Vertical": "PRV",
  "Topografia e Medição": "TOP",
  "Registro e Documentação": "REG",
  "Coleta e Amostragem Ambiental": "CAM",
  "Acessórios e Logística": "LOG",
  "Comunicação": "COM",
  "Outros": "OUT"
};

// Estado em memória
let itens = []; // lista de itens (patrimônio + estadoAtual)
let maxSeqPorPrefixo = {}; // { "EPI": 3, ... }

// Referências DOM – PATRIMÔNIO
const formPatrimonio = document.getElementById("form-patrimonio");
const inputPatCodigoInterno = document.getElementById("pat-codigoInterno");
const selectPatCategoria = document.getElementById("pat-categoria");
const inputPatNome = document.getElementById("pat-nome");
const inputPatQuantidadeTotal = document.getElementById("pat-quantidadeTotal");
const inputPatDataAquisicao = document.getElementById("pat-dataAquisicao");
const inputPatValorEstimado = document.getElementById("pat-valorEstimado");
const inputPatFoto = document.getElementById("pat-foto");
const inputPatDescricao = document.getElementById("pat-descricao");
const inputPatObservacoes = document.getElementById("pat-observacoes");
const spanPatStatus = document.getElementById("pat-status-mensagem");
const btnPatSalvar = document.getElementById("btn-pat-salvar");
const tbodyPatrimonio = document.getElementById("tbody-patrimonio");

// Referências DOM – MOVIMENTAÇÃO
const formMov = document.getElementById("form-movimentacao");
const selectMovItem = document.getElementById("mov-item");
const selectMovTipo = document.getElementById("mov-tipo");
const inputMovQuantidade = document.getElementById("mov-quantidade");
const inputMovResponsavel = document.getElementById("mov-responsavel");
const inputMovDestino = document.getElementById("mov-destino");
const inputMovObservacoes = document.getElementById("mov-observacoes");
const spanMovStatus = document.getElementById("mov-status-mensagem");
const spanMovItemResumo = document.getElementById("mov-item-resumo");
const btnMovSalvar = document.getElementById("btn-mov-salvar");
const tbodyMovimentacoes = document.getElementById("tbody-movimentacoes");

// Referências DOM – OPERACIONAL
const tbodyOperacional = document.getElementById("tbody-operacional");
const filtroOpCategoria = document.getElementById("op-filtro-categoria");
const filtroOpStatus = document.getElementById("op-filtro-status");
const filtroOpCodigo = document.getElementById("op-filtro-codigo");
const filtroOpResponsavel = document.getElementById("op-filtro-responsavel");

// KPIs
const kpiTotal = document.getElementById("kpi-total");
const kpiDisponiveis = document.getElementById("kpi-disponiveis");
const kpiEmprestadas = document.getElementById("kpi-emprestadas");
const kpiManutencao = document.getElementById("kpi-manutencao");
const kpiPerdidas = document.getElementById("kpi-perdidas");

// -----------------------------
// Autenticação básica
// -----------------------------
if (auth && auth.onAuthStateChanged) {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      console.log("❌ Inventário: usuário não autenticado. Redirecionando...");
      window.location.href = "../index.html";
    } else {
      console.log("✅ Inventário: usuário autenticado:", user.email);
    }
  });
}

// -----------------------------
// Helpers de formatação
// -----------------------------
function formatarData(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarNumero(n) {
  if (n == null || Number.isNaN(n)) return "0";
  return Number(n).toString();
}

// Gera código interno baseado na categoria + sequência local
function gerarCodigoInterno() {
  const categoria = selectPatCategoria.value;
  if (!categoria) {
    inputPatCodigoInterno.value = "";
    delete inputPatCodigoInterno.dataset.prefix;
    delete inputPatCodigoInterno.dataset.seq;
    return;
  }

  const prefixo = SIGLAS[categoria] || "OUT";
  const nextSeq = (maxSeqPorPrefixo[prefixo] || 0) + 1;
  const codigo = `${prefixo}-${String(nextSeq).padStart(3, "0")}`;

  inputPatCodigoInterno.value = codigo;
  inputPatCodigoInterno.dataset.prefix = prefixo;
  inputPatCodigoInterno.dataset.seq = String(nextSeq);
}

// Tipo movimentação → rótulo amigável
function labelMovTipo(tipo) {
  switch (tipo) {
    case "emprestimo": return "Empréstimo";
    case "devolucao": return "Devolução";
    case "manutencao": return "Manutenção";
    case "retorno_manutencao": return "Retorno Manutenção";
    case "perda": return "Baixa / Perda";
    case "ajuste": return "Ajuste";
    default: return tipo;
  }
}

// -----------------------------
// Tabs
// -----------------------------
document.querySelectorAll(".tab-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabId = btn.dataset.tab;
    document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    const sec = document.getElementById(tabId);
    if (sec) sec.classList.add("active");
  });
});

// -----------------------------
// Snapshot em tempo real – ITENS
// -----------------------------
if (db) {
  db.collection(COLECAO_ITENS)
    .orderBy("criadoEm", "desc")
    .onSnapshot((snap) => {
      itens = [];
      maxSeqPorPrefixo = {};

      snap.forEach((doc) => {
        const data = doc.data();
        const estadoAtual = data.estadoAtual || {};
        const responsaveis = data.responsaveis || {};

        // Atualiza o maxSeq para geração de novos códigos
        if (data.codigoPrefixo && typeof data.codigoSeq === "number") {
          const atual = maxSeqPorPrefixo[data.codigoPrefixo] || 0;
          if (data.codigoSeq > atual) {
            maxSeqPorPrefixo[data.codigoPrefixo] = data.codigoSeq;
          }
        }

        itens.push({
          id: doc.id,
          nome: data.nome || "",
          categoria: data.categoria || "",
          codigoInterno: data.codigoInterno || "",
          codigoPrefixo: data.codigoPrefixo || "",
          codigoSeq: data.codigoSeq || 0,
          quantidadeTotal: Number(data.quantidadeTotal || 0),
          descricao: data.descricao || "",
          observacoes: data.observacoes || "",
          dataAquisicao: data.dataAquisicao || null,
          valorEstimado: data.valorEstimado || null,
          fotoURL: data.fotoURL || "",
          estadoAtual: {
            disponivel: Number(estadoAtual.disponivel || 0),
            emprestado: Number(estadoAtual.emprestado || 0),
            manutencao: Number(estadoAtual.manutencao || 0),
            perdido: Number(estadoAtual.perdido || 0)
          },
          responsaveis,
          criadoEm: data.criadoEm || null
        });
      });

      atualizarKPIs();
      renderPatrimonio();
      renderMovSelect();
      renderOperacional();
      carregarUltimasMovimentacoes(); // snapshot separado de movimentações gerais
    });
}

// -----------------------------
// KPIs
// -----------------------------
function atualizarKPIs() {
  let totalUnidades = 0;
  let disponiveis = 0;
  let emprestadas = 0;
  let manutencao = 0;
  let perdidas = 0;

  itens.forEach((it) => {
    totalUnidades += it.quantidadeTotal || 0;
    disponiveis += it.estadoAtual.disponivel || 0;
    emprestadas += it.estadoAtual.emprestado || 0;
    manutencao += it.estadoAtual.manutencao || 0;
    perdidas += it.estadoAtual.perdido || 0;
  });

  kpiTotal.textContent = formatarNumero(totalUnidades);
  kpiDisponiveis.textContent = formatarNumero(disponiveis);
  kpiEmprestadas.textContent = formatarNumero(emprestadas);
  kpiManutencao.textContent = formatarNumero(manutencao);
  kpiPerdidas.textContent = formatarNumero(perdidas);
}

// -----------------------------
// Render – Patrimônio
// -----------------------------
function renderPatrimonio() {
  tbodyPatrimonio.innerHTML = "";

  if (!itens.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Nenhum item cadastrado.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    tbodyPatrimonio.appendChild(tr);
    return;
  }

  itens.forEach((it) => {
    const tr = document.createElement("tr");

    const tdCodigo = document.createElement("td");
    tdCodigo.textContent = it.codigoInterno || "-";

    const tdCategoria = document.createElement("td");
    tdCategoria.textContent = it.categoria || "-";

    const tdNome = document.createElement("td");
    tdNome.textContent = it.nome || "-";

    const tdQtde = document.createElement("td");
    tdQtde.textContent = formatarNumero(it.quantidadeTotal);

    const tdFoto = document.createElement("td");
    if (it.fotoURL) {
      const img = document.createElement("img");
      img.src = it.fotoURL;
      img.alt = it.nome || "Foto do equipamento";
      img.className = "equip-img-thumb";
      tdFoto.appendChild(img);
    } else {
      tdFoto.textContent = "-";
    }

    const tdCriado = document.createElement("td");
    tdCriado.textContent = formatarData(it.criadoEm);

    tr.appendChild(tdCodigo);
    tr.appendChild(tdCategoria);
    tr.appendChild(tdNome);
    tr.appendChild(tdQtde);
    tr.appendChild(tdFoto);
    tr.appendChild(tdCriado);

    tbodyPatrimonio.appendChild(tr);
  });
}

// -----------------------------
// Render – Select de item (Movimentação)
// -----------------------------
function renderMovSelect() {
  selectMovItem.innerHTML = '<option value="">Selecione um item...</option>';

  itens.forEach((it) => {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = `${it.codigoInterno || "SEM-COD"} — ${it.nome}`;
    selectMovItem.appendChild(opt);
  });

  atualizarResumoItemMov();
}

function atualizarResumoItemMov() {
  const id = selectMovItem.value;
  const it = itens.find((i) => i.id === id);
  if (!it) {
    spanMovItemResumo.textContent = "Selecione um item para ver o resumo de estoque.";
    return;
  }
  spanMovItemResumo.textContent =
    `Total: ${formatarNumero(it.quantidadeTotal)} | ` +
    `Disponível: ${formatarNumero(it.estadoAtual.disponivel)} | ` +
    `Emprestado: ${formatarNumero(it.estadoAtual.emprestado)} | ` +
    `Manutenção: ${formatarNumero(it.estadoAtual.manutencao)} | ` +
    `Perdido: ${formatarNumero(it.estadoAtual.perdido)}`;
}

selectMovItem.addEventListener("change", atualizarResumoItemMov);

// -----------------------------
// Render – Inventário Operacional
// -----------------------------
function aplicarFiltrosOperacional() {
  const cat = (filtroOpCategoria.value || "").trim();
  const st = (filtroOpStatus.value || "").trim();
  const cod = (filtroOpCodigo.value || "").trim().toLowerCase();
  const resp = (filtroOpResponsavel.value || "").trim().toLowerCase();

  return itens.filter((it) => {
    if (cat && it.categoria !== cat) return false;

    if (st) {
      const ea = it.estadoAtual;
      if (st === "disponivel" && !(ea.disponivel > 0)) return false;
      if (st === "emprestado" && !(ea.emprestado > 0)) return false;
      if (st === "manutencao" && !(ea.manutencao > 0)) return false;
      if (st === "perdido" && !(ea.perdido > 0)) return false;
    }

    if (cod && !(it.codigoInterno || "").toLowerCase().includes(cod)) {
      return false;
    }

    if (resp) {
      const respKeys = Object.keys(it.responsaveis || {});
      const match = respKeys.some((r) => r.toLowerCase().includes(resp));
      if (!match) return false;
    }

    return true;
  });
}

function renderOperacional() {
  const lista = aplicarFiltrosOperacional();
  tbodyOperacional.innerHTML = "";

  if (!lista.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.textContent = "Nenhum item encontrado com os filtros atuais.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    tbodyOperacional.appendChild(tr);
    return;
  }

  lista.forEach((it) => {
    const tr = document.createElement("tr");

    const tdCodigo = document.createElement("td");
    tdCodigo.textContent = it.codigoInterno || "-";

    const tdCategoria = document.createElement("td");
    tdCategoria.textContent = it.categoria || "-";

    const tdNome = document.createElement("td");
    tdNome.textContent = it.nome || "-";

    const tdQtdeTotal = document.createElement("td");
    tdQtdeTotal.textContent = formatarNumero(it.quantidadeTotal);

    const tdDisp = document.createElement("td");
    tdDisp.textContent = formatarNumero(it.estadoAtual.disponivel);

    const tdEmp = document.createElement("td");
    tdEmp.textContent = formatarNumero(it.estadoAtual.emprestado);

    const tdMan = document.createElement("td");
    tdMan.textContent = formatarNumero(it.estadoAtual.manutencao);

    const tdPerd = document.createElement("td");
    tdPerd.textContent = formatarNumero(it.estadoAtual.perdido);

    const tdResp = document.createElement("td");
    const respMap = it.responsaveis || {};
    const respEntries = Object.keys(respMap).map(
      (nome) => `${nome} (${respMap[nome]})`
    );
    tdResp.textContent = respEntries.length ? respEntries.join("; ") : "—";

    tr.appendChild(tdCodigo);
    tr.appendChild(tdCategoria);
    tr.appendChild(tdNome);
    tr.appendChild(tdQtdeTotal);
    tr.appendChild(tdDisp);
    tr.appendChild(tdEmp);
    tr.appendChild(tdMan);
    tr.appendChild(tdPerd);
    tr.appendChild(tdResp);

    tbodyOperacional.appendChild(tr);
  });
}

[filtroOpCategoria, filtroOpStatus, filtroOpCodigo, filtroOpResponsavel].forEach(
  (el) => {
    el.addEventListener("input", renderOperacional);
    el.addEventListener("change", renderOperacional);
  }
);

// -----------------------------
// Submissão – Cadastro de Patrimônio
// -----------------------------
formPatrimonio.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db || !storage) return;

  const categoria = selectPatCategoria.value;
  const nome = inputPatNome.value.trim();
  const qtdeTotal = parseInt(inputPatQuantidadeTotal.value || "0", 10);
  const fotoFile = inputPatFoto.files[0] || null;

  if (!categoria || !nome || !qtdeTotal || qtdeTotal <= 0 || !fotoFile) {
    spanPatStatus.textContent =
      "Preencha corretamente os campos obrigatórios (código, categoria, nome, quantidade e foto).";
    return;
  }

  // Garante código interno
  if (!inputPatCodigoInterno.value) {
    gerarCodigoInterno();
  }
  const prefixo = inputPatCodigoInterno.dataset.prefix || (SIGLAS[categoria] || "OUT");
  const seq = parseInt(inputPatCodigoInterno.dataset.seq || "1", 10);
  const codigoInterno = inputPatCodigoInterno.value;

  const descricao = inputPatDescricao.value.trim();
  const observacoes = inputPatObservacoes.value.trim();
  const valorEstimado = inputPatValorEstimado.value
    ? parseFloat(inputPatValorEstimado.value.replace(",", "."))
    : null;
  const dataAquisicaoRaw = inputPatDataAquisicao.value;
  const dataAquisicao = dataAquisicaoRaw ? new Date(dataAquisicaoRaw) : null;

  spanPatStatus.textContent = "Salvando patrimônio...";
  btnPatSalvar.disabled = true;

  try {
    const docRef = db.collection(COLECAO_ITENS).doc();
    let fotoURL = "";

    // Upload da foto
    const storageRef = storage.ref().child(`inventario/${docRef.id}_${fotoFile.name}`);
    await storageRef.put(fotoFile);
    fotoURL = await storageRef.getDownloadURL();

    const agora = firebase.firestore.FieldValue.serverTimestamp();

    const payload = {
      nome,
      categoria,
      codigoInterno,
      codigoPrefixo: prefixo,
      codigoSeq: seq,
      quantidadeTotal: qtdeTotal,
      descricao,
      observacoes,
      valorEstimado: valorEstimado != null ? valorEstimado : null,
      dataAquisicao: dataAquisicao || null,
      fotoURL: fotoURL || "",
      estadoAtual: {
        disponivel: qtdeTotal,
        emprestado: 0,
        manutencao: 0,
        perdido: 0
      },
      responsaveis: {},
      criadoEm: agora,
      atualizadoEm: agora
    };

    await docRef.set(payload);

    if (!maxSeqPorPrefixo[prefixo] || seq > maxSeqPorPrefixo[prefixo]) {
      maxSeqPorPrefixo[prefixo] = seq;
    }

    formPatrimonio.reset();
    inputPatCodigoInterno.value = "";
    delete inputPatCodigoInterno.dataset.prefix;
    delete inputPatCodigoInterno.dataset.seq;

    spanPatStatus.textContent = "Patrimônio cadastrado com sucesso.";
  } catch (err) {
    console.error("Erro ao salvar patrimônio:", err);
    spanPatStatus.textContent = "Erro ao salvar patrimônio. Tente novamente.";
  } finally {
    btnPatSalvar.disabled = false;
    setTimeout(() => (spanPatStatus.textContent = ""), 3000);
  }
});

// Gerar código sempre que categoria mudar
selectPatCategoria.addEventListener("change", () => {
  gerarCodigoInterno();
});

// -----------------------------
// Lógica de aplicação de movimentação
// -----------------------------
function aplicarMovimentacaoAoEstado(it, mov) {
  const novo = {
    disponivel: it.estadoAtual.disponivel,
    emprestado: it.estadoAtual.emprestado,
    manutencao: it.estadoAtual.manutencao,
    perdido: it.estadoAtual.perdido
  };

  const total = it.quantidadeTotal || 0;
  const q = mov.quantidade;

  switch (mov.tipo) {
    case "emprestimo":
      if (q > novo.disponivel) {
        throw new Error("Quantidade solicitada maior que a disponível.");
      }
      novo.disponivel -= q;
      novo.emprestado += q;
      break;

    case "devolucao":
      if (q > novo.emprestado) {
        throw new Error("Quantidade devolvida maior que a emprestada.");
      }
      novo.emprestado -= q;
      novo.disponivel += q;
      break;

    case "manutencao":
      if (q > novo.disponivel) {
        throw new Error("Quantidade em manutenção maior que a disponível.");
      }
      novo.disponivel -= q;
      novo.manutencao += q;
      break;

    case "retorno_manutencao":
      if (q > novo.manutencao) {
        throw new Error("Quantidade de retorno maior que a em manutenção.");
      }
      novo.manutencao -= q;
      novo.disponivel += q;
      break;

    case "perda":
      // Por simplicidade: primeiro consome disponíveis, depois emprestadas
      let resto = q;
      const dispAntes = novo.disponivel;
      if (resto <= novo.disponivel) {
        novo.disponivel -= resto;
        resto = 0;
      } else {
        resto -= novo.disponivel;
        novo.disponivel = 0;
      }
      if (resto > 0) {
        if (resto > novo.emprestado) {
          throw new Error("Quantidade perdida maior que (disponível + emprestada).");
        }
        novo.emprestado -= resto;
      }
      novo.perdido += q;
      break;

    case "ajuste":
      // Ajuste pode ser positivo (entrada) ou negativo (saída de disponível)
      const novaDisp = novo.disponivel + q;
      if (novaDisp < 0) {
        throw new Error("Ajuste resultaria em disponível negativa.");
      }
      if (novaDisp + novo.emprestado + novo.manutencao + novo.perdido > total) {
        throw new Error("Ajuste ultrapassa a quantidade total cadastrada.");
      }
      novo.disponivel = novaDisp;
      break;

    default:
      throw new Error("Tipo de movimentação inválido.");
  }

  if (
    novo.disponivel < 0 ||
    novo.emprestado < 0 ||
    novo.manutencao < 0 ||
    novo.perdido < 0
  ) {
    throw new Error("Movimentação resultou em valores negativos.");
  }

  if (
    novo.disponivel + novo.emprestado + novo.manutencao + novo.perdido >
    total
  ) {
    throw new Error("Soma de estados ultrapassa a quantidade total.");
  }

  return novo;
}

function atualizarResponsaveis(it, mov) {
  const map = { ...(it.responsaveis || {}) };
  const nome = (mov.responsavel || "").trim();
  const q = mov.quantidade;

  if (!nome) {
    return map;
  }

  const atual = Number(map[nome] || 0);

  switch (mov.tipo) {
    case "emprestimo":
      map[nome] = atual + q;
      break;

    case "devolucao":
      map[nome] = Math.max(0, atual - q);
      if (map[nome] === 0) {
        delete map[nome];
      }
      break;

    case "perda":
      // se estava emprestado com essa pessoa, desconta
      map[nome] = Math.max(0, atual - q);
      if (map[nome] === 0) {
        delete map[nome];
      }
      break;

    // manutenção / retorno / ajuste: não mexem em custódia individual
    default:
      break;
  }

  return map;
}

// -----------------------------
// Submissão – Movimentação
// -----------------------------
formMov.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;

  const itemId = selectMovItem.value;
  const tipo = selectMovTipo.value;
  const quantidade = parseInt(inputMovQuantidade.value || "0", 10);
  const responsavel = inputMovResponsavel.value.trim();
  const destino = inputMovDestino.value.trim();
  const observacoes = inputMovObservacoes.value.trim();

  if (!itemId || !tipo || !quantidade || quantidade <= 0) {
    spanMovStatus.textContent =
      "Preencha item, tipo de movimentação e quantidade.";
    return;
  }

  const it = itens.find((i) => i.id === itemId);
  if (!it) {
    spanMovStatus.textContent = "Item não encontrado.";
    return;
  }

  const mov = {
    itemId,
    tipo,
    quantidade,
    responsavel,
    destino,
    observacoes
  };

  spanMovStatus.textContent = "Registrando movimentação...";
  btnMovSalvar.disabled = true;

  try {
    // Calcula novo estadoAtual
    const novoEstado = aplicarMovimentacaoAoEstado(it, mov);
    const novosResponsaveis = atualizarResponsaveis(it, mov);
    const agora = firebase.firestore.FieldValue.serverTimestamp();

    const itemRef = db.collection(COLECAO_ITENS).doc(itemId);
    const movRef = itemRef.collection("movimentacoes").doc();

    await db.runTransaction(async (tx) => {
      tx.set(movRef, {
        ...mov,
        data: agora,
        criadoEm: agora
      });
      tx.update(itemRef, {
        estadoAtual: novoEstado,
        responsaveis: novosResponsaveis,
        atualizadoEm: agora
      });
    });

    formMov.reset();
    spanMovStatus.textContent = "Movimentação registrada com sucesso.";
    atualizarResumoItemMov();
  } catch (err) {
    console.error("Erro ao registrar movimentação:", err);
    spanMovStatus.textContent = err.message || "Erro ao registrar movimentação.";
  } finally {
    btnMovSalvar.disabled = false;
    setTimeout(() => (spanMovStatus.textContent = ""), 4000);
  }
});

// -----------------------------
// Histórico – Últimas movimentações (geral)
// -----------------------------
async function carregarUltimasMovimentacoes() {
  if (!db) return;
  // Busca até 20 movimentações mais recentes usando collectionGroup
  try {
    const snap = await db
      .collectionGroup("movimentacoes")
      .orderBy("data", "desc")
      .limit(20)
      .get();

    tbodyMovimentacoes.innerHTML = "";

    if (snap.empty) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "Nenhuma movimentação registrada.";
      td.style.textAlign = "center";
      tr.appendChild(td);
      tbodyMovimentacoes.appendChild(tr);
      return;
    }

    snap.forEach((doc) => {
      const data = doc.data();
      const it = itens.find((i) => i.id === data.itemId);

      const tr = document.createElement("tr");

      const tdData = document.createElement("td");
      tdData.textContent = formatarData(data.data);

      const tdItem = document.createElement("td");
      tdItem.textContent = it
        ? `${it.codigoInterno || ""} — ${it.nome}`
        : "(item removido)";

      const tdTipo = document.createElement("td");
      tdTipo.textContent = labelMovTipo(data.tipo);

      const tdQtd = document.createElement("td");
      tdQtd.textContent = formatarNumero(data.quantidade);

      const tdResp = document.createElement("td");
      tdResp.textContent = data.responsavel || "—";

      const tdDest = document.createElement("td");
      tdDest.textContent = data.destino || "—";

      tr.appendChild(tdData);
      tr.appendChild(tdItem);
      tr.appendChild(tdTipo);
      tr.appendChild(tdQtd);
      tr.appendChild(tdResp);
      tr.appendChild(tdDest);

      tbodyMovimentacoes.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro ao carregar últimas movimentações:", err);
  }
}

// -----------------------------
// Inicialização básica
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log("📦 Módulo Inventário carregado.");
  // Garante estado inicial das tabs (já definido no HTML)
});
