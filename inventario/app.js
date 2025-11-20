// =======================================
// INVENTÁRIO – LÓGICA PRINCIPAL
// =======================================

// Configuração Firebase (mesma do portal)
const firebaseConfig = {
  apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
  authDomain: "portal-relevo.firebaseapp.com",
  projectId: "portal-relevo",
  storageBucket: "portal-relevo.firebasestorage.app",
  messagingSenderId: "182759626683",
  appId: "1:182759626683:web:2dde2eeef910d4c288569e"
};

// Inicializa app se ainda não houver
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const storage = firebase.storage();

// Coleção do inventário
const COLECAO = "inventario";

// Mapeamento de siglas por categoria base
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
let todosEquipamentos = [];
let maxSeqPorPrefixo = {}; // ex: { EPI: 3, ILU: 5, ... }

// Referências DOM
const formCadastro = document.getElementById("form-cadastro");
const inputNome = document.getElementById("nome");
const selectCategoria = document.getElementById("categoria");
const grupoCategoriaOutro = document.getElementById("grupo-categoria-outro");
const inputCategoriaOutro = document.getElementById("categoriaOutro");
const inputCodigoInterno = document.getElementById("codigoInterno");
const selectStatus = document.getElementById("status");
const inputFoto = document.getElementById("foto");
const inputDescricao = document.getElementById("descricao");
const tbodyEquip = document.getElementById("tbody-equipamentos");
const statusMensagem = document.getElementById("status-mensagem");
const btnSalvar = document.getElementById("btn-salvar");

// Filtros
const filtroCategoria = document.getElementById("filtro-categoria");
const filtroStatus = document.getElementById("filtro-status");
const filtroCodigo = document.getElementById("filtro-codigo");

// Stats
const statTotal = document.getElementById("stat-total");
const statDisponiveis = document.getElementById("stat-disponiveis");
const statEmprestados = document.getElementById("stat-emprestados");
const statManutencao = document.getElementById("stat-manutencao");
const statPerdidos = document.getElementById("stat-perdidos");

// -----------------------------
// Helpers
// -----------------------------

function mostrarCategoriaOutroSeNecessario() {
  if (selectCategoria.value === "Outros") {
    grupoCategoriaOutro.style.display = "block";
  } else {
    grupoCategoriaOutro.style.display = "none";
    inputCategoriaOutro.value = "";
  }
}

function getCategoriaFinal() {
  if (selectCategoria.value === "Outros") {
    const outro = inputCategoriaOutro.value.trim();
    return outro || "Outros";
  }
  return selectCategoria.value;
}

function gerarCodigoInterno() {
  const categoriaBase = selectCategoria.value;
  if (!categoriaBase) {
    inputCodigoInterno.value = "";
    delete inputCodigoInterno.dataset.prefix;
    delete inputCodigoInterno.dataset.seq;
    return;
  }

  const prefixo = SIGLAS[categoriaBase] || "OUT";
  const nextSeq = (maxSeqPorPrefixo[prefixo] || 0) + 1;
  const codigo = `${prefixo}-${String(nextSeq).padStart(3, "0")}`;

  inputCodigoInterno.value = codigo;
  inputCodigoInterno.dataset.prefix = prefixo;
  inputCodigoInterno.dataset.seq = String(nextSeq);
}

function formatarData(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function atualizarStats() {
  const total = todosEquipamentos.length;
  let disponiveis = 0;
  let emprestados = 0;
  let manutencao = 0;
  let perdidos = 0;

  todosEquipamentos.forEach((eq) => {
    switch (eq.status) {
      case "disponivel":
        disponiveis++;
        break;
      case "emprestado":
        emprestados++;
        break;
      case "manutencao":
        manutencao++;
        break;
      case "perdido":
        perdidos++;
        break;
      default:
        break;
    }
  });

  statTotal.textContent = total;
  statDisponiveis.textContent = disponiveis;
  statEmprestados.textContent = emprestados;
  statManutencao.textContent = manutencao;
  statPerdidos.textContent = perdidos;
}

function aplicarFiltrosERender() {
  const cat = filtroCategoria.value;
  const st = filtroStatus.value;
  const cod = filtroCodigo.value.trim().toLowerCase();

  const filtrados = todosEquipamentos.filter((eq) => {
    if (cat && eq.categoriaBase === "Outros" && cat === "Outros") {
      // ok
    } else if (cat && eq.categoriaBase !== cat && eq.categoria !== cat) {
      return false;
    }

    if (st && eq.status !== st) return false;

    if (cod && !(eq.codigoInterno || "").toLowerCase().includes(cod)) {
      return false;
    }

    return true;
  });

  renderTabela(filtrados);
}

function renderTabela(lista) {
  tbodyEquip.innerHTML = "";

  if (!lista.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Nenhum equipamento encontrado.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    tbodyEquip.appendChild(tr);
    return;
  }

  lista.forEach((eq) => {
    const tr = document.createElement("tr");

    const tdCodigo = document.createElement("td");
    tdCodigo.textContent = eq.codigoInterno || "-";

    const tdNome = document.createElement("td");
    tdNome.textContent = eq.nome || "-";

    const tdCategoria = document.createElement("td");
    tdCategoria.textContent = eq.categoria || "-";

    const tdStatus = document.createElement("td");
    const spanStatus = document.createElement("span");
    spanStatus.classList.add("status-badge");
    spanStatus.textContent = eq.status || "-";
    switch (eq.status) {
      case "disponivel":
        spanStatus.classList.add("status-disponivel");
        spanStatus.textContent = "Disponível";
        break;
      case "emprestado":
        spanStatus.classList.add("status-emprestado");
        spanStatus.textContent = "Emprestado";
        break;
      case "manutencao":
        spanStatus.classList.add("status-manutencao");
        spanStatus.textContent = "Manutenção";
        break;
      case "perdido":
        spanStatus.classList.add("status-perdido");
        spanStatus.textContent = "Perdido";
        break;
      default:
        break;
    }
    tdStatus.appendChild(spanStatus);

    const tdFoto = document.createElement("td");
    if (eq.fotoURL) {
      const img = document.createElement("img");
      img.src = eq.fotoURL;
      img.alt = eq.nome || "Foto do equipamento";
      img.className = "equip-img-thumb";
      tdFoto.appendChild(img);
    } else {
      tdFoto.textContent = "-";
    }

    const tdCriado = document.createElement("td");
    tdCriado.textContent = formatarData(eq.criadoEm);

    tr.appendChild(tdCodigo);
    tr.appendChild(tdNome);
    tr.appendChild(tdCategoria);
    tr.appendChild(tdStatus);
    tr.appendChild(tdFoto);
    tr.appendChild(tdCriado);

    tbodyEquip.appendChild(tr);
  });
}

// -----------------------------
// Snapshot em tempo real
// -----------------------------

db.collection(COLECAO).orderBy("criadoEm", "desc").onSnapshot((snap) => {
  todosEquipamentos = [];
  maxSeqPorPrefixo = {};

  snap.forEach((doc) => {
    const data = doc.data();
    const eq = {
      id: doc.id,
      nome: data.nome || "",
      categoria: data.categoria || "",
      categoriaBase: data.categoriaBase || data.categoria || "",
      codigoPrefixo: data.codigoPrefixo || "",
      codigoSeq: data.codigoSeq || 0,
      codigoInterno: data.codigoInterno || "",
      status: data.status || "",
      fotoURL: data.fotoURL || "",
      criadoEm: data.criadoEm || null
    };

    // Atualiza max seq por prefixo
    if (eq.codigoPrefixo && typeof eq.codigoSeq === "number") {
      const atual = maxSeqPorPrefixo[eq.codigoPrefixo] || 0;
      if (eq.codigoSeq > atual) {
        maxSeqPorPrefixo[eq.codigoPrefixo] = eq.codigoSeq;
      }
    }

    todosEquipamentos.push(eq);
  });

  atualizarStats();
  aplicarFiltrosERender();
});

// -----------------------------
// Eventos UI
// -----------------------------

selectCategoria.addEventListener("change", () => {
  mostrarCategoriaOutroSeNecessario();
  gerarCodigoInterno();
});

inputCategoriaOutro.addEventListener("input", () => {
  // Categoria final só muda o texto, mas o prefixo continua OUT
  if (selectCategoria.value === "Outros") {
    gerarCodigoInterno();
  }
});

filtroCategoria.addEventListener("change", aplicarFiltrosERender);
filtroStatus.addEventListener("change", aplicarFiltrosERender);
filtroCodigo.addEventListener("input", aplicarFiltrosERender);

// -----------------------------
// Submit do formulário
// -----------------------------

formCadastro.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = inputNome.value.trim();
  const categoriaBase = selectCategoria.value;
  const categoriaFinal = getCategoriaFinal();
  const status = selectStatus.value;

  if (!nome || !categoriaBase || !status) {
    statusMensagem.textContent = "Preencha os campos obrigatórios (nome, categoria e status).";
    return;
  }

  // Garante que temos um código interno
  if (!inputCodigoInterno.value) {
    gerarCodigoInterno();
  }

  const prefixo = inputCodigoInterno.dataset.prefix || (SIGLAS[categoriaBase] || "OUT");
  const seq = parseInt(inputCodigoInterno.dataset.seq || "1", 10);

  const descricao = inputDescricao.value.trim();
  const arquivo = inputFoto.files[0] || null;

  statusMensagem.textContent = "Salvando equipamento...";
  btnSalvar.disabled = true;

  try {
    const docRef = db.collection(COLECAO).doc();
    let fotoURL = "";

    if (arquivo) {
      const storageRef = storage.ref().child(`inventario/${docRef.id}_${arquivo.name}`);
      await storageRef.put(arquivo);
      fotoURL = await storageRef.getDownloadURL();
    }

    const agora = firebase.firestore.FieldValue.serverTimestamp();

    const payload = {
      nome,
      categoria: categoriaFinal,
      categoriaBase,
      codigoPrefixo: prefixo,
      codigoSeq: seq,
      codigoInterno: inputCodigoInterno.value,
      status,
      descricao,
      fotoURL: fotoURL || "",
      criadoEm: agora,
      atualizadoEm: agora
    };

    await docRef.set(payload);

    // Atualiza contador local
    if (!maxSeqPorPrefixo[prefixo] || seq > maxSeqPorPrefixo[prefixo]) {
      maxSeqPorPrefixo[prefixo] = seq;
    }

    formCadastro.reset();
    inputCodigoInterno.value = "";
    delete inputCodigoInterno.dataset.prefix;
    delete inputCodigoInterno.dataset.seq;
    grupoCategoriaOutro.style.display = "none";
    statusMensagem.textContent = "Equipamento cadastrado com sucesso.";
  } catch (err) {
    console.error("Erro ao salvar equipamento:", err);
    statusMensagem.textContent = "Erro ao salvar. Tente novamente.";
  } finally {
    btnSalvar.disabled = false;
    setTimeout(() => {
      statusMensagem.textContent = "";
    }, 3000);
  }
});

// Inicializa categoria/outro/código na carga
document.addEventListener("DOMContentLoaded", () => {
  mostrarCategoriaOutroSeNecessario();
});
