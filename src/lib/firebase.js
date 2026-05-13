import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAxtV11ZX9D_yR4bLNTQ3J_5JVtuvpa1-k",
  authDomain: "duovet-faa04.firebaseapp.com",
  projectId: "duovet-faa04",
  storageBucket: "duovet-faa04.appspot.com",
  messagingSenderId: "269626599228",
  appId: "1:269626599228:web:477472df9b59ffedfb6039",
  measurementId: "G-3LPRZX00J2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
// Adiciona escopo do Google Calendar
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Função utilitária para extrair o accessToken do Google após login
export function getGoogleAccessTokenFromResult(result) {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return credential && credential.accessToken;
}

export { auth, googleProvider };