import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Force long polling to avoid WebChannel 400s when proxies block streaming; disable fetch streams for safety.
const db =
  initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  }) || getFirestore(app);
const storage = getStorage(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const functions = getFunctions(app, import.meta.env.VITE_FUNCTION_REGION || 'europe-west2');

const provider = new GoogleAuthProvider();

const signIn = () => signInWithPopup(auth, provider);
const signOut = () => firebaseSignOut(auth);

export { auth, db, signIn, signOut, storage, analytics };
export { functions };
