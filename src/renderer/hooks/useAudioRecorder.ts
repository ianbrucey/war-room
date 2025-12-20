import { voice } from '@/common/ipcBridge';
import { bridge } from '@office-ai/platform';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean; // true while waiting for transcription
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  transcription: string; // The latest transcription result
  error: string | null;
  volume: number; // For visualization 0-1
  duration: number; // Recording duration in seconds
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
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
      setDuration(0);

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

      // Determine best supported audio format for Whisper API
      // Whisper supports: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
      let mimeType = 'audio/webm';
      let fileExtension = 'webm';

      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
        fileExtension = 'webm';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
        fileExtension = 'webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        fileExtension = 'mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
        fileExtension = 'ogg';
      } else {
        console.warn('[useAudioRecorder] No supported audio format found, using default');
      }

      console.log('[useAudioRecorder] Using audio format:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      // Collect all chunks into a single array, then combine at the end
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log('[useAudioRecorder] Chunk collected, total chunks:', chunks.length);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[useAudioRecorder] MediaRecorder stopped, processing audio...');
        setIsRecording(false);
        setIsProcessing(true);

        try {
          // Combine all chunks into a single blob - this creates a valid audio file
          const audioBlob = new Blob(chunks, { type: mimeType });
          console.log('[useAudioRecorder] Combined blob size:', audioBlob.size, 'type:', audioBlob.type);

          // Convert to array for JSON transport
          const buffer = await audioBlob.arrayBuffer();
          const data = Array.from(new Uint8Array(buffer));

          console.log('[useAudioRecorder] Sending complete audio to backend, size:', data.length);

          // Send the complete audio file to backend
          await voice.transcribe.invoke({ data, fileExtension });
        } catch (err) {
          console.error('[useAudioRecorder] Failed to process audio:', err);
          setError('Failed to process audio');
          setIsProcessing(false);
        }

        cleanup();
      };

      // Start recording - no timeslice means we get one blob at the end
      // But we use a timeslice to collect chunks that we'll combine into a valid file
      mediaRecorder.start(1000); // Collect every 1 second
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Track duration
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      console.log('[useAudioRecorder] Recording started');

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
    isProcessing,
    startRecording,
    stopRecording,
    transcription,
    error,
    volume,
    duration,
  };
};
