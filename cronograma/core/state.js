export const state = {
  currentView: "dashboard"
};

export function setView(view) {
  state.currentView = view;
}
