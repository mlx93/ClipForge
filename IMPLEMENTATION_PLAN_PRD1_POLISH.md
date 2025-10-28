# ClipForge - PRD-1 Polish & Project Management Implementation Plan

**Status:** Ready to Implement  
**Estimated Time:** 3-4 hours  
**Priority:** High - Fixes critical bugs and adds essential features

---

## 🎯 **Implementation Tasks**

### **1. Fix Trim Handle Dragging** 🔴 CRITICAL
- **Problem:** Custom properties on Fabric.js canvas not triggering drag events
- **Solution:** Use Fabric.js native `object:moving` event instead of custom `isDragging` flag
- **Pseudocode:**
  ```typescript
  canvas.on('object:moving', (e) => {
    if (e.target.isTrimHandle) {
      calculateNewTrimTime(e.target.left);
      updateClipTrimInStore(clipId, newTrimStart/End);
    }
  });
  ```
- Make trim handles `selectable: true, movable: true` (currently locked)
- Constrain handle movement to parent clip bounds

### **2. Fix Timeline Zoom** 🔍
- **Problem:** Zoom state updates but canvas doesn't re-render with scaled clips
- **Solution:** Add `zoom` to `useLayoutEffect` dependency array (already there - investigate further)
- Alternative: Manually call `canvas.setZoom(zoom)` and `canvas.renderAll()`
- Scale clip widths based on zoom: `clipWidth = (clipDuration / totalDuration) * canvas.width * zoom`

### **3. Fix Clip Movement on Timeline** 🔄 NEW
- **Problem:** Clips show 4-arrow cursor but can't be moved/reordered
- **Solution:** Enable clip dragging and reordering on timeline
- Make main clip rectangles `selectable: true` and `movable: true`
- Implement `object:moving` event for clip reordering
- Update Zustand store with new clip order

### **4. Add Media Library Drag & Drop Reordering** 📋 NEW
- **Problem:** Can't reorder videos in the imported panel
- **Solution:** Add drag & drop reordering to MediaLibrary component
- Use React DnD or native HTML5 drag & drop
- Update media library order in Zustand store
- Visual feedback during drag operations

### **5. Fix Trim Functionality** ✂️ NEW
- **Problem:** Red trim bars move but don't actually trim the video
- **Solution:** Ensure trim values are properly applied to video playback
- Update video preview to respect trim points
- Fix trim calculation in `object:moving` event
- Test that trimmed video plays correctly

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

### **4. Application Menu** 📋
- Create `src/main/menu.ts` with Electron Menu template
- Menus: File, Edit, View, Help
- File: New, Open, Save, Export, Quit
- Edit: Undo, Redo, Cut, Copy, Paste, Delete
- View: Zoom In, Zoom Out, Reset Zoom
- Wire menu items to IPC handlers or renderer actions

### **5. Export Preview Dialog Enhancement** 📹
- Modify `ExportDialog.tsx` to show preview BEFORE starting export
- Add preview section: Settings summary + first frame thumbnail
- Generate thumbnail: Create temp canvas, draw first frame from first clip
- Button flow: "Start Export" → (validates) → Shows preview modal → "Confirm Export"

### **6. Timeline Hover Feedback** ✨
- Add Fabric.js `mouse:over` and `mouse:out` events
- On hover: Highlight clip (lighter blue), show cursor change
- On hover over handles: Show resize cursor (ew-resize)
- Visual feedback: Scale up slightly or add glow effect

### **7. Export Progress IPC** 📊
- Verify `export-progress` events flow from main → renderer
- Test: Add console.log in main process when progress updates
- Ensure `mainWindow.webContents.send()` fires correctly
- Check renderer listener properly attached in `exportStore.ts`

---

## 📝 **Files to Modify:**

### **New Files:**
- `src/main/menu.ts` - Application menu template
- `src/main/projectManager.ts` - Save/load logic
- `src/renderer/store/projectStore.ts` - Project state management

### **Modified Files:**
- `src/renderer/components/Timeline.tsx` - Fix trim drag, zoom, hover feedback
- `src/renderer/components/ExportDialog.tsx` - Add preview with thumbnail
- `src/main/ipc/handlers.ts` - Add project save/load IPC handlers
- `src/main/index.ts` - Register application menu
- `src/shared/types.ts` - Add `Project` interface
- `src/shared/constants.ts` - Add project-related IPC channels

---

## ✅ **Success Criteria:**

1. ✅ Trim handles can be dragged to adjust clip in/out points
2. ✅ Zoom +/- buttons scale timeline and clips correctly
3. ✅ Projects can be saved to and loaded from `.clipforge` files
4. ✅ Application menu provides keyboard shortcuts and actions
5. ✅ Export dialog shows preview with settings and first frame
6. ✅ Timeline clips highlight on hover with visual feedback
7. ✅ Export progress updates correctly in dialog

---

**Ready to implement. Starting with critical fixes (trim handles, zoom) first.**

