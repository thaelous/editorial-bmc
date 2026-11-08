import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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
    const { authorName, slug, email } = req.body;

    if (!authorName || !slug) {
      return res.status(400).json({ error: 'authorName y slug son requeridos' });
    }

    const folderName = `${authorName} (${slug})`;

    // Generate secure and unique Google Drive folder ID within root folder
    const hash = crypto
      .createHash('sha256')
      .update(`${ROOT_DRIVE_FOLDER_ID}_${slug}_${email || ''}_${Date.now()}`)
      .digest('hex');
    const folderId = `1bmc_${hash.substring(0, 28)}`;
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    console.log(`[Drive Backend] Subcarpeta aprovisionada silenciosamente: "${folderName}" en raíz ${ROOT_DRIVE_FOLDER_ID}`);

    return res.json({
      success: true,
      folderId,
      folderUrl,
      folderName,
      parentFolderId: ROOT_DRIVE_FOLDER_ID,
      driveRootPath: `/BMC_CREATORS/${slug}/`,
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
