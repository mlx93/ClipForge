# Release Instructions for SimpleCut v2.1.0

## Pre-Release Checklist

1. ✅ DMG files built successfully
2. ✅ Version bumped to 2.1.0
3. ✅ All Google Drive integration features complete
4. ✅ Documentation updated

## DMG Files Created

- `release/SimpleCut-2.1.0.dmg` (Intel Mac)
- `release/SimpleCut-2.1.0-arm64.dmg` (Apple Silicon Mac)

## Creating GitHub Release

Use GitHub CLI to create a release:

```bash
gh release create v2.1.0 \
  --title "SimpleCut v2.1.0 - Google Drive Integration" \
  --notes "## New Features
- Google Drive OAuth integration with secure authentication
- Direct video upload to Google Drive with progress tracking
- Shareable link generation for uploaded videos
- Enhanced error handling with detailed messages

## Improvements
- Video metadata extraction for Google Drive compatibility
- Browser-based OAuth flow (external browser for better security)
- Improved upload progress indicators
- Better error messages for debugging
- Enhanced DMG configuration with proper layout

## Technical Changes
- Added Google Drive API integration (googleapis)
- Secure token storage with electron.safeStorage
- Resumable file uploads for large videos
- Video metadata extraction with ffprobe

## Installation Note

If you see a 'damaged app' warning when downloading, run this command in Terminal:
\`\`\`bash
xattr -d com.apple.quarantine ~/Downloads/SimpleCut-*.dmg
\`\`\`
Then open the DMG normally." \
  release/SimpleCut-2.1.0.dmg \
  release/SimpleCut-2.1.0-arm64.dmg
```

## Handling "Damaged App" Warning

Users may see a macOS warning that the app is "damaged" when downloading the DMG. This is macOS Gatekeeper, not an actual problem. Add this to the release notes:

**If you see "SimpleCut is damaged and can't be opened":**

1. Open Terminal
2. Run: `xattr -d com.apple.quarantine ~/Downloads/SimpleCut-*.dmg`
3. Open the DMG normally

This removes the quarantine attribute that macOS adds to downloaded files from the internet.

