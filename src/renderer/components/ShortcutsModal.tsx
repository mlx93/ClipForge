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
      <div className="bg-white rounded-lg p-4 w-full max-w-6xl max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-4">
          {shortcuts.map((category) => (
            <div key={category.category} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-1">
                {category.category}
              </h3>
              <div className="space-y-1">
                {category.items.map((shortcut, index) => (
                  <div key={index} className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-700 flex-1 pr-1">{shortcut.description}</span>
                    <kbd className="px-2 py-0.5 text-xs font-mono font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded flex-shrink-0">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            <p>
              <strong>Note:</strong> Shortcuts work when the main window is focused. Some may not work during playback or when dialogs are open.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
