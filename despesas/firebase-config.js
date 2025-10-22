// Configuração Firebase - SUAS CREDENCIAIS
const firebaseConfig = {
  apiKey: "AIzaSyCDIrPqQs7S_E2UeDGPNeFCVYcv09JFoTs",
  authDomain: "app-despesas-7029f.firebaseapp.com",
  projectId: "app-despesas-7029f",
  messagingSenderId: "843931176271",
  appId: "1:843931176271:web:5cdafdd10bc28c3bd8893a"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxDfo_xoXo4POKqSw0W3piKWUutECoXvgy1upb3ChCp3_V_t92Fc6UlKg6SmW_q8DOJ/exec";
