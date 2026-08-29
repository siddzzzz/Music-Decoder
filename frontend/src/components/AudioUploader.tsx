import React, { useState, useRef, useEffect } from 'react';
import { Upload, Mic, MicOff, Play, Sparkles, FileAudio, Disc, ArrowRight } from 'lucide-react';
import type { SampleTrack, TranscriptionOptions } from '../types';

interface AudioUploaderProps {
  samples: SampleTrack[];
  onUploadFile: (file: File) => void;
  onSelectSample: (sampleId: string) => void;
  options: TranscriptionOptions;
  onOptionsChange: (newOptions: TranscriptionOptions) => void;
  isLoading: boolean;
  loadingMessage: string;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  samples,
  onUploadFile,
  onSelectSample,
  options,
  onOptionsChange,
  isLoading,
  loadingMessage,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (sampleAudioRef.current) sampleAudioRef.current.pause();
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) {
        onUploadFile(file);
      } else {
        alert('Please upload a valid audio file (.mp3, .wav, .flac, .ogg, .m4a)');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFile(e.target.files[0]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const recordedFile = new File([audioBlob], 'live_recording.wav', { type: 'audio/wav' });
        stream.getTracks().forEach(t => t.stop());
        onUploadFile(recordedFile);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  const toggleSamplePreview = (sampleId: string) => {
    if (playingSampleId === sampleId) {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        setPlayingSampleId(null);
      }
    } else {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
      }
      const audio = new Audio(`/api/samples/${sampleId}/audio`);
      audio.onended = () => setPlayingSampleId(null);
      audio.play();
      sampleAudioRef.current = audio;
      setPlayingSampleId(sampleId);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Hero Title Banner */}
      <div style={{ textAlign: 'center', maxWidth: 780, margin: '20px auto 0' }}>
        <div className="badge badge-purple" style={{ marginBottom: 14 }}>
          <Sparkles size={13} />
          <span>Automatic Music Transcription & Notation AI</span>
        </div>
        <h1 style={{
          fontSize: '2.8rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginBottom: 14,
          background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Turn Instrumental Music into <span style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Sheet Music</span>
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Upload any instrumental recording (piano, acoustic guitar, solo winds, violin, synths) and our AI neural network will transcribe polyphonic notes, quantize the rhythm, and engrave interactive sheet music with downloadable PDF, MusicXML, and MIDI.
        </p>
      </div>

      {/* Mode Selector Pill */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: 'rgba(15, 23, 42, 0.85)',
        padding: 6,
        borderRadius: 9999,
        border: '1px solid var(--border-active)',
        width: 'fit-content',
        margin: '0 auto',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
      }}>
        <button
          type="button"
          className={`btn ${options.mode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 20px', borderRadius: 9999, fontSize: '0.85rem' }}
          onClick={() => onOptionsChange({ ...options, mode: 'single' })}
        >
          <span>Solo / Polyphonic Instrument</span>
        </button>

        <button
          type="button"
          className={`btn ${options.mode === 'multitrack' ? 'btn-cyan' : 'btn-secondary'}`}
          style={{ padding: '8px 20px', borderRadius: 9999, fontSize: '0.85rem' }}
          onClick={() => onOptionsChange({ ...options, mode: 'multitrack' })}
        >
          <Sparkles size={14} />
          <span>Full Song & Orchestra (Demucs AI Stems)</span>
        </button>
      </div>

      {/* Main Upload Dropzone */}
      <div
        className={`glass-panel ${isDragging ? 'glow-purple' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragging ? '2px dashed var(--accent-purple)' : '2px dashed var(--border-subtle)',
          borderRadius: 20,
          padding: '48px 32px',
          textAlign: 'center',
          cursor: isLoading ? 'wait' : 'pointer',
          background: isDragging ? 'rgba(139, 92, 246, 0.08)' : 'rgba(15, 23, 42, 0.65)',
          transition: 'all 0.25s ease',
          position: 'relative'
        }}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <div style={{ padding: '30px 0' }}>
            <div style={{
              width: 56,
              height: 56,
              margin: '0 auto 20px',
              border: '4px solid rgba(139, 92, 246, 0.2)',
              borderTopColor: 'var(--accent-purple)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {loadingMessage || 'AI Transcribing & Quantizing Music...'}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Extracting polyphonic pitches, detecting tempo/key, and building MusicXML score...
            </p>
          </div>
        ) : (
          <div>
            <div style={{
              width: 68,
              height: 68,
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              boxShadow: '0 8px 24px -4px rgba(139, 92, 246, 0.3)'
            }}>
              <Upload size={32} color="#c4b5fd" />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Drag & Drop your Instrumental Audio here
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Supports MP3, WAV, FLAC, M4A, OGG • Up to 50MB
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <FileAudio size={16} />
                <span>Browse Audio File</span>
              </button>

              <button
                type="button"
                className={`btn ${isRecording ? 'btn-outline' : 'btn-secondary'}`}
                style={{
                  borderColor: isRecording ? '#f43f5e' : undefined,
                  color: isRecording ? '#f43f5e' : undefined,
                  background: isRecording ? 'rgba(244, 63, 94, 0.15)' : undefined
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  isRecording ? stopRecording() : startRecording();
                }}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                <span>{isRecording ? `Recording (${recordSeconds}s) - Click to Stop` : 'Record Microphone'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preset Instrumental Sample Tracks */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Disc size={18} color="#8b5cf6" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Or Try 1-Click Instrumental Demo Tracks
            </h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Instant AI Transcription Test</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16
        }}>
          {samples.map((sample) => (
            <div
              key={sample.id}
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                    {sample.instrument}
                  </span>
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>{sample.bpm} BPM</span>
                    <span>•</span>
                    <span>{sample.key}</span>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {sample.name}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 16 }}>
                  {sample.description}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  onClick={() => toggleSamplePreview(sample.id)}
                  title="Listen to audio preview"
                >
                  <Play size={13} fill={playingSampleId === sample.id ? '#06b6d4' : 'none'} color="#06b6d4" />
                  <span>{playingSampleId === sample.id ? 'Pause' : 'Preview'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-cyan"
                  style={{ flex: 1, padding: '8px 14px', fontSize: '0.82rem' }}
                  onClick={() => onSelectSample(sample.id)}
                  disabled={isLoading}
                >
                  <span>Transcribe Track</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
