import React from 'react';
import { X, FileText, Music, Disc, Download, Printer } from 'lucide-react';
import type { TranscriptionResult } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: TranscriptionResult;
  onPrint: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  result,
  onPrint,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 580,
          padding: 28,
          borderRadius: 20,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border-active)',
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.8)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Export Sheet Music & Audio
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Download your AI transcribed score in universal music notation formats
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: 6, borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Formats Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {/* PDF Sheet Music */}
          <a
            href={result.exports.pdf}
            download="sheet_music.pdf"
            className="glass-panel"
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(30, 41, 59, 0.5)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText size={22} color="#f87171" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Sheet Music PDF
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  High-res printable score with clefs, key & tempo metadata
                </p>
              </div>
            </div>
            <div className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <Download size={14} />
              <span>Download PDF</span>
            </div>
          </a>

          {/* MusicXML (.musicxml) */}
          <a
            href={result.exports.musicxml}
            download="score.musicxml"
            className="glass-panel"
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(30, 41, 59, 0.5)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(139, 92, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Music size={22} color="#c4b5fd" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  MusicXML (.musicxml)
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Universal format for MuseScore, Finale, Sibelius, Dorico
                </p>
              </div>
            </div>
            <div className="btn btn-cyan" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <Download size={14} />
              <span>Download XML</span>
            </div>
          </a>

          {/* MIDI (.mid) */}
          <a
            href={result.exports.midi}
            download="transcription.mid"
            className="glass-panel"
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(30, 41, 59, 0.5)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Disc size={22} color="#6ee7b7" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  MIDI File (.mid)
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Standard MIDI sequence for Ableton, FL Studio, Logic Pro
                </p>
              </div>
            </div>
            <div className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <Download size={14} />
              <span>Download MIDI</span>
            </div>
          </a>
        </div>

        {/* Direct Print Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onClose();
              onPrint();
            }}
          >
            <Printer size={15} />
            <span>Print Current Score</span>
          </button>
        </div>
      </div>
    </div>
  );
};
