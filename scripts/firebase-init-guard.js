// portal-relevo/scripts/injetar-guard.js
const fs = require("fs");
const path = require("path");

// index.html que foi copiado do dist do cronograma
const indexPath = path.resolve(__dirname, "..", "cronograma", "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("❌ Não encontrei cronograma/index.html. Verifique se o build foi copiado.");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf-8");

// Se já tem o guard, não faz nada
if (html.includes("firebase-init-guard.js")) {
  console.log("ℹ️ Guard já está injetado no index.html do Cronograma. Nada a fazer.");
  process.exit(0);
}

const injectBlock = `
  <!-- Firebase compat do Portal Relevo -->
  <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore-compat.js"></script>

  <!-- Guard do Portal Relevo -->
  <script src="/scripts/firebase-init-guard.js"></script>
`;

// Insere logo depois da tag <head>
if (!html.includes("<head>")) {
  console.error("❌ index.html do Cronograma não tem <head>. Estrutura inesperada.");
  process.exit(1);
}

html = html.replace("<head>", `<head>\n${injectBlock}\n`);

fs.writeFileSync(indexPath, html, "utf-8");
console.log("🔥 Guard e Firebase compat injetados no index.html do Cronograma com sucesso!");
