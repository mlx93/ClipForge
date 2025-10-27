import React, { useRef } from 'react';

interface ImportZoneProps {
  onImport: (filePaths: string[]) => void;
}

const ImportZone: React.FC<ImportZoneProps> = ({ onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const filePaths = Array.from(files).map(file => file.path);
      onImport(filePaths);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        className="w-full btn-primary flex items-center justify-center space-x-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span>Import Videos</span>
      </button>
      
      <div className="text-center text-sm text-gray-400">
        or drag & drop video files here
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp4,.mov,.avi,.mkv,.webm"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default ImportZone;
