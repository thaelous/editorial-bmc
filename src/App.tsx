/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import confetti from 'canvas-confetti';
import {
  KeyRound,
  CheckCircle2,
  Loader2,
  Globe,
  User,
  Mail,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Copy,
  ExternalLink,
  BookOpen,
  Crown,
  Database,
  ChevronDown,
  ChevronUp,
  HardDrive,
  FolderCheck,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  FileText,
  UploadCloud,
  Library,
  Compass,
  Bookmark,
  Layers,
} from 'lucide-react';

import { db, auth, firebaseConfig, firebaseStatus } from './firebase.ts';
export { db, auth, firebaseConfig, firebaseStatus };


const ROOT_DRIVE_FOLDER_ID = '1vncgfUnvay174cvzERBqt_hyqRBSoY8w';

// Error handling helper as required by Firebase skill
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Este correo electrónico ya está registrado. Por favor, ve a la pestaña "Iniciar Sesión".';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico ingresado no es válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Credenciales incorrectas. Verifica tu correo y contraseña e inténtalo de nuevo.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Por seguridad, espera unos instantes antes de volver a intentar.';
    case 'auth/network-request-failed':
      return 'Error de conexión de red. Verifica tu acceso a internet.';
    case 'auth/operation-not-allowed':
      return 'El método de inicio de sesión con Correo/Contraseña (Email/Password) no está habilitado en Firebase Authentication. Ve a Firebase Console > Authentication > Sign-in method y habilítalo.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'La clave VITE_FIREBASE_API_KEY no es válida para este proyecto de Firebase. Revisa que no contenga tildes o caracteres especiales (como la "í" en SEMdíQIU) y cópiala directamente desde la consola de Firebase.';
    default:
      return 'Ocurrió un error en la autenticación. Verifica tus datos e inténtalo de nuevo.';
  }
}

// Master Code & Author Types
interface MasterCodeRecord {
  id: string;
  code: string;
  used: boolean;
  plan?: string;
  createdAt?: string;
  usedAt?: string;
  usedBy?: string;
}

interface AuthorRecord {
  id?: string;
  uid?: string;
  name: string;
  email: string;
  role: string;
  masterCode: string;
  plan: string;
  membershipStatus: string;
  driveSyncReady: boolean;
  driveFolderStatus: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  driveFolderName?: string;
  driveRootFolderId: string;
  driveRootPath: string;
  createdAt: string;
}

export default function App() {
  // Global Auth state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authorProfile, setAuthorProfile] = useState<AuthorRecord | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Authentication Mode Tabs: 'activate' (Activación por Primera Vez) | 'login' (Iniciar Sesión)
  const [activeTab, setActiveTab] = useState<'activate' | 'login'>('activate');

  // Tab 1: Formulario de Activación por Primera Vez
  const [activationCode, setActivationCode] = useState('');
  const [activationName, setActivationName] = useState('');
  const [activationEmail, setActivationEmail] = useState('');
  const [activationPassword, setActivationPassword] = useState('');
  const [showActivationPassword, setShowActivationPassword] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Tab 2: Formulario de Iniciar Sesión (Visitas recurrentes)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // UI feedback & sandbox
  const [copiedFolderId, setCopiedFolderId] = useState(false);
  const [copiedCodeNotice, setCopiedCodeNotice] = useState<string | null>(null);
  const [showSandbox, setShowSandbox] = useState(false);
  const [liveCodes, setLiveCodes] = useState<MasterCodeRecord[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  // Estado de validación por campo 'code' en tiempo real
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeValidationStatus, setCodeValidationStatus] = useState<{
    valid: boolean;
    plan?: string;
    message?: string;
  } | null>(null);

  // Verify connection once on mount using query by field where("code", "==", ...)
  useEffect(() => {
    async function testConnection() {
      try {
        const pingQuery = query(collection(db, 'master_codes'), where('code', '==', '_ping_connection'));
        await getDocs(pingQuery);
      } catch (err) {
        // Handled silently
      }
    }
    testConnection();
  }, []);

  // Listen to live master_codes for the Demo Codes drawer
  useEffect(() => {
    const q = collection(db, 'master_codes');
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          seedDemoCodes();
          return;
        }

        const codesList: MasterCodeRecord[] = snapshot.docs
          .filter((docSnap) => docSnap.id !== '_ping_connection')
          .map((docSnap) => ({
            id: docSnap.id, // ID automático asignado por Firestore
            code: docSnap.data().code, // Campo "code" guardado dentro del documento
            used: !!docSnap.data().used,
            plan: docSnap.data().plan || 'Membresía Anual BMC',
            createdAt: docSnap.data().createdAt,
            usedAt: docSnap.data().usedAt,
            usedBy: docSnap.data().usedBy,
          }))
          .filter((item) => Boolean(item.code));
        setLiveCodes(codesList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'master_codes');
      }
    );
    return () => unsubscribe();
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchAuthorProfile(user);
      } else {
        setAuthorProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch author record from Firestore
  const fetchAuthorProfile = async (user: FirebaseUser) => {
    try {
      const authorsRef = collection(db, 'authors');
      // Query by email
      const qEmail = query(authorsRef, where('email', '==', user.email?.toLowerCase()));
      const snap = await getDocs(qEmail);

      if (!snap.empty) {
        const docData = snap.docs[0].data() as AuthorRecord;
        setAuthorProfile({
          ...docData,
          id: snap.docs[0].id,
        });
        return;
      }

      // Query by UID
      const qUid = query(authorsRef, where('uid', '==', user.uid));
      const snapUid = await getDocs(qUid);

      if (!snapUid.empty) {
        const docData = snapUid.docs[0].data() as AuthorRecord;
        setAuthorProfile({
          ...docData,
          id: snapUid.docs[0].id,
        });
        return;
      }

      // Fallback profile if record not yet synchronized
      const fallbackProfile: AuthorRecord = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Autor BMC',
        email: user.email || '',
        role: 'author',
        masterCode: 'VINCULADO',
        plan: 'Membresía Anual BMC Creators',
        membershipStatus: 'active',
        driveSyncReady: true,
        driveFolderStatus: 'created',
        driveRootFolderId: ROOT_DRIVE_FOLDER_ID,
        driveRootPath: `/BMC_EDITORIAL/`,
        createdAt: new Date().toISOString(),
      };
      setAuthorProfile(fallbackProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'authors');
    }
  };

  // Helper to format input code
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().trim();
    setActivationCode(val);
    setActivationError(null);
    setCodeValidationStatus(null);
  };

  // Consulta exacta por campo: query(collection(db, 'master_codes'), where('code', '==', cleanCode))
  // Se busca en el campo "code" del documento, ya que los documentos tienen IDs automáticos generados por Firestore
  const validateCodeByField = async (codeCandidate?: string) => {
    const targetCode = (codeCandidate !== undefined ? codeCandidate : activationCode).trim().toUpperCase();
    if (!targetCode) {
      setCodeValidationStatus(null);
      return;
    }

    setCodeValidating(true);
    try {
      const codesRef = collection(db, 'master_codes');
      // Consulta estricta por campo (where("code", "==", targetCode))
      const qCode = query(codesRef, where('code', '==', targetCode));
      const codeSnapshot = await withTimeout(
        getDocs(qCode),
        8000,
        'Tiempo de espera al consultar Firestore.'
      );

      if (codeSnapshot.empty) {
        setCodeValidationStatus({
          valid: false,
          message: 'Código no encontrado en el campo "code" de master_codes.',
        });
        return;
      }

      // Documento encontrado mediante la consulta del campo 'code' (el ID del documento es automático)
      const matchedDoc = codeSnapshot.docs[0];
      const data = matchedDoc.data();

      if (data.used === true) {
        setCodeValidationStatus({
          valid: false,
          message: `Código ya utilizado${data.usedBy ? ` por ${data.usedBy}` : ''}.`,
        });
        return;
      }

      setCodeValidationStatus({
        valid: true,
        plan: data.plan || 'Membresía Anual BMC Creators',
        message: `Código disponible (${data.plan || 'Membresía Anual BMC Creators'})`,
      });
    } catch (err) {
      console.error('Error al validar código por campo code:', err);
    } finally {
      setCodeValidating(false);
    }
  };

  // Timeout helper to avoid infinite hanging
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);

      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  // =========================================================================
  // 1. LÓGICA DE ACTIVACIÓN POR PRIMERA VEZ (TAB 1)
  // =========================================================================
  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = activationCode.trim().toUpperCase();
    const cleanName = activationName.trim();
    const cleanEmail = activationEmail.trim().toLowerCase();
    const password = activationPassword;

    // Client-side validations
    if (!cleanCode) {
      setActivationError('Ingresa tu Código de Activación o Código Maestro.');
      return;
    }
    if (!cleanName) {
      setActivationError('Ingresa tu Nombre de Autor o Seudónimo Editorial.');
      return;
    }
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setActivationError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!password || password.length < 6) {
      setActivationError('La contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }

    if (!firebaseConfig.apiKey) {
      setActivationError('No se encontró la clave de Firebase (VITE_FIREBASE_API_KEY). Configura las variables de entorno en .env o en el panel de despliegue.');
      return;
    }

    setIsActivating(true);
    setActivationError(null);

    try {
      // Step A: Consulta por campo en Firestore: where("code", "==", cleanCode)
      // Los documentos tienen IDs automáticos y el código se busca estrictamente dentro del campo 'code'
      const codesRef = collection(db, 'master_codes');
      const qCode = query(codesRef, where('code', '==', cleanCode));
      const codeSnapshot = await withTimeout(
        getDocs(qCode),
        8000,
        'Tiempo de espera agotado al conectar con Firestore. Verifica tu conexión.'
      );

      if (codeSnapshot.empty) {
        throw new Error(
          `El código "${cleanCode}" no fue encontrado en el campo "code" de la colección master_codes. Verifica con el administrador de Buenos Malos Consejos.`
        );
      }

      // Se obtiene el documento resultante de la consulta por campo (su doc.id es autogenerado)
      const codeDoc = codeSnapshot.docs[0];
      const codeData = codeDoc.data();

      if (codeData.used === true) {
        throw new Error(
          `Este código ya fue utilizado${codeData.usedBy ? ` por ${codeData.usedBy}` : ''}. Si crees que se trata de un error, contacta a soporte.`
        );
      }

      // Step B: Registrar al usuario en Firebase Authentication
      const userCredential = await withTimeout(
        createUserWithEmailAndPassword(auth, cleanEmail, password),
        10000,
        'Tiempo de espera agotado en Firebase Authentication.'
      );
      const user = userCredential.user;

      // Step C: Preparar carpeta Google Drive asignada para manuscritos del autor
      const generatedFolderId = `1bmc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
      const driveFolderUrl = `https://drive.google.com/drive/folders/${generatedFolderId}`;

      // Step D: Guardar perfil en la colección "authors" (con nombre, correo, rol 'author', etc.)
      const authorPayload: AuthorRecord = {
        uid: user.uid,
        name: cleanName,
        email: cleanEmail,
        role: 'author',
        masterCode: cleanCode,
        plan: codeData.plan || 'Membresía Anual BMC Creators',
        membershipStatus: 'active',
        driveSyncReady: true,
        driveFolderStatus: 'created',
        driveFolderId: generatedFolderId,
        driveFolderUrl: driveFolderUrl,
        driveFolderName: `${cleanName} - Manuscritos`,
        driveRootFolderId: ROOT_DRIVE_FOLDER_ID,
        driveRootPath: `/BMC_EDITORIAL/${cleanName}/`,
        createdAt: new Date().toISOString(),
      };

      await withTimeout(
        addDoc(collection(db, 'authors'), authorPayload),
        8000,
        'Tiempo de espera al guardar el perfil del autor en Firestore.'
      );

      // Step E: Marcar el código como usado en la colección "master_codes"
      const codeDocRef = doc(db, 'master_codes', codeDoc.id);
      await withTimeout(
        updateDoc(codeDocRef, {
          used: true,
          usedAt: new Date().toISOString(),
          usedBy: cleanEmail,
          authorUid: user.uid,
        }),
        8000,
        'Tiempo de espera al actualizar el código maestro.'
      );

      // Step F: Actualizar estado y redirigir al panel de gestión centralizado
      setAuthorProfile(authorPayload);

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#34d399', '#f97316', '#a855f7', '#06b6d4'],
      });
    } catch (err: any) {
      console.warn('Activation notice:', err?.code || err?.message || err);
      let message = err?.message || 'Error al completar la activación.';
      if (err?.code) {
        message = getAuthErrorMessage(err.code);
      } else if (err?.message?.toLowerCase().includes('api-key')) {
        message = 'La API Key de Firebase no es válida. Revisa las variables de entorno (VITE_FIREBASE_API_KEY).';
      }
      setActivationError(message);
    } finally {
      setIsActivating(false);
    }
  };

  // =========================================================================
  // 2. LÓGICA DE INICIAR SESIÓN (TAB 2 - VISITAS RECURRENTES)
  // =========================================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = loginEmail.trim().toLowerCase();
    const password = loginPassword;

    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setLoginError('Por favor ingresa un correo electrónico válido.');
      return;
    }
    if (!password) {
      setLoginError('Por favor ingresa tu contraseña.');
      return;
    }

    if (!firebaseConfig.apiKey) {
      setLoginError('No se encontró la clave de Firebase (VITE_FIREBASE_API_KEY). Configura las variables de entorno en .env o en el panel de despliegue.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      // Iniciar sesión directamente con Firebase Authentication
      const userCredential = await withTimeout(
        signInWithEmailAndPassword(auth, cleanEmail, password),
        10000,
        'Tiempo de espera agotado al conectar con el servidor de autenticación.'
      );

      // Cargar perfil del autor y redirigir al panel centralizado
      await fetchAuthorProfile(userCredential.user);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#38bdf8', '#34d399', '#06b6d4'],
      });
    } catch (err: any) {
      console.warn('Login notice:', err?.code || err?.message || err);
      let message = err?.message || 'Error al iniciar sesión.';
      if (err?.code) {
        message = getAuthErrorMessage(err.code);
      } else if (err?.message?.toLowerCase().includes('api-key')) {
        message = 'La API Key de Firebase no es válida. Revisa las variables de entorno (VITE_FIREBASE_API_KEY).';
      }
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Cerrar Sesión
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setAuthorProfile(null);
      setActiveTab('login');
      setLoginPassword('');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Sembrar códigos demo para pruebas con 1 clic
  const seedDemoCodes = async () => {
    setIsSeeding(true);
    try {
      const samples = [
        { code: 'BMC-2026-VIP-CREATOR', plan: 'Anual Pro - Autores Independientes', used: false },
        { code: 'BMC-BESTSELLER-8899', plan: 'Anual Elite - Ficción & Novelas', used: false },
        { code: 'BMC-NOVEL-PASS-4412', plan: 'Anual Starter - Primer Libro', used: false },
      ];

      for (const sample of samples) {
        const q = query(collection(db, 'master_codes'), where('code', '==', sample.code));
        const res = await getDocs(q);
        if (res.empty) {
          await addDoc(collection(db, 'master_codes'), {
            ...sample,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'master_codes');
    } finally {
      setIsSeeding(false);
    }
  };

  const copyAndFillCode = (code: string) => {
    setActivationCode(code);
    setActiveTab('activate');
    setActivationError(null);
    setCopiedCodeNotice(code);
    validateCodeByField(code);
    setTimeout(() => setCopiedCodeNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden font-sans">
      {/* Background ambient mesh with Buenos Malos Consejos glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[720px] pointer-events-none opacity-40">
        <div className="absolute top-[-80px] left-1/6 w-96 h-96 bg-sky-500/20 rounded-full blur-[120px]" />
        <div className="absolute top-[-40px] right-1/6 w-96 h-96 bg-purple-600/18 rounded-full blur-[120px]" />
        <div className="absolute top-48 left-1/3 w-80 h-80 bg-orange-500/12 rounded-full blur-[100px]" />
        <div className="absolute top-48 right-1/4 w-80 h-80 bg-emerald-500/15 rounded-full blur-[100px]" />
      </div>

      {/* Floating Header */}
      <header className="sticky top-3 sm:top-5 z-40 px-3 sm:px-6">
        <nav className="max-w-4xl mx-auto rounded-full bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl shadow-cyan-950/40 p-2 sm:p-2.5 flex items-center justify-between gap-2">
          {/* Brand Pill */}
          <div className="flex items-center space-x-2.5 pl-2 pr-2 py-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-sky-400 via-cyan-400 to-emerald-400 flex items-center justify-center shadow-md shadow-cyan-500/25 border border-cyan-200/50 shrink-0">
              <BookOpen className="w-4 h-4 text-slate-950 font-extrabold" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-xs sm:text-sm text-white">
                  Buenos Malos Consejos
                </span>
                <span className="hidden sm:inline-block text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-gradient-to-r from-sky-500/20 to-emerald-500/20 text-cyan-300 border border-cyan-400/30">
                  Editorial Central
                </span>
              </div>
              <span className="text-[10px] text-slate-400 -mt-0.5 hidden xs:inline">
                Plataforma Editorial Centralizada
              </span>
            </div>
          </div>

          {/* Navigation link */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950/70 p-1 rounded-full border border-slate-800/80 text-xs">
            <a
              href="https://buenosmalosconsejos.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/70 transition"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>buenosmalosconsejos.com</span>
            </a>
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-cyan-200 bg-cyan-950/50 border border-cyan-400/30 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{firebaseUser ? 'Panel Centralizado' : 'Acceso de Autores'}</span>
            </div>
          </div>

          {/* Right Action: Demo Sandbox / Logout */}
          <div className="flex items-center gap-2 pr-1">
            {firebaseUser ? (
              <button
                onClick={handleSignOut}
                className="text-xs flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-700/50 transition shadow-sm"
                title="Cerrar sesión actual"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-semibold hidden xs:inline">Cerrar Sesión</span>
              </button>
            ) : (
              <button
                onClick={() => setShowSandbox(!showSandbox)}
                className="text-xs flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-slate-950/90 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-cyan-500/35 transition shadow-sm"
                title="Códigos de prueba para Firestore"
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold hidden xs:inline">Códigos Demo</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                  {liveCodes.filter((c) => !c.used).length}
                </span>
                {showSandbox ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* Demo Codes Drawer */}
      {showSandbox && !firebaseUser && (
        <div className="max-w-4xl mx-auto w-full px-4 mt-3 z-30 animate-fade-in">
          <div className="bg-slate-900/95 border border-cyan-500/35 rounded-3xl p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-sm font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Códigos de Activación Disponibles en Firestore
                </h4>
                <p className="text-xs text-slate-400">
                  Haz clic en un código disponible para cargarlo automáticamente en la pestaña de activación.
                </p>
              </div>
              <button
                onClick={seedDemoCodes}
                disabled={isSeeding}
                className="self-start sm:self-auto text-xs font-semibold px-4 py-2 rounded-full bg-cyan-950/80 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-400/40 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-cyan-400" />}
                Sembrar Nuevos Códigos
              </button>
            </div>

            {copiedCodeNotice && (
              <div className="mb-3 text-xs text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-3.5 py-2 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Código <strong className="text-white font-mono">{copiedCodeNotice}</strong> cargado en el formulario de activación.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {liveCodes.length === 0 ? (
                <div className="sm:col-span-3 text-center py-5 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
                  No hay códigos registrados aún.{' '}
                  <button onClick={seedDemoCodes} className="text-cyan-400 hover:text-cyan-300 underline font-semibold ml-1">
                    Sembrar 3 códigos de prueba
                  </button>
                </div>
              ) : (
                liveCodes.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => !item.used && copyAndFillCode(item.code)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between group ${
                      item.used
                        ? 'bg-slate-950/40 border-slate-800/80 opacity-60 cursor-not-allowed'
                        : 'bg-slate-950/80 border-slate-700/80 hover:border-cyan-400/60 cursor-pointer shadow-sm hover:shadow-cyan-500/15'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-white tracking-wide">{item.code}</span>
                        {item.used ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50">
                            Canjeado
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                            Disponible
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.used ? `Por: ${item.usedBy || 'Autor'}` : item.plan}
                      </div>
                    </div>
                    {!item.used && (
                      <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col justify-center">
        {authLoading ? (
          <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm text-slate-400">Verificando sesión editorial...</p>
          </div>
        ) : firebaseUser && authorProfile ? (
          /* ========================================================================= */
          /* PANEL DE GESTIÓN CENTRALIZADO (USUARIO AUTENTICADO) */
          /* ========================================================================= */
          <div className="space-y-6 animate-fade-in">
            {/* Top Welcome Card */}
            <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-500/15 via-emerald-500/10 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-400 via-cyan-400 to-emerald-400 flex items-center justify-center text-slate-950 shadow-xl shadow-cyan-500/30 border border-cyan-200/50 font-extrabold text-2xl shrink-0">
                    {authorProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Autor Registrado
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-semibold">
                        Rol: {authorProfile.role || 'author'}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40 font-semibold flex items-center gap-1">
                        <Crown className="w-3 h-3 text-purple-400" />
                        {authorProfile.plan || 'Membresía Anual'}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      Panel Editorial Centralizado
                    </h1>
                    <p className="text-sm text-cyan-200 font-medium mt-0.5">
                      {authorProfile.name} • <span className="text-slate-400 font-mono text-xs">{authorProfile.email}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>

              {/* Main action cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* Plataforma Editorial Centralizada */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-cyan-400" />
                        Plataforma Editorial Centralizada
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-semibold">
                        OFICIAL
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                      Tus obras y perfil de autor se publican directamente en el catálogo editorial central de Buenos Malos Consejos.
                    </p>
                    <div className="font-mono text-cyan-300 text-sm font-semibold p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      https://buenosmalosconsejos.com
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-900">
                    <a
                      href="https://buenosmalosconsejos.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-xs py-2.5 px-4 rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 transition hover:opacity-90"
                    >
                      <span>Ir al Portal Central</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Google Drive Subcarpeta Asignada */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4 text-emerald-400" />
                        Espacio de Manuscritos en la Nube
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-semibold">
                        GOOGLE DRIVE
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Carpeta Privada:</span>
                        <span className="text-white font-semibold truncate ml-2">
                          {authorProfile.driveFolderName || `${authorProfile.name} - Manuscritos`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                        <span>Código Maestro:</span>
                        <span className="text-cyan-300">{authorProfile.masterCode}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-900">
                    {authorProfile.driveFolderUrl && (
                      <a
                        href={authorProfile.driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-xs py-2.5 px-4 rounded-full bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40 font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Abrir Mi Carpeta de Manuscritos</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Centralized Editorial Pipeline */}
              <div className="mt-6 p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-2">
                  <Library className="w-4 h-4 text-cyan-400" />
                  Flujo de Gestión Editorial Centralizado
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>1. Cuenta & Membresía</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Perfil editorial activo con rol de autor registrado y credenciales protegidas en Firebase Auth.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-1">
                      <UploadCloud className="w-4 h-4" />
                      <span>2. Depósito de Manuscritos</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Sube tus obras en formato .docx o .pdf a tu carpeta asignada en Google Drive para revisión.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold mb-1">
                      <Bookmark className="w-4 h-4" />
                      <span>3. Edición & Catálogo</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Corrección de estilo, diagramación y publicación en la plataforma central de Buenos Malos Consejos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* FORMULARIO DE ACCESO DUAL (SIN SUBDOMINIOS): ACTIVACIÓN vs INICIAR SESIÓN */
          /* ========================================================================= */
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-sky-500/10 via-purple-500/10 to-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header intro */}
            <div className="mb-6 text-center sm:text-left">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-950/80 border border-white/10 text-xs font-semibold mb-4 shadow-sm">
                <div className="flex items-center -space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-slate-950" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950" />
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 border border-slate-950" />
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 border border-slate-950" />
                </div>
                <span className="text-white font-bold">Buenos Malos Consejos</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-300">Plataforma Editorial Centralizada</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeTab === 'activate' ? 'Activación de Cuenta de Autor' : 'Iniciar Sesión en el Panel Editorial'}
              </h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {activeTab === 'activate'
                  ? 'Si eres un autor nuevo, ingresa tu Código de Activación / Maestro y configura tu cuenta para acceder al panel de gestión centralizado.'
                  : 'Si ya activaste tu cuenta previamente, inicia sesión con tu correo y contraseña para acceder de inmediato a tu panel.'}
              </p>
            </div>

            {firebaseStatus.hasKeyError && (
              <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs leading-relaxed flex items-start gap-3 animate-fade-in">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-300">
                    Aviso de configuración en VITE_FIREBASE_API_KEY:
                  </p>
                  <p className="mt-1 text-slate-300">
                    {firebaseStatus.detectedErrorDetail}
                  </p>
                  <p className="mt-1.5 text-amber-400/90 font-mono text-[11px] bg-slate-950/60 p-2 rounded-lg border border-amber-500/20">
                    Sustituye el valor con la Web API Key pura (ASCII sin tildes) en Firebase Console &gt; Project Settings &gt; General.
                  </p>
                </div>
              </div>
            )}

            {/* Selector de Pestañas (Tabs) Estilo Píldora */}
            <div className="mb-7 p-1.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('activate');
                  setActivationError(null);
                  setLoginError(null);
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'activate'
                    ? 'bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/25 border border-cyan-100/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Activación por Primera Vez</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold hidden sm:inline ${
                    activeTab === 'activate' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-cyan-300'
                  }`}
                >
                  Nuevo
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setActivationError(null);
                  setLoginError(null);
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/25 border border-cyan-100/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Iniciar Sesión</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold hidden sm:inline ${
                    activeTab === 'login' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Recurrente
                </span>
              </button>
            </div>

            {/* ========================================================================= */}
            {/* PESTAÑA 1: ACTIVACIÓN POR PRIMERA VEZ (POR DEFECTO - SIN SUBDOMINIOS) */}
            {/* ========================================================================= */}
            {activeTab === 'activate' && (
              <form onSubmit={handleActivation} className="space-y-4 animate-fade-in">
                {/* 1. Código de Activación / Maestro */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs uppercase font-bold tracking-wider text-slate-300">
                      Código de Activación / Maestro <span className="text-cyan-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {codeValidating && (
                        <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" /> Buscando campo &quot;code&quot;...
                        </span>
                      )}
                      {codeValidationStatus && !codeValidating && (
                        <span
                          className={`text-[11px] flex items-center gap-1 font-semibold ${
                            codeValidationStatus.valid ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {codeValidationStatus.valid ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span>{codeValidationStatus.message}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowSandbox(true);
                          seedDemoCodes();
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold flex items-center gap-1 ml-1"
                      >
                        <Database className="w-3 h-3" /> Ver códigos demo
                      </button>
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <KeyRound className="w-4 h-4 text-cyan-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={activationCode}
                      onChange={handleCodeChange}
                      onBlur={() => activationCode.trim() && validateCodeByField(activationCode)}
                      placeholder="EJ: BMC-2026-VIP-CREATOR"
                      className="w-full pl-11 pr-24 py-3 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white font-mono text-sm tracking-wider placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => validateCodeByField(activationCode)}
                      disabled={!activationCode.trim() || codeValidating}
                      className="absolute right-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-slate-700 text-xs font-semibold transition disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {codeValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verificar'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Búsqueda por consulta de campo: <span className="font-mono text-slate-400">where(&quot;code&quot;, &quot;==&quot;, valor)</span> en <span className="font-mono text-slate-400">master_codes</span>.
                  </p>
                </div>

                {/* 2. Nombre del Autor o Seudónimo */}
                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider text-slate-300 mb-1.5">
                    Nombre del Autor o Seudónimo <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4 text-cyan-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={activationName}
                      onChange={(e) => {
                        setActivationName(e.target.value);
                        setActivationError(null);
                      }}
                      placeholder="Ej: Gabriel García Márquez"
                      className="w-full pl-11 pr-4 py-3 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
                    />
                  </div>
                </div>

                {/* 3. Correo Electrónico */}
                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider text-slate-300 mb-1.5">
                    Correo Electrónico <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4 text-cyan-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={activationEmail}
                      onChange={(e) => {
                        setActivationEmail(e.target.value);
                        setActivationError(null);
                      }}
                      placeholder="autor@editorial.com"
                      className="w-full pl-11 pr-4 py-3 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Será tu correo de acceso para iniciar sesión en futuras visitas.
                  </p>
                </div>

                {/* 4. Contraseña */}
                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider text-slate-300 mb-1.5">
                    Contraseña <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4 text-cyan-400" />
                    </div>
                    <input
                      type={showActivationPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={activationPassword}
                      onChange={(e) => {
                        setActivationPassword(e.target.value);
                        setActivationError(null);
                      }}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-11 pr-12 py-3 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowActivationPassword(!showActivationPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white"
                      title={showActivationPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showActivationPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>Mínimo 6 caracteres de seguridad.</span>
                    {activationPassword.length >= 6 && (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Contraseña válida
                      </span>
                    )}
                  </div>
                </div>

                {/* Error Banner */}
                {activationError && (
                  <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-600/60 text-rose-200 text-xs flex items-start gap-3 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-white">Error de activación:</span> {activationError}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={
                    isActivating ||
                    !activationCode.trim() ||
                    !activationName.trim() ||
                    !activationEmail.trim() ||
                    activationPassword.length < 6
                  }
                  className="w-full mt-2 py-4 px-8 rounded-full font-extrabold text-sm bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 hover:from-sky-300 hover:via-cyan-300 hover:to-emerald-300 text-slate-950 shadow-xl shadow-cyan-500/25 border border-cyan-100/60 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Verificando código y activando cuenta...</span>
                    </>
                  ) : (
                    <>
                      <span>Activar Cuenta y Acceder al Panel</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ========================================================================= */}
            {/* PESTAÑA 2: INICIAR SESIÓN (PARA VISITAS RECURRENTES) */}
            {/* ========================================================================= */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
                {/* Correo Electrónico */}
                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider text-slate-300 mb-1.5">
                    Correo Electrónico <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4 text-cyan-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setLoginError(null);
                      }}
                      placeholder="autor@editorial.com"
                      autoFocus
                      className="w-full pl-11 pr-4 py-3 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs uppercase font-bold tracking-wider text-slate-300">
                      Contraseña <span className="text-cyan-400">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4 text-cyan-400" />
                    </div>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setLoginError(null);
                      }}
                      placeholder="Tu contraseña registrada"
                      className="w-full pl-11 pr-12 py-3 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white"
                      title={showLoginPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {loginError && (
                  <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-600/60 text-rose-200 text-xs flex items-start gap-3 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-white">Error al iniciar sesión:</span> {loginError}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoggingIn || !loginEmail.trim() || !loginPassword}
                  className="w-full mt-3 py-4 px-8 rounded-full font-extrabold text-sm bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 hover:from-sky-300 hover:via-cyan-300 hover:to-emerald-300 text-slate-950 shadow-xl shadow-cyan-500/25 border border-cyan-100/60 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Autenticando credenciales...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Ingresar al Panel de Gestión</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Switch to Activation tab helper */}
                <div className="pt-4 text-center text-xs text-slate-400">
                  ¿Es tu primera vez y tienes un Código Maestro?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('activate')}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 ml-1"
                  >
                    Activar mi cuenta aquí
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Buenos Malos Consejos. Plataforma editorial centralizada.</p>
          <div className="flex items-center space-x-4 text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Firebase Authentication & Firestore
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Gestión Editorial Centralizada
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
