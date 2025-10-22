// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCDIrPqQs7S_E2UeDGPNeFCVYcv09JFoTs",
  authDomain: "app-despesas-7029f.firebaseapp.com",
  projectId: "app-despesas-7029f",
  storageBucket: "app-despesas-7029f.firebasestorage.app",
  messagingSenderId: "843931176271",
  appId: "1:843931176271:web:5cdafdd10bc28c3bd8893a"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referências globais
const db = firebase.firestore();
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzns8tQtMpdAfOo_cfmpUfTq1g3hBbGv-dCLIO3M3NRDcgQxUh_N8QYNO9k9ZV9hTlA/exec";