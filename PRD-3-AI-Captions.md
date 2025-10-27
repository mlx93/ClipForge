# ClipForge - Product Requirements Document
## Part 3: AI Closed Captions (Audio-to-Text)

**Version:** 1.0  
**Last Updated:** October 27, 2025  
**Prerequisites:** PRD Part 1 (MVP) MUST be completed. PRD Part 2 optional but recommended.  
**Target Platform:** macOS (primary), Windows (supported)

---

## 1. Feature Overview

### 1.1 Purpose
AI Closed Captions automatically transcribe spoken audio from video clips into text subtitles, making content more accessible and discoverable. Users can generate, preview, and export captions with a single click.

**Use Cases:**
- Educational videos requiring transcripts
- Social media content for accessibility compliance
- Tutorials and demonstrations needing subtitles
- Multi-language audiences (English transcription for now)

### 1.2 Value Proposition
- **One-click transcription:** No manual typing required
- **Industry-leading accuracy:** OpenAI Whisper API (95%+ accuracy)
- **Time-stamped captions:** Automatically synced with video timing
- **Flexible export:** Burn captions into video OR export separate SRT file

### 1.3 Scope
**In Scope:**
- Generate captions from video audio using OpenAI Whisper
- Display captions as overlay in preview window
- Toggle captions on/off
- Basic caption editing (text only, not timing)
- Export with burned-in captions OR separate SRT file

**Out of Scope (Future Enhancement):**
- Speaker identification (who's talking)
- Caption styling (font, color, position)
- Multiple language support (only video's spoken language)
- Real-time captioning during recording
- Auto-translation to other languages

---

## 2. Prerequisites

### 2.1 Required from PRD1
**MUST be implemented before starting PRD3:**
- ✅ Media Library with imported video clips
- ✅ Video Preview with HTML5 player
- ✅ Timeline Store (Zustand state management)
- ✅ FFmpeg integration in main process
- ✅ Export pipeline to MP4

**Why:** Captions feature extends these existing components rather than building new infrastructure.

### 2.2 Optional from PRD2
**Helpful but not required:**
- Text overlay system (similar UI patterns)
- Multi-track timeline (captions could be separate track)
- Keyboard shortcuts (add shortcut for caption toggle)

---

## 3. Technical Stack

### 3.1 New Dependencies
```json
{
  "openai": "^4.20.0",      // OpenAI API client for Whisper
  "subtitle": "^4.2.1"       // Parse and manipulate SRT files
}
```

### 3.2 Existing Dependencies (From PRD1)
- `fluent-ffmpeg`: Audio extraction, caption burning
- `zustand`: State management for captions
- `electron`: IPC for API calls from main process

### 3.3 OpenAI Whisper API
**Endpoint:** `https://api.openai.com/v1/audio/transcriptions`  
**Model:** `whisper-1`  
**Pricing:** $0.006 per minute of audio  
**Response Formats:** JSON (with timestamps), SRT, VTT, text  
**Audio Formats Supported:** MP3, MP4, WAV, M4A, WEBM (we'll use MP3)

**API Requirements:**
- OpenAI API key (environment variable or secure storage)
- Audio file size limit: 25 MB max
- For longer videos: Split audio into chunks if needed

---

## 4. Architecture Integration

### 4.1 Component Extensions

**Existing PRD1 Components (Extended):**
```
Timeline Store (Zustand)
  └─ NEW: Add captions property to Clip interface
       { clip.captions: { srt: string, enabled: boolean } }

Media Library Panel
  └─ NEW: Add "Generate Captions" button per clip

Video Preview Component
  └─ NEW: Add CaptionOverlay component (renders subtitles)

FFmpeg Handler (Main Process)
  └─ NEW: Add audio extraction function
  └─ NEW: Add caption burning function (drawtext filter)

Export Dialog
  └─ NEW: Add checkbox "Include Captions" with options:
       - Burned into video
       - Separate SRT file
       - Both
```

### 4.2 New Components (PRD3 Only)

**Main Process:**
```
src/main/
  ├── whisper.ts           # OpenAI Whisper API client
  ├── audioExtractor.ts    # FFmpeg audio extraction
  └── ipc/
      └── captionHandlers.ts  # IPC handlers for captions
```

**Renderer Process:**
```
src/renderer/
  ├── components/
  │   ├── CaptionButton.tsx     # "Generate Captions" button
  │   ├── CaptionOverlay.tsx    # Subtitle display in preview
  │   └── CaptionEditor.tsx     # Edit caption text (optional)
  ├── store/
  │   └── captionStore.ts       # Caption state per clip
  └── utils/
      └── srtParser.ts           # Parse SRT format
```

### 4.3 Data Flow

**Caption Generation Flow:**
1. User clicks "Generate Captions" on clip in Media Library
2. Renderer sends IPC to main process with clip path
3. Main process extracts audio to temp MP3 file (FFmpeg)
4. Main process sends MP3 to OpenAI Whisper API
5. Whisper returns SRT format with timestamps
6. Main process sends SRT back to renderer via IPC
7. Renderer stores SRT in Timeline Store (clip.captions)
8. Caption data persists with project

**Caption Display Flow:**
1. User plays video in preview
2. Preview component checks if clip.captions.enabled === true
3. CaptionOverlay parses SRT, finds current caption by playhead time
4. Caption text rendered as overlay on video element

**Caption Export Flow:**
1. User clicks "Export" with captions enabled
2. Export dialog shows caption options
3. If "Burned into video": FFmpeg uses drawtext filter with SRT
4. If "Separate SRT file": Save clip.captions.srt to disk alongside MP4
5. Export completes with captions included

---

## 5. Core Features

### 5.1 Generate Captions

**Requirements:**
- "Generate Captions" button appears on each clip in Media Library
- Click button → Shows loading indicator ("Transcribing...")
- Extracts audio from video clip
- Sends audio to OpenAI Whisper API
- Receives SRT file with timestamps
- Stores SRT in clip metadata
- Visual indicator: Clip shows caption icon when captions exist

**UI:**
```
Media Library Clip Card:
┌─────────────────────────────┐
│ 📹 Screen Recording.mp4     │
│ Duration: 2:34              │
│ Resolution: 1920x1080       │
│                             │
│ [🎤 Generate Captions]      │  ← New button
│                             │
│ [CC] Captions available     │  ← After generation
└─────────────────────────────┘
```

**Technical Implementation:**
- Extract audio: `ffmpeg -i video.mp4 -vn -ar 16000 -ac 1 audio.mp3`
- API call: Send audio.mp3 to Whisper with `response_format=srt`
- Store SRT: Add to Timeline Store clip object
- Clean up: Delete temp audio.mp3 file

### 5.2 Display Captions in Preview

**Requirements:**
- Captions appear as overlay at bottom of preview window
- Text appears/disappears based on video timestamp
- Default styling: White text, black background, centered
- Captions remain readable over any video content
- Toggle button to show/hide captions

**UI:**
```
Preview Window:
┌─────────────────────────────────────┐
│                                     │
│        [Video Content]              │
│                                     │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Hello, welcome to this video  │ │  ← Caption overlay
│  └───────────────────────────────┘ │
│                                     │
│  ▶️ Play  [CC]  0:15 / 2:34        │  ← Toggle button
└─────────────────────────────────────┘
```

**Caption Rendering Logic:**
- Parse SRT file into array of caption objects: `{ start, end, text }`
- On video playback, check current time against caption ranges
- Display caption.text if `currentTime >= start && currentTime <= end`
- Update caption every 100ms (smooth transitions)

### 5.3 Toggle Captions On/Off

**Requirements:**
- [CC] button in preview controls
- Click to toggle captions.enabled (true/false)
- Button state: Active (on) vs Inactive (off) styling
- Preference persists per clip in Timeline Store
- Keyboard shortcut: Cmd+Shift+C (if PRD2 shortcuts implemented)

**State Management:**
- Store toggle state in Timeline Store: `clip.captions.enabled`
- CaptionOverlay component reads this flag
- Button updates state via Zustand action

### 5.4 Basic Caption Editing

**Requirements (Optional - Low Priority):**
- Click on caption in preview → Opens caption editor
- Edit caption text only (not timing)
- Save changes back to SRT
- Preview updates with edited text

**UI (If Implemented):**
```
Caption Editor Modal:
┌─────────────────────────────────────┐
│  Edit Caption                       │
├─────────────────────────────────────┤
│  Time: 0:15 - 0:18                  │
│                                     │
│  Text:                              │
│  ┌───────────────────────────────┐ │
│  │ Hello, welcome to this video  │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Cancel]  [Save]                   │
└─────────────────────────────────────┘
```

**Note:** Timing editing is out of scope. Users can manually edit SRT files externally if needed.

### 5.5 Export with Captions

**Requirements:**
- Export dialog shows "Captions" section (if clip has captions)
- Three options:
  1. **Burned into video** - Captions permanently embedded
  2. **Separate SRT file** - video.mp4 + video.srt
  3. **Both** - Burned-in + separate file
- If "Separate SRT file": Save SRT to same directory as exported video
- If "Burned into video": Use FFmpeg drawtext filter with SRT

**Export Dialog (Extended):**
```
Export Settings:
┌─────────────────────────────────────┐
│  Resolution: [1080p ▼]              │
│  Output: /Users/me/Videos/clip.mp4  │
│                                     │
│  ☑️ Include Captions:               │
│    ⚪ Burned into video             │
│    🔘 Separate SRT file             │
│    ⚪ Both                           │
│                                     │
│  [Cancel]  [Export]                 │
└─────────────────────────────────────┘
```

**FFmpeg Caption Burning:**
- Use subtitles filter: `ffmpeg -i video.mp4 -vf subtitles=captions.srt output.mp4`
- Alternative drawtext (if more control needed): Parse SRT, apply drawtext per caption with enable time ranges

---

## 6. Implementation Guidelines

### 6.1 Audio Extraction (FFmpeg)

**Purpose:** Extract audio track from video for Whisper API

**Implementation Logic:**
- Input: Video file path
- Output: Temp MP3 file (16kHz, mono for optimal Whisper performance)
- FFmpeg command: `-i input.mp4 -vn -ar 16000 -ac 1 -b:a 128k output.mp3`
- Delete temp file after API call completes

### 6.2 OpenAI Whisper API Call

**Purpose:** Send audio to Whisper, receive SRT transcription

**Implementation Logic:**
- Read MP3 file as buffer
- Create FormData with file and parameters
- POST to `https://api.openai.com/v1/audio/transcriptions`
- Headers: `Authorization: Bearer YOUR_API_KEY`
- Body parameters:
  - file: audio buffer
  - model: "whisper-1"
  - response_format: "srt"
  - language: "en" (optional, auto-detect if omitted)
- Response: SRT format string
- Error handling: Network failures, API rate limits, invalid audio

**API Response Example (SRT):**
```
1
00:00:00,000 --> 00:00:03,000
Hello, welcome to this video tutorial.

2
00:00:03,500 --> 00:00:07,000
Today we're going to learn about video editing.
```

### 6.3 SRT Parsing

**Purpose:** Convert SRT string to usable caption objects

**Implementation Logic:**
- Use `subtitle` npm package to parse SRT
- Convert to array: `[{ start: 0, end: 3000, text: "Hello..." }, ...]`
- Times in milliseconds for easy comparison with video currentTime
- Store both original SRT string and parsed array in state

### 6.4 Caption Overlay Rendering

**Purpose:** Display caption text at correct time during playback

**Implementation Logic:**
- Component receives: current playhead time (ms), parsed captions array
- Find active caption: `captions.find(c => time >= c.start && time <= c.end)`
- Render text in absolutely positioned div over video element
- Styling: White text, black semi-transparent background, centered, bottom padding
- Update on playhead change (subscribe to Timeline Store playhead)

### 6.5 Caption Burning (Export)

**Purpose:** Permanently embed captions into exported video

**Implementation Logic:**
- Save SRT to temp file
- FFmpeg command: `-i input.mp4 -vf subtitles=temp.srt output.mp4`
- Alternative (more control): Use drawtext filter with enable expressions per caption
- Delete temp SRT after export completes

---

## 7. State Management

### 7.1 Timeline Store Extension

**Add to existing Clip interface:**
```
interface Clip {
  id: string;
  path: string;
  duration: number;
  // ... existing properties
  
  // NEW for PRD3:
  captions?: {
    srt: string;              // Original SRT format
    parsed: Caption[];        // Parsed for rendering
    enabled: boolean;         // Show/hide toggle
    generatedAt: string;      // Timestamp
  };
}

interface Caption {
  start: number;    // ms
  end: number;      // ms
  text: string;
}
```

### 7.2 Caption Store (Optional)

If captions need separate state (e.g., global caption settings), create dedicated store:

**State:** Global caption preferences (font size, position)  
**Actions:** updateCaptionStyle(), toggleAllCaptions()  
**Note:** Likely unnecessary for MVP, just extend Timeline Store

---

## 8. UI Components

### 8.1 CaptionButton Component
- **Location:** Media Library clip card
- **Appearance:** Button with microphone icon "🎤 Generate Captions"
- **States:** Default, Loading ("Transcribing..."), Success (shows CC icon)
- **Action:** onClick → Calls IPC to generate captions
- **Props:** clipId, hasExistingCaptions

### 8.2 CaptionOverlay Component
- **Location:** Layered over Video Preview element
- **Appearance:** Centered text at bottom, white on semi-transparent black
- **Behavior:** Shows/hides based on currentTime and caption ranges
- **Props:** captions (array), currentTime (ms), enabled (bool)
- **Styling:** 
  - Font: Sans-serif, 18px
  - Background: rgba(0,0,0,0.8), padding 10px
  - Position: Bottom 20px from edge

### 8.3 Caption Toggle Button
- **Location:** Preview controls bar (next to play/pause)
- **Appearance:** [CC] text button
- **States:** Active (captions on), Inactive (captions off)
- **Action:** onClick → Toggles clip.captions.enabled

### 8.4 Export Captions Section
- **Location:** Export dialog (below resolution selector)
- **Appearance:** Checkbox "Include Captions" with radio options
- **Behavior:** Only shows if current clip has captions
- **Options:** Radio group (Burned / Separate / Both)

---

## 9. Error Handling

### 9.1 API Errors
**Scenarios:**
- OpenAI API key missing or invalid
- Network connection failure
- API rate limit exceeded
- Audio file too large (>25 MB)

**Handling:**
- Display error message to user: "Caption generation failed: [reason]"
- Offer retry button
- Log error details for debugging
- Don't crash app or block other features

### 9.2 Audio Extraction Errors
**Scenarios:**
- Video has no audio track
- FFmpeg fails to extract audio
- Corrupted video file

**Handling:**
- Check video has audio stream before attempting extraction
- Show error: "This video has no audio track to transcribe"
- Log FFmpeg error output

### 9.3 SRT Parsing Errors
**Scenarios:**
- Malformed SRT from API
- Unexpected timestamp format

**Handling:**
- Validate SRT structure before parsing
- Fallback to plain text display if parsing fails
- Log parsing error

---

## 10. Performance Considerations

### 10.1 API Response Time
- Whisper API typically takes 10-30 seconds for 5-minute video
- Show progress indicator during transcription
- Don't block UI while waiting for API response
- Consider timeout after 2 minutes (fail gracefully)

### 10.2 Memory Usage
- Temp audio files: ~1-2 MB per minute of video
- Clean up temp files immediately after API call
- SRT text files are small (<100 KB for typical video)
- Parsed caption arrays: minimal memory impact

### 10.3 Render Performance
- Caption overlay updates every 100ms (10 fps, acceptable)
- Only render when video is playing (not when paused)
- Use CSS transforms for smooth positioning (GPU accelerated)

---

## 11. Testing & Validation

### 11.1 Caption Generation Tests
1. **Short video (30 seconds):** Generate captions → Verify SRT received and stored
2. **Long video (10 minutes):** Generate captions → Check audio extraction, API success
3. **No audio video:** Attempt generation → Verify graceful error message
4. **Multiple clips:** Generate captions for 3 clips → Verify each stores independently

### 11.2 Display Tests
1. **Play video with captions:** Verify text appears at correct times
2. **Toggle captions off:** Verify overlay disappears
3. **Toggle captions on:** Verify overlay reappears
4. **Scrub timeline:** Verify captions update immediately to correct text

### 11.3 Export Tests
1. **Export with burned captions:** Verify captions visible in output video
2. **Export with separate SRT:** Verify .srt file created alongside .mp4
3. **Export both:** Verify both burned-in and separate file exist
4. **Export without captions:** Verify no caption-related processing occurs

### 11.4 Edge Cases
- Empty audio (silence): Whisper may return empty SRT → Handle gracefully
- Very long caption text: Ensure text wraps or truncates in overlay
- Special characters in caption text: Verify proper encoding (UTF-8)
- API key expired: Show clear error message with instructions

---

## 12. Cost Estimation

### 12.1 OpenAI Whisper Pricing
- $0.006 per minute of audio
- Example costs:
  - 5-minute video: $0.03
  - 30-minute video: $0.18
  - 100 videos × 5 min: $3.00

**Optimization:**
- Cache captions (don't regenerate for same clip)
- Consider offering "caption credits" or usage limits
- For free tier: Limit to 30 minutes of transcription per month

### 12.2 User Communication
- Show estimated cost before generation (optional)
- Display total caption minutes used in settings
- Warn if approaching API limits

---

## 13. Success Criteria

**PRD3 Feature Complete When:**
✅ User can click "Generate Captions" on any video clip  
✅ Captions generate successfully using OpenAI Whisper API  
✅ Captions display correctly in preview window synced with video  
✅ User can toggle captions on/off  
✅ Captions export as burned-in video OR separate SRT file  
✅ All PRD1 and PRD2 features remain functional (no regressions)  

**Acceptance Test:**
1. Import 2-minute video with speech → Generate captions → Captions appear
2. Play video → Captions display in sync with audio
3. Toggle CC off → Captions disappear
4. Export with burned captions → Open exported video → Captions visible
5. Export with separate SRT → Open .srt file → Verify timestamps and text

---

## 14. Integration with PRD1 & PRD2

### 14.1 Dependencies on PRD1
**Required (Must exist before PRD3):**
- Media Library (clips imported and displayed)
- Video Preview (playback controls, HTML5 video element)
- Timeline Store (clip state management)
- FFmpeg integration (audio extraction, caption burning)
- Export pipeline (extend with caption options)

**Integration Points:**
- Caption button added to existing Media Library UI
- Caption overlay added to existing Preview component
- Caption data stored in existing Timeline Store (extend Clip interface)
- Caption export extends existing FFmpeg export flow

### 14.2 Compatibility with PRD2
**If PRD2 is implemented:**
- Captions work with multi-track timeline (captions tied to individual clips)
- Keyboard shortcut for caption toggle (Cmd+Shift+C)
- Undo/redo support for caption generation (optional)
- Text overlay system provides UI patterns (similar styling)

**If PRD2 is NOT implemented:**
- All PRD3 features still work independently
- Just won't have keyboard shortcuts or undo/redo for captions

### 14.3 Build Order
**Recommended sequence:**
1. PRD1 (MVP) → Complete and tested
2. PRD2 (Advanced features) → Complete and tested
3. **PRD3 (AI Captions)** → Build on stable foundation

**Why this order matters:**
- Captions depend on PRD1 core infrastructure (media library, preview, export)
- Captions enhance PRD2 features if present (shortcuts, multi-track)
- Building captions first would require reimplementing foundation features

---

## 15. Future Enhancements (Out of Scope)

**Post-MVP Improvements:**
- Multi-language support (transcribe in Spanish, French, etc.)
- Speaker identification ("Speaker 1:", "Speaker 2:")
- Caption styling editor (font, color, size, position)
- Real-time captioning during recording
- Auto-translation (English → Spanish, etc.)
- Caption search (find clips by spoken words)
- Caption export to other formats (WebVTT, TTML)

**Note:** These are intentionally excluded from PRD3 to maintain focus on core audio-to-text functionality.

---

## 16. Security & Privacy

### 16.1 API Key Storage
- Store OpenAI API key securely (not in code)
- Use environment variables or electron-store with encryption
- Never commit API keys to version control
- Prompt user to enter API key on first use

### 16.2 Audio Data Handling
- Audio sent to OpenAI servers for processing (cloud-based)
- Inform user that audio is processed by third party
- Temp audio files deleted immediately after API call
- No audio stored long-term by our app

### 16.3 User Consent
- Display one-time notice: "Captions powered by OpenAI. Audio will be processed by OpenAI servers."
- Link to OpenAI privacy policy
- User accepts before first caption generation

---

**End of PRD Part 3**

---

## Summary

**PRD3 delivers AI captions in ~250-300 lines:**
- ✅ Extends PRD1 components (Media Library, Preview, Export)
- ✅ Minimal new infrastructure (Whisper API client, caption overlay)
- ✅ Clear integration points with existing system
- ✅ Focused scope (audio → text → display → export)
- ✅ OpenAI Whisper for industry-leading accuracy
- ✅ Flexible export options (burned-in or separate SRT)

**Next Steps:**
1. Implement PRD1 completely
2. Implement PRD2 (optional but recommended)
3. Add OpenAI API key configuration
4. Build PRD3 caption features on stable foundation