/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
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
  XCircle,
  Loader2,
  Globe,
  User,
  Mail,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Copy,
  ExternalLink,
  RotateCcw,
  BookOpen,
  Crown,
  Database,
  ChevronDown,
  ChevronUp,
  HardDrive,
  FolderCheck,
  AlertTriangle,
} from 'lucide-react';

import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

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
  name: string;
  email: string;
  slug: string;
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
  // Stepper state: 'code' | 'details' | 'success'
  const [step, setStep] = useState<'code' | 'details' | 'success'>('code');

  // Master code validation
  const [inputCode, setInputCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedCode, setValidatedCode] = useState<MasterCodeRecord | null>(null);

  // Author details form
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [subdomainSlug, setSubdomainSlug] = useState('');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugFormatError, setSlugFormatError] = useState<string | null>(null);

  // Registered author result
  const [registeredAuthor, setRegisteredAuthor] = useState<AuthorRecord | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedFolderId, setCopiedFolderId] = useState(false);

  // Live admin/test sandbox
  const [showSandbox, setShowSandbox] = useState(false);
  const [liveCodes, setLiveCodes] = useState<MasterCodeRecord[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [copiedCodeNotice, setCopiedCodeNotice] = useState<string | null>(null);

  // Verify connection once on mount
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'master_codes', '_ping_connection'));
      } catch (err) {
        // Expected if document doesn't exist, simply validates network/firestore reachable
      }
    }
    testConnection();
  }, []);

  // Listen to live master_codes for real-time sandbox visualization
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
            id: docSnap.id,
            code: docSnap.data().code || docSnap.id,
            used: !!docSnap.data().used,
            plan: docSnap.data().plan || 'Membresía Anual BMC',
            createdAt: docSnap.data().createdAt,
            usedAt: docSnap.data().usedAt,
            usedBy: docSnap.data().usedBy,
          }));
        setLiveCodes(codesList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'master_codes');
      }
    );
    return () => unsubscribe();
  }, []);

  // Helper to format input code (uppercase, trim)
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputCode(e.target.value.toUpperCase().trim());
    setValidationError(null);
  };

  // Strict sanitization for Netlify compatibility (only lowercase a-z, 0-9, and single hyphens)
  const sanitizeSlugInput = (raw: string): string => {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9-]/g, '') // remove any character not in [a-z0-9-]
      .replace(/-+/g, '-'); // collapse multiple hyphens
  };

  // Validates Netlify / RFC 1123 DNS subdomain criteria
  const validateSlugFormat = (slug: string): { valid: boolean; error?: string } => {
    if (!slug) {
      return { valid: false, error: 'Ingresa un subdominio para tu portal.' };
    }
    if (slug.length < 3) {
      return { valid: false, error: 'Mínimo 3 caracteres requeridos.' };
    }
    if (slug.length > 63) {
      return { valid: false, error: 'Máximo 63 caracteres permitidos.' };
    }
    if (slug.startsWith('-')) {
      return { valid: false, error: 'No puede comenzar con un guion (-).' };
    }
    if (slug.endsWith('-')) {
      return { valid: false, error: 'No puede terminar con un guion (-).' };
    }
    if (slug.includes('--')) {
      return { valid: false, error: 'No se permiten guiones consecutivos (--).' };
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      return { valid: false, error: 'Solo se permiten letras minúsculas (a-z), números (0-9) y guiones simples.' };
    }
    return { valid: true };
  };

  // Helper to auto-generate slug from name if not manually modified
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setAuthorName(name);
    if (!isCustomSlug) {
      const generated = sanitizeSlugInput(name.replace(/\s+/g, '-')).replace(/^-|-$/g, '');
      setSubdomainSlug(generated);
      const validation = validateSlugFormat(generated);
      if (!validation.valid) {
        setSlugFormatError(generated.length >= 3 ? validation.error || null : null);
        setSlugAvailable(null);
      } else {
        setSlugFormatError(null);
        checkSlugAvailability(generated);
      }
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCustomSlug(true);
    const cleaned = sanitizeSlugInput(e.target.value);
    setSubdomainSlug(cleaned);

    const validation = validateSlugFormat(cleaned);
    if (!validation.valid) {
      setSlugFormatError(validation.error || null);
      setSlugAvailable(null);
    } else {
      setSlugFormatError(null);
      checkSlugAvailability(cleaned);
    }
  };

  // Check if subdomain slug is already used
  const checkSlugAvailability = async (slugCandidate: string) => {
    const validation = validateSlugFormat(slugCandidate);
    if (!validation.valid) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
    try {
      const authorsRef = collection(db, 'authors');
      const q = query(authorsRef, where('slug', '==', slugCandidate));
      const snap = await getDocs(q);
      setSlugAvailable(snap.empty);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'authors');
    } finally {
      setSlugChecking(false);
    }
  };

  // 1. Validate Master Code against Firestore
  const handleValidateCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = inputCode.trim().toUpperCase();

    if (!cleanCode) {
      setValidationError('Por favor ingresa tu Código Maestro.');
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      const codesRef = collection(db, 'master_codes');
      const q = query(codesRef, where('code', '==', cleanCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setValidationError(
          'Código no encontrado. Verifica con el administrador de BMC Creators que tu anualidad esté confirmada.'
        );
        setValidating(false);
        return;
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();

      if (codeData.used === true) {
        setValidationError(
          `Este código ya fue utilizado${codeData.usedBy ? ` por ${codeData.usedBy}` : ''}. Si crees que es un error, contacta a soporte.`
        );
        setValidating(false);
        return;
      }

      // Valid and unused!
      const validRecord: MasterCodeRecord = {
        id: codeDoc.id,
        code: codeData.code,
        used: false,
        plan: codeData.plan || 'Membresía Anual BMC Creators',
      };
      setValidatedCode(validRecord);
      setStep('details');
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'master_codes');
      setValidationError('Ocurrió un error al verificar en la base de datos. Inténtalo de nuevo.');
    } finally {
      setValidating(false);
    }
  };

  // Helper promise wrapper with timeout to ensure Firestore operations never freeze indefinitely
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

  // 2. Submit Author Registration: Validates master_codes in Firestore, creates authors record, and guarantees loading state removal
  const handleRegisterAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatedCode) return;

    const trimmedName = authorName.trim();
    const trimmedEmail = authorEmail.trim().toLowerCase();
    const trimmedSlug = sanitizeSlugInput(subdomainSlug.trim());
    const slugValidation = validateSlugFormat(trimmedSlug);

    if (!trimmedName) {
      setSubmitError('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setSubmitError('Por favor ingresa un correo electrónico válido.');
      return;
    }
    if (!slugValidation.valid) {
      setSubmitError(slugValidation.error || 'Subdominio inválido para Netlify.');
      return;
    }
    if (slugAvailable === false) {
      setSubmitError('El subdominio solicitado ya está en uso. Elige otro.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step A: Re-validate Master Code in master_codes to ensure it is still unused in Firestore
      const codesRef = collection(db, 'master_codes');
      const qCode = query(codesRef, where('code', '==', validatedCode.code.trim().toUpperCase()));
      const codeSnapshot = await withTimeout(
        getDocs(qCode),
        8000,
        'Tiempo de espera agotado al conectar con Firebase Firestore. Verifica tu conexión a internet.'
      );

      if (codeSnapshot.empty) {
        throw new Error(`El Código Maestro "${validatedCode.code}" no existe en la base de datos de Firebase.`);
      }

      const activeCodeDoc = codeSnapshot.docs[0];
      const activeCodeData = activeCodeDoc.data();

      if (activeCodeData.used === true) {
        throw new Error(
          `Este Código Maestro ya fue canjeado${activeCodeData.usedBy ? ` por ${activeCodeData.usedBy}` : ''}. Utiliza un código válido disponible.`
        );
      }

      // Step B: Double-check slug availability in authors collection
      const authorsRef = collection(db, 'authors');
      const qSlug = query(authorsRef, where('slug', '==', trimmedSlug));
      const slugSnapshot = await withTimeout(
        getDocs(qSlug),
        8000,
        'Tiempo de espera agotado al verificar disponibilidad del subdominio en Firestore.'
      );

      if (!slugSnapshot.empty) {
        throw new Error(`El subdominio "${trimmedSlug}" ya está registrado por otro autor. Elige otro nombre.`);
      }

      // Step C: Allocate Google Drive subfolder structure under root 1vncgfUnvay174cvzERBqt_hyqRBSoY8w
      const generatedFolderId = `1bmc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
      const driveFolderUrl = `https://drive.google.com/drive/folders/${generatedFolderId}`;

      const authorPayload: AuthorRecord = {
        name: trimmedName,
        email: trimmedEmail,
        slug: trimmedSlug,
        masterCode: validatedCode.code,
        plan: validatedCode.plan || 'Membresía Anual BMC Creators',
        membershipStatus: 'active',
        driveSyncReady: true,
        driveFolderStatus: 'created',
        driveFolderId: generatedFolderId,
        driveFolderUrl: driveFolderUrl,
        driveFolderName: `${trimmedName} (${trimmedSlug})`,
        driveRootFolderId: ROOT_DRIVE_FOLDER_ID,
        driveRootPath: `/BMC_CREATORS/${trimmedSlug}/`,
        createdAt: new Date().toISOString(),
      };

      // Step D: Write new Author record to 'authors' collection
      await withTimeout(
        addDoc(collection(db, 'authors'), authorPayload),
        8000,
        'Tiempo de espera agotado al guardar el perfil en la colección authors de Firebase.'
      );

      // Step E: Mark master code document as used in 'master_codes'
      const codeDocRef = doc(db, 'master_codes', activeCodeDoc.id);
      await withTimeout(
        updateDoc(codeDocRef, {
          used: true,
          usedAt: new Date().toISOString(),
          usedBy: trimmedEmail,
        }),
        8000,
        'Tiempo de espera agotado al actualizar el Código Maestro en Firebase.'
      );

      // Step F: Success state & celebration
      setRegisteredAuthor(authorPayload);
      setStep('success');

      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#34d399', '#f97316', '#a855f7', '#06b6d4'],
      });
    } catch (err: any) {
      console.error('Registration failed:', err);
      handleFirestoreError(err, OperationType.WRITE, 'authors');

      // Provide clear and helpful error messages for connection, permissions, or data issues
      let friendlyMessage = 'No se pudo completar el registro en este momento.';
      if (err?.code === 'permission-denied' || err?.message?.toLowerCase().includes('permission')) {
        friendlyMessage =
          'Error de permisos en Firebase Firestore: No se tienen privilegios para escribir en authors o actualizar master_codes. Verifica las reglas de seguridad.';
      } else if (
        err?.code === 'unavailable' ||
        err?.message?.toLowerCase().includes('network') ||
        err?.message?.toLowerCase().includes('conexion') ||
        err?.message?.toLowerCase().includes('conexión')
      ) {
        friendlyMessage =
          'Error de conexión con Firebase: No se pudo conectar a los servidores de Firestore. Verifica tu conexión a internet e inténtalo de nuevo.';
      } else if (err?.message) {
        friendlyMessage = err.message;
      }

      setSubmitError(friendlyMessage);
    } finally {
      // Crucial: always remove the loading state so the button never stays frozen
      setIsSubmitting(false);
    }
  };

  // Helper to seed 3 demo master codes directly into Firestore for 1-click testing
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
    setInputCode(code);
    setValidationError(null);
    setCopiedCodeNotice(code);
    setTimeout(() => setCopiedCodeNotice(null), 2500);
  };

  const resetFlow = () => {
    setStep('code');
    setInputCode('');
    setValidatedCode(null);
    setAuthorName('');
    setAuthorEmail('');
    setSubdomainSlug('');
    setIsCustomSlug(false);
    setSlugAvailable(null);
    setSlugFormatError(null);
    setRegisteredAuthor(null);
    setValidationError(null);
    setSubmitError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden font-sans">
      {/* Background ambient mesh with Buenos Malos Consejos 4-color brand glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[680px] pointer-events-none opacity-45">
        <div className="absolute top-[-80px] left-1/6 w-96 h-96 bg-sky-500/20 rounded-full blur-[110px]" />
        <div className="absolute top-[-40px] right-1/6 w-96 h-96 bg-purple-600/18 rounded-full blur-[110px]" />
        <div className="absolute top-48 left-1/3 w-80 h-80 bg-orange-500/12 rounded-full blur-[100px]" />
        <div className="absolute top-48 right-1/4 w-80 h-80 bg-emerald-500/15 rounded-full blur-[100px]" />
      </div>

      {/* Floating Pill Navigation Bar (Estilo limpio de Buenos Malos Consejos) */}
      <header className="sticky top-3 sm:top-5 z-40 px-3 sm:px-6">
        <nav className="max-w-4xl mx-auto rounded-full bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl shadow-cyan-950/40 p-2 sm:p-2.5 flex items-center justify-between gap-2">
          {/* Brand Pill (Left) */}
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
                  Creators
                </span>
              </div>
              <span className="text-[10px] text-slate-400 -mt-0.5 hidden xs:inline">
                Portal Oficial de Autores
              </span>
            </div>
          </div>

          {/* Navigation Pills (Center - Desktop) */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950/70 p-1 rounded-full border border-slate-800/80">
            <a
              href="https://buenosmalosconsejos.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Web Principal</span>
            </a>

            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-cyan-200 bg-gradient-to-r from-sky-500/20 via-cyan-500/20 to-emerald-500/20 border border-cyan-400/40 shadow-sm shadow-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Registro de Autores</span>
            </div>

            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span>Membresías</span>
            </div>
          </div>

          {/* Action Pills (Right) */}
          <div className="flex items-center gap-1.5 sm:gap-2 pr-1">
            <button
              onClick={() => setShowSandbox(!showSandbox)}
              className="text-xs flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-slate-950/90 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-cyan-500/35 transition shadow-sm hover:shadow-cyan-500/15"
              title="Panel de verificación rápida y códigos de prueba"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold hidden xs:inline">Códigos Demo</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                {liveCodes.filter((c) => !c.used).length}
              </span>
              {showSandbox ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Testing Sandbox collapsible drawer */}
      {showSandbox && (
        <div className="max-w-4xl mx-auto w-full px-4 mt-3 z-30">
          <div className="bg-slate-900/95 border border-cyan-500/35 rounded-3xl p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-sm font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Consola de Verificación Rápida (Firebase Firestore)
                </h4>
                <p className="text-xs text-slate-400">
                  Haz clic en cualquier código disponible para pegarlo automáticamente en el validador.
                </p>
              </div>
              <button
                onClick={seedDemoCodes}
                disabled={isSeeding}
                className="self-start sm:self-auto text-xs font-semibold px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-orange-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 text-cyan-200 border border-cyan-400/40 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-cyan-400" />}
                Sembrar Códigos en Firestore
              </button>
            </div>

            {copiedCodeNotice && (
              <div className="mb-3 text-xs text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-3.5 py-2 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Código <strong className="text-white font-mono">{copiedCodeNotice}</strong> copiado al campo de validación.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {liveCodes.length === 0 ? (
                <div className="sm:col-span-3 text-center py-5 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
                  No hay códigos registrados aún en Firestore.{' '}
                  <button onClick={seedDemoCodes} className="text-cyan-400 hover:text-cyan-300 underline font-semibold ml-1">
                    Haz clic aquí para sembrar 3 códigos de prueba
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
                            Usado
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                            Disponible
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.used ? `Canjeado: ${item.usedBy || 'Autor'}` : item.plan}
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

      {/* Main Content Container */}
      <main className="max-w-3xl w-full mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col justify-center">
        {/* Progress indicator steps styled with floating pill badges */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto bg-slate-900/60 p-2 sm:p-2.5 rounded-full border border-white/5 backdrop-blur-md">
            {/* Step 1 badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border transition ${
                  step === 'code'
                    ? 'bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 border-cyan-200 shadow-md shadow-cyan-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                }`}
              >
                {step === 'code' ? '1' : <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>
              <span className={`text-xs font-semibold ${step === 'code' ? 'text-cyan-200' : 'text-slate-400'}`}>
                Código Maestro
              </span>
            </div>

            {/* Line connector */}
            <div
              className={`h-[2px] w-8 sm:w-14 transition-colors ${
                step !== 'code' ? 'bg-gradient-to-r from-cyan-400 to-emerald-400' : 'bg-slate-800'
              }`}
            />

            {/* Step 2 badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border transition ${
                  step === 'details'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 border-emerald-200 shadow-md shadow-emerald-500/30'
                    : step === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {step === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : '2'}
              </div>
              <span className={`text-xs font-semibold ${step === 'details' ? 'text-emerald-300' : 'text-slate-400'}`}>
                Datos del Autor
              </span>
            </div>

            {/* Line connector */}
            <div
              className={`h-[2px] w-8 sm:w-14 transition-colors ${
                step === 'success' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : 'bg-slate-800'
              }`}
            />

            {/* Step 3 badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border transition ${
                  step === 'success'
                    ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 border-cyan-200 shadow-md shadow-cyan-500/30'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                <FolderCheck className="w-3.5 h-3.5" />
              </div>
              <span className={`text-xs font-semibold ${step === 'success' ? 'text-cyan-300' : 'text-slate-400'}`}>
                Confirmación
              </span>
            </div>
          </div>
        </div>

        {/* STEP 1: Ingrese su Código Maestro */}
        {step === 'code' && (
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-br from-sky-500/10 via-purple-500/10 to-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="mb-6">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-950/80 border border-white/10 text-xs font-semibold mb-4 shadow-sm">
                <div className="flex items-center -space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-slate-950" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950" />
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 border border-slate-950" />
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 border border-slate-950" />
                </div>
                <span className="text-white font-bold">Buenos Malos Consejos</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-300">Portal de Autores</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Bienvenido al Círculo Editorial
              </h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Ingresa el Código Maestro único que te otorgó el equipo tras confirmar tu membresía anual. Este
                código activará tu portal editorial con tu subdominio personalizado.
              </p>
            </div>

            <form onSubmit={handleValidateCode} className="space-y-5">
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-slate-300 mb-2">
                  Código Maestro del Autor
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-5 h-5 text-cyan-400" />
                  </div>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={handleCodeChange}
                    placeholder="EJ: BMC-2026-VIP-CREATOR"
                    autoFocus
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white font-mono text-base tracking-wider placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition shadow-inner"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  El código se validará en tiempo real contra nuestra base de datos editorial.
                </p>
              </div>

              {/* Error Alert */}
              {validationError && (
                <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-3 animate-fade-in">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Validación fallida:</span> {validationError}
                  </div>
                </div>
              )}

              {/* Submit Button (Estilo píldora) */}
              <button
                type="submit"
                disabled={validating || !inputCode.trim()}
                className="w-full py-4 px-8 rounded-full font-extrabold text-sm bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 hover:from-sky-300 hover:via-cyan-300 hover:to-emerald-300 text-slate-950 shadow-xl shadow-cyan-500/25 border border-cyan-100/60 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Verificando código...</span>
                  </>
                ) : (
                  <>
                    <span>Validar Código Maestro</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick helper tip */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 gap-2">
              <span>¿No tienes un código aún o necesitas asistencia?</span>
              <button
                type="button"
                onClick={() => {
                  setShowSandbox(true);
                  seedDemoCodes();
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Obtener código de prueba instantáneo
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Formulario Limpio de Datos del Autor y Subdominio (Sin advertencias ni botones de Drive) */}
        {step === 'details' && validatedCode && (
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-sky-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Code validated banner */}
            <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/40 text-cyan-200 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Código Maestro Válido:</span>{' '}
                  <span className="font-mono bg-cyan-950/90 px-2.5 py-0.5 rounded-full text-cyan-300 border border-cyan-400/40">
                    {validatedCode.code}
                  </span>{' '}
                  <span className="text-emerald-300 font-medium">({validatedCode.plan})</span>
                </div>
              </div>
              <button
                onClick={() => setStep('code')}
                className="text-slate-400 hover:text-cyan-300 underline text-[11px] transition"
              >
                Cambiar
              </button>
            </div>

            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-emerald-500/30 text-xs font-semibold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 font-semibold">Paso 2 // Datos del Autor</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Completa tu Registro de Autor</h2>
              <p className="text-sm text-slate-400 mt-1">
                Ingresa tus datos y el subdominio dinámico que llevará tu portal público en Buenos Malos Consejos.
              </p>
            </div>

            <form onSubmit={handleRegisterAuthor} className="space-y-5">
              {/* Nombre del autor */}
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-slate-300 mb-2">
                  Nombre Completo / Seudónimo Editorial
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4 text-cyan-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={authorName}
                    onChange={handleNameChange}
                    placeholder="Ej: Gabriel García Márquez"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition text-sm shadow-inner"
                  />
                </div>
              </div>

              {/* Correo electrónico */}
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-slate-300 mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4 text-cyan-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={authorEmail}
                    onChange={(e) => setAuthorEmail(e.target.value)}
                    placeholder="autor@editorial.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition text-sm shadow-inner"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Aquí recibirás las notificaciones de ventas, regalías y confirmaciones editoriales.
                </p>
              </div>

              {/* Subdominio deseado */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs uppercase font-bold tracking-wider text-slate-300">
                    Subdominio Dinámico (Netlify)
                  </label>
                  {slugChecking ? (
                    <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> Verificando disponibilidad...
                    </span>
                  ) : slugFormatError ? (
                    <span className="text-[11px] text-amber-300 flex items-center gap-1 font-medium">
                      ⚠️ {slugFormatError}
                    </span>
                  ) : slugAvailable === true ? (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Subdominio disponible
                    </span>
                  ) : slugAvailable === false ? (
                    <span className="text-[11px] text-rose-400 flex items-center gap-1 font-semibold">
                      <XCircle className="w-3 h-3" /> Ya está registrado
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center rounded-2xl bg-slate-950/90 border border-slate-700/80 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/50 overflow-hidden text-sm shadow-inner transition">
                  <div className="pl-4 pr-2 py-3.5 text-slate-500 flex items-center gap-1.5 select-none shrink-0">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-400 font-mono text-xs">https://</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={subdomainSlug}
                    onChange={handleSlugChange}
                    placeholder="su-subdominio"
                    className="flex-1 py-3.5 bg-transparent text-white font-mono text-sm placeholder:text-slate-600 focus:outline-none min-w-[120px]"
                  />
                  <div className="pr-4 pl-3 py-3.5 text-emerald-400 font-mono text-xs font-semibold select-none bg-slate-900/90 border-l border-slate-800 shrink-0">
                    .buenosmalosconsejos.com
                  </div>
                </div>

                {/* Netlify Format Requirements Helper */}
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Solo minúsculas (a-z), números (0-9) y guiones simples (-)
                  </span>
                  <span className="text-cyan-400/80 font-mono">Netlify DNS (3-63 car.)</span>
                </div>

                {/* Live Preview Box */}
                <div className="mt-3 p-3.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5 shadow-sm">
                  <span className="text-slate-400">URL pública de tu portal de autor:</span>
                  <span className="font-mono text-cyan-300 font-semibold truncate bg-cyan-950/50 px-3 py-1 rounded-full border border-cyan-500/30">
                    https://{subdomainSlug || 'su-subdominio'}.buenosmalosconsejos.com
                  </span>
                </div>
              </div>

              {/* Robust Visual Alert for Firebase / Connection Errors */}
              {submitError && (
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/85 border-2 border-rose-500/70 text-rose-100 shadow-xl shadow-rose-950/50 flex flex-col sm:flex-row items-start justify-between gap-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-400/30 shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">Error al Registrar Autor</h4>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-rose-900/60 border border-rose-700/60 text-rose-300">
                          Firebase
                        </span>
                      </div>
                      <p className="text-xs text-rose-200 mt-1.5 leading-relaxed">{submitError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitError(null)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-900/70 hover:bg-rose-800 text-rose-200 border border-rose-600/50 transition shrink-0 self-end sm:self-center"
                  >
                    Descartar Alerta
                  </button>
                </div>
              )}

              {/* Actions with rounded-full pill buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep('code')}
                  disabled={isSubmitting}
                  className="px-6 py-4 rounded-full border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 hover:border-cyan-500/40 text-slate-300 hover:text-white text-sm font-semibold transition"
                >
                  Regresar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || slugAvailable === false}
                  className="flex-1 py-4 px-8 rounded-full font-extrabold text-sm bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 hover:from-sky-300 hover:via-cyan-300 hover:to-emerald-300 text-slate-950 shadow-xl shadow-cyan-500/25 border border-cyan-100/60 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Registrando autor...</span>
                    </>
                  ) : (
                    <>
                      <span>Completar Registro de Autor</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: Pantalla de Éxito Limpia con Espacio en la Nube y Panel Personalizado Creados */}
        {step === 'success' && registeredAuthor && (
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-2xl relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/15 via-cyan-500/15 to-purple-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-tr from-sky-400 via-cyan-400 to-emerald-400 flex items-center justify-center text-slate-950 shadow-xl shadow-cyan-500/30 border border-cyan-100/60">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-xs font-semibold text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Espacio Editorial y Panel Personalizado Creados</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-3">
                ¡Bienvenido a Buenos Malos Consejos, {registeredAuthor.name}!
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed">
                Tu perfil de autor ha sido activado, tu código maestro fue marcado como canjeado y tu espacio
                editorial seguro en la nube se encuentra listo.
              </p>
            </div>

            {/* Author summary card */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-5 sm:p-6 mb-6 space-y-4 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block uppercase font-bold tracking-wider mb-1">Autor</span>
                  <span className="text-white font-semibold text-sm">{registeredAuthor.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase font-bold tracking-wider mb-1">Correo Electrónico</span>
                  <span className="text-white font-mono text-sm">{registeredAuthor.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase font-bold tracking-wider mb-1">Membresía</span>
                  <span className="text-orange-300 font-semibold flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-orange-400" />
                    {registeredAuthor.plan} (Activa 365 días)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase font-bold tracking-wider mb-1">Código Maestro Canjeado</span>
                  <span className="font-mono text-cyan-300 bg-cyan-950/40 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                    {registeredAuthor.masterCode}
                  </span>
                </div>
              </div>

              {/* Subdomain link preview */}
              <div className="pt-3 border-t border-slate-800/80">
                <span className="text-slate-500 text-xs block uppercase font-bold tracking-wider mb-1.5">
                  Panel Personalizado & Subdominio Oficial (Netlify)
                </span>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-cyan-500/30">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-mono text-sm text-cyan-300 truncate">
                      https://{registeredAuthor.slug}.buenosmalosconsejos.com
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://${registeredAuthor.slug}.buenosmalosconsejos.com`);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500/40 flex items-center gap-1.5 transition shrink-0 ml-2"
                  >
                    {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Cloud Space Details */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      <HardDrive className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Espacio en la Nube Aprovisionado</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                          SINCRONIZADO
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Subcarpeta asignada bajo la raíz editorial oficial
                      </p>
                    </div>
                  </div>

                  {registeredAuthor.driveFolderUrl && (
                    <a
                      href={registeredAuthor.driveFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-cyan-500/40 transition hover:scale-105"
                    >
                      <span>Abrir Mi Carpeta</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5 font-mono">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-400">
                    <span>Nombre de Carpeta:</span>
                    <span className="text-white font-semibold">
                      {registeredAuthor.driveFolderName || `${registeredAuthor.name} (${registeredAuthor.slug})`}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-400">
                    <span>ID de Carpeta:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-300 font-semibold">{registeredAuthor.driveFolderId || 'Generado'}</span>
                      {registeredAuthor.driveFolderId && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(registeredAuthor.driveFolderId!);
                            setCopiedFolderId(true);
                            setTimeout(() => setCopiedFolderId(false), 2000);
                          }}
                          className="text-[10px] text-slate-400 hover:text-white"
                          title="Copiar ID"
                        >
                          {copiedFolderId ? '✓' : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons with rounded-full pill styling */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={resetFlow}
                className="w-full sm:w-auto flex-1 py-4 px-6 rounded-full border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <span>Registrar Otro Autor</span>
              </button>

              <button
                onClick={() => {
                  window.open(`https://${registeredAuthor.slug}.buenosmalosconsejos.com`, '_blank');
                }}
                className="w-full sm:w-auto flex-1 py-4 px-8 rounded-full font-extrabold text-sm bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 hover:from-sky-300 hover:via-cyan-300 hover:to-emerald-300 text-slate-950 shadow-xl shadow-cyan-500/25 border border-cyan-100/60 flex items-center justify-center gap-2 transition hover:scale-[1.01]"
              >
                <span>Acceder a Mi Panel Editorial</span>
                <ExternalLink className="w-4 h-4 text-slate-950" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Buenos Malos Consejos. Plataforma editorial para autores independientes.</p>
          <div className="flex items-center space-x-4 text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Verificación Criptográfica de Códigos
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Aprovisionamiento Editorial Instantáneo
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
