// ██ FIREBASE INIT ██
// Inicializa Firebase y autentica de forma anónima

const firebaseConfig = {
  apiKey: "AIzaSyCu1MMXSzg1A0DSK30ABch0gkWKAHLS3U",
  authDomain: "cmr-franez.firebaseapp.com",
  projectId: "cmr-franez",
  storageBucket: "cmr-franez.firebasestorage.app",
  messagingSenderId: "1083773900994",
  appId: "1:1083773900994:web:a51fbffc904da8d9a2435b"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);
const auth = firebase.auth(app);

// Login anónimo automático
auth.signInAnonymously().catch(function(error) {
  console.error("Error en login anónimo:", error);
});

// Esperar a que el usuario esté autenticado
let fbUser = null;
auth.onAuthStateChanged(function(user) {
  fbUser = user;
  if (user) {
    console.log("✓ Autenticado en Firebase (anónimo)");
    // Disparar evento para que sync.js sepa que puede empezar
    window.dispatchEvent(new CustomEvent('firebaseReady'));
  }
});
