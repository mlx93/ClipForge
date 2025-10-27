graph TB
    %% Legend
    subgraph Legend["📌 Legend"]
        EXISTING["Existing Component<br/>(From PRD1)"]
        NEW["New Component<br/>(PRD2 Addition)"]
        ENHANCED["Enhanced Component<br/>(PRD2 Extension)"]
    end
    
    %% User
    USER["👤 User"]
    
    %% ===== PRD1 FOUNDATION (EXISTING - DASHED) =====
    subgraph PRD1_Foundation["🏗️ PRD1 Foundation (Already Built)"]
        style PRD1_Foundation fill:#f0f0f0,stroke:#999,stroke-width:2px,stroke-dasharray: 5 5
        
        EXISTING_MAIN["Main Process<br/>- File System<br/>- FFmpeg<br/>- IPC"]
        EXISTING_TIMELINE["Timeline Canvas<br/>(Fabric.js)<br/>Track 1"]
        EXISTING_PREVIEW["Video Preview<br/>(HTML5 video)"]
        EXISTING_MEDIA["Media Library<br/>Panel"]
        EXISTING_EXPORT["Export Dialog<br/>(MP4)"]
        EXISTING_STATE["Timeline Store<br/>(Zustand)"]
    end
    
    %% ===== PRD2 RECORDING LAYER (NEW) =====
    subgraph Recording_Layer["🎬 Recording System (NEW)"]
        direction TB
        
        RECORDING_PANEL["RecordingPanel.tsx<br/>- Screen selector<br/>- Webcam selector<br/>- Audio selector<br/>- Start/Stop controls"]
        
        DESKTOP_CAPTURER["desktopCapturer API<br/>(Main Process)<br/>- List screens/windows<br/>- Return source IDs"]
        
        GET_USER_MEDIA["getUserMedia()<br/>(Renderer)<br/>- Screen capture<br/>- Webcam capture<br/>- Audio capture"]
        
        MEDIA_RECORDER["MediaRecorder API<br/>- Combine streams<br/>- Record to chunks<br/>- Save as webm/mp4"]
        
        RECORDING_STORE["Recording Store<br/>- isRecording<br/>- sources<br/>- duration"]
    end
    
    %% ===== PRD2 MULTI-TRACK EXTENSION (ENHANCED) =====
    subgraph MultiTrack_Extension["🎞️ Multi-Track Timeline (ENHANCED)"]
        direction TB
        
        TRACK_MANAGER["Track Manager<br/>- Add/remove tracks<br/>- Track 2, 3, 4+<br/>- Y-axis layering"]
        
        ENHANCED_TIMELINE["Timeline Canvas<br/>(Extended)<br/>Track 1 (base)<br/>Track 2+ (overlays)"]
        
        PIP_CONTROLS["PiP Controls<br/>- Position presets<br/>- Size scaling<br/>- Drag positioning"]
        
        OVERLAY_PREVIEW["Overlay Preview<br/>- Real-time composition<br/>- Multi-track rendering"]
        
        MULTITRACK_EXPORT["Multi-Track Export<br/>- FFmpeg overlay filter<br/>- Chain overlays<br/>- Composite tracks"]
    end
    
    %% ===== PRD2 UNDO/REDO SYSTEM (NEW) =====
    subgraph History_System["⏮️ Undo/Redo System (NEW)"]
        direction LR
        
        HISTORY_STORE["History Store<br/>- past: State[]<br/>- present: State<br/>- future: State[]"]
        
        UNDO_REDO_UI["Undo/Redo Buttons<br/>Cmd+Z / Cmd+Shift+Z"]
    end
    
    %% ===== PRD2 KEYBOARD SHORTCUTS (NEW) =====
    subgraph Shortcuts_System["⌨️ Keyboard Shortcuts (NEW)"]
        SHORTCUTS_STORE["Shortcuts Store<br/>- Map<key, handler><br/>- Register/unregister"]
        
        SHORTCUTS_HANDLER["Global Handler<br/>- hotkeys-js<br/>- 30+ shortcuts"]
    end
    
    %% ===== PRD2 AUTO-SAVE (NEW) =====
    subgraph AutoSave_System["💾 Auto-Save System (NEW)"]
        AUTOSAVE_TIMER["Auto-Save Timer<br/>- Every 2 minutes<br/>- electron-store"]
        
        SESSION_RESTORE["Session Restore<br/>- Check on launch<br/>- Prompt user"]
    end
    
    %% ===== PRD2 CLOUD EXPORT (NEW) =====
    subgraph Cloud_Export["☁️ Cloud Export (NEW)"]
        SHARE_BUTTON["Share Button<br/>- Upload video<br/>- Generate link"]
        
        FILE_HOSTING["File Hosting API<br/>- HTTP POST<br/>- Get shareable URL"]
        
        LINK_DISPLAY["Link Display Modal<br/>- Copy to clipboard<br/>- Expiry notice"]
    end
    
    %% ===== USER INTERACTION FLOWS =====
    
    %% Recording Flow (NEW)
    USER -->|"🆕 1️⃣ Start Recording"| RECORDING_PANEL
    RECORDING_PANEL -->|"Request sources"| DESKTOP_CAPTURER
    DESKTOP_CAPTURER -->|"Return source IDs"| GET_USER_MEDIA
    GET_USER_MEDIA -->|"MediaStreams"| MEDIA_RECORDER
    MEDIA_RECORDER -->|"Save recording"| EXISTING_MAIN
    EXISTING_MAIN -->|"Auto-import"| EXISTING_MEDIA
    RECORDING_PANEL <-->|"State updates"| RECORDING_STORE
    
    %% Multi-Track Flow (ENHANCED)
    USER -->|"🔄 2️⃣ Drag clip to Track 2"| TRACK_MANAGER
    TRACK_MANAGER -->|"Add to track"| ENHANCED_TIMELINE
    ENHANCED_TIMELINE -->|"Update canvas"| EXISTING_STATE
    USER -->|"🔄 Adjust PiP"| PIP_CONTROLS
    PIP_CONTROLS -->|"Position/scale"| OVERLAY_PREVIEW
    ENHANCED_TIMELINE -.->|"Extends"| EXISTING_TIMELINE
    OVERLAY_PREVIEW -.->|"Enhances"| EXISTING_PREVIEW
    
    %% Undo/Redo Flow (NEW)
    EXISTING_STATE -->|"Action occurred"| HISTORY_STORE
    HISTORY_STORE -->|"Store state snapshot"| HISTORY_STORE
    USER -->|"🆕 3️⃣ Cmd+Z"| UNDO_REDO_UI
    UNDO_REDO_UI -->|"Restore previous"| HISTORY_STORE
    HISTORY_STORE -->|"Apply to timeline"| EXISTING_STATE
    
    %% Keyboard Shortcuts Flow (NEW)
    USER -->|"🆕 4️⃣ Press shortcut"| SHORTCUTS_HANDLER
    SHORTCUTS_HANDLER -->|"Lookup action"| SHORTCUTS_STORE
    SHORTCUTS_STORE -->|"Execute handler"| EXISTING_STATE
    SHORTCUTS_STORE -.->|"Triggers"| UNDO_REDO_UI
    SHORTCUTS_STORE -.->|"Triggers"| RECORDING_PANEL
    
    %% Auto-Save Flow (NEW)
    AUTOSAVE_TIMER -->|"Every 2 min"| EXISTING_STATE
    EXISTING_STATE -->|"Serialize state"| AUTOSAVE_TIMER
    AUTOSAVE_TIMER -->|"Save to disk"| SESSION_RESTORE
    SESSION_RESTORE -->|"On app launch"| USER
    
    %% Export Flow (ENHANCED)
    USER -->|"5️⃣ Export"| EXISTING_EXPORT
    EXISTING_EXPORT -->|"Multi-track?"| MULTITRACK_EXPORT
    MULTITRACK_EXPORT -->|"FFmpeg overlay"| EXISTING_MAIN
    EXISTING_MAIN -->|"Export complete"| SHARE_BUTTON
    USER -->|"🆕 6️⃣ Share"| SHARE_BUTTON
    SHARE_BUTTON -->|"Upload video"| FILE_HOSTING
    FILE_HOSTING -->|"Return URL"| LINK_DISPLAY
    
    %% Integration Points (Dashed = connects to existing)
    RECORDING_STORE -.->|"Integrates with"| EXISTING_STATE
    ENHANCED_TIMELINE -.->|"Extends"| EXISTING_TIMELINE
    MULTITRACK_EXPORT -.->|"Enhances"| EXISTING_MAIN
    HISTORY_STORE -.->|"Wraps"| EXISTING_STATE
    
    %% Styling
    classDef existingClass fill:#e0e0e0,stroke:#666,stroke-width:2px,stroke-dasharray: 5 5,color:#333
    classDef newClass fill:#4CAF50,stroke:#2E7D32,stroke-width:2px,color:#fff
    classDef enhancedClass fill:#FF9800,stroke:#E65100,stroke-width:2px,color:#fff
    classDef userClass fill:#2196F3,stroke:#1565C0,stroke-width:3px,color:#fff
    classDef legendExisting fill:#e0e0e0,stroke:#666,stroke-width:2px,stroke-dasharray: 5 5
    classDef legendNew fill:#4CAF50,stroke:#2E7D32,stroke-width:2px
    classDef legendEnhanced fill:#FF9800,stroke:#E65100,stroke-width:2px
    
    %% Apply styles
    class USER userClass
    class EXISTING_MAIN,EXISTING_TIMELINE,EXISTING_PREVIEW,EXISTING_MEDIA,EXISTING_EXPORT,EXISTING_STATE existingClass
    class RECORDING_PANEL,DESKTOP_CAPTURER,GET_USER_MEDIA,MEDIA_RECORDER,RECORDING_STORE,HISTORY_STORE,UNDO_REDO_UI,SHORTCUTS_STORE,SHORTCUTS_HANDLER,AUTOSAVE_TIMER,SESSION_RESTORE,SHARE_BUTTON,FILE_HOSTING,LINK_DISPLAY newClass
    class TRACK_MANAGER,ENHANCED_TIMELINE,PIP_CONTROLS,OVERLAY_PREVIEW,MULTITRACK_EXPORT enhancedClass
    class EXISTING legendExisting
    class NEW legendNew
    class ENHANCED legendEnhanced
