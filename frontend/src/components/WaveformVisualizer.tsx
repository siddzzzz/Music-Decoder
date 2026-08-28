import React, { useRef, useEffect, useState } from 'react';
import type { TranscriptionResult } from '../types';

interface WaveformVisualizerProps {
  result: TranscriptionResult;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  result,
  currentTime = 0,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const waveform = result.waveform || [];
  const duration = Math.max(0.1, result.duration || 1);
  const beatTimes = result.beat_times || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // Clear background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, width, height);

    // Draw Beat Marker Lines
    beatTimes.forEach((bt, idx) => {
      const x = (bt / duration) * width;
      const isMeasure = idx % 4 === 0;
      ctx.strokeStyle = isMeasure ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = isMeasure ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    // Draw Waveform Bars
    const totalPoints = waveform.length;
    const barWidth = width / totalPoints;

    for (let i = 0; i < totalPoints; i++) {
      const amp = waveform[i];
      const barHeight = Math.max(2, amp * (height * 0.85));
      const x = i * barWidth;
      const pointTime = (i / totalPoints) * duration;

      const isPlayed = pointTime <= currentTime;

      // Gradient color for played vs unplayed waveform
      if (isPlayed) {
        ctx.fillStyle = '#38bdf8';
      } else {
        ctx.fillStyle = 'rgba(139, 92, 246, 0.65)';
      }

      ctx.fillRect(x, centerY - (barHeight / 2), Math.max(1, barWidth - 0.5), barHeight);
    }

    // Draw Playhead scrubber line
    if (currentTime > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(playheadX, 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [result, waveform, duration, beatTimes, currentTime]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / canvas.width) * duration;
    setHoverTime(Math.max(0, Math.min(duration, time)));
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onSeek) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / canvas.width) * duration;
    onSeek(Math.max(0, Math.min(duration, time)));
  };

  return (
    <div className="glass-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Audio Waveform & Beat Grid
          </span>
          <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
            {result.tempo} BPM • {result.key.display}
          </span>
        </div>

        {hoverTime !== null && (
          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            Cursor: {hoverTime.toFixed(2)}s
          </span>
        )}
      </div>

      <div style={{ width: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={1000}
          height={90}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverTime(null)}
          onClick={handleClick}
          style={{
            display: 'block',
            width: '100%',
            height: 90,
            borderRadius: 8,
            cursor: onSeek ? 'pointer' : 'default',
            border: '1px solid var(--border-subtle)'
          }}
        />
      </div>
    </div>
  );
};
