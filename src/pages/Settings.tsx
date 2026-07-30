import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useFiscalYear } from '../context/FiscalYearContext';
import ToastContainer from '../components/ToastContainer';
import { getAppSettings, saveAppSettings, DEFAULT_SETTINGS, getFiscalYearOptions, hashActionPin, verifyActionPin } from '../services/settingsService';
import { getUserSessions, revokeSession, revokeOtherSessions, getCurrentSessionId, type DeviceSession } from '../services/sessionService';
import { exportFullBackup } from '../utils/backupExport';
import { getDirectoryHandle, saveDirectoryHandle, deleteDirectoryHandle } from '../utils/directoryDB';
import type { AppSettings } from '../types';
import './Settings.css';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const BS_MONTH_NAMES = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

// Helper function to format time ago
const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
};

const Settings: React.FC = () => {
  const { changePassword, activeUid } = useAuth();
  const { toasts, showSuccess, showError, showToast, removeToast } = useToast();
  const { setActiveFiscalYear, refreshSettings } = useFiscalYear();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [newUnit, setNewUnit] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<'idle' | 'available' | 'installed'>('idle');
  const [installHint, setInstallHint] = useState('');
  const [developerBadgeExpanded, setDeveloperBadgeExpanded] = useState(true);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  
  // Device session management states
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [currentSessionId] = useState(getCurrentSessionId() || '');
  
  // Password change states
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Backup states
  const [backupFiscalYear, setBackupFiscalYear] = useState<string>('active');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupDirHandle, setBackupDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirPickerSupported, setDirPickerSupported] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUid]);

  useEffect(() => {
    setDirPickerSupported(typeof window !== 'undefined' && 'showDirectoryPicker' in window);
    const loadDirHandle = async () => {
      try {
        const handle = await getDirectoryHandle();
        setBackupDirHandle(handle);
      } catch (err) {
        console.error('Failed to load backup directory handle:', err);
      }
    };
    loadDirHandle();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDeveloperBadgeExpanded(false);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstallState('installed');
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      // store on window so components mounted later can access it
      (window as any).__deferredInstallPrompt = event;
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallHint('');
      setInstallState('available');
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setInstallHint('');
      setInstallState('installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If the global deferred prompt already exists (fired before this component mounted), use it
    const globalPrompt = (window as any).__deferredInstallPrompt;
    if (globalPrompt) {
      setInstallPrompt(globalPrompt as BeforeInstallPromptEvent);
      setInstallState('available');
    }

    const handleGlobalDeferred = () => {
      const gp = (window as any).__deferredInstallPrompt;
      if (gp) {
        setInstallPrompt(gp as BeforeInstallPromptEvent);
        setInstallState('available');
        setInstallHint('');
      }
    };

    const handleGlobalInstalled = () => {
      setInstallPrompt(null);
      setInstallState('installed');
      setInstallHint('');
    };

    window.addEventListener('pwa-deferred', handleGlobalDeferred as EventListener);
    window.addEventListener('pwa-installed', handleGlobalInstalled as EventListener);

    if (!('serviceWorker' in navigator) || !window.matchMedia('(display-mode: standalone)').matches && !('standalone' in window.navigator)) {
      // Keep the section visible even when the prompt is not currently available.
      setInstallState((prev) => (prev === 'installed' ? prev : 'idle'));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-deferred', handleGlobalDeferred as EventListener);
      window.removeEventListener('pwa-installed', handleGlobalInstalled as EventListener);
    };
  }, []);

  // PWA diagnostics removed — kept install UI visible and simple.

  const loadSettings = async () => {
    setLoading(true);
    try {
      const fetched = await getAppSettings(activeUid || '');
      setSettings(fetched);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (error) {
      console.error('Error loading settings:', error);
      showError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    if (!activeUid) return;
    setSessionsLoading(true);
    try {
      const fetchedSessions = await getUserSessions(activeUid);
      setSessions(fetchedSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
      showError('Failed to load device sessions.');
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!activeUid) return;
    if (!confirm('Are you sure you want to revoke this session? The device will be logged out.')) return;
    
    setRevokingSessionId(sessionId);
    try {
      await revokeSession(activeUid, sessionId);
      showSuccess('Session revoked successfully.');
      await loadSessions();
    } catch (error) {
      console.error('Error revoking session:', error);
      showError('Failed to revoke session.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!activeUid) return;
    if (!confirm('Are you sure you want to log out all other devices? Only this device will remain logged in.')) return;
    
    setSessionsLoading(true);
    try {
      await revokeOtherSessions(activeUid, currentSessionId);
      showSuccess('All other sessions have been revoked.');
      await loadSessions();
    } catch (error) {
      console.error('Error revoking sessions:', error);
      showError('Failed to revoke other sessions.');
    } finally {
      setSessionsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError('Please fill in all fields.');
      return;
    }
    
    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showError('New passwords do not match.');
      return;
    }
    
    setPasswordChanging(true);
    try {
      await changePassword(currentPassword, newPassword);
      showSuccess('Password changed successfully. All devices have been logged out for security.');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // User will be logged out after password change
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        showError('Current password is incorrect.');
      } else if (error.code === 'auth/weak-password') {
        showError('New password is too weak.');
      } else if (error.code === 'auth/requires-recent-login') {
        showError('Please log out and log in again, then try changing your password.');
      } else {
        showError('Failed to change password. Please try again.');
      }
    } finally {
      setPasswordChanging(false);
    }
  };

  const handleFieldChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Basic validation
      if (settings.billNumberFormat === 'prefix' && !settings.billNumberPrefix.trim()) {
        showError('Please enter a valid bill prefix.');
        setSaving(false);
        return;
      }
      if (!Number.isFinite(settings.maxBillNumber) || settings.maxBillNumber < 1) {
        showError('Please enter a valid maximum bill number.');
        setSaving(false);
        return;
      }
      
      await saveAppSettings(activeUid || '', settings);
      await refreshSettings();
      // Sync the fiscal year context so TopBar updates immediately
      await setActiveFiscalYear(settings.activeFiscalYear);
      showSuccess('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Generate a live billing number format preview based on current state
  const getPreviewBillNo = () => {
    const padded = '0001';
    if (settings.billNumberFormat === 'prefix') {
      return `${settings.billNumberPrefix || ''}${padded}`;
    }
    return padded;
  };

  type BillPrimaryAction = 'save' | 'pdf' | 'print';

  const getPreviewPrintFontSize = () => settings.printFontSize ?? 13;
  const primaryBillAction = settings.billPrimaryAction ?? DEFAULT_SETTINGS.billPrimaryAction;
  const unitCategories = settings.unitCategories ?? DEFAULT_SETTINGS.unitCategories;
  const maxBillNumber = settings.maxBillNumber ?? DEFAULT_SETTINGS.maxBillNumber;

  const normalizeUnit = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();

  const handleAddUnit = () => {
    const nextUnit = normalizeUnit(newUnit);
    if (!nextUnit) return;
    if (unitCategories.map(unit => unit.toUpperCase()).includes(nextUnit)) {
      showError('Unit already exists.');
      return;
    }
    handleFieldChange('unitCategories', [...unitCategories, nextUnit]);
    setNewUnit('');
  };

  const handleUpdateUnit = (index: number, value: string) => {
    const nextUnit = normalizeUnit(value);
    const updated = unitCategories.map((unit, i) => (i === index ? nextUnit : unit));
    handleFieldChange('unitCategories', updated.filter(Boolean));
  };

  const handleRemoveUnit = (index: number) => {
    handleFieldChange('unitCategories', unitCategories.filter((_, i) => i !== index));
  };

  const handlePrimaryActionChange = (value: BillPrimaryAction) => {
    setSettings(prev => {
      const updated = { ...prev, billPrimaryAction: value };
      if (value === 'save') {
        updated.billActionAutoSave = false;
      }
      if (value === 'pdf') {
        updated.billActionAutoGeneratePdf = false;
      }
      if (value === 'print') {
        updated.billActionAutoPrint = false;
      }
      return updated;
    });
  };

  const handleSavePin = async () => {
    setPinSaving(true);
    try {
      const existingHash = settings.actionPinHash;
      const hasExistingPin = Boolean(existingHash);
      const trimmedNewPin = newPin.trim();

      if (hasExistingPin) {
        if (!currentPin.trim()) {
          showError('Enter your current PIN first.');
          return;
        }

        const isValidCurrent = await verifyActionPin(currentPin, existingHash);
        if (!isValidCurrent) {
          showError('Current PIN is incorrect.');
          return;
        }
      }

      if (!trimmedNewPin) {
        if (!hasExistingPin) {
          showError('Enter a new PIN to set one.');
          return;
        }

        const updated = { ...settings, actionPinHash: undefined };
        await saveAppSettings(activeUid || '', updated);
        setSettings(updated);
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        showSuccess('Action PIN removed successfully.');
        return;
      }

      if (trimmedNewPin.length < 4) {
        showError('PIN must be at least 4 characters long.');
        return;
      }

      if (trimmedNewPin !== confirmPin.trim()) {
        showError('PIN and confirmation do not match.');
        return;
      }

      const hashed = await hashActionPin(trimmedNewPin);
      const updated = { ...settings, actionPinHash: hashed };
      await saveAppSettings(activeUid || '', updated);
      setSettings(updated);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      showSuccess(hashed ? 'Action PIN saved successfully.' : 'Action PIN cleared successfully.');
    } catch (error) {
      console.error('Error saving PIN:', error);
      showError('Failed to save action PIN.');
    } finally {
      setPinSaving(false);
    }
  };

  const handleInstallApp = async () => {
    // Try to pick up any global deferred prompt that may have been stored earlier
    let promptEvent = installPrompt ?? (window as any).__deferredInstallPrompt as BeforeInstallPromptEvent | undefined;
    if (!promptEvent) {
      // Run diagnostics to help user understand why install is unavailable
      const reasons: string[] = [];
      const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      if (!isSecure) reasons.push('App is not served over HTTPS or localhost (required for install prompt).');
      if (!('serviceWorker' in navigator)) reasons.push('Service worker support is not available in this browser.');
      else {
        try {
          const reg = await navigator.serviceWorker.getRegistration('/sw.js');
          if (!reg) reasons.push('Service worker not registered at /sw.js.');
        } catch (e) {
          reasons.push('Could not verify service worker registration.');
        }
      }

      try {
        const resp = await fetch('/manifest.json', { cache: 'no-store' });
        if (!resp.ok) reasons.push('Could not fetch manifest.json (HTTP ' + resp.status + ').');
        else {
          try {
            const manifest = await resp.json();
            if (!manifest.display || manifest.display !== 'standalone') reasons.push('Manifest `display` is not `standalone`.');
            if (!manifest.start_url) reasons.push('Manifest `start_url` is missing.');
            if (!manifest.icons || manifest.icons.length === 0) reasons.push('Manifest icons are missing.');
          } catch (e) {
            reasons.push('Manifest exists but could not be parsed as JSON.');
          }
        }
      } catch (e) {
        reasons.push('Failed to fetch manifest.json.');
      }

      const hint = reasons.length === 0
        ? 'This browser has not exposed the install prompt yet. Use the install icon in the address bar or open the browser menu and choose Install App / Add to Home Screen.'
        : 'Install prompt unavailable for these reasons: ' + reasons.join(' ');

      setInstallHint(hint);
      setInstallState(prev => (prev === 'installed' ? prev : 'idle'));
      return;
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      // Clear stored prompt after using it
      (window as any).__deferredInstallPrompt = null;
      setInstallPrompt(null);
      setInstallHint('');
      setInstallState(choice.outcome === 'accepted' ? 'installed' : 'available');
    } catch (err) {
      console.error('PWA prompt failed:', err);
      setInstallHint('Failed to show install prompt. You can try the browser menu to install the app manually.');
    }
  };

  if (loading) {
    return (
      <div className="settings-page-loading">
        <div className="settings-spinner" />
        <p>Loading your preferences...</p>
      </div>
    );
  }

  return (
    <div className="settings-page fade-in">
      <div className="container">
        <div className="settings-header">
          <h1>System Settings</h1>
          <p className="subtitle">Customize invoice formats, billing numbering, and business details</p>
        </div>

        <form onSubmit={handleSave} className="settings-form">
          {/* Section 1: Business Profile */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <h2>Business Profile Settings</h2>
            </div>
            <p className="card-desc">Configure business profile details. These details are dynamically loaded onto bill headers, thermal prints, and PDF exports.</p>
            
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="label">Bill Title</label>
                <input
                  type="text"
                  className="input"
                  value={settings.billTitle ?? 'Estimate Bill'}
                  onChange={e => handleFieldChange('billTitle', e.target.value)}
                  placeholder="e.g. Estimate Bill, Tax Invoice, Receipt"
                />
              </div>

              <div className="form-group full-width">
                <label className="label">Business Name *</label>
                <input
                  type="text"
                  className="input"
                  value={settings.businessName}
                  onChange={e => handleFieldChange('businessName', e.target.value)}
                  placeholder="e.g. Invoice Billing System"
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Business Address *</label>
                <input
                  type="text"
                  className="input"
                  value={settings.businessAddress}
                  onChange={e => handleFieldChange('businessAddress', e.target.value)}
                  placeholder="e.g. Garuda, Rautahat, Nepal"
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Business Contact Number</label>
                <input
                  type="text"
                  className="input"
                  value={settings.businessContact}
                  onChange={e => handleFieldChange('businessContact', e.target.value)}
                  placeholder="e.g. +977-98XXXXXXXX"
                />
              </div>
            </div>
            <small className="help-text">This details will appears at the top of every printed bill and downloaded PDF.</small>
          </div>

          {/* Section 2: Invoice & Numbering Settings */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <h2>Invoice Numbering & Formats</h2>
            </div>
            <p className="card-desc">Choose how bill numbers are generated and format prefixes for estimate invoices.</p>

            <div className="form-grid">
              <div className="form-group full-width">
                <label className="label">Bill Numbering Scheme</label>
                <div className="radio-group-cards">
                  <label className={`radio-card ${settings.billNumberFormat === 'numeric' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="billNumberFormat"
                      value="numeric"
                      checked={settings.billNumberFormat === 'numeric'}
                      onChange={() => handleFieldChange('billNumberFormat', 'numeric')}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>Simple Numeric</strong>
                    </div>
                    <p className="radio-card-desc">Generates plain numeric sequential billing formats. (e.g. <code>0001</code>, <code>0042</code>)</p>
                  </label>

                  <label className={`radio-card ${settings.billNumberFormat === 'prefix' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="billNumberFormat"
                      value="prefix"
                      checked={settings.billNumberFormat === 'prefix'}
                      onChange={() => handleFieldChange('billNumberFormat', 'prefix')}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>Custom Prefix Format</strong>
                    </div>
                    <p className="radio-card-desc">Integrates custom letters/prefixes in front of sequential numbers. (e.g. <code>BILL-0001</code>, <code>INV-0001</code>)</p>
                  </label>
                </div>
              </div>

              {settings.billNumberFormat === 'prefix' && (
                <div className="form-group full-width fade-in">
                  <label className="label">Custom Prefix Letters *</label>
                  <input
                    type="text"
                    className="input prefix-input"
                    value={settings.billNumberPrefix}
                    onChange={e => handleFieldChange('billNumberPrefix', e.target.value.toUpperCase())}
                    placeholder="e.g. BILL- or INV-"
                    required
                  />
                  <small className="help-text">Prefix values automatically convert to uppercase.</small>
                </div>
              )}

              {/* Dynamic Live Preview Box */}
              <div className="form-group full-width">
                <label className="label">Dynamic Live Preview</label>
                <div className="settings-preview-box">
                  <span className="preview-label">Next Bill Number:</span>
                  <strong className="preview-value">{getPreviewBillNo()}</strong>
                </div>
              </div>

              <div className="form-group full-width">
                <label className="label">Maximum Bill Number</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input"
                  value={maxBillNumber}
                  onChange={e => handleFieldChange('maxBillNumber', Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                  placeholder="e.g. 100"
                />
                <small className="help-text">
                  After this number is reached, billing restarts from <strong>0001</strong>.
                </small>
              </div>
            </div>
          </div>

          {/* Section 3: Fiscal Year Settings */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
              </svg>
              <h2>Fiscal Year Settings</h2>
            </div>
            <p className="card-desc">
              Set the active fiscal year and configure the start/end months for your business year.
              In Nepal, the standard fiscal year runs from <strong>Shrawan</strong> to <strong>Ashadh</strong>.
              All records, dashboard stats, and reports will be filtered by the active fiscal year.
            </p>

            <div className="form-grid">
              {/* Active Fiscal Year */}
              <div className="form-group full-width">
                <label className="label">Active Fiscal Year</label>
                <div className="fy-year-grid">
                  {getFiscalYearOptions().map(fy => (
                    <button
                      key={fy}
                      type="button"
                      className={`fy-year-btn ${settings.activeFiscalYear === fy ? 'active' : ''}`}
                      onClick={() => handleFieldChange('activeFiscalYear', fy)}
                    >
                      {fy}
                    </button>
                  ))}
                </div>
                <small className="help-text">
                  Selected: <strong>{settings.activeFiscalYear}</strong> — Dashboard and Records will show data for this year only.
                </small>
              </div>

              {/* Start Month */}
              <div className="form-group">
                <label className="label">Fiscal Year Start Month</label>
                <select
                  className="input"
                  value={settings.fiscalYearStart}
                  onChange={e => handleFieldChange('fiscalYearStart', Number(e.target.value))}
                >
                  {BS_MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>{name} (Month {idx + 1})</option>
                  ))}
                </select>
                <small className="help-text">The month your business year begins.</small>
              </div>

              {/* End Month */}
              <div className="form-group">
                <label className="label">Fiscal Year End Month</label>
                <select
                  className="input"
                  value={settings.fiscalYearEnd}
                  onChange={e => handleFieldChange('fiscalYearEnd', Number(e.target.value))}
                >
                  {BS_MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>{name} (Month {idx + 1})</option>
                  ))}
                </select>
                <small className="help-text">The month your business year closes.</small>
              </div>

              {/* Fiscal Year Preview */}
              <div className="form-group full-width">
                <label className="label">Fiscal Year Range Preview</label>
                <div className="settings-preview-box fy-preview-box">
                  <div className="fy-preview-item">
                    <span className="preview-label">Active Year</span>
                    <strong className="preview-value">{settings.activeFiscalYear}</strong>
                  </div>
                  <div className="fy-preview-divider" />
                  <div className="fy-preview-item">
                    <span className="preview-label">Starts</span>
                    <strong className="preview-value fy-range">
                      {BS_MONTH_NAMES[(settings.fiscalYearStart ?? 4) - 1]} {settings.activeFiscalYear.split('-')[0]}
                    </strong>
                  </div>
                  <div className="fy-preview-divider" />
                  <div className="fy-preview-item">
                    <span className="preview-label">Ends</span>
                    <strong className="preview-value fy-range">
                      {BS_MONTH_NAMES[(settings.fiscalYearEnd ?? 3) - 1]} {parseInt(settings.activeFiscalYear.split('-')[0], 10) + 1}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Print Font Settings */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V4h12v5" />
                <path d="M6 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1" />
                <path d="M6 14h12v6H6z" />
              </svg>
              <h2>Print & Font Settings</h2>
            </div>
            <p className="card-desc">
              Configure print configurations, default copy count, and font sizes used for billing invoices and PDF outputs.
            </p>

            <div className="form-grid">
              <div className="form-group full-width">
                <label className="label">Default Print Copies</label>
                <div className="radio-group-cards">
                  <label className={`radio-card ${(settings.printCopies ?? 2) === 1 ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="printCopies"
                      checked={(settings.printCopies ?? 2) === 1}
                      onChange={() => handleFieldChange('printCopies', 1)}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>1 Copy</strong>
                    </div>
                    <p className="radio-card-desc">Prints a single standard copy of the invoice.</p>
                  </label>

                  <label className={`radio-card ${(settings.printCopies ?? 2) === 2 ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="printCopies"
                      checked={(settings.printCopies ?? 2) === 2}
                      onChange={() => handleFieldChange('printCopies', 2)}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>2 Copies</strong>
                    </div>
                    <p className="radio-card-desc">Prints two copies (Customer & Office Copies) separated by a clean page break.</p>
                  </label>
                </div>
              </div>

              <div className="form-group full-width">
                <label className="label">
                  Print Font Size: <strong>{getPreviewPrintFontSize()}px</strong>
                </label>
                <input
                  type="range"
                  className="print-font-slider"
                  min={10}
                  max={20}
                  step={1}
                  value={settings.printFontSize}
                  onChange={e => handleFieldChange('printFontSize', Number(e.target.value))}
                />
                <div className="print-font-range-labels">
                  <span>Smaller</span>
                  <span>Larger</span>
                </div>
              </div>

              <div className="form-group full-width">
                <label className="label">Live Print Preview</label>
                <div className="print-font-preview">
                  <div className="print-font-preview-title" style={{ fontSize: `${getPreviewPrintFontSize() + 8}px` }}>
                    Estimate Bill
                  </div>
                  <div className="print-font-preview-subtitle" style={{ fontSize: `${Math.max(10, getPreviewPrintFontSize() + 1)}px` }}>
                    {settings.businessName || 'Invoice Billing System'}
                  </div>
                  <div className="print-font-preview-meta" style={{ fontSize: `${Math.max(9, getPreviewPrintFontSize() - 1)}px` }}>
                    Bill No: {getPreviewBillNo()} | Qty: 5 | Amount: Rs. 1,250
                  </div>
                  <div className="print-font-preview-table" style={{ fontSize: `${Math.max(9, getPreviewPrintFontSize() - 1)}px` }}>
                    <div className="preview-table-row preview-table-head">
                      <span>Particulars</span>
                      <span>Qty</span>
                      <span>Rate</span>
                      <span>Amount</span>
                    </div>
                    <div className="preview-table-row">
                      <span>Sample Item</span>
                      <span className="center">2</span>
                      <span className="center">125</span>
                      <span className="center">250</span>
                    </div>
                  </div>
                </div>
                <small className="help-text">This preview mirrors the font size used in print and PDF output.</small>
              </div>
            </div>
          </div>

          {/* Section 5: PWA / Install Support */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18" />
                <path d="M5 10h14" />
                <path d="M7 7l5-4 5 4" />
                <path d="M7 17l5 4 5-4" />
              </svg>
              <h2>Install App / PWA</h2>
            </div>
            <p className="card-desc">
              Install the billing system on supported browsers and devices. It can run like a normal app on desktop, laptop, Android, and other supported platforms.
            </p>

            <div className="pwa-panel">
              <div className="pwa-status-row">
                <div>
                  <strong className="pwa-status-title">
                    {installState === 'installed'
                      ? 'Installed'
                      : installState === 'available'
                        ? 'Ready to install'
                        : 'Installation support enabled'}
                  </strong>
                  <p className="pwa-status-text">
                    {installState === 'installed'
                      ? 'This app is already installed on this device.'
                      : installState === 'available'
                        ? 'A browser install prompt is available right now.'
                        : 'A service worker and manifest are active, so supported browsers can install this app.'}
                  </p>
                  {installHint && (
                    <p className="pwa-hint-text">{installHint}</p>
                  )}
                </div>

                {installState === 'installed' ? (
                  <span className="pwa-status-badge installed">Installed</span>
                ) : (
                  <button type="button" className="btn btn-primary pwa-install-btn" onClick={handleInstallApp}>
                    Install App
                  </button>
                )}
              </div>

              <div className="pwa-note-box">
                <div className="pwa-note-title">Works best in:</div>
                <ul className="pwa-note-list">
                  <li>Chrome, Edge, and Chromium browsers on desktop and Android</li>
                  <li>Supported mobile browsers that show the install prompt</li>
                  <li>Offline-friendly launch with the app shell cached locally</li>
                </ul>
                <small className="help-text">
                  On iPhone or iPad, open the browser share menu and choose <strong>Add to Home Screen</strong> if the install button does not appear.
                </small>
              </div>
            </div>
          </div>

          {/* Section 6: Unit Categories */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M7 12h10" />
                <path d="M10 18h4" />
              </svg>
              <h2>Unit Categories</h2>
            </div>
            <p className="card-desc">
              Add or edit unit labels used on the billing screen (e.g. CTN, BAG, PCS).
            </p>

            <div className="form-grid">
              <div className="form-group full-width">
                <label className="label">Add New Unit</label>
                <div className="unit-add-row">
                  <input
                    type="text"
                    className="input"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUnit();
                      }
                    }}
                    placeholder="e.g. CTN"
                  />
                  <button type="button" className="btn btn-primary" onClick={handleAddUnit}>
                    Add
                  </button>
                </div>
              </div>

              <div className="form-group full-width">
                <label className="label">Available Units</label>
                <div className="unit-list">
                  {unitCategories.length === 0 ? (
                    <div className="empty-state">No units yet. Add one above.</div>
                  ) : (
                    unitCategories.map((unit, index) => (
                      <div className="unit-row" key={`${unit}-${index}`}>
                        <input
                          type="text"
                          className="input"
                          value={unit}
                          onChange={(e) => handleUpdateUnit(index, e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveUnit(index)}
                          title="Remove unit"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <small className="help-text">These units appear in the quantity dropdown on the billing form.</small>
              </div>
            </div>
          </div>

          {/* Section 7: Device Sessions & Security */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <h2>Device Sessions & Security</h2>
            </div>
            <p className="card-desc">
              View and manage devices where you're currently logged in. You can revoke access from unfamiliar devices for security.
            </p>

            <div className="form-grid">
              {/* Password Change Section */}
              <div className="form-group full-width">
                <div className="sessions-header">
                  <h3 className="sessions-title">Change Password</h3>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                  >
                    {showPasswordChange ? 'Cancel' : 'Change Password'}
                  </button>
                </div>
                {showPasswordChange && (
                  <div className="password-change-form fade-in">
                    <div>
                      <div className="form-group">
                        <label className="label">Current Password *</label>
                        <input
                          type="password"
                          className="input"
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          disabled={passwordChanging}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">New Password *</label>
                        <input
                          type="password"
                          className="input"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min 6 characters)"
                          disabled={passwordChanging}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">Confirm New Password *</label>
                        <input
                          type="password"
                          className="input"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          disabled={passwordChanging}
                          required
                        />
                      </div>
                      <div className="password-change-warning">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>Changing your password will log you out from all devices for security.</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handlePasswordChange}
                        disabled={passwordChanging}
                      >
                        {passwordChanging ? 'Changing Password...' : 'Change Password'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Sessions Section */}
              <div className="form-group full-width">
                <div className="sessions-header">
                  <h3 className="sessions-title">Active Device Sessions ({sessions.length})</h3>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger-outline"
                      onClick={handleRevokeOtherSessions}
                      disabled={sessionsLoading}
                    >
                      Logout All Other Devices
                    </button>
                  )}
                </div>
                <small className="help-text" style={{ marginBottom: '1rem', display: 'block' }}>
                  These are the devices currently logged into your account. Revoke access from unfamiliar devices.
                </small>

                {sessionsLoading ? (
                  <div className="sessions-loading">
                    <div className="settings-spinner" />
                    <p>Loading sessions...</p>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="sessions-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <p>No active sessions found</p>
                  </div>
                ) : (
                  <div className="sessions-list">
                    {sessions.map(session => {
                      const isCurrentSession = session.id === currentSessionId;
                      const timeAgo = getTimeAgo(session.lastActive);
                      
                      return (
                        <div key={session.id} className={`session-item ${isCurrentSession ? 'current-session' : ''}`}>
                          <div className="session-icon">
                            {(session.os || '').includes('Windows') || (session.os || '').includes('Mac') || (session.os || '').includes('Linux') ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                              </svg>
                            ) : (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="5" y="2" width="14" height="20" rx="2" />
                                <line x1="12" y1="18" x2="12.01" y2="18" />
                              </svg>
                            )}
                          </div>
                          <div className="session-info">
                            <div className="session-device">
                              {session.deviceName || 'Unknown Device'}
                              {isCurrentSession && <span className="current-badge">Current Device</span>}
                            </div>
                            <div className="session-meta">
                              <span>{session.ipAddress || 'Unknown IP'}</span>
                              <span>•</span>
                              <span>Last active {timeAgo}</span>
                            </div>
                          </div>
                          {!isCurrentSession && (
                            <button
                              type="button"
                              className="btn-revoke"
                              onClick={() => handleRevokeSession(session.id)}
                              disabled={revokingSessionId === session.id}
                              title="Revoke this session"
                            >
                              {revokingSessionId === session.id ? (
                                <span className="login-spinner" />
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 8: Action PIN */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V8a5 5 0 0 1 10 0v3" />
              </svg>
              <h2>Action PIN</h2>
            </div>
            <p className="card-desc">
              Protect edit and delete actions with a PIN. When set, users must enter the PIN before opening edit or delete flows.
            </p>

            <div className="form-grid">
              <div className="form-group full-width">
                <div className="settings-preview-box" style={{ justifyContent: 'space-between' }}>
                  <span className="preview-label">PIN Status</span>
                  <strong className="preview-value">{settings.actionPinHash ? 'PIN Enabled' : 'No PIN Set'}</strong>
                </div>
              </div>

              {settings.actionPinHash && (
                <div className="form-group full-width">
                  <label className="label">Current PIN *</label>
                  <input
                    type="password"
                    className="input"
                    name="current-action-pin"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value)}
                    placeholder="Enter current PIN"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="label">New PIN {settings.actionPinHash ? '(leave blank to remove)' : '*'}</label>
                <input
                  type="password"
                  className="input"
                  name="new-action-pin"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  placeholder="Enter new PIN"
                />
              </div>

              <div className="form-group">
                <label className="label">Confirm New PIN</label>
                <input
                  type="password"
                  className="input"
                  name="confirm-action-pin"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  placeholder="Re-enter new PIN"
                />
              </div>

              <div className="form-group full-width">
                <small className="help-text">
                  Leave the new PIN empty and save to remove the current PIN. PINs are stored securely as hashes.
                </small>
              </div>

              <div className="form-group full-width">
                <button type="button" className="btn btn-primary" onClick={handleSavePin} disabled={pinSaving}>
                  {pinSaving ? 'Saving PIN...' : settings.actionPinHash ? 'Update / Remove PIN' : 'Save PIN'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 8: Bill Action Shortcuts */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V4h12v5" />
                <path d="M6 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1" />
                <path d="M6 14h12v6H6z" />
              </svg>
              <h2>Bill Action Shortcuts</h2>
            </div>
            <p className="card-desc">
              Choose the primary billing button. When that button is clicked, it can also run the extra actions you enable below.
            </p>

            <div className="form-grid">
              <div className="form-group full-width">
                <label className="label">Primary Button</label>
                <div className="radio-group-cards action-primary-grid">
                  <label className={`radio-card ${primaryBillAction === 'save' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="billPrimaryAction"
                      value="save"
                      checked={primaryBillAction === 'save'}
                      onChange={() => handlePrimaryActionChange('save')}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>Save Bill</strong>
                    </div>
                    <p className="radio-card-desc">Make Save Bill the main button on the billing screen.</p>
                  </label>

                  <label className={`radio-card ${primaryBillAction === 'pdf' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="billPrimaryAction"
                      value="pdf"
                      checked={primaryBillAction === 'pdf'}
                      onChange={() => handlePrimaryActionChange('pdf')}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>Generate PDF</strong>
                    </div>
                    <p className="radio-card-desc">Make Generate PDF the main button on the billing screen.</p>
                  </label>

                  <label className={`radio-card ${primaryBillAction === 'print' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="billPrimaryAction"
                      value="print"
                      checked={primaryBillAction === 'print'}
                      onChange={() => handlePrimaryActionChange('print')}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>Print</strong>
                    </div>
                    <p className="radio-card-desc">Make Print the main button on the billing screen.</p>
                  </label>
                </div>
                <small className="help-text">The primary action always runs on click.</small>
              </div>

              <div className="form-group full-width">
                <label className="label">Also Run These Actions</label>
                <div className="action-toggle-grid">
                  <label className={`action-toggle ${primaryBillAction === 'save' ? 'disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={settings.billActionAutoSave}
                      disabled={primaryBillAction === 'save'}
                      onChange={e => handleFieldChange('billActionAutoSave', e.target.checked)}
                    />
                    <div>
                      <strong>Save Bill</strong>
                      <span>Saves to records before other actions.</span>
                    </div>
                  </label>

                  <label className={`action-toggle ${primaryBillAction === 'pdf' ? 'disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={settings.billActionAutoGeneratePdf}
                      disabled={primaryBillAction === 'pdf'}
                      onChange={e => handleFieldChange('billActionAutoGeneratePdf', e.target.checked)}
                    />
                    <div>
                      <strong>Generate PDF</strong>
                      <span>Automatically downloads the bill PDF.</span>
                    </div>
                  </label>

                  <label className={`action-toggle ${primaryBillAction === 'print' ? 'disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={settings.billActionAutoPrint}
                      disabled={primaryBillAction === 'print'}
                      onChange={e => handleFieldChange('billActionAutoPrint', e.target.checked)}
                    />
                    <div>
                      <strong>Print</strong>
                      <span>Opens the print dialog after the primary action.</span>
                    </div>
                  </label>

                  <label className="action-toggle">
                    <input
                      type="checkbox"
                      checked={settings.billActionAutoClear}
                      onChange={e => handleFieldChange('billActionAutoClear', e.target.checked)}
                    />
                    <div>
                      <strong>Clear Form</strong>
                      <span>Resets the billing form after all actions finish.</span>
                    </div>
                  </label>
                </div>
                <small className="help-text">Extra actions run only after the primary action succeeds.</small>
              </div>
            </div>
          </div>

          {/* Section: Data Backup */}
          <div className="settings-card card">
            <div className="card-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <h2>Data Backup</h2>
            </div>
            <p className="card-desc">
              Export all your records, stock, customers, and party data as a backup file.
              A single <strong>.xlsx</strong> file (6 sheets) is created for one fiscal year, or a <strong>.zip</strong> of per-year Excel files for All Years.
            </p>

            <div className="form-grid">
              <div className="form-group full-width">
                <label className="label">Backup Scope</label>
                <div className="radio-group-cards">
                  <label className={`radio-card ${backupFiscalYear === 'all' ? 'active' : ''}`}>
                    <input type="radio" name="backupScope" value="all"
                      checked={backupFiscalYear === 'all'}
                      onChange={() => setBackupFiscalYear('all')}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>All Years</strong>
                    </div>
                    <p className="radio-card-desc">Exports every record regardless of fiscal year.</p>
                  </label>

                  <label className={`radio-card ${backupFiscalYear === 'active' ? 'active' : ''}`}>
                    <input type="radio" name="backupScope" value="active"
                      checked={backupFiscalYear === 'active'}
                      onChange={() => setBackupFiscalYear('active')}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>Active Fiscal Year</strong>
                    </div>
                    <p className="radio-card-desc">Exports only data from the currently active fiscal year ({settings.activeFiscalYear}).</p>
                  </label>

                  <label className={`radio-card ${backupFiscalYear !== 'all' && backupFiscalYear !== 'active' ? 'active' : ''}`}>
                    <input type="radio" name="backupScope" value="custom"
                      checked={backupFiscalYear !== 'all' && backupFiscalYear !== 'active'}
                      onChange={() => setBackupFiscalYear(getFiscalYearOptions()[0])}
                      style={{ display: 'none' }}
                    />
                    <div className="radio-card-header">
                      <span className="radio-dot" />
                      <strong>Specific Fiscal Year</strong>
                    </div>
                    <p className="radio-card-desc">Select a specific year to export.</p>
                  </label>
                </div>
              </div>

              {backupFiscalYear !== 'all' && backupFiscalYear !== 'active' && (
                <div className="form-group full-width fade-in">
                  <label className="label">Select Fiscal Year</label>
                  <div className="fy-year-grid">
                    {getFiscalYearOptions().map(fy => (
                      <button
                        key={fy}
                        type="button"
                        className={`fy-year-btn ${backupFiscalYear === fy ? 'active' : ''}`}
                        onClick={() => setBackupFiscalYear(fy)}
                      >
                        {fy}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group full-width">
                <div className="settings-preview-box" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <span className="preview-label">Backup Includes: </span>
                    <strong className="preview-value" style={{ color: 'var(--primary)', textTransform: 'none' }}>
                      bills | particulars list | stock | customer list | customer | parties list | parties
                    </strong>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span className="preview-label">Fiscal Year: </span>
                    <strong className="preview-value">
                      {backupFiscalYear === 'all' ? 'All Years' : backupFiscalYear === 'active' ? settings.activeFiscalYear : backupFiscalYear}
                    </strong>
                  </div>
                </div>
              </div>

              {dirPickerSupported && (
                <div className="form-group full-width fade-in">
                  <label className="label">Backup Destination Folder</label>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '200px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Choose where backups will be automatically saved:
                      </span>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {backupDirHandle ? `Selected Directory: ${backupDirHandle.name}` : 'Default (Downloads folder or Save As dialog)'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={async () => {
                          try {
                            const handle = await (window as any).showDirectoryPicker();
                            await saveDirectoryHandle(handle);
                            setBackupDirHandle(handle);
                            showSuccess('Backup directory path updated successfully!');
                          } catch (err: any) {
                            if (err.name !== 'AbortError') {
                              console.error(err);
                              showError('Failed to select directory.');
                            }
                          }
                        }}
                      >
                        {backupDirHandle ? 'Change Folder' : 'Select Folder'}
                      </button>
                      {backupDirHandle && (
                        <button
                          type="button"
                          className="btn btn-danger-action"
                          style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', border: 'none', background: '#ef4444', color: '#fff' }}
                          onClick={async () => {
                            try {
                              await deleteDirectoryHandle();
                              setBackupDirHandle(null);
                              showSuccess('Backup destination reset to default.');
                            } catch (err) {
                              console.error(err);
                              showError('Failed to reset backup path.');
                            }
                          }}
                        >
                          Reset to Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Backup Reminder Section */}
              <div className="form-group full-width" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <label className="label">Automatic Backup Reminder</label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                      Reminder Frequency:
                    </span>
                    <select
                      className="input"
                      value={settings.backupReminderFrequency || 'none'}
                      onChange={e => handleFieldChange('backupReminderFrequency', e.target.value as any)}
                    >
                      <option value="none">None (Disabled)</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {settings.backupReminderFrequency && settings.backupReminderFrequency !== 'none' && (
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                        Reminder Time (HH:MM):
                      </span>
                      <input
                        type="time"
                        className="input"
                        value={settings.backupReminderTime || '17:00'}
                        onChange={e => handleFieldChange('backupReminderTime', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group full-width">
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  disabled={backupLoading}
                  onClick={async () => {
                    if (!activeUid) return;

                    // Request permission synchronously inside user click gesture before starting async work
                    if (backupDirHandle) {
                      try {
                        const options = { mode: 'readwrite' as const };
                        if ((await (backupDirHandle as any).queryPermission(options)) !== 'granted') {
                          if ((await (backupDirHandle as any).requestPermission(options)) !== 'granted') {
                            showError('Permission to write to the backup directory was denied.');
                            return;
                          }
                        }
                      } catch (err) {
                        console.error('Failed to query folder permission:', err);
                        showError('Failed to access selected directory. Please try selecting it again.');
                        return;
                      }
                    }

                    setBackupLoading(true);
                    const progressToastId = showToast('info', 'Exporting Backup...', 0);
                    try {
                      const fy = backupFiscalYear === 'active' ? settings.activeFiscalYear : backupFiscalYear === 'all' ? undefined : backupFiscalYear;
                      await exportFullBackup(activeUid, settings.businessName, {
                        fiscalYear: fy,
                        startMonth: settings.fiscalYearStart ?? 4,
                        endMonth: settings.fiscalYearEnd ?? 3,
                        directoryHandle: backupDirHandle,
                      });
                      removeToast(progressToastId);
                      showSuccess(backupDirHandle ? `Backup saved to "${backupDirHandle.name}" folder successfully!` : 'Backup downloaded successfully!');
                      
                      if (settings.backupReminderFrequency && settings.backupReminderFrequency !== 'none') {
                        const d = new Date();
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        let periodKey = '';
                        if (settings.backupReminderFrequency === 'daily') {
                          periodKey = `${year}-${month}-${String(d.getDate()).padStart(2, '0')}`;
                        } else if (settings.backupReminderFrequency === 'monthly') {
                          periodKey = `${year}-${month}`;
                        } else {
                          const firstDay = new Date(year, 0, 1);
                          const pastDays = (d.getTime() - firstDay.getTime()) / 86400000;
                          const weekNum = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
                          periodKey = `${year}-W${weekNum}`;
                        }
                        localStorage.setItem(`last_backup_completed_${activeUid}`, periodKey);
                      }
                    } catch (err) {
                      console.error('Backup error:', err);
                      removeToast(progressToastId);
                      showError('Failed to export backup. Please try again.');
                    } finally {
                      setBackupLoading(false);
                    }
                  }}
                >
                  {backupLoading ? (
                    <>
                      <div className="btn-spinner" />
                      Exporting Backup...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {backupFiscalYear === 'all' ? 'Download Backup (.zip)' : 'Download Backup (.xlsx)'}
                    </>
                  )}
                </button>
                <small className="help-text" style={{ marginTop: '0.5rem', display: 'block' }}>
                  The backup file can be used to restore or migrate your data. Keep it in a safe location.
                </small>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="settings-actions">            <button
              type="submit"
              className="btn btn-success btn-large"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="btn-spinner" />
                  Saving Preferences...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save Configurations
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <a
        className={`developer-badge ${developerBadgeExpanded ? 'developer-badge-expanded' : ''}`}
        href="https://www.bibekchandsah.com.np/"
        target="_blank"
        rel="noopener noreferrer"
        title="Developer: Bibek Chand Sah"
        aria-label="Open developer website"
      >
        <img
          src="https://bibekchandsah.github.io/kiitcse/assets/image/developer.jpg"
          alt="Developer"
          className="developer-badge-image"
        />
        <span className="developer-badge-text">Developed by Bibek</span>
      </a>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default Settings;
