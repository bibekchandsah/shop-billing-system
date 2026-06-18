import { useMemo, useState } from 'react';
import { verifyActionPin } from '../services/settingsService';

interface GuardedAction {
  label: string;
  onConfirm: () => void | Promise<void>;
}

interface UseActionPinGuardOptions {
  pinHash?: string;
  showError: (message: string) => void;
}

export const useActionPinGuard = ({ pinHash, showError }: UseActionPinGuardOptions) => {
  const [pendingAction, setPendingAction] = useState<GuardedAction | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const requiresPin = useMemo(() => Boolean(pinHash), [pinHash]);

  const close = () => {
    setIsOpen(false);
    setBusy(false);
    setPinValue('');
    setPinError('');
    setPendingAction(null);
  };

  const requestAction = async (action: GuardedAction) => {
    if (!requiresPin) {
      await action.onConfirm();
      return true;
    }

    setPendingAction(action);
    setPinValue('');
    setPinError('');
    setIsOpen(true);
    return false;
  };

  const submitPin = async () => {
    if (!pendingAction || !pinHash) {
      close();
      return;
    }

    const normalized = pinValue.trim();
    if (!normalized) {
      const message = 'Please enter the PIN.';
      setPinError(message);
      showError(message);
      return;
    }

    setBusy(true);
    try {
      const valid = await verifyActionPin(normalized, pinHash);
      if (!valid) {
        const message = 'Invalid PIN.';
        setPinError(message);
        showError(message);
        return;
      }

      const action = pendingAction;
      close();
      await action.onConfirm();
    } catch (error) {
      console.error('PIN verification failed:', error);
      const message = 'Failed to verify PIN.';
      setPinError(message);
      showError(message);
    } finally {
      setBusy(false);
    }
  };

  const pinPrompt = isOpen ? (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2>Enter PIN</h2>
          <button className="modal-close" onClick={close} type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
            Enter your action PIN to continue{pendingAction?.label ? ` with ${pendingAction.label}` : ''}.
          </p>
          <div className="form-group">
            <label className="label">PIN</label>
            <input
              type="password"
              className="input"
              name="action-pin"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={pinValue}
              onChange={(e) => {
                setPinValue(e.target.value);
                setPinError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitPin();
                }
              }}
              placeholder="Enter PIN"
              autoFocus
            />
            {pinError && <div style={{ color: '#b91c1c', marginTop: '0.5rem', fontSize: '0.875rem' }}>{pinError}</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-success" type="button" onClick={() => void submitPin()} disabled={busy}>
            {busy ? 'Verifying...' : 'Continue'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={close} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { requestAction, pinPrompt, requiresPin };
};
