# Google Drive Integration Plan

**Project**: SimpleCut v2.0.0  
**Feature**: Google Drive Upload with OAuth Authentication  
**Status**: Planning Phase  
**Date**: December 19, 2024

---

## Overview

This document outlines the implementation plan for integrating Google Drive upload functionality into SimpleCut, allowing users to authenticate with Google OAuth and upload exported videos directly to their Google Drive with shareable links.

---

## Architecture Overview

### OAuth Flow

```
┌─────────────┐
│   User      │
│  (Electron) │
└──────┬──────┘
       │
       │ 1. Click "Share to Cloud" → Select Google Drive
       ▼
┌─────────────────────────────────────┐
│  Renderer Process (React UI)        │
│  - CloudExport.tsx                   │
│  - Google Drive Auth Button         │
└──────┬───────────────────────────────┘
       │
       │ 2. IPC: initiate-google-auth
       ▼
┌─────────────────────────────────────┐
│  Main Process (Node.js)              │
│  - IPC Handler                       │
│  - OAuth Flow Management             │
└──────┬───────────────────────────────┘
       │
       │ 3. Open Browser Window
       │    (electron BrowserWindow)
       ▼
┌─────────────────────────────────────┐
│  Google OAuth Consent Screen         │
│  (External Browser)                 │
└──────┬───────────────────────────────┘
       │
       │ 4. User Grants Permission
       │ 5. Redirect to callback URL
       ▼
┌─────────────────────────────────────┐
│  Local HTTP Server (Main Process)    │
│  - OAuth Callback Handler            │
│  - Receive Authorization Code        │
└──────┬───────────────────────────────┘
       │
       │ 6. Exchange Code for Tokens
       ▼
┌─────────────────────────────────────┐
│  Google OAuth API                    │
│  - Access Token                     │
│  - Refresh Token                    │
└──────┬───────────────────────────────┘
       │
       │ 7. Store Tokens Securely
       ▼
┌─────────────────────────────────────┐
│  Electron Secure Storage             │
│  - keytar (macOS Keychain)           │
│  - SafeStorage API (Electron)       │
└──────┬───────────────────────────────┘
       │
       │ 8. Upload Video File
       ▼
┌─────────────────────────────────────┐
│  Google Drive API                    │
│  - Upload File                       │
│  - Generate Shareable Link          │
└─────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: OAuth Setup & Configuration (2-3 hours)

#### 1.1 Google Cloud Console Setup
- [ ] Create Google Cloud Project
- [ ] Enable Google Drive API
- [ ] Create OAuth 2.0 Credentials
  - Application type: Desktop App
  - OAuth client ID
  - OAuth client secret
- [ ] Configure OAuth consent screen
  - Scopes: `https://www.googleapis.com/auth/drive.file`
  - Authorized redirect URIs: `http://localhost:3000/oauth/callback`

#### 1.2 Environment Configuration
- [ ] Create `.env` file structure (development)
- [ ] Store OAuth credentials securely
- [ ] Add to `.gitignore` to prevent committing secrets
- [ ] Document setup process in README

#### 1.3 Dependencies Installation
```bash
npm install googleapis
npm install @types/googleapis --save-dev
npm install keytar  # For secure token storage
npm install @types/keytar --save-dev
```

**Files to Create/Modify**:
- `src/main/googleDrive.ts` - OAuth flow and API client
- `src/shared/constants.ts` - Add Google OAuth constants
- `.env.example` - Template for OAuth credentials
- `README.md` - Google Drive setup instructions

---

### Phase 2: OAuth Authentication Flow (4-5 hours)

#### 2.1 OAuth Flow Implementation

**Main Process (`src/main/googleDrive.ts`)**:
- [ ] Implement authorization URL generation
- [ ] Create local HTTP server for callback
- [ ] Handle authorization code exchange
- [ ] Token storage and retrieval
- [ ] Token refresh mechanism

**Key Functions**:
```typescript
// OAuth flow management
export async function initiateGoogleAuth(): Promise<{ authUrl: string; codeVerifier: string }>
export async function handleOAuthCallback(code: string, codeVerifier: string): Promise<{ success: boolean; tokens?: OAuthTokens }>
export async function refreshAccessToken(refreshToken: string): Promise<string | null>
export function isAuthenticated(): boolean
export function getAccessToken(): string | null
```

#### 2.2 Browser Window Management

**Main Process**:
- [ ] Create hidden BrowserWindow for OAuth flow
- [ ] Navigate to Google OAuth URL
- [ ] Monitor URL changes for callback
- [ ] Extract authorization code from callback
- [ ] Close browser window after token exchange

**Considerations**:
- Use Electron's `BrowserWindow` with `show: false` initially
- Show window during OAuth flow for user interaction
- Handle window close events gracefully
- Clear cookies/session after completion

#### 2.3 Secure Token Storage

**Storage Options**:
1. **keytar** (Recommended for macOS)
   - Uses macOS Keychain
   - Secure credential storage
   - Native integration

2. **Electron SafeStorage** (Alternative)
   - Built into Electron
   - Uses OS credential store
   - Less external dependencies

**Implementation**:
```typescript
// Store tokens securely
async function storeTokens(tokens: OAuthTokens): Promise<void>
async function retrieveTokens(): Promise<OAuthTokens | null>
async function clearTokens(): Promise<void>
```

**Files to Create/Modify**:
- `src/main/googleDrive.ts` - Full OAuth implementation
- `src/main/oauthCallback.ts` - Callback server handler
- `src/shared/types.ts` - Add OAuth token types

---

### Phase 3: IPC Integration (1-2 hours)

#### 3.1 IPC Handlers

**Add to `src/main/ipc/handlers.ts`**:
```typescript
// Google Drive OAuth handlers
ipcMain.handle('google-drive-initiate-auth', async () => {
  // Return authorization URL
});

ipcMain.handle('google-drive-check-auth', async () => {
  // Check if user is authenticated
});

ipcMain.handle('google-drive-sign-out', async () => {
  // Clear tokens and sign out
});

ipcMain.handle('google-drive-upload', async (_, { filePath, fileName }) => {
  // Upload file to Google Drive
});
```

#### 3.2 Preload API

**Add to `src/preload/preload.ts`**:
```typescript
googleDrive: {
  initiateAuth: () => Promise<{ success: boolean; authUrl?: string; error?: string }>,
  checkAuth: () => Promise<{ authenticated: boolean }>,
  signOut: () => Promise<{ success: boolean }>,
  uploadFile: (filePath: string, fileName: string) => Promise<{ success: boolean; fileId?: string; shareUrl?: string; error?: string }>,
  onAuthStateChange: (callback: (authenticated: boolean) => void) => void,
}
```

#### 3.3 Type Definitions

**Update `src/renderer/global.d.ts`**:
```typescript
googleDrive: {
  initiateAuth: () => Promise<{ success: boolean; authUrl?: string; error?: string }>;
  checkAuth: () => Promise<{ authenticated: boolean }>;
  signOut: () => Promise<{ success: boolean }>;
  uploadFile: (filePath: string, fileName: string) => Promise<{ success: boolean; fileId?: string; shareUrl?: string; error?: string }>;
  onAuthStateChange: (callback: (authenticated: boolean) => void) => void;
}
```

**Files to Modify**:
- `src/main/ipc/handlers.ts` - Add Google Drive handlers
- `src/preload/preload.ts` - Expose Google Drive API
- `src/renderer/global.d.ts` - Add type definitions

---

### Phase 4: Google Drive API Integration (3-4 hours)

#### 4.1 File Upload Implementation

**Main Process (`src/main/googleDrive.ts`)**:
- [ ] Implement resumable upload for large files
- [ ] Handle upload progress tracking
- [ ] Error handling and retry logic
- [ ] File metadata (title, description)

**Key Functions**:
```typescript
async function uploadFileToDrive(
  filePath: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<{ fileId: string; shareUrl: string }>
```

**Upload Strategy**:
1. **Small files (< 5MB)**: Simple upload
2. **Large files (> 5MB)**: Resumable upload
   - Initiate resumable session
   - Upload in chunks
   - Track progress
   - Handle resume on failure

#### 4.2 Shareable Link Generation

**Main Process**:
- [ ] Create file with viewer permissions
- [ ] Generate shareable link
- [ ] Return link to renderer

**Implementation**:
```typescript
async function createShareableLink(fileId: string): Promise<string>
```

**Permissions**:
- Default: `anyoneWithLink` can view
- Future: Allow user to choose permissions (view/edit)

#### 4.3 Progress Tracking

**IPC Progress Updates**:
- Send progress updates to renderer during upload
- Update CloudExport component progress bar
- Handle cancellation

**Files to Create/Modify**:
- `src/main/googleDrive.ts` - Complete upload implementation
- `src/main/ipc/handlers.ts` - Add progress event sending

---

### Phase 5: UI Integration (2-3 hours)

#### 5.1 CloudExport Component Updates

**Modify `src/renderer/components/CloudExport.tsx`**:

- [ ] Add Google Drive authentication button
- [ ] Show authentication status
- [ ] Replace mock upload with real API call
- [ ] Display real upload progress
- [ ] Show real shareable link after upload
- [ ] Add error handling UI

**UI Flow**:
1. User selects Google Drive platform
2. If not authenticated: Show "Sign in with Google" button
3. OAuth flow in browser window
4. After authentication: Show upload button
5. Upload progress indicator
6. Display shareable link on completion

#### 5.2 Authentication State Management

**Create `src/renderer/store/googleDriveStore.ts`**:
```typescript
interface GoogleDriveStore {
  isAuthenticated: boolean;
  isUploading: boolean;
  uploadProgress: number;
  lastShareUrl: string | null;
  
  checkAuth: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  uploadFile: (filePath: string, fileName: string) => Promise<void>;
}
```

**Files to Create/Modify**:
- `src/renderer/components/CloudExport.tsx` - Full UI integration
- `src/renderer/store/googleDriveStore.ts` - New store for state management

---

### Phase 6: Error Handling & Edge Cases (2 hours)

#### 6.1 Error Scenarios

- [ ] Network failures during upload
- [ ] Token expiration during upload
- [ ] User cancels OAuth flow
- [ ] Browser window closed prematurely
- [ ] Invalid file paths
- [ ] Insufficient Google Drive quota
- [ ] API rate limiting

#### 6.2 User Feedback

- [ ] Clear error messages
- [ ] Retry mechanisms
- [ ] Toast notifications for success/failure
- [ ] Loading states during operations

**Files to Modify**:
- `src/main/googleDrive.ts` - Comprehensive error handling
- `src/renderer/components/CloudExport.tsx` - Error UI states

---

### Phase 7: Testing & Documentation (2-3 hours)

#### 7.1 Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Tokens stored securely
- [ ] File uploads work for various sizes
- [ ] Progress tracking accurate
- [ ] Shareable links accessible
- [ ] Error handling works correctly
- [ ] Authentication persists across app restarts
- [ ] Sign out clears tokens properly

#### 7.2 Documentation

- [ ] Update README with Google Drive setup
- [ ] Add troubleshooting section
- [ ] Document OAuth flow
- [ ] API usage examples
- [ ] Security considerations

**Files to Create/Modify**:
- `README.md` - Google Drive setup instructions
- `docs/GOOGLE_DRIVE_SETUP.md` - Detailed setup guide

---

## Technical Details

### OAuth Scopes Required

```typescript
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file' // Upload and manage files
];
```

**Scope Explanation**:
- `drive.file`: Allows app to create, read, update, and delete files created by the app
- More restrictive than full Drive access
- Better security practices

### Token Storage Structure

```typescript
interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  expiry_date: number; // Timestamp when token expires
}
```

### Google Drive API Endpoints

1. **Authorization**: `https://accounts.google.com/o/oauth2/v2/auth`
2. **Token Exchange**: `https://oauth2.googleapis.com/token`
3. **File Upload**: `https://www.googleapis.com/upload/drive/v3/files`
4. **Permissions**: `https://www.googleapis.com/drive/v3/files/{fileId}/permissions`

### File Upload Flow

```
1. POST /upload/drive/v3/files?uploadType=resumable
   → Returns resumable session URI

2. PUT {resumableSessionURI}
   Content-Length: fileSize
   Content-Range: bytes 0-{chunkSize-1}/{fileSize}
   → Upload file chunks

3. GET {resumableSessionURI}
   → Check upload status

4. POST /drive/v3/files/{fileId}/permissions
   → Make file shareable

5. GET /drive/v3/files/{fileId}?fields=webViewLink
   → Get shareable link
```

---

## Security Considerations

### 1. OAuth Credentials Protection
- ✅ Never commit credentials to git
- ✅ Use environment variables for development
- ✅ Use secure storage for production (keytar)
- ✅ Rotate credentials if compromised

### 2. Token Security
- ✅ Store tokens securely (Keychain/SafeStorage)
- ✅ Encrypt tokens at rest
- ✅ Refresh tokens before expiration
- ✅ Clear tokens on sign out

### 3. Upload Security
- ✅ Verify file paths before upload
- ✅ Validate file sizes
- ✅ Handle network errors gracefully
- ✅ Don't expose tokens in logs

### 4. User Privacy
- ✅ Request minimal required scopes
- ✅ Clear tokens on app uninstall
- ✅ Allow users to revoke access
- ✅ Provide clear privacy policy

---

## Dependencies

### Required Packages

```json
{
  "googleapis": "^128.0.0",
  "keytar": "^7.9.0",
  "@types/googleapis": "^40.0.0",
  "@types/keytar": "^5.0.0"
}
```

### Optional Packages

```json
{
  "dotenv": "^16.3.1" // For environment variable management
}
```

---

## Estimated Timeline

| Phase | Hours | Complexity |
|-------|-------|------------|
| Phase 1: OAuth Setup | 2-3 | Low |
| Phase 2: OAuth Flow | 4-5 | High |
| Phase 3: IPC Integration | 1-2 | Medium |
| Phase 4: Drive API | 3-4 | High |
| Phase 5: UI Integration | 2-3 | Medium |
| Phase 6: Error Handling | 2 | Medium |
| Phase 7: Testing | 2-3 | Low |
| **Total** | **16-22 hours** | |

---

## Future Enhancements

### Phase 2 Features (Post-MVP)
- [ ] Multiple Google account support
- [ ] Custom folder selection
- [ ] Upload to existing folders
- [ ] Share permissions selection (view/edit)
- [ ] Upload progress pause/resume
- [ ] File metadata editing (title, description)
- [ ] Batch upload support
- [ ] Direct link to file in Google Drive

### Phase 3 Features (Advanced)
- [ ] Upload to Google Drive after export (automatic)
- [ ] Google Drive project backup
- [ ] Sync project files to Drive
- [ ] Collaborative editing (future)

---

## Success Criteria

✅ User can authenticate with Google OAuth  
✅ Access tokens stored securely  
✅ Video files upload successfully to Google Drive  
✅ Shareable links generated and displayed  
✅ Upload progress tracked accurately  
✅ Error handling works correctly  
✅ User can sign out and clear tokens  
✅ Authentication persists across app restarts  

---

## Implementation Order

1. **Start with Phase 1-2**: Get OAuth working end-to-end
2. **Then Phase 3**: Wire up IPC communication
3. **Then Phase 4**: Implement actual file uploads
4. **Then Phase 5**: Integrate with UI
5. **Finally Phase 6-7**: Polish and test

---

## Notes

- Google OAuth requires a verified OAuth consent screen for production
- Desktop apps use redirect URIs with `localhost` or custom protocols
- Token refresh is critical for long-running sessions
- Resumable uploads are essential for large video files
- Consider implementing upload queue for multiple files

---

## References

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [Google OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [keytar Documentation](https://www.npmjs.com/package/keytar)

