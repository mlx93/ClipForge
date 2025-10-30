import { BrowserWindow, app, safeStorage, session, shell } from 'electron';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// OAuth token interface
interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  expiry_date: number;
}

// OAuth credentials (should be loaded from environment variables or config)
const getOAuthConfig = () => {
  // For desktop apps, Google accepts localhost redirects automatically
  // The redirect URI format for desktop apps can be:
  // - http://localhost (any port)
  // - http://localhost:PORT/path
  // - urn:ietf:wg:oauth:2.0:oob (manual copy-paste flow)
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  // For desktop apps, use localhost with any port - Google accepts this automatically
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback';
  
  console.log('[Google Drive] Loading OAuth config:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    redirectUri,
    clientIdPrefix: clientId ? clientId.substring(0, 20) + '...' : 'MISSING'
  });
  
  return { clientId, clientSecret, redirectUri };
};

// Create OAuth2 client
let oauth2Client: OAuth2Client | null = null;

const getOAuth2Client = (): OAuth2Client => {
  if (!oauth2Client) {
    const { clientId, clientSecret, redirectUri } = getOAuthConfig();
    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }
  return oauth2Client;
};

// Token storage using Electron's SafeStorage API
const TOKEN_STORAGE_KEY = 'google_drive_tokens';

const storeTokens = async (tokens: OAuthTokens): Promise<void> => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(JSON.stringify(tokens));
      const fs = await import('fs/promises');
      const path = await import('path');
      const userDataPath = app.getPath('userData');
      const tokenPath = path.join(userDataPath, 'googleDriveTokens.enc');
      await fs.writeFile(tokenPath, encrypted);
    } else {
      console.warn('[Google Drive] SafeStorage not available, storing tokens unencrypted');
      const fs = await import('fs/promises');
      const path = await import('path');
      const userDataPath = app.getPath('userData');
      const tokenPath = path.join(userDataPath, 'googleDriveTokens.json');
      await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));
    }
  } catch (error) {
    console.error('[Google Drive] Failed to store tokens:', error);
    throw error;
  }
};

const retrieveTokens = async (): Promise<OAuthTokens | null> => {
  try {
    const path = await import('path');
    const fs = await import('fs/promises');
    const { existsSync } = await import('fs');
    const userDataPath = app.getPath('userData');
    
    // Check for encrypted tokens first
    const encryptedPath = path.join(userDataPath, 'googleDriveTokens.enc');
    const jsonPath = path.join(userDataPath, 'googleDriveTokens.json');
    
    if (existsSync(encryptedPath)) {
      const encrypted = await fs.readFile(encryptedPath);
      if (safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted) as OAuthTokens;
      }
    }
    
    if (existsSync(jsonPath)) {
      const data = await fs.readFile(jsonPath, 'utf-8');
      return JSON.parse(data) as OAuthTokens;
    }
    
    return null;
  } catch (error) {
    console.error('[Google Drive] Failed to retrieve tokens:', error);
    return null;
  }
};

const clearTokens = async (): Promise<void> => {
  try {
    const path = await import('path');
    const fs = await import('fs/promises');
    const { existsSync } = await import('fs');
    const userDataPath = app.getPath('userData');
    
    const encryptedPath = path.join(userDataPath, 'googleDriveTokens.enc');
    const jsonPath = path.join(userDataPath, 'googleDriveTokens.json');
    
    if (existsSync(encryptedPath)) {
      await fs.unlink(encryptedPath);
    }
    if (existsSync(jsonPath)) {
      await fs.unlink(jsonPath);
    }
  } catch (error) {
    console.error('[Google Drive] Failed to clear tokens:', error);
  }
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const tokens = await retrieveTokens();
  if (!tokens) return false;
  
  // Check if token is expired
  if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
    // Token expired, try to refresh
    try {
      const refreshedTokens = await refreshAccessToken(tokens.refresh_token);
      return refreshedTokens !== null;
    } catch (error) {
      console.error('[Google Drive] Token refresh failed:', error);
      return false;
    }
  }
  
  return true;
};

// Refresh access token
export const refreshAccessToken = async (refreshToken: string): Promise<OAuthTokens | null> => {
  try {
    const client = getOAuth2Client();
    client.setCredentials({ refresh_token: refreshToken });
    
    const { credentials } = await client.refreshAccessToken();
    
    const newTokens: OAuthTokens = {
      access_token: credentials.access_token || '',
      refresh_token: credentials.refresh_token || refreshToken,
      expires_in: credentials.expiry_date ? (credentials.expiry_date - Date.now()) / 1000 : 3600,
      token_type: credentials.token_type || 'Bearer',
      expiry_date: credentials.expiry_date || Date.now() + 3600 * 1000
    };
    
    await storeTokens(newTokens);
    return newTokens;
  } catch (error) {
    console.error('[Google Drive] Failed to refresh access token:', error);
    return null;
  }
};

// Initiate OAuth flow with BrowserWindow
export const initiateGoogleAuth = async (mainWindow: BrowserWindow): Promise<{ authUrl: string }> => {
  try {
    const client = getOAuth2Client();
    const scopes = ['https://www.googleapis.com/auth/drive.file'];
    
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });
    
    // Open OAuth in external browser (Google blocks Electron embedded browsers)
    console.log('[Google Drive] Opening OAuth URL in external browser:', authUrl);
    await shell.openExternal(authUrl);
    
    // Note: The OAuth callback URL will redirect to localhost:3000/oauth/callback
    // This will fail in the browser since there's no server listening
    // User will need to manually copy the code from the URL
    // OR we need to use a different redirect URI that's registered in Google Cloud Console
    
    return { authUrl };
  } catch (error) {
    console.error('[Google Drive] Failed to initiate auth:', error);
    throw error;
  }
};

// Handle OAuth callback
export const handleOAuthCallback = async (code: string): Promise<{ success: boolean; tokens?: OAuthTokens }> => {
  try {
    const client = getOAuth2Client();
    
    const { tokens } = await client.getToken(code);
    
    if (!tokens.access_token || !tokens.refresh_token) {
      return { success: false };
    }
    
    const oauthTokens: OAuthTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expiry_date ? (tokens.expiry_date - Date.now()) / 1000 : 3600,
      token_type: tokens.token_type || 'Bearer',
      expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000
    };
    
    await storeTokens(oauthTokens);
    
    return { success: true, tokens: oauthTokens };
  } catch (error) {
    console.error('[Google Drive] OAuth callback failed:', error);
    return { success: false };
  }
};

// Get access token
export const getAccessToken = async (): Promise<string | null> => {
  const tokens = await retrieveTokens();
  if (!tokens) return null;
  
  // Check if token needs refresh
  if (tokens.expiry_date && Date.now() >= tokens.expiry_date - 60000) { // Refresh 1 minute before expiry
    const refreshedTokens = await refreshAccessToken(tokens.refresh_token);
    if (!refreshedTokens) return null;
    return refreshedTokens.access_token;
  }
  
  return tokens.access_token;
};

// Sign out (clear tokens)
export const signOut = async (): Promise<void> => {
  await clearTokens();
};

// Upload file to Google Drive with progress tracking
export const uploadFileToDrive = async (
  filePath: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<{ fileId: string; shareUrl: string }> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in to Google Drive.');
    }
    
    const fs = await import('fs/promises');
    const { statSync, createReadStream } = await import('fs');
    const path = await import('path');
    
    const fileSize = statSync(filePath).size;
    
    // Initialize Google Drive API client
    const client = getOAuth2Client();
    client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: client });
    
    // Create file metadata
    const fileMetadata = {
      name: fileName
    };
    
    // Upload file using resumable upload for better progress tracking
    const media = {
      mimeType: 'video/mp4',
      body: createReadStream(filePath)
    };
    
    // Use simple upload for files under 5MB, resumable for larger files
    let fileId: string;
    
    if (fileSize < 5 * 1024 * 1024) {
      // Simple upload for small files
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media
      });
      
      fileId = response.data.id!;
      
      if (onProgress) {
        onProgress(100);
      }
    } else {
      // Resumable upload for large files
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: 'video/mp4'
        }
      });
      
      fileId = response.data.id!;
      
      // Upload file in chunks with progress tracking
      await uploadFileInChunks(drive, fileId, filePath, fileSize, onProgress);
    }
    
    // Make file shareable and get share URL
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    const fileInfo = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink, webContentLink'
    });
    
    const shareUrl = fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    
    return { fileId, shareUrl };
  } catch (error) {
    console.error('[Google Drive] Upload failed:', error);
    throw error;
  }
};

// Upload file in chunks with progress tracking
const uploadFileInChunks = async (
  drive: any,
  fileId: string,
  filePath: string,
  fileSize: number,
  onProgress?: (progress: number) => void
): Promise<void> => {
  const { createReadStream } = await import('fs');
  const chunkSize = 256 * 1024; // 256KB chunks
  let uploaded = 0;
  
  try {
    const stream = createReadStream(filePath, { highWaterMark: chunkSize });
    
    for await (const chunk of stream) {
      const start = uploaded;
      const end = Math.min(uploaded + chunk.length - 1, fileSize - 1);
      
      // Upload chunk
      await drive.files.update({
        fileId: fileId,
        media: {
          mimeType: 'video/mp4',
          body: chunk
        }
      });
      
      uploaded += chunk.length;
      
      if (onProgress) {
        const progress = Math.round((uploaded / fileSize) * 100);
        onProgress(progress);
      }
    }
  } catch (error) {
    console.error('[Google Drive] Error uploading file chunks:', error);
    throw error;
  }
};

