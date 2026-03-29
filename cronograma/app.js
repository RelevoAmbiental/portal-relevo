import { state, setView } from "./core/state.js";
import { renderCurrentView } from "./core/router.js";
import { bindLayoutEvents, updateActiveNav } from "./ui/layout.js";

function syncUI() {
  updateActiveNav(state.currentView);
  renderCurrentView(state.currentView);
}

function init() {
  bindLayoutEvents((view) => {
    setView(view);
    syncUI();
  });

  syncUI();
}

document.addEventListener("DOMContentLoaded", init);
