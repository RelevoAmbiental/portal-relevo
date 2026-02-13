(function () {
  "use strict";

  function $(sel){ return document.querySelector(sel); }
  function setStatus(msg){
    const el = $("#status");
    if (el) el.textContent = msg || "";
  }
  function safeText(s){ return String(s || "").trim(); }

  function escapeHtml(str){
    return String(str || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function escapeAttr(str){ return escapeHtml(str).replace(/`/g, ""); }

  function render(){
    const grid = $("#appsGrid");
    const apps = (window.RELEVO_APPS || []).filter(a => a && a.url);

    if (!grid) return;

    if (!apps.length){
      grid.innerHTML = '<div class="app-card"><div class="app-title">Nenhum app configurado</div><div class="app-desc">Edite apps.config.js e adicione seus módulos.</div></div>';
      return;
    }

    grid.innerHTML = apps.map(app => {
      const titulo = safeText(app.titulo) || "App";
      const desc = safeText(app.descricao) || "";
      const url = safeText(app.url);
      const icon = safeText(app.icon);

      const iconHtml = icon
        ? `<img class="app-icon" src="${escapeAttr(icon)}" alt="" loading="lazy" />`
        : "";

      return `
        <div class="app-card">
          <div class="top">
            ${iconHtml}
            <div>
              <div class="app-title">${escapeHtml(titulo)}</div>
              <div class="app-desc">${escapeHtml(desc)}</div>
            </div>
          </div>
          <div class="app-actions">
            <button class="btn btn-primary" data-url="${escapeAttr(url)}" type="button">Abrir</button>
          </div>
        </div>
      `;
    }).join("");

    grid.querySelectorAll("button[data-url]").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-url");
        if (!url) return;
    
        if(/^https?:\/\//i.test(url)) {
          window.open(url, "_blank", "noopener");
        } else {
          window.location.href = url;
        }
      });
    });
  }

  function initMenu(){
    const sidebar = $("#sidebar");
    const overlay = $("#overlay");
    const trigger = $("#menuTrigger");

    function openMenu(){
      if(sidebar) sidebar.classList.add("active");
      if(overlay) overlay.classList.add("active");
    }
    function closeMenu(){
      if(sidebar) sidebar.classList.remove("active");
      if(overlay) overlay.classList.remove("active");
    }

    if(trigger) trigger.addEventListener("click", openMenu);
    if(overlay) overlay.addEventListener("click", closeMenu);
    window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeMenu(); });
    document.addEventListener("click", (e)=>{
      const a = e.target.closest && e.target.closest("a");
      if(a && window.matchMedia("(max-width: 900px)").matches) closeMenu();
    });
  }

  function initPWA(){
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/apps/sw.js")
      .then(() => setStatus("PWA pronto para uso."))
      .catch(() => setStatus("PWA: SW não registrado (ok, segue o baile)."));
  }

  function boot(){
    initMenu();
    render();
    initPWA();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
