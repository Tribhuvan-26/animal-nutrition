'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setStatus({ type: 'error', message: 'Please upload an image file.' });
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStatus(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  async function onSubmit() {
    if (!file) return;
    setStatus({ type: 'loading', message: 'Reading ledger with Gemini...' });

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setStatus({ type: 'error', message: json.error || 'Something went wrong.', result: json });
        return;
      }

      setStatus({ type: 'success', message: `Added ${json.rowsAdded} row(s) under "${json.dateLabel}".`, result: json });
      setFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 720 }}>
        <h1>Sales Ledger to Sheet</h1>
        <p className="subtitle">Upload a photo of the daily sales ledger. Compare what Gemini read vs what got written to the sheet.</p>

        <label
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Ledger preview" className="preview" />
          ) : (
            <>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
              <div>Click or drag a ledger photo here</div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        <button onClick={onSubmit} disabled={!file || status?.type === 'loading'}>
          {status?.type === 'loading' ? 'Working...' : 'Log to sheet'}
        </button>

        {status && (
          <div className={`status ${status.type}`}>
            <div>{status.message}</div>
            {status.result?.entries && (
              <div className="result-table">
                <div className="result-header">
                  <span>#</span>
                  <span>Customer</span>
                  <span>Gemini read</span>
                  <span>Written</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                {status.result.entries.map((e, i) => {
                  const w = status.result.written?.[i];
                  const writtenItem = w?.item_written ?? '';
                  const missing = e.items && writtenItem !== e.items;
                  return (
                    <div className="result-row-grid" key={i}>
                      <span>{i + 1}</span>
                      <span title={e.name}>{e.name}</span>
                      <span title={e.items} style={{ color: '#94a3b8' }}>{e.items || '—'}</span>
                      <span title={writtenItem} style={{ color: missing ? '#fca5a5' : '#86efac' }}>
                        {writtenItem || '(blank)'}
                      </span>
                      <span>{e.amount}</span>
                      <span>{e.paid_or_not || '—'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {status.result && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                <div>Sheets API enabled: <b style={{ color: status.result.sheetsAvailable ? '#86efac' : '#fca5a5' }}>{String(status.result.sheetsAvailable ?? '—')}</b></div>
                <div>Chip template found: <b style={{ color: status.result.chipFound ? '#86efac' : '#fca5a5' }}>{String(status.result.chipFound ?? '—')}</b></div>
                <div>API requests sent: <b>{status.result.apiRequestCount ?? '—'}</b> | applied: <b style={{ color: status.result.apiUsed ? '#86efac' : '#fca5a5' }}>{String(status.result.apiUsed ?? '—')}</b></div>
                {status.result.apiError && <div style={{ color: '#fca5a5', wordBreak: 'break-word' }}>API error: {status.result.apiError}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
