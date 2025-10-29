# Undo/Redo Issue - Investigation Summary

## Problem
When performing multiple operations (e.g., split → reorder), clicking undo undoes the FIRST operation (split) instead of the MOST RECENT operation (reorder).

## Root Cause
The history snapshots are being created BEFORE the operations execute, which is correct. However, the issue is that we're capturing the state at the wrong moment.

**Current flow:**
1. Split: Captures state BEFORE split (2 clips) → Executes split → State becomes 3 clips
2. Move: Captures state BEFORE move (3 clips after split) → Executes move → State becomes 3 clips reordered
3. Undo: Restores to state from past[3] which is the SPLIT state

**The issue:** The snapshots in `past` array don't match what the user expects to undo.

## Analysis from Logs
```
Before split:  {past: 2, present: "Add clip", future: 0}
After split:   {past: 3, present: "Split clip", future: 0}
After move:    {past: 4, present: "Move clip", future: 0}
On undo:       Takes past[3] = "Split clip" ❌
```

The history store is working correctly, but we need to ensure snapshots are created at the right time relative to state changes.

## Solution Needed
The issue is that when the `createSnapshot` function is called, it's reading the timeline state from React state, which may be stale or not yet updated. We need to ensure snapshots capture the state immediately before the Zustand store is modified.

## Next Steps
1. Move snapshot creation to INSIDE the Zustand store actions
2. Or ensure snapshots are created synchronously before any state updates
3. Test that undo/redo works in the correct order

