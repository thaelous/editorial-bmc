import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';


/**
 * Sanitizes and cleans an environment variable value:
 * - Strips leading/trailing and internal whitespace, newlines, tabs, zero-width spaces, and BOM
 * - Strips surrounding quotes (" or ')
 * - Normalizes Unicode and strips diacritics/accents (e.g. 'í' -> 'i')
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

/**
 * Specifically cleans and validates a Google API Key:
 * - Applies general env sanitization (no quotes, no spaces, no accents)
 * - Strips any remaining characters outside ASCII [A-Za-z0-9_-]
 */
function sanitizeApiKey(rawKey: unknown): string {
  return sanitizeEnvValue(rawKey).replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * Validates whether a Google Cloud / Firebase API key has valid ASCII format.
 * Valid Google API keys are strictly ASCII alphanumeric characters with hyphens and underscores,
 * typically 35-45 characters long, and cannot contain non-ASCII characters or placeholder words.
 */
function isValidGoogleApiKey(key: string | undefined): boolean {
  if (!key) return false;
  const clean = sanitizeApiKey(key);
  if (
    clean.includes('TU_API_KEY') ||
    clean.includes('YOUR_KEY') ||
    clean.includes('your-firebase') ||
    clean.length < 30
  ) {
    return false;
  }
  return /^[A-Za-z0-9_-]{35,45}$/.test(clean);
}

// Default verified project configuration (AI Studio provisioned project)
const DEFAULT_CONFIG = {
  apiKey: 'AIzaSyDRARil2rIj5ykaL5j9jMizhlpEgVEb898',
  authDomain: 'gen-lang-client-0713667882.firebaseapp.com',
  projectId: 'gen-lang-client-0713667882',
  storageBucket: 'gen-lang-client-0713667882.firebasestorage.app',
  messagingSenderId: '178097549484',
  appId: '1:178097549484:web:9b1da1dfd6a1761c5cef09',
  measurementId: undefined,
};

function resolveFirebaseConfig() {
  const rawKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envKey = sanitizeApiKey(rawKey);
  const envProjectId = sanitizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID);
  const envAuthDomain = sanitizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  const envStorageBucket = sanitizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
  const envSenderId = sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
  const envAppId = sanitizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID);
  const envMeasurementId = sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);

  const isCustomKeyValid = isValidGoogleApiKey(envKey);
  const isKeyCorrupted = Boolean(rawKey && !isCustomKeyValid);

  // If the user provided a validly formatted custom API key, use custom environment config
  if (isCustomKeyValid && envProjectId && envProjectId !== 'none') {
    return {
      config: {
        apiKey: envKey,
        authDomain: envAuthDomain || `${envProjectId}.firebaseapp.com`,
        projectId: envProjectId,
        storageBucket: envStorageBucket || `${envProjectId}.firebasestorage.app`,
        messagingSenderId: envSenderId || '',
        appId: envAppId || '',
        measurementId: envMeasurementId && envMeasurementId !== 'none' ? envMeasurementId : undefined,
      },
      isCustom: true,
      hasKeyError: false,
      detectedErrorDetail: null,
    };
  }

  // Provide diagnostic info if corrupted key was detected
  let detectedErrorDetail: string | null = null;
  if (isKeyCorrupted && rawKey) {
    if (/[^\x20-\x7E]/.test(String(rawKey))) {
      detectedErrorDetail = `El valor configurado en VITE_FIREBASE_API_KEY contiene caracteres no ASCII o con tildes (ej: 'í'). Las claves de Google solo permiten letras, números, guiones y guiones bajos [A-Za-z0-9_-].`;
    } else {
      detectedErrorDetail = `El formato de VITE_FIREBASE_API_KEY no es una clave de API de Google válida (debe tener entre 35 y 45 caracteres válidos).`;
    }
  }

  return {
    config: DEFAULT_CONFIG,
    isCustom: false,
    hasKeyError: isKeyCorrupted,
    detectedErrorDetail,
  };
}

const resolved = resolveFirebaseConfig();
export const firebaseConfig = resolved.config;
export const firebaseStatus = {
  isCustom: resolved.isCustom,
  hasKeyError: resolved.hasKeyError,
  detectedErrorDetail: resolved.detectedErrorDetail,
};

// Initialize Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore cleanly using only the Firebase App instance (no database arguments or '(default)' reference)
export const db: Firestore = getFirestore(app);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);


