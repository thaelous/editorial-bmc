import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

/**
 * Sanitiza valores de variables de entorno para evitar comillas, espacios accidentales o caracteres no ASCII.
 * No contiene claves, secretos ni valores por defecto en texto plano.
 */
function sanitizeEnvValue(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\s\u200B\uFEFF\u00A0\r\n\t]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sanitizeApiKey(rawKey: unknown): string {
  return sanitizeEnvValue(rawKey).replace(/[^A-Za-z0-9_-]/g, '');
}

// Configuración leída 100% de variables de entorno de Vite (VITE_*)
// CERO llaves, credenciales ni valores por defecto en texto plano
export const firebaseConfig = {
  apiKey: sanitizeApiKey(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) || undefined,
};

const isKeyValid = /^[A-Za-z0-9_-]{30,45}$/.test(firebaseConfig.apiKey);
const isMissingKey = !firebaseConfig.apiKey;

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  isKeyValid
);

export const firebaseStatus = {
  isConfigured: isFirebaseConfigured,
  hasKeyError: !isKeyValid || isMissingKey,
  detectedErrorDetail: isMissingKey
    ? 'Variables de entorno no detectadas. Configura VITE_FIREBASE_API_KEY y VITE_FIREBASE_PROJECT_ID en las variables de entorno de Netlify.'
    : !isKeyValid
    ? 'El formato de VITE_FIREBASE_API_KEY no es válido.'
    : null,
};

// Inicialización limpia de Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicialización limpia de Firestore sin pasar argumentos inválidos como 'none' ni '(default)'
export const db: Firestore = getFirestore(app);

// Inicialización limpia de Firebase Auth
export const auth: Auth = getAuth(app);






