import React, { useState, useEffect, useRef } from 'react';
import { useRecordingStore, RecordingSource } from '../store/recordingStore';
import { useMediaLibraryStore } from '../store/mediaLibraryStore';
import { useTimelineStore } from '../store/timelineStore';
import toast from 'react-hot-toast';

interface RecordingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({ isOpen, onClose }) => {
  const {
    isRecording,
    isPaused,
    recordingTime,
    availableSources,
    settings,
    recordingBlob,
    recordingUrl,
    setRecording,
    setPaused,
    setRecordingTime,
    setAvailableSources,
    updateSettings,
    setRecordingBlob,
    resetRecording,
    getFormattedTime,
    isReadyToRecord
  } = useRecordingStore();

  const { addClips } = useTimelineStore();
  const { addClip } = useMediaLibraryStore();

  const [isLoading, setIsLoading] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load available sources when panel opens
  useEffect(() => {
    if (isOpen && availableSources.length === 0) {
      loadRecordingSources();
    }
  }, [isOpen, availableSources.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const loadRecordingSources = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getRecordingSources();
      
      if (result.success && result.sources) {
        setAvailableSources(result.sources);
      } else {
        toast.error(result.error || 'Failed to load recording sources');
      }
    } catch (error) {
      console.error('Error loading recording sources:', error);
      toast.error('Failed to load recording sources');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    if (!settings.videoSource) {
      toast.error('Please select a recording source');
      return;
    }

    try {
      setIsLoading(true);
      
      // Get recording constraints from main process
      const result = await window.electronAPI.startRecording({
        videoSourceId: settings.videoSource.id,
        audioEnabled: settings.audioSource,
        resolution: settings.resolution,
        frameRate: settings.frameRate
      });

      if (!result.success || !result.constraints) {
        throw new Error(result.error || 'Failed to start recording');
      }

      // Get user media with the constraints
      const mediaStream = await navigator.mediaDevices.getUserMedia(result.constraints);
      setStream(mediaStream);

      // Create MediaRecorder
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const recordedChunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        setRecordingBlob(blob);
        setChunks(recordedChunks);
      };

      recorder.start(1000); // Collect data every second
      setMediaRecorder(recorder);
      setRecording(true);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    setRecording(false);
    setPaused(false);
    toast.success('Recording stopped');
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setPaused(true);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setPaused(false);
      
      // Resume timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const saveRecording = async () => {
    if (!recordingBlob) return;

    try {
      // Create a temporary file URL for the recording
      const url = URL.createObjectURL(recordingBlob);
      
      // Create a temporary file name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `recording-${timestamp}.webm`;
      
      // Create a temporary file element to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      // Reset recording state
      resetRecording();
      setChunks([]);
      
      toast.success('Recording saved');
      onClose();
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('Failed to save recording');
    }
  };

  const discardRecording = () => {
    resetRecording();
    setChunks([]);
    toast.success('Recording discarded');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Record Screen</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Recording Source Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Recording Source
          </label>
          {isLoading ? (
            <div className="text-center py-4">Loading sources...</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {availableSources.map((source: RecordingSource) => (
                <button
                  key={source.id}
                  onClick={() => updateSettings({ videoSource: source })}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    settings.videoSource?.id === source.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <img
                    src={source.thumbnail}
                    alt={source.name}
                    className="w-full h-24 object-cover rounded mb-2"
                  />
                  <div className="text-sm font-medium text-gray-900">
                    {source.name}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {source.type}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recording Settings */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.audioSource}
                onChange={(e) => updateSettings({ audioSource: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Include Audio
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution
              </label>
              <select
                value={`${settings.resolution.width}x${settings.resolution.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  updateSettings({ resolution: { width, height } });
                }}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="1920x1080">1920x1080 (1080p)</option>
                <option value="1280x720">1280x720 (720p)</option>
                <option value="854x480">854x480 (480p)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frame Rate
              </label>
              <select
                value={settings.frameRate}
                onChange={(e) => updateSettings({ frameRate: Number(e.target.value) })}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
                <option value={24}>24 FPS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="mb-6">
          {!isRecording ? (
            <div className="text-center">
              <button
                onClick={startRecording}
                disabled={!isReadyToRecord() || isLoading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {isLoading ? 'Starting...' : 'Start Recording'}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-2xl font-mono text-gray-900">
                {getFormattedTime()}
              </div>
              
              <div className="flex justify-center space-x-4">
                {isPaused ? (
                  <button
                    onClick={resumeRecording}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={pauseRecording}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Pause
                  </button>
                )}
                
                <button
                  onClick={stopRecording}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Stop
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recording Preview/Save */}
        {recordingBlob && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Recording Complete
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <video
                src={recordingUrl || undefined}
                controls
                className="w-full max-w-md mx-auto"
              />
              <div className="mt-4 flex justify-center space-x-4">
                <button
                  onClick={saveRecording}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Save Recording
                </button>
                <button
                  onClick={discardRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingPanel;
