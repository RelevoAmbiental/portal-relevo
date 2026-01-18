(function () {
  "use strict";

  function $(sel){ return document.querySelector(sel); }

  function setStatus(msg){
    const el = $("#status");
    if (el) el.textContent = msg || "";
  }

  function safeText(s){
    return String(s || "").trim();
  }

  function render(){
    const grid = $("#appsGrid");
    const apps = (window.RELEVO_APPS || []).filter(a => a && a.url);

    if (!grid) return;

    if (!apps.length){
      grid.innerHTML = '<div class="card"><div class="left"><div class="card-title">Nenhum app configurado</div><div class="card-desc">Edite apps.config.js e adicione seus módulos.</div></div></div>';
      return;
    }

    grid.innerHTML = apps.map(app => {
      const titulo = safeText(app.titulo) || "App";
      const desc = safeText(app.descricao) || "";
      const url = safeText(app.url);

    const iconHtml = app.icon
      ? `<img class="card-icon-img" src="${escapeAttr(app.icon)}" alt="" loading="lazy" />`
      : "";
    
    return `
      <div class="card">
        <div class="left">
          ${iconHtml}
          <div class="card-title">${escapeHtml(titulo)}</div>
          <div class="card-desc">${escapeHtml(desc)}</div>
        </div>
        <button class="btn" data-url="${escapeAttr(url)}">Abrir</button>
      </div>
    `;
      
    }).join("");

    grid.querySelectorAll("button[data-url]").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-url");
        if (!url) return;
        // mesmo “app feel”: navega na mesma aba
        window.location.href = url;
      });
    });
  }

  function escapeHtml(str){
    return String(str || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function escapeAttr(str){
    // simples e suficiente aqui
    return escapeHtml(str).replace(/`/g, "");
  }

  function initPWA(){
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("./sw.js")
      .then(() => setStatus("PWA pronto para uso."))
      .catch(() => setStatus("PWA: SW não registrado (ok, segue o baile)."));
  }

  function boot(){
    render();
    initPWA();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
