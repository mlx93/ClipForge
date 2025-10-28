graph TB
    %% User Interactions
    USER["👤 User"]
    
    %% ===== ELECTRON MAIN PROCESS =====
    subgraph Main_Process["🖥️ Electron Main Process (Node.js)"]
        direction TB
        
        MAIN_ENTRY["index.ts<br/>(Entry Point)"]
        
        subgraph File_Operations["📁 File System Layer"]
            FILE_HANDLER["fileSystem.ts<br/>- Import validation<br/>- File path handling<br/>- Metadata extraction"]
            FILE_PICKER["dialog.showOpenDialog()<br/>(Native File Picker)"]
        end
        
        subgraph FFmpeg_Layer["🎬 FFmpeg Processing"]
            FFMPEG_HANDLER["ffmpeg.ts<br/>- Video encoding<br/>- Clip concatenation<br/>- Trim operations"]
            FFPROBE["ffmpeg.ffprobe()<br/>(Metadata Extraction)"]
            EXPORT_PIPELINE["Export Pipeline<br/>- Stream processing<br/>- Progress tracking<br/>- Multi-clip stitching"]
        end
        
        subgraph IPC_Layer["🔌 IPC Handlers"]
            IPC_IMPORT["handle('import-videos')"]
            IPC_EXPORT["handle('export-timeline')"]
            IPC_PROGRESS["send('export-progress')"]
            IPC_COMPLETE["send('export-complete')"]
        end
        
        LIFECYCLE["App Lifecycle<br/>- Window management<br/>- Menu bar setup"]
    end
    
    %% ===== RENDERER PROCESS =====
    subgraph Renderer_Process["🌐 Renderer Process (React + TypeScript)"]
        direction TB
        
        APP_ROOT["App.tsx<br/>(Root Component)"]
        
        subgraph UI_Components["🎨 UI Components"]
            direction LR
            
            subgraph Timeline_Module["Timeline Editor"]
                TIMELINE_CANVAS["TimelineCanvas.tsx<br/>(Fabric.js)"]
                TIMELINE_CLIP["Clip Rendering<br/>- Visual blocks<br/>- Trim handles<br/>- Playhead indicator"]
                TIMELINE_CONTROLS["Timeline Controls<br/>- Zoom in/out<br/>- Snap-to-grid"]
            end
            
            subgraph Preview_Module["Video Preview"]
                VIDEO_PLAYER["VideoPlayer.tsx<br/>(HTML5 &lt;video&gt;)"]
                PLAYBACK_CTRL["Playback Controls<br/>- Play/Pause<br/>- Scrubber bar<br/>- Time display"]
            end
            
            subgraph Media_Module["Media Library"]
                MEDIA_PANEL["MediaLibrary.tsx<br/>- Clip thumbnails<br/>- Metadata display<br/>- Drag source"]
                IMPORT_ZONE["ImportZone.tsx<br/>- Drag & drop target<br/>- File validation"]
            end
            
            subgraph Export_Module["Export Interface"]
                EXPORT_DIALOG["ExportDialog.tsx<br/>- Resolution selector<br/>- Output path<br/>- Progress modal"]
            end
        end
        
        subgraph State_Layer["📦 State Management (Zustand)"]
            TIMELINE_STORE["Timeline Store<br/>- clips: Clip[]<br/>- playhead: number<br/>- selectedClip: string"]
            PROJECT_STORE["Project Store<br/>- projectPath: string<br/>- isDirty: boolean<br/>- save/load methods"]
            EXPORT_STORE["Export Store<br/>- isExporting: boolean<br/>- progress: number<br/>- error handling"]
        end
        
        UTILS["Utils & Helpers<br/>- IPC wrappers<br/>- Time formatting<br/>- ID generation"]
    end
    
    %% ===== SHARED LAYER =====
    subgraph Shared_Layer["📚 Shared Modules"]
        TYPES["types.ts<br/>- Clip interface<br/>- ExportSettings<br/>- ProjectState"]
        CONSTANTS["constants.ts<br/>- Supported formats<br/>- Resolution presets<br/>- Timeline config"]
    end
    
    %% ===== EXTERNAL DEPENDENCIES =====
    subgraph External_Systems["🔧 External Dependencies"]
        FFMPEG_BIN["@ffmpeg-installer/ffmpeg<br/>(Bundled FFmpeg Binary)"]
        OS_FS["Operating System<br/>- File System (macOS/Windows)<br/>- Native Dialogs"]
        FABRIC["Fabric.js Library<br/>(Canvas Manipulation)"]
    end
    
    %% ===== USER INTERACTION FLOWS =====
    
    %% Import Flow
    USER -->|"1️⃣ Drag & Drop MP4/MOV"| IMPORT_ZONE
    USER -->|"1️⃣ Click Import Button"| FILE_PICKER
    IMPORT_ZONE -->|"Validate files"| IPC_IMPORT
    FILE_PICKER -->|"Selected paths"| IPC_IMPORT
    IPC_IMPORT -->|"Extract metadata"| FFPROBE
    FFPROBE -->|"duration, resolution, codec"| IPC_IMPORT
    IPC_IMPORT -->|"Return video data"| MEDIA_PANEL
    MEDIA_PANEL -->|"Update state"| TIMELINE_STORE
    
    %% Timeline Interaction Flow
    USER -->|"2️⃣ Drag clip to timeline"| TIMELINE_CANVAS
    TIMELINE_CANVAS -->|"Add clip"| TIMELINE_STORE
    TIMELINE_STORE -->|"State change"| TIMELINE_CLIP
    TIMELINE_CLIP -->|"Re-render canvas"| TIMELINE_CANVAS
    
    USER -->|"2️⃣ Click timeline position"| TIMELINE_CANVAS
    TIMELINE_CANVAS -->|"Update playhead"| TIMELINE_STORE
    TIMELINE_STORE -->|"Sync playhead"| VIDEO_PLAYER
    
    %% Trim & Split Flow
    USER -->|"3️⃣ Mark In/Out points"| TIMELINE_CANVAS
    USER -->|"3️⃣ Split at playhead"| TIMELINE_CANVAS
    TIMELINE_CANVAS -->|"Update clip trim data"| TIMELINE_STORE
    TIMELINE_STORE -->|"Reflect in preview"| VIDEO_PLAYER
    
    %% Preview Flow
    USER -->|"4️⃣ Play/Pause"| PLAYBACK_CTRL
    PLAYBACK_CTRL -->|"Control video element"| VIDEO_PLAYER
    VIDEO_PLAYER -->|"Sync currentTime"| TIMELINE_STORE
    TIMELINE_STORE -->|"Update playhead position"| TIMELINE_CANVAS
    
    USER -->|"4️⃣ Scrub timeline"| PLAYBACK_CTRL
    PLAYBACK_CTRL -->|"Seek to time"| VIDEO_PLAYER
    
    %% Export Flow
    USER -->|"5️⃣ Click Export"| EXPORT_DIALOG
    EXPORT_DIALOG -->|"Get clips + settings"| TIMELINE_STORE
    EXPORT_DIALOG -->|"invoke('export-timeline')"| IPC_EXPORT
    IPC_EXPORT -->|"Process clips"| EXPORT_PIPELINE
    EXPORT_PIPELINE -->|"ffmpeg.input() for each clip"| FFMPEG_HANDLER
    FFMPEG_HANDLER -->|"complexFilter (concat)"| FFMPEG_BIN
    FFMPEG_BIN -->|"Stream encode to disk"| OS_FS
    EXPORT_PIPELINE -->|"Progress updates"| IPC_PROGRESS
    IPC_PROGRESS -->|"Update UI"| EXPORT_STORE
    EXPORT_STORE -->|"Update modal"| EXPORT_DIALOG
    EXPORT_PIPELINE -->|"Export complete"| IPC_COMPLETE
    IPC_COMPLETE -->|"Show success"| EXPORT_DIALOG
    
    %% Component Connections
    APP_ROOT --> TIMELINE_CANVAS
    APP_ROOT --> VIDEO_PLAYER
    APP_ROOT --> MEDIA_PANEL
    APP_ROOT --> EXPORT_DIALOG
    
    %% State Management Connections
    TIMELINE_STORE -.->|"Subscribe"| TIMELINE_CANVAS
    TIMELINE_STORE -.->|"Subscribe"| VIDEO_PLAYER
    TIMELINE_STORE -.->|"Subscribe"| MEDIA_PANEL
    PROJECT_STORE -.->|"Auto-save"| UTILS
    EXPORT_STORE -.->|"Subscribe"| EXPORT_DIALOG
    
    %% Shared Layer Connections
    Shared_Layer -.->|"Import types"| Renderer_Process
    Shared_Layer -.->|"Import types"| Main_Process
    
    %% External Dependencies
    FABRIC -.->|"Canvas API"| TIMELINE_CANVAS
    FFMPEG_BIN -.->|"Binary path"| FFMPEG_HANDLER
    OS_FS -.->|"Read video files"| FILE_HANDLER
    OS_FS -.->|"Write export output"| FFMPEG_HANDLER
    
    %% Lifecycle
    MAIN_ENTRY -->|"Initialize"| LIFECYCLE
    LIFECYCLE -->|"Create window"| APP_ROOT
    
    %% Memory Management (Implicit)
    VIDEO_PLAYER -.->|"preload='metadata'<br/>(Memory efficient)"| OS_FS
    TIMELINE_STORE -.->|"Store file paths<br/>not video data"| FILE_HANDLER
    EXPORT_PIPELINE -.->|"Stream processing<br/>chunk-based"| FFMPEG_BIN
    
    %% Styling
    classDef userClass fill:#4CAF50,stroke:#2E7D32,stroke-width:3px,color:#fff
    classDef mainClass fill:#2196F3,stroke:#1565C0,stroke-width:2px,color:#fff
    classDef rendererClass fill:#FF9800,stroke:#E65100,stroke-width:2px,color:#fff
    classDef stateClass fill:#9C27B0,stroke:#6A1B9A,stroke-width:2px,color:#fff
    classDef externalClass fill:#607D8B,stroke:#37474F,stroke-width:2px,color:#fff
    classDef sharedClass fill:#00BCD4,stroke:#006064,stroke-width:2px,color:#fff
    
    class USER userClass
    class MAIN_ENTRY,FILE_HANDLER,FILE_PICKER,FFMPEG_HANDLER,FFPROBE,EXPORT_PIPELINE,IPC_IMPORT,IPC_EXPORT,IPC_PROGRESS,IPC_COMPLETE,LIFECYCLE mainClass
    class APP_ROOT,TIMELINE_CANVAS,TIMELINE_CLIP,TIMELINE_CONTROLS,VIDEO_PLAYER,PLAYBACK_CTRL,MEDIA_PANEL,IMPORT_ZONE,EXPORT_DIALOG,UTILS rendererClass
    class TIMELINE_STORE,PROJECT_STORE,EXPORT_STORE stateClass
    class FFMPEG_BIN,OS_FS,FABRIC externalClass
    class TYPES,CONSTANTS sharedClass
