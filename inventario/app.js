// inventario/app.js
/* global firebase */

const db = window.__RELEVO_DB__;
const storage = firebase.storage();

const tabela = document.getElementById("tabela-inventario");
const filtroNome = document.getElementById("filtro-nome");
const filtroStatus = document.getElementById("filtro-status");
const filtroLocal = document.getElementById("filtro-local");
const btnFiltros = document.getElementById("btn-aplicar-filtros");
const btnNovoItem = document.getElementById("btn-novo-item");
const roleHint = document.getElementById("inventario-role-hint");

const cardForm = document.getElementById("card-form");
const formInventario = document.getElementById("form-inventario");
const formTitle = document.getElementById("form-title");
const btnCancelarForm = document.getElementById("btn-cancelar-form");

const cardMov = document.getElementById("card-mov");
const formMov = document.getElementById("form-movimentacao");
const movItemId = document.getElementById("mov-item-id");

let inventarioRaw = [];
let editandoId = null;
let userRole = null;
let userName = null;

// ==================================================
// Sessão do usuário (role e nome)
// ==================================================
function carregarSessao() {
  try {
    const raw = localStorage.getItem("relevoSession");
    if (!raw) return;
    const sess = JSON.parse(raw);
    userRole = sess.tipo || null; // gestao / colaborador / cliente
    userName = sess.email || null;

    if (userRole === "gestao") {
      roleHint.textContent =
        "Perfil: Gestão. Você pode cadastrar, movimentar, editar e excluir equipamentos.";
    } else if (userRole === "colaborador") {
      roleHint.textContent =
        "Perfil: Colaborador. Você pode cadastrar novos itens e registrar movimentações.";
    } else {
      roleHint.textContent =
        "Seu perfil não possui permissões completas neste módulo.";
      btnNovoItem.style.display = "none";
    }
  } catch (e) {
    console.error("Erro ao carregar sessão:", e);
  }
}

// ==================================================
// Listagem em tempo real
// ==================================================
function iniciarListener() {
  db.collection("inventario")
    .orderBy("nome")
    .onSnapshot((snap) => {
      inventarioRaw = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      renderTabela();
    }, (err) => {
      console.error("Erro ao carregar inventário:", err);
    });
}

// ==================================================
// Renderização da tabela
// ==================================================
function passaFiltros(item) {
  const termo = filtroNome.value.trim().toLowerCase();
  const st = filtroStatus.value;
  const loc = filtroLocal.value.trim().toLowerCase();

  if (termo) {
    const haystack = (item.nome || "") + " " + (item.codigo || "");
    if (!haystack.toLowerCase().includes(termo)) return false;
  }
  if (st && item.status !== st) return false;
  if (loc && !(item.localizacao || "").toLowerCase().includes(loc)) return false;
  return true;
}

function renderTabela() {
  tabela.innerHTML = "";

  const filtrados = inventarioRaw.filter(passaFiltros);

  if (!filtrados.length) {
    tabela.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;">Nenhum equipamento encontrado.</td>
      </tr>`;
    return;
  }

  filtrados.forEach((item) => {
    const tr = document.createElement("tr");

    const fotoTd = document.createElement("td");
    if (item.fotoURL) {
      fotoTd.innerHTML = `<img src="${item.fotoURL}" alt="Foto" style="width:48px;height:48px;object-fit:cover;border-radius:8px;">`;
    } else {
      fotoTd.textContent = "—";
    }

    const nomeTd = document.createElement("td");
    nomeTd.textContent = item.nome || "";

    const codTd = document.createElement("td");
    codTd.textContent = item.codigo || "";

    const catTd = document.createElement("td");
    catTd.textContent = item.categoria || "";

    const stTd = document.createElement("td");
    stTd.textContent = item.status || "";

    const locTd = document.createElement("td");
    locTd.textContent = item.localizacao || "";

    const respTd = document.createElement("td");
    respTd.textContent = item.responsavelAtual || "—";

    const acoesTd = document.createElement("td");
    const btnMov = document.createElement("button");
    btnMov.className = "btn btn-small";
    btnMov.innerHTML = '<i class="fas fa-exchange-alt"></i>';
    btnMov.title = "Registrar movimentação";
    btnMov.onclick = () => abrirMovimentacao(item.id);

    acoesTd.appendChild(btnMov);

    if (userRole === "gestao") {
      const btnEdit = document.createElement("button");
      btnEdit.className = "btn btn-small";
      btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
      btnEdit.title = "Editar equipamento";
      btnEdit.onclick = () => abrirEdicao(item);

      const btnDel = document.createElement("button");
      btnDel.className = "btn btn-small btn-danger";
      btnDel.innerHTML = '<i class="fas fa-trash"></i>';
      btnDel.title = "Excluir equipamento";
      btnDel.onclick = () => excluirItem(item.id);

      acoesTd.appendChild(btnEdit);
      acoesTd.appendChild(btnDel);
    }

    tr.appendChild(fotoTd);
    tr.appendChild(nomeTd);
    tr.appendChild(codTd);
    tr.appendChild(catTd);
    tr.appendChild(stTd);
    tr.appendChild(locTd);
    tr.appendChild(respTd);
    tr.appendChild(acoesTd);

    tabela.appendChild(tr);
  });
}

// ==================================================
// Formulário de cadastro / edição
// ==================================================
function abrirFormNovo() {
  editandoId = null;
  formTitle.textContent = "Novo Equipamento";
  formInventario.reset();
  cardForm.style.display = "block";
  cardMov.style.display = "none";
}

function abrirEdicao(item) {
  if (userRole !== "gestao") return;

  editandoId = item.id;
  formTitle.textContent = "Editar Equipamento";

  document.getElementById("nome").value = item.nome || "";
  document.getElementById("codigo").value = item.codigo || "";
  document.getElementById("categoria").value = item.categoria || "";
  document.getElementById("status").value = item.status || "disponivel";
  document.getElementById("localizacao").value = item.localizacao || "";
  document.getElementById("responsavelAtual").value = item.responsavelAtual || "";
  document.getElementById("valorEstimado").value = item.valorEstimado || "";
  document.getElementById("dataAquisicao").value = item.dataAquisicao || "";
  document.getElementById("descricao").value = item.descricao || "";

  cardForm.style.display = "block";
  cardMov.style.display = "none";
}

async function salvarItem(e) {
  e.preventDefault();
  if (!userRole || (userRole !== "gestao" && userRole !== "colaborador")) return;

  const nome = document.getElementById("nome").value.trim();
  if (!nome) return alert("Informe o nome do equipamento.");

  const data = {
    nome,
    codigo: document.getElementById("codigo").value.trim(),
    categoria: document.getElementById("categoria").value.trim(),
    status: document.getElementById("status").value,
    localizacao: document.getElementById("localizacao").value.trim(),
    responsavelAtual: document.getElementById("responsavelAtual").value.trim(),
    valorEstimado: parseFloat(document.getElementById("valorEstimado").value || 0),
    dataAquisicao: document.getElementById("dataAquisicao").value || null,
    descricao: document.getElementById("descricao").value.trim(),
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: userName || null,
  };

  const fileInput = document.getElementById("foto");
  const file = fileInput.files[0];

  try {
    if (!editandoId) {
      // novo
      data.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      data.criadoPor = userName || null;
      data.historico = [];

      const docRef = await db.collection("inventario").add(data);

      if (file) {
        const url = await uploadFoto(docRef.id, file);
        await docRef.update({ fotoURL: url });
      }
    } else {
      // edição
      const docRef = db.collection("inventario").doc(editandoId);

      if (file) {
        const url = await uploadFoto(editandoId, file);
        data.fotoURL = url;
      }

      await docRef.update(data);
    }

    cardForm.style.display = "none";
    formInventario.reset();
    editandoId = null;
  } catch (err) {
    console.error("Erro ao salvar equipamento:", err);
    alert("Erro ao salvar. Verifique o console.");
  }
}

function uploadFoto(itemId, file) {
  const ref = storage.ref().child(`inventario/${itemId}/${file.name}`);
  return ref.put(file).then((snap) => snap.ref.getDownloadURL());
}

// ==================================================
// Exclusão
// ==================================================
async function excluirItem(id) {
  if (userRole !== "gestao") return;
  if (!confirm("Tem certeza que deseja excluir este equipamento?")) return;

  try {
    await db.collection("inventario").doc(id).delete();
  } catch (err) {
    console.error("Erro ao excluir:", err);
    alert("Erro ao excluir. Verifique o console.");
  }
}

// ==================================================
// Movimentação
// ==================================================
function abrirMovimentacao(id) {
  if (!userRole || (userRole !== "gestao" && userRole !== "colaborador")) return;
  movItemId.value = id;
  formMov.reset();
  cardMov.style.display = "block";
  cardForm.style.display = "none";
}

async function salvarMovimentacao(e) {
  e.preventDefault();
  if (!movItemId.value) return;

  const tipo = document.getElementById("mov-tipo").value;
  const responsavel = document.getElementById("mov-responsavel").value.trim();
  const novaLocal = document.getElementById("mov-nova-local").value.trim();
  const obs = document.getElementById("mov-observacoes").value.trim();

  if (!responsavel || !novaLocal) {
    return alert("Informe responsável e nova localização.");
  }

  try {
    const docRef = db.collection("inventario").doc(movItemId.value);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new Error("Item não encontrado.");

      const data = snap.data();
      const historico = data.historico || [];

      historico.push({
        data: new Date().toISOString().slice(0, 10),
        tipo,
        por: userName || "Usuário",
        para: novaLocal,
        observacoes: obs,
      });

      tx.update(docRef, {
        responsavelAtual: responsavel,
        localizacao: novaLocal,
        status: tipo === "devolucao" ? "disponivel" : data.status || "emprestado",
        historico,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoPor: userName || null,
      });
    });

    cardMov.style.display = "none";
    formMov.reset();
  } catch (err) {
    console.error("Erro ao registrar movimentação:", err);
    alert("Erro ao registrar movimentação. Verifique o console.");
  }
}

// ==================================================
// Eventos de UI
// ==================================================
btnFiltros.addEventListener("click", renderTabela);
btnNovoItem.addEventListener("click", abrirFormNovo);
btnCancelarForm.addEventListener("click", () => {
  cardForm.style.display = "none";
  editandoId = null;
});

btnCancelarMov.addEventListener("click", () => {
  cardMov.style.display = "none";
});

formInventario.addEventListener("submit", salvarItem);
formMov.addEventListener("submit", salvarMovimentacao);

// boot
carregarSessao();
iniciarListener();
