import React from 'react';
import { Music, Download, Printer, RefreshCw, Sparkles } from 'lucide-react';

interface NavbarProps {
  backendOnline: boolean;
  hasResult: boolean;
  onOpenExport: () => void;
  onPrint: () => void;
  onReset: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  backendOnline,
  hasResult,
  onOpenExport,
  onPrint,
  onReset,
}) => {
  return (
    <header className="navbar-container" style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 15, 29, 0.85)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '12px 24px'
    }}>
      <div style={{
        maxWidth: 1440,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={onReset}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)'
          }}>
            <Music size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(to right, #ffffff, #c4b5fd, #67e8f9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Music-Decoder
              </span>
              <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>AI STUDIO</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
              Instrumental Audio → Sheet Music Notation
            </p>
          </div>
        </div>

        {/* Engine Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="badge badge-purple" style={{ textTransform: 'none', padding: '4px 10px' }}>
            <Sparkles size={12} />
            <span>Neural Transcription ONNX</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            padding: '4px 10px',
            borderRadius: 999,
            background: backendOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            border: `1px solid ${backendOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            color: backendOnline ? '#6ee7b7' : '#fda4af'
          }}>
            <div style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: backendOnline ? '#10b981' : '#f43f5e',
              boxShadow: backendOnline ? '0 0 8px #10b981' : 'none'
            }} />
            <span>{backendOnline ? 'AI Backend Online' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasResult && (
            <>
              <button
                className="btn btn-secondary"
                onClick={onPrint}
                style={{ fontSize: '0.84rem', padding: '7px 12px' }}
                title="Print Sheet Music Score"
              >
                <Printer size={15} />
                <span>Print Score</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={onOpenExport}
                style={{ fontSize: '0.84rem', padding: '7px 14px' }}
              >
                <Download size={15} />
                <span>Export (PDF/XML/MIDI)</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={onReset}
                style={{ fontSize: '0.84rem', padding: '7px 10px' }}
                title="New Audio File"
              >
                <RefreshCw size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
