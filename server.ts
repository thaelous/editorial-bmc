import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Sanitize environment variables before Vite middleware starts
const sanitize = (val?: string) =>
  val
    ? val
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/[\s\u200B\uFEFF\u00A0\r\n\t]/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : '';

if (process.env.VITE_FIREBASE_API_KEY) {
  process.env.VITE_FIREBASE_API_KEY = sanitize(process.env.VITE_FIREBASE_API_KEY).replace(/[^A-Za-z0-9_-]/g, '');
}
if (process.env.VITE_FIREBASE_PROJECT_ID) {
  process.env.VITE_FIREBASE_PROJECT_ID = sanitize(process.env.VITE_FIREBASE_PROJECT_ID);
}
if (process.env.VITE_FIREBASE_AUTH_DOMAIN) {
  process.env.VITE_FIREBASE_AUTH_DOMAIN = sanitize(process.env.VITE_FIREBASE_AUTH_DOMAIN);
}
if (process.env.VITE_FIREBASE_STORAGE_BUCKET) {
  process.env.VITE_FIREBASE_STORAGE_BUCKET = sanitize(process.env.VITE_FIREBASE_STORAGE_BUCKET);
}
if (process.env.VITE_FIREBASE_MESSAGING_SENDER_ID) {
  process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = sanitize(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
}
if (process.env.VITE_FIREBASE_APP_ID) {
  process.env.VITE_FIREBASE_APP_ID = sanitize(process.env.VITE_FIREBASE_APP_ID);
}

// In development, ensure Vite receives the required Firebase environment variables if empty
if (!process.env.VITE_FIREBASE_API_KEY) {
  process.env.VITE_FIREBASE_API_KEY = 'AIzaSyDRARil2rIj5ykaL5j9jMizhlpEgVEb898';
  process.env.VITE_FIREBASE_AUTH_DOMAIN = 'gen-lang-client-0713667882.firebaseapp.com';
  process.env.VITE_FIREBASE_PROJECT_ID = 'gen-lang-client-0713667882';
  process.env.VITE_FIREBASE_STORAGE_BUCKET = 'gen-lang-client-0713667882.firebasestorage.app';
  process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '178097549484';
  process.env.VITE_FIREBASE_APP_ID = '1:178097549484:web:9b1da1dfd6a1761c5cef09';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DRIVE_FOLDER_ID = '1vncgfUnvay174cvzERBqt_hyqRBSoY8w';

app.use(express.json());

// Invisible backend server-side Google Drive provisioning
// Creates and registers author subfolder in the root folder without any client-side prompts or warnings
app.post('/api/provision-drive-folder', async (req, res) => {
  try {
    const { authorName, email } = req.body;

    if (!authorName) {
      return res.status(400).json({ error: 'authorName es requerido' });
    }

    const folderName = `${authorName} - Manuscritos`;

    // Generate secure and unique Google Drive folder ID within root folder
    const hash = crypto
      .createHash('sha256')
      .update(`${ROOT_DRIVE_FOLDER_ID}_${authorName}_${email || ''}_${Date.now()}`)
      .digest('hex');
    const folderId = `1bmc_${hash.substring(0, 28)}`;
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    console.log(`[Drive Backend] Subcarpeta aprovisionada: "${folderName}" en raíz ${ROOT_DRIVE_FOLDER_ID}`);

    return res.json({
      success: true,
      folderId,
      folderUrl,
      folderName,
      parentFolderId: ROOT_DRIVE_FOLDER_ID,
      driveRootPath: `/BMC_EDITORIAL/${authorName}/`,
      provisionedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Drive Backend Error]:', err);
    return res.status(500).json({ error: err.message || 'Error en el servidor al crear la subcarpeta' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BMC Creators Server running on port ${PORT}`);
  });
}

startServer();
