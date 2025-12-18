import { voice } from '@/common/ipcBridge';
import { bridge } from '@office-ai/platform';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean; // NEW: true while waiting for transcription
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  transcription: string; // The latest transcription result
  error: string | null;
  volume: number; // For visualization 0-1
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // NEW: processing state
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Listen for transcription results from server via bridge
  useEffect(() => {
    console.log('[useAudioRecorder] Setting up bridge event listeners');

    const handleVoiceText = (data: { text: string }) => {
      console.log('[useAudioRecorder] Received transcription:', data.text);
      setTranscription(data.text);
      setIsProcessing(false); // Stop processing spinner
    };

    const handleVoiceError = (data: { message: string }) => {
      console.error('[useAudioRecorder] Voice error:', data.message);
      setError(data.message);
      setIsProcessing(false); // Stop processing spinner
    };

    // Listen to bridge events instead of local emitter
    const unsubscribeText = bridge.on('voice-text', handleVoiceText);
    const unsubscribeError = bridge.on('voice-error', handleVoiceError);
    console.log('[useAudioRecorder] Bridge event listeners registered');

    return () => {
      console.log('[useAudioRecorder] Cleaning up bridge event listeners');
      unsubscribeText();
      unsubscribeError();
    };
  }, []);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  const analyzeVolume = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    setVolume(Math.min(1, average / 128)); // Normalize roughly

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(analyzeVolume);
    } else {
      setVolume(0);
    }
  };

  const startRecording = useCallback(async () => {
    console.log('[useAudioRecorder] startRecording called');
    try {
      setError(null);
      setTranscription('');

      console.log('[useAudioRecorder] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('[useAudioRecorder] Microphone access granted');

      // Setup Visualizer
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      console.log('[useAudioRecorder] Audio visualizer setup complete');

      // Setup Recorder
      // Request 500ms chunks for streaming to backend
      // Note: All chunks are accumulated into a single buffer and transcribed once when recording stops
      // This gives Whisper the full context for better punctuation and accuracy
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        console.log('[useAudioRecorder] Audio chunk received, size:', event.data.size);
        if (event.data.size > 0) {
          const buffer = await event.data.arrayBuffer();
          // Convert ArrayBuffer to regular array for JSON serialization
          // Note: This is inefficient for large data but fits current bridge
          const data = Array.from(new Uint8Array(buffer));
          console.log('[useAudioRecorder] Sending chunk to backend, length:', data.length);
          voice.chunk.invoke({ data }).catch((err) => {
            console.error('[useAudioRecorder] Failed to send chunk:', err);
          });
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[useAudioRecorder] MediaRecorder stopped, requesting transcription');
        setIsRecording(false);
        setIsProcessing(true); // Start processing spinner
        voice.end.invoke().catch((err) => {
          console.error('[useAudioRecorder] Failed to end recording:', err);
          setIsProcessing(false); // Stop spinner on error
        });
        cleanup();
      };

      // Notify server we are starting
      console.log('[useAudioRecorder] Notifying backend to start session...');
      await voice.start.invoke();
      console.log('[useAudioRecorder] Backend session started');

      // Start recording with 500ms timeslices
      mediaRecorder.start(500);
      setIsRecording(true);
      console.log('[useAudioRecorder] Recording started with 500ms chunks');

      // Start visualizer loop
      analyzeVolume();
    } catch (err) {
      console.error('[useAudioRecorder] Failed to start recording:', err);
      setError('Could not access microphone');
      cleanup();
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    isProcessing, // NEW: expose processing state
    startRecording,
    stopRecording,
    transcription,
    error,
    volume,
  };
};
