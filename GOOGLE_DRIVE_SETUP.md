# Google Drive Integration Setup Guide

This guide will walk you through setting up Google Drive upload functionality for SimpleCut v2.0.0.

## Prerequisites

- Google Cloud Console account
- Basic understanding of OAuth 2.0
- Electron app development environment

## Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Name your project (e.g., "SimpleCut Integration")
4. Click "Create"

### Step 2: Enable Google Drive API

1. In your Google Cloud project, go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click on "Google Drive API" and click "Enable"

### Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in app information (name, logo, support email)
   - Add your email to test users
   - Add scopes: `https://www.googleapis.com/auth/drive.file`
   - Save and continue through the screens
4. For OAuth client:
   - Application type: **Desktop app**
   - Name: "SimpleCut"
   - Click "Create"
5. Copy the **Client ID** and **Client Secret**

### Step 4: Configure Environment Variables

**✅ COMPLETED**: The `.env` file has been created in the project root with the following credentials:

```bash
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_SCOPE=https://www.googleapis.com/auth/drive.file
```

**Note**: Do NOT commit the `.env` file to version control. It should be in `.gitignore`.

### Step 5: Install Dependencies

The required dependencies are already installed:

```bash
npm install googleapis
```

### Step 6: Test the Integration

1. Build and run the app:
   ```bash
   npm run dev
   ```

2. Export a video from SimpleCut
3. Click "Share to Cloud" and select "Google Drive"
4. Click "Sign in with Google Drive"
5. Complete the OAuth flow in the BrowserWindow
6. Upload your video
7. Copy the shareable link

## How It Works

### OAuth Flow

1. User clicks "Sign in with Google Drive"
2. App opens a BrowserWindow with Google OAuth consent screen
3. User grants permissions
4. Google redirects to callback URL with authorization code
5. App exchanges code for access token and refresh token
6. Tokens are stored securely using Electron's SafeStorage API
7. BrowserWindow closes and user is authenticated

### File Upload

1. User clicks "Upload" button
2. App checks if user is authenticated
3. If not authenticated, prompts user to sign in
4. If authenticated, uploads file using Google Drive API
5. Shows progress percentage
6. Makes file shareable with "anyone with link" permission
7. Displays shareable URL

### Token Management

- **Access Token**: Used for API calls, expires in 1 hour
- **Refresh Token**: Used to get new access tokens, doesn't expire
- **Storage**: Tokens encrypted using Electron's SafeStorage (macOS Keychain on Mac)
- **Auto-refresh**: Access token automatically refreshed before expiry

## Security Considerations

### Production Deployment

1. **Never commit `.env` file** to version control
2. **Rotate credentials** if compromised
3. **Use verified OAuth consent screen** for production
4. **Scope limitation**: Only requests `drive.file` scope (app-created files only)
5. **Token security**: Tokens stored encrypted using SafeStorage API

### Development vs Production

**Development:**
- Use unverified OAuth consent screen
- Add test users to your Google Cloud project

**Production:**
- Submit for OAuth verification
- Add domains to authorized JavaScript origins
- Complete security review if required

## Troubleshooting

### "Authentication failed"

- Check that Client ID and Client Secret are correct
- Verify OAuth consent screen is configured
- Ensure redirect URI matches exactly: `http://localhost:3000/oauth/callback`
- Check that you're added as a test user (for unverified apps)

### "Upload failed"

- Check internet connection
- Verify Google Drive API is enabled
- Check file size (Google Drive has quota limits)
- Look for error messages in console logs

### Token issues

- Clear stored tokens: Delete `googleDriveTokens.enc` or `googleDriveTokens.json` from app's userData directory
- Sign out and sign in again
- Check that SafeStorage is available: `safeStorage.isEncryptionAvailable()`

### BrowserWindow not showing

- Check console for errors
- Verify BrowserWindow permissions in main process
- Ensure modal window configuration is correct

## File Structure

```
src/
├── main/
│   └── googleDrive.ts          # OAuth flow, token management, file upload
├── renderer/
│   ├── components/
│   │   └── CloudExport.tsx     # UI for cloud export and Google Drive
│   └── store/
│       └── googleDriveStore.ts # Zustand store for Google Drive state
└── shared/
    └── constants.ts            # IPC channel definitions
```

## API Reference

### Main Process (`src/main/googleDrive.ts`)

- `initiateGoogleAuth(mainWindow)`: Start OAuth flow
- `handleOAuthCallback(code)`: Exchange authorization code for tokens
- `isAuthenticated()`: Check if user is authenticated
- `signOut()`: Clear tokens and sign out
- `uploadFileToDrive(filePath, fileName, onProgress)`: Upload file with progress tracking
- `getAccessToken()`: Get current access token (refresh if needed)

### IPC Handlers (`src/main/ipc/handlers.ts`)

- `google-drive-initiate-auth`: Initialize OAuth flow
- `google-drive-check-auth`: Check authentication status
- `google-drive-sign-out`: Sign out from Google Drive
- `google-drive-upload`: Upload file to Google Drive
- `google-drive-progress`: Progress updates during upload

### Renderer Store (`src/renderer/store/googleDriveStore.ts`)

- `isAuthenticated`: Boolean indicating auth status
- `isUploading`: Boolean indicating upload in progress
- `uploadProgress`: Number (0-100) indicating upload percentage
- `lastShareUrl`: String with last uploaded file's share URL
- `checkAuth()`: Check authentication status
- `signIn()`: Initiate sign-in flow
- `signOut()`: Sign out
- `uploadFile(filePath, fileName)`: Upload file to Google Drive
- `resetUploadState()`: Reset upload progress and URL

## Future Enhancements

- Multiple Google account support
- Custom folder selection
- Batch upload support
- Upload queue management
- Direct file management (delete, rename)
- Upload resume after network failure
- Thumbnail preview in Google Drive
- Share permissions selection (view/edit)

## Support

For issues or questions:
1. Check the console for error messages
2. Review the troubleshooting section
3. Check Google Cloud Console for API usage and errors
4. Verify OAuth credentials are valid

