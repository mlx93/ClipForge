# Google Drive OAuth Troubleshooting

## Error 403: access_denied

You're getting this error because the OAuth consent screen is in "Testing" mode.

### Solution 1: Add Test User (Quick Fix)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Scroll to **"Test users"** section
4. Click **"+ ADD USERS"**
5. Enter your email: `mylesethan93@gmail.com`
6. Click **"ADD"** and **"SAVE"**
7. Try the OAuth flow again

### Solution 2: Add Authorized Redirect URI

If the test user approach doesn't work, you may need to add the redirect URI:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. Click the **edit** (pencil) icon
5. Under **"Authorized redirect URIs"**, click **"ADD URI"**
6. Add: `http://localhost:3000/oauth/callback`
7. Click **"SAVE"**
8. Try the OAuth flow again

### Solution 3: Publish the App (For Production)

If you want to make the app public (skip testing mode):

1. Go to **OAuth consent screen**
2. Complete all required fields (app name, logo, etc.)
3. Submit for verification
4. Wait for Google's approval (can take several days)

**Note**: Publishing requires verification for sensitive scopes like Google Drive.

## Current Issue

Your OAuth app is set to:
- **Publishing status**: Testing
- **User type**: External
- **Scopes**: `https://www.googleapis.com/auth/drive.file`

This means only test users you explicitly add can access it.

## Quick Workaround

For development purposes, you can:
1. Add your email to test users (Solution 1)
2. Wait a few minutes for changes to propagate
3. Try the OAuth flow again

## Console Logs to Check

When you click "Sign in with Google Drive", check the console for:
- `[Google Drive] Loading OAuth config:` - Should show your client ID
- `[Google Drive] Loading OAuth URL:` - The OAuth URL
- Any error messages about authentication

## Next Steps

After fixing the test user/redirect URI issue, the OAuth flow should work:
1. Click "Sign in with Google Drive" in SimpleCut
2. Browser opens with Google OAuth
3. Sign in with your Google account
4. Grant permissions
5. Get redirected back to SimpleCut
6. Success!

