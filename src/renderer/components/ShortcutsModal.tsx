import React from 'react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcuts = [
    {
      category: 'General',
      items: [
        { key: 'Cmd+Z', description: 'Undo last action' },
        { key: 'Cmd+Shift+Z', description: 'Redo last action' },
        { key: 'Cmd+E', description: 'Export video' },
        { key: 'Cmd+R', description: 'Start recording' },
      ]
    },
    {
      category: 'Playback',
      items: [
        { key: 'Space', description: 'Play/Pause video' },
        { key: 'Home', description: 'Go to beginning' },
        { key: 'End', description: 'Go to end' },
        { key: '←', description: 'Move playhead left' },
        { key: '→', description: 'Move playhead right' },
      ]
    },
    {
      category: 'Timeline Editing',
      items: [
        { key: 'S', description: 'Split clip at playhead' },
        { key: 'Delete', description: 'Delete selected clip' },
        { key: 'Backspace', description: 'Delete selected clip' },
        { key: 'Tab', description: 'Select next clip' },
        { key: 'Shift+Tab', description: 'Select previous clip' },
      ]
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.items.map((shortcut, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="text-gray-700">{shortcut.description}</span>
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              <strong>Note:</strong> Keyboard shortcuts work when the main window is focused.
            </p>
            <p>
              Some shortcuts may not work during video playback or when certain dialogs are open.
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
