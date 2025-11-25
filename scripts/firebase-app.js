<script type="module">
  // export Firebase as window.__RELEVO_FIREBASE__
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "...",
    authDomain: "portal-relevo.firebaseapp.com",
    projectId: "portal-relevo",
    storageBucket: "portal-relevo.appspot.com",
    messagingSenderId: "...",
    appId: "..."
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  window.__RELEVO_AUTH__ = auth;
  window.__RELEVO_DB__ = db;
</script>
