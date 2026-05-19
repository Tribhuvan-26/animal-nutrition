'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PhotoMasonry from '@/app/components/PhotoMasonry';

export default function Home() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

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

  function clearFile() {
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <main>
      <div className="card-overlay">
        <div className="card">
        <div className="header">
          <div className="logo">📒</div>
          <div className="header-text">
            <h1>Sales Ledger to Sheet</h1>
            <p className="subtitle">Upload a daily ledger photo. Gemini reads it, rows fill in your Google Sheet.</p>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">Logout</button>
        </div>

        <label
          className={`dropzone ${dragging ? 'dragging' : ''} ${previewUrl ? 'has-preview' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="Ledger preview" className="preview" />
              <button type="button" className="clear-btn" onClick={(e) => { e.preventDefault(); clearFile(); }}>✕</button>
            </>
          ) : (
            <div className="drop-empty">
              <div className="drop-icon">📄</div>
              <div className="drop-title">Drop a ledger photo</div>
              <div className="drop-hint">or click to browse</div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        <button className="submit-btn" onClick={onSubmit} disabled={!file || status?.type === 'loading'}>
          {status?.type === 'loading' ? (
            <><span className="spinner" /> Working...</>
          ) : (
            <>Log to sheet →</>
          )}
        </button>

        {status && (
          <div className={`status ${status.type}`}>
            <div className="status-message">{status.message}</div>

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
                  return (
                    <div className="result-row-grid" key={i}>
                      <span className="rg-num">{i + 1}</span>
                      <span className="rg-name" title={e.name}>{e.name}</span>
                      <span className="rg-gemini" title={e.items}>{e.items || '—'}</span>
                      <span className="rg-written" title={writtenItem}>{writtenItem || '(blank)'}</span>
                      <span className="rg-amount">{e.amount}</span>
                      <span className="rg-status">{e.paid_or_not || '—'}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {status.result && (status.result.sheetsAvailable !== undefined || status.result.chipFound !== undefined) && (
              <div className="diagnostics">
                <span className="diag-pill">
                  Sheets API: <b className={status.result.sheetsAvailable ? 'ok' : 'bad'}>{status.result.sheetsAvailable ? 'on' : 'off'}</b>
                </span>
                <span className="diag-pill">
                  Chip template: <b className={status.result.chipFound ? 'ok' : 'bad'}>{status.result.chipFound ? 'found' : 'missing'}</b>
                </span>
                <span className="diag-pill">
                  API calls: <b>{status.result.apiRequestCount ?? 0}</b> · applied <b className={status.result.apiUsed ? 'ok' : 'bad'}>{status.result.apiUsed ? 'yes' : 'no'}</b>
                </span>
                {status.result.apiError && (
                  <div className="diag-error">API error: {status.result.apiError}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      </div>

      <PhotoMasonry columns={4} />

      <div className="footer">
        Pushes to <a href="https://docs.google.com/spreadsheets/d/1hnrfkJXN8Irf3YbTt6h14vTWz72BnEJgN48LM9OdNDc/edit" target="_blank" rel="noreferrer">your Google Sheet</a> via Apps Script + Gemini 2.5 Flash
      </div>
    </main>
  );
}
