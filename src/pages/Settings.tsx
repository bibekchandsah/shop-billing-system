import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useFiscalYear } from '../context/FiscalYearContext';
import ToastContainer from '../components/ToastContainer';
import { getAppSettings, saveAppSettings, DEFAULT_SETTINGS, getFiscalYearOptions } from '../services/settingsService';
import type { AppSettings } from '../types';
import './Settings.css';

const BS_MONTH_NAMES = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  const { setActiveFiscalYear } = useFiscalYear();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [newUnit, setNewUnit] = useState('');

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const fetched = await getAppSettings(user?.uid || '');
      setSettings(fetched);
    } catch (error) {
      console.error('Error loading settings:', error);
      showError('Failed to load settings.');
    } finally {
      setLoading(false);
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
      
      await saveAppSettings(user?.uid || '', settings);
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
                <label className="label">Business Name *</label>
                <input
                  type="text"
                  className="input"
                  value={settings.businessName}
                  onChange={e => handleFieldChange('businessName', e.target.value)}
                  placeholder="e.g. Shop Billing System"
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
              <h2>Print Font Settings</h2>
            </div>
            <p className="card-desc">
              Choose the font size used when printing bills and PDFs. The last saved size is remembered and used automatically for future prints.
            </p>

            <div className="form-grid">
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
                    {settings.businessName || 'Shop Billing System'}
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

          {/* Section 5: Unit Categories */}
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

          {/* Section 6: Bill Action Shortcuts */}
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
        className="developer-badge"
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
