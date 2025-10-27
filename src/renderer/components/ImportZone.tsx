import React, { useRef, useState } from 'react';

interface ImportZoneProps {
  onImport: (filePaths: string[]) => void;
}

const ImportZone: React.FC<ImportZoneProps> = ({ onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    const videoFiles = files.filter(file => 
      file.type.startsWith('video/') || 
      ['.mp4', '.mov', '.avi', '.mkv', '.webm'].some(ext => 
        file.name.toLowerCase().endsWith(ext)
      )
    );
    
    if (videoFiles.length > 0) {
      const filePaths = videoFiles.map(file => file.path);
      onImport(filePaths);
    }
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
      
      <div 
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          isDragOver 
            ? 'border-blue-400 bg-blue-900/20' 
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div className="text-sm text-gray-400">
          {isDragOver ? 'Drop video files here' : 'or drag & drop video files here'}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Supports MP4, MOV, AVI, MKV, WebM
        </div>
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
