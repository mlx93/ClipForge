# ClipForge - PRD-1 Polish & Project Management Implementation Plan

**Status:** In Progress (5 of 9 tasks complete)  
**Estimated Time Remaining:** 2-3 hours  
**Priority:** High - Fixes critical bugs and adds essential features

---

## ✅ **COMPLETED TASKS**

### **1. ✅ Fix Trim Handle Dragging** 🔴 CRITICAL
- **Status:** COMPLETE
- Made trim handles selectable and draggable
- Implemented `object:moving` event for real-time updates
- Constrained handle movement to clip bounds
- Added trim preview with Apply/Cancel workflow

### **2. ✅ Fix Trim Functionality** ✂️
- **Status:** COMPLETE
- Trim handles now persist during playhead movement
- Added temporary trim state for preview before applying
- Green "✓ Apply Trim" button confirms and applies
- Red "✕ Cancel" button discards preview
- Selection persists when clicking empty timeline space

### **3. ✅ Fix Clip Movement on Timeline** 🔄
- **Status:** COMPLETE
- Disabled drag-based movement to prevent overlap
- Added Move Left (←) and Move Right (→) buttons
- Keyboard shortcuts: `[` for left, `]` for right
- Clips snap instantly to new positions

### **4. ✅ Add Media Library Drag & Drop Reordering** 📋
- **Status:** COMPLETE
- Local state management for smooth reordering
- Visual feedback: opacity 50% on drag, yellow ring on hover
- Clips can be reordered by dragging above/below

### **6. ✅ Timeline Hover Feedback** ✨
- **Status:** COMPLETE
- Clips lighten on hover (#3b82f6 → #60a5fa)
- Cursor changes to 'pointer' on clips, 'ew-resize' on handles
- Visual feedback improves UX

---

## 🚧 **REMAINING TASKS**

### **5. Fix Timeline Zoom** 🔍
- **Problem:** Zoom state updates but canvas doesn't scale clips
- **Solution:** Apply zoom transformation to clip widths
- Scale clip widths based on zoom: `clipWidth = (clipDuration / totalDuration) * canvas.width * zoom`
- Already in dependency array, just needs clip width calculation fix

### **6. Project Save/Load** 💾
- Create `src/main/projectManager.ts` with save/load functions
- IPC handlers: `save-project`, `load-project`
- Save format (JSON):
  ```json
  { "name": "My Project", "clips": [...], "timeline": {...}, "version": "1.0" }
  ```
- Default path: `~/Desktop/ClipForge Projects/`
- Add to Zustand: `projectStore` with `currentProject`, `isDirty`, `saveProject()`, `loadProject()`
- File menu: "Save Project (Cmd+S)", "Open Project (Cmd+O)", "New Project (Cmd+N)"

### **7. Application Menu** 📋
- Create `src/main/menu.ts` with Electron Menu template
- Menus: File, Edit, View, Help
- File: New, Open, Save, Export, Quit
- Edit: Undo, Redo, Cut, Copy, Paste, Delete
- View: Zoom In, Zoom Out, Reset Zoom
- Wire menu items to IPC handlers or renderer actions

### **8. Export Preview Dialog Enhancement** 📹
- Modify `ExportDialog.tsx` to show preview BEFORE starting export
- Add preview section: Settings summary + first frame thumbnail
- Generate thumbnail: Create temp canvas, draw first frame from first clip
- Button flow: "Start Export" → (validates) → Shows preview modal → "Confirm Export"

---

## 📝 **Files Modified So Far:**

### **New Files:**
- `src/renderer/store/mediaLibraryStore.ts` - Media library state management

### **Modified Files:**
- `src/renderer/components/Timeline.tsx` - Trim preview, clip reordering, hover feedback
- `src/renderer/components/MediaLibrary.tsx` - Drag & drop reordering
- `src/renderer/App.tsx` - Media library store integration
- `IMPLEMENTATION_PLAN_PRD1_POLISH.md` - This file

---

## ✅ **Success Criteria:**

1. ✅ Trim handles can be dragged with Apply/Cancel workflow
2. ✅ Trim handles persist during playhead movement
3. ✅ Timeline clips can be reordered with buttons/keyboard shortcuts
4. ✅ Media library supports drag & drop reordering
5. ✅ Timeline clips highlight on hover with visual feedback
6. ⏳ Zoom +/- buttons scale timeline and clips correctly
7. ⏳ Projects can be saved to and loaded from `.clipforge` files
8. ⏳ Application menu provides keyboard shortcuts and actions
9. ⏳ Export dialog shows preview with settings and first frame

---

**Ready for next tasks: Zoom, Project Save/Load, Application Menu, Export Preview**