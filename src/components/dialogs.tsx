import { create } from 'zustand';
import { AlertTriangle, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';

/* In-app replacements for window.confirm / window.alert, which some hosts block. */

interface Pending {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  alertOnly?: boolean;
  resolve: (ok: boolean) => void;
}

const useDialog = create<{ pending: Pending | null }>(() => ({ pending: null }));

export function askConfirm(opts: { title: string; message?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    useDialog.getState().pending?.resolve(false);
    useDialog.setState({ pending: { ...opts, resolve } });
  });
}

export function notify(title: string, message?: string): Promise<void> {
  return new Promise((resolve) => {
    useDialog.getState().pending?.resolve(false);
    useDialog.setState({ pending: { title, message, alertOnly: true, resolve: () => resolve() } });
  });
}

export function DialogHost() {
  const pending = useDialog((s) => s.pending);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);
  if (!pending) return null;
  const close = (ok: boolean) => {
    pending.resolve(ok);
    useDialog.setState({ pending: null });
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="modal dialog" role="alertdialog" aria-modal="true" aria-label={pending.title}>
        <div className="dialog-body">
          <span className={`dialog-icon ${pending.danger ? 'danger' : ''}`}>{pending.danger ? <AlertTriangle size={20} /> : <Info size={20} />}</span>
          <div>
            <h2>{pending.title}</h2>
            {pending.message && <p className="muted">{pending.message}</p>}
          </div>
        </div>
        <div className="modal-actions">
          {!pending.alertOnly && (
            <button className="btn ghost" onClick={() => close(false)}>
              Cancel
            </button>
          )}
          <button ref={okRef} className={`btn ${pending.danger ? 'danger-solid' : 'primary'}`} onClick={() => close(true)}>
            {pending.alertOnly ? 'OK' : pending.confirmLabel ?? 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
