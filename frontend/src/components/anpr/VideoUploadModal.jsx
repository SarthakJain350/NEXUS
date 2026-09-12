import React, { useRef, useState } from 'react';
import { X, Upload, Film, Loader2, CheckCircle2, AlertCircle, Clock, FileVideo } from 'lucide-react';
import { api } from '../../services/api';

/**
 * Local Video Upload → ANPR pipeline modal.
 *
 * Uploads a local video file; the backend runs the EXISTING NEXUS pipeline
 * (YOLO vehicle detection + ByteTrack + ONNX plate detection + Fast-Plate-OCR)
 * on it and ingests every detection against the reserved LOCAL_UPLOAD source
 * node with real-world processing timestamps. Results also flow into the
 * regular Live Feed / ANPR tables via the normal polling.
 */
export default function VideoUploadModal({ isOpen, onClose }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [result, setResult] = useState(null);
  const [plateReads, setPlateReads] = useState({});
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const reset = () => {
    setSelectedFile(null);
    setResult(null);
    setPlateReads({});
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      setResult(null);
      setPlateReads({});
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || isProcessing) return;
    setIsProcessing(true);
    setElapsed(0);
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    setError('');
    setResult(null);
    try {
      const res = await api.uploadVideoForAnpr(selectedFile);
      setResult(res);
      // Enrich with per-detection OCR confidence from the plate-reads trail.
      const reads = await Promise.all(
        (res.detections || []).map(async (d) => [d.id, await api.getPlateReads(d.id)])
      );
      setPlateReads(Object.fromEntries(reads));
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      clearInterval(tick);
      setIsProcessing(false);
      setElapsed(null);
    }
  };

  const formatTs = (ts) =>
    new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '640px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        background: 'rgba(11, 17, 30, 0.97)',
        border: '1px solid var(--border-medium)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--accent-cyan)' }}>
              <FileVideo size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Upload Video → ANPR Pipeline</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Runs the existing NEXUS YOLO + Fast-Plate-OCR pipeline on a local video
              </p>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Info */}
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(0, 242, 254, 0.04)',
            border: '1px solid rgba(0, 242, 254, 0.2)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)'
          }}>
            Detections are ingested with real-world processing timestamps (not video frame
            time) against the <b>LOCAL_UPLOAD</b> source node — no camera assignment, no
            fabricated GPS. Results also appear in Live Feed / ANPR automatically.
          </div>

          {/* File picker */}
          <input ref={fileInputRef} type="file" accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm" style={{ display: 'none' }} onChange={handleFileSelect} />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-outline" disabled={isProcessing} style={{ flexShrink: 0 }}>
              <Upload size={14} /> Choose Video
            </button>
            <div className="font-mono" style={{
              flex: 1,
              fontSize: '0.74rem',
              color: selectedFile ? '#fff' : 'var(--text-dim)',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(255, 255, 255, 0.02)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB)` : 'No file selected (.mp4/.avi/.mov/.mkv/.webm, max 200 MB)'}
            </div>
            <button onClick={handleUpload} disabled={!selectedFile || isProcessing} className="btn btn-primary" style={{ flexShrink: 0 }}>
              {isProcessing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Film size={14} />}
              {isProcessing ? 'Processing…' : 'Run Pipeline'}
            </button>
          </div>

          {/* Processing state */}
          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.06)', border: '1px solid rgba(0, 242, 254, 0.25)', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Running vehicle detection + plate OCR… <b>{elapsed ?? 0}s</b> elapsed — this typically takes 30–90 seconds for a demo clip.
            </div>
          )}

          {/* Error state */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.35)', fontSize: '0.76rem', color: '#fb7185' }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</span>
            </div>
          )}

          {/* Results */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#34d399' }}>
                <CheckCircle2 size={15} />
                <b>{result.detection_count}</b> detection{result.detection_count === 1 ? '' : 's'} ingested
                <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                  (source: {result.source}, {result.elapsed_seconds}s)
                </span>
              </div>

              {result.detection_count === 0 && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  {result.plates_read > 0 ? (
                    <>
                      The pipeline read <b style={{ color: 'var(--accent-cyan)' }}>{result.plates_read}</b> plate{result.plates_read === 1 ? '' : 's'}, but this exact
                      footage was already ingested earlier — every event was an <b>idempotent replay</b> (the original
                      detections keep their original timestamps and are already in the Live Feed / ANPR table).
                      <b> Upload a different clip</b> to see new detections.
                    </>
                  ) : (
                    <>
                      No readable plates were found in this clip (plates need roughly 40+ px height; try a
                      closer/higher-resolution video).
                    </>
                  )}
                </div>
              )}

              {result.detections.map((d) => {
                const read = (plateReads[d.id] || [])[0];
                return (
                  <div key={d.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span className="plate-badge font-mono" style={{ fontSize: '0.82rem', padding: '2px 8px', flexShrink: 0 }}>
                        <span className="ind-tag">IND</span>
                        <span>{d.plate_number || 'UNREADABLE'}</span>
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', flexShrink: 0 }}>{d.vehicle_type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.7rem', flexShrink: 0 }}>
                      <span style={{ color: 'var(--text-muted)' }}>det <b style={{ color: 'var(--accent-cyan)' }}>{(d.confidence * 100).toFixed(0)}%</b></span>
                      <span style={{ color: 'var(--text-muted)' }}>ocr <b style={{ color: 'var(--accent-emerald)' }}>{read?.ocr_confidence != null ? `${(read.ocr_confidence * 100).toFixed(0)}%` : '—'}</b></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)' }} title="Real-world processing timestamp (IST)">
                        <Clock size={11} /> {formatTs(d.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
