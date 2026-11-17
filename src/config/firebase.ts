import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore - getReactNativePersistence está incluido en el bundle de React Native de Firebase
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBMTVybq2tWUzOlh0r8bOUdfVXQLF9kqYo",
  authDomain: "petpass-ef4e9.firebaseapp.com",
  projectId: "petpass-ef4e9",
  storageBucket: "petpass-ef4e9.firebasestorage.app",
  messagingSenderId: "509451091619",
  appId: "1:509451091619:web:5497f9a9b56ddc45a9c916"
};

// Evita reinicializar la app durante el Fast Refresh de Expo
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inicializa Auth guardando la sesión de forma persistente en el teléfono
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const dbCloud = getFirestore(app);