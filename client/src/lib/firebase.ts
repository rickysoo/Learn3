import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithRedirect, GoogleAuthProvider, getRedirectResult, signOut, onAuthStateChanged, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "learn3-c6f29.firebaseapp.com",
  projectId: "learn3-c6f29",
  storageBucket: "learn3-c6f29.firebasestorage.app",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Debug Firebase config
console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? '***exists***' : 'MISSING',
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId ? '***exists***' : 'MISSING'
});

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

export const signInWithGoogle = () => {
  return signInWithRedirect(auth, googleProvider);
};

export const handleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    return result;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};