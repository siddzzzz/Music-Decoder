import React from 'react';
import { X, FileText, Music, Disc, Download, Printer, BookOpen, Layers } from 'lucide-react';
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

  const partIcons: Record<string, string> = {
    lead: '🪈',
    harmony: '🎹',
    bass: '🎸',
    drums: '🥁',
  };

  const partLabels: Record<string, string> = {
    lead: 'Lead Solo / Winds',
    harmony: 'Harmony / Keys / Strings',
    bass: 'Bassline & TAB',
    drums: 'Drum Kit & Percussion',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 28,
          borderRadius: 20,
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1px solid var(--border-active)',
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.8)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Export Sheet Music &amp; Parts
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Download your AI transcribed scores, performer parts, and master booklet in universal formats
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

        {/* Master Orchestral Booklet Banner (If Multitrack or Booklet available) */}
        {result.exports.booklet && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              marginBottom: 16,
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%)',
              border: '1px solid rgba(167, 139, 250, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              boxShadow: '0 4px 20px -4px rgba(139, 92, 246, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
                }}
              >
                <BookOpen size={24} color="#ffffff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Master Orchestral Score Booklet
                  </h4>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 10,
                      background: 'rgba(216, 180, 254, 0.25)',
                      color: '#e9d5ff',
                      textTransform: 'uppercase'
                    }}
                  >
                    Multi-Page PDF
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '3px 0 0 0' }}>
                  Cover page + Conductor's full score + Paginated individual instrument parts
                </p>
              </div>
            </div>
            <a
              href={result.exports.booklet}
              download="orchestral_master_booklet.pdf"
              className="btn btn-primary"
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                textDecoration: 'none',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              <Download size={15} />
              <span>Download Booklet</span>
            </a>
          </div>
        )}

        {/* Individual Performer Parts Section (If Parts available) */}
        {result.exports.parts && Object.keys(result.exports.parts).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Layers size={16} color="#38bdf8" />
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                Individual Performer Parts (Extracted Scores)
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {Object.entries(result.exports.parts).map(([trackKey, partInfo]) => {
                const icon = partIcons[trackKey] || '🎼';
                const label = partLabels[trackKey] || (result.tracks && result.tracks[trackKey]?.name) || trackKey.toUpperCase();
                return (
                  <div
                    key={trackKey}
                    style={{
                      background: 'rgba(30, 41, 59, 0.65)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          Standalone Part Score
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <a
                        href={partInfo.pdf}
                        download={`${trackKey}_part.pdf`}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.74rem', justifyContent: 'center', textDecoration: 'none' }}
                      >
                        <FileText size={12} color="#f87171" />
                        <span>PDF</span>
                      </a>
                      <a
                        href={partInfo.musicxml}
                        download={`${trackKey}_part.musicxml`}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.74rem', justifyContent: 'center', textDecoration: 'none' }}
                      >
                        <Music size={12} color="#c4b5fd" />
                        <span>XML</span>
                      </a>
                      <a
                        href={partInfo.midi}
                        download={`${trackKey}_part.mid`}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.74rem', justifyContent: 'center', textDecoration: 'none' }}
                      >
                        <Disc size={12} color="#6ee7b7" />
                        <span>MIDI</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Standard Full Score Formats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 2px 0' }}>
            {result.is_multitrack ? "Conductor's Full Master Score Formats" : 'Standard Sheet Music Formats'}
          </h4>

          {/* PDF Sheet Music */}
          <a
            href={result.exports.pdf}
            download="sheet_music.pdf"
            className="glass-panel"
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(30, 41, 59, 0.45)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileText size={20} color="#f87171" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {result.is_multitrack ? "Conductor's Full Score PDF" : 'Sheet Music PDF'}
                </h4>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
                  High-res printable notation with clefs, key, tempo &amp; chords
                </p>
              </div>
            </div>
            <div className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
              <Download size={13} />
              <span>Download PDF</span>
            </div>
          </a>

          {/* MusicXML (.musicxml) */}
          <a
            href={result.exports.musicxml}
            download="score.musicxml"
            className="glass-panel"
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(30, 41, 59, 0.45)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(139, 92, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Music size={20} color="#c4b5fd" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  MusicXML (.musicxml)
                </h4>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Universal format for MuseScore, Finale, Sibelius, Dorico
                </p>
              </div>
            </div>
            <div className="btn btn-cyan" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
              <Download size={13} />
              <span>Download XML</span>
            </div>
          </a>

          {/* MIDI (.mid) */}
          <a
            href={result.exports.midi}
            download="transcription.mid"
            className="glass-panel"
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(30, 41, 59, 0.45)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Disc size={20} color="#6ee7b7" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {result.is_multitrack ? 'Multi-Track Type-1 MIDI' : 'MIDI File (.mid)'}
                </h4>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {result.is_multitrack ? 'Dedicated channels for Lead, Harmony, Bass, Drums' : 'Standard MIDI sequence for Ableton, FL Studio, Logic Pro'}
                </p>
              </div>
            </div>
            <div className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
              <Download size={13} />
              <span>Download MIDI</span>
            </div>
          </a>

          {/* Separated Stems Box (If Multi-Track) */}
          {result.is_multitrack && result.exports.stems && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: 12,
                padding: '12px 16px',
                border: '1px solid var(--border-active)'
              }}
            >
              <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c4b5fd', marginBottom: 8, marginTop: 0 }}>
                Download Isolated Audio Stems (.wav)
              </h5>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(result.exports.stems).map(([stemName, stemUrl]) => (
                  <a
                    key={stemName}
                    href={stemUrl}
                    download={`${stemName}.wav`}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none' }}
                  >
                    <Download size={12} />
                    <span>{stemName.toUpperCase()} WAV</span>
                  </a>
                ))}
              </div>
            </div>
          )}
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

