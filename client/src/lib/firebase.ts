import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAUj45Lnpz7wYmomuzFcDnry_F13ZQA_b8",
  authDomain: "learn3-c6f29.firebaseapp.com",
  projectId: "learn3-c6f29",
  storageBucket: "learn3-c6f29.firebasestorage.app",
  messagingSenderId: "349950778878",
  appId: "1:349950778878:web:3fa2809182405ddfaa34af",
  measurementId: "G-C65D93VKBL"
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

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('User signed in:', result.user.displayName);
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