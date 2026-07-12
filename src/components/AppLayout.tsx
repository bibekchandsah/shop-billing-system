import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import { useFiscalYear } from '../context/FiscalYearContext';
import { useAuth } from '../context/AuthContext';
import { exportFullBackup } from '../utils/backupExport';
import { getDirectoryHandle } from '../utils/directoryDB';
import ToastContainer, { type ToastMessage } from './ToastContainer';
import './AppLayout.css';
import './Sidebar.css';

// ── Premium Tooltip Content ───────────────────────────────────────────────────
const TOOLTIP_CONTENT: Record<string, { label: string; description: string; tag: string }> = {
  'Home': {
    label: 'Home',
    description: 'Pro Dashboard — Real-time billing analytics, daily sales tracking, and secure business summaries.',
    tag: '⚡ PRO ANALYTICS'
  },
  'Dashboard': {
    label: 'Dashboard',
    description: 'Business Overview — See billing, records, stock, and settings summaries in one screen.',
    tag: '📊 OVERVIEW'
  },
  'Create Bill': {
    label: 'Create Bill',
    description: 'Smart Invoice — Dual English/Nepali calendar support, automated VAT/Discount math, and instant print/PDF downloads.',
    tag: '✨ SMART BILLING'
  },
  'Quick Entry': {
    label: 'Quick Entry',
    description: 'Fast entry panel to add stock particulars, stock transactions, customer profiles, customer transactions, party profiles, and party transactions in one click.',
    tag: '⚡ QUICK ACTIONS'
  },
  'Records': {
    label: 'Records',
    description: 'Advanced Archive — Complete billing history, dynamic filters, secure Firestore backups, and print re-generation.',
    tag: '🔒 SECURE DATABASE'
  },
  'Stock': {
    label: 'Stock Ledger',
    description: 'Inventory Control — Track stock levels, maintain credit/debit records, and view full particulars transaction ledgers.',
    tag: '📦 INVENTORY MANAGER'
  },
  'Customers': {
    label: 'Customers',
    description: 'Customer Ledger — Track bill-linked entries, running balances, and editable customer details.',
    tag: '🧾 CUSTOMER ACCOUNTS'
  },
  'Parties': {
    label: 'Party Ledger',
    description: 'Track party dues, payments, and balances in one place.',
    tag: '🏷️ LEDGER'
  },
  'Settings': {
    label: 'Settings',
    description: 'Configuration — Set invoice formats, custom prefixes, and update company profile settings.',
    tag: '⚙️ CONFIGURATION'
  }
};


// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    to: '/create-bill',
    label: 'Create Bill',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
  {
    to: '/quick-entry',
    label: 'Quick Entry',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
  },
  {
    to: '/records',
    label: 'Records',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    to: '/stock',
    label: 'Stock',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    to: '/customers',
    label: 'Customers',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/parties',
    label: 'Parties',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 20h18" />
        <path d="M5 20V8l7-4 7 4v12" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { settings } = useFiscalYear();
  const [layoutToasts, setLayoutToasts] = useState<ToastMessage[]>([]);

  // Period key generator for daily/weekly/monthly periods
  const getPeriodKey = (frequency: 'daily' | 'weekly' | 'monthly'): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    
    if (frequency === 'daily') {
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    if (frequency === 'monthly') {
      return `${year}-${month}`;
    }
    
    // Weekly
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNum}`;
  };

  const triggerGlobalBackup = async () => {
    if (!user?.uid || !settings) return;
    
    let dirHandle: FileSystemDirectoryHandle | null = null;
    try {
      dirHandle = await getDirectoryHandle();
    } catch (err) {
      console.error('Failed to load directory handle for reminder backup:', err);
    }

    if (dirHandle) {
      try {
        const options = { mode: 'readwrite' as const };
        if ((await (dirHandle as any).queryPermission(options)) !== 'granted') {
          if ((await (dirHandle as any).requestPermission(options)) !== 'granted') {
            const errToastId = Date.now().toString();
            setLayoutToasts(prev => [...prev, { id: errToastId, type: 'error', message: 'Permission to write to the backup directory was denied.' }]);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to get permission in reminder:', err);
        const errToastId = Date.now().toString();
        setLayoutToasts(prev => [...prev, { id: errToastId, type: 'error', message: 'Failed to access selected directory.' }]);
        return;
      }
    }

    const progressToastId = Date.now().toString();
    setLayoutToasts(prev => [...prev, { id: progressToastId, type: 'info', duration: 0, message: 'Exporting Backup...' }]);
    
    try {
      await exportFullBackup(user.uid, settings.businessName, {
        fiscalYear: settings.activeFiscalYear,
        startMonth: settings.fiscalYearStart ?? 4,
        endMonth: settings.fiscalYearEnd ?? 3,
        directoryHandle: dirHandle,
      });
      setLayoutToasts(prev => prev.filter(t => t.id !== progressToastId));
      
      // Mark as completed for this period
      if (settings.backupReminderFrequency && settings.backupReminderFrequency !== 'none') {
        const periodKey = getPeriodKey(settings.backupReminderFrequency);
        localStorage.setItem(`last_backup_completed_${user.uid}`, periodKey);
      }
      
      // Remove any active reminder toasts
      setLayoutToasts(prev => prev.filter(t => t.id !== 'backup-reminder-toast'));

      const successId = Date.now().toString();
      setLayoutToasts(prev => [...prev, {
        id: successId,
        type: 'success',
        message: dirHandle 
          ? `Backup saved to "${dirHandle.name}" folder successfully!` 
          : 'Backup downloaded successfully!'
      }]);
    } catch (err) {
      console.error('Reminder backup error:', err);
      setLayoutToasts(prev => prev.filter(t => t.id !== progressToastId));
      const errorId = Date.now().toString();
      setLayoutToasts(prev => [...prev, { id: errorId, type: 'error', message: 'Failed to export backup. Please try again.' }]);
    }
  };

  useEffect(() => {
    console.log('[BackupReminder] Hook triggered', {
      uid: user?.uid,
      hasSettings: !!settings,
      frequency: settings?.backupReminderFrequency,
      time: settings?.backupReminderTime
    });

    if (!user?.uid || !settings || !settings.backupReminderFrequency || settings.backupReminderFrequency === 'none') {
      return;
    }

    const frequency = settings.backupReminderFrequency;

    const checkReminder = () => {
      const periodKey = getPeriodKey(frequency);
      const lastCompleted = localStorage.getItem(`last_backup_completed_${user.uid}`);
      const dismissedTimeStr = localStorage.getItem(`backup_reminder_dismissed_time_${user.uid}`);
      
      let shouldShow = lastCompleted !== periodKey;

      if (shouldShow && dismissedTimeStr) {
        const dismissedTime = Number(dismissedTimeStr);
        const elapsed = Date.now() - dismissedTime;
        if (elapsed < 20 * 60 * 1000) { // 20 minutes grace period
          shouldShow = false;
        }
      }

      console.log('[BackupReminder] Running check', {
        periodKey,
        lastCompleted,
        dismissedTimeStr,
        shouldShow
      });

      // If backup is missing for current period, we show reminder instantly
      if (shouldShow) {
        // Use functional state update to inspect current toasts without requiring layoutToasts in effect dependencies
        setLayoutToasts((prev) => {
          const hasReminder = prev.some(t => t.id === 'backup-reminder-toast');
          if (hasReminder) {
            return prev;
          }
          console.log('[BackupReminder] Dispatching toast reminder');
          
          const newToast: ToastMessage = {
            id: 'backup-reminder-toast',
            type: 'warning',
            duration: 0, // stay open until manually closed
            message: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Backup Reminder
                </strong>
                <span style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  You haven't backed up your billing data for this period yet.
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', border: 'none', background: 'var(--primary)', color: '#fff' }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setLayoutToasts((currentToasts) => currentToasts.filter((t) => t.id !== 'backup-reminder-toast'));
                      await triggerGlobalBackup();
                    }}
                  >
                    Backup Now
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.setItem(`backup_reminder_dismissed_time_${user.uid}`, Date.now().toString());
                      setLayoutToasts((currentToasts) => currentToasts.filter((t) => t.id !== 'backup-reminder-toast'));
                    }}
                  >
                    Remind Later
                  </button>
                </div>
              </div>
            )
          };
          return [...prev, newToast];
        });
      } else {
        // If it's already completed or dismissed, make sure any active reminder is cleared
        setLayoutToasts(prev => prev.filter(t => t.id !== 'backup-reminder-toast'));
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 60000); // Check every 1 minute
    return () => clearInterval(interval);
  }, [user?.uid, settings]);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const [activeTooltip, setActiveTooltip] = useState<{
    label: string;
    description: string;
    tag: string;
    x: number;
    y: number;
  } | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef<any>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>, label: string) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    const content = TOOLTIP_CONTENT[label];
    if (!content) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      label: content.label,
      description: content.description,
      tag: content.tag,
      x: rect.right + 12,
      y: rect.top + rect.height / 2,
    });
    
    tooltipTimeoutRef.current = setTimeout(() => {
      setIsTooltipVisible(true);
    }, 50);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setIsTooltipVisible(false);
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className={`app-layout ${collapsed ? 'layout-collapsed' : ''}`}>

      {/* ── TOP STRIP: brand + collapse + page title (same background row) ── */}
      <div className="app-top-strip">
        {/* Brand section — same width as sidebar nav */}
        <div className={`strip-brand ${collapsed ? 'strip-brand-collapsed' : ''}`}>
          <Link to="/" className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-store" aria-hidden="true">
                <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
                <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />
                <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />
              </svg>
            </div>
            {!collapsed && <span className="sidebar-brand-text">Invoice Billing</span>}
          </Link>

          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* TopBar — fills the rest of the strip */}
        <TopBar onMobileMenuOpen={() => setMobileOpen(v => !v)} mobileOpen={mobileOpen} />
      </div>

      {/* ── BODY: nav panel + content ──────────────────────────────────────── */}
      <div className="app-body">

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
        )}

        {/* Nav panel */}
        <div className={`sidebar-nav-panel ${mobileOpen ? 'sidebar-nav-panel-open' : ''}`}>
          <nav className="sidebar-nav sidebar-nav-shell sidebar-nav-stack" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0.75rem 0.625rem 1.5rem', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`sidebar-nav-item ${isActive(item.to) ? 'active' : ''}`}
                  // style={{ display: item.label === 'Quick Entry' ? 'none' : undefined }}
                  onMouseEnter={e => handleMouseEnter(e, item.label)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => {
                    handleMouseLeave();
                    setMobileOpen(false);
                  }}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                  {isActive(item.to) && <span className="sidebar-active-pill" />}
                </Link>
              ))}
            </div>

            <div className="sidebar-settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--sidebar-border)' }}>
              <Link
                to="/settings"
                className={`sidebar-nav-item ${isActive('/settings') ? 'active' : ''}`}
                onMouseEnter={e => handleMouseEnter(e, 'Settings')}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  handleMouseLeave();
                  setMobileOpen(false);
                }}
              >
                <span className="sidebar-nav-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
                {!collapsed && <span className="sidebar-nav-label">Settings</span>}
                {isActive('/settings') && <span className="sidebar-active-pill" />}
              </Link>
            </div>
          </nav>
        </div>

        {/* Content panel */}
        <main className="app-content">
          {children}
        </main>
      </div>

      {activeTooltip && createPortal(
        <div
          className={`premium-tooltip ${isTooltipVisible ? 'visible' : ''}`}
          style={{
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
          }}
        >
          {activeTooltip.label}
        </div>,
        document.body
      )}
      <ToastContainer
        toasts={layoutToasts}
        onRemove={(id) => {
          if (id === 'backup-reminder-toast' && user?.uid) {
            localStorage.setItem(`backup_reminder_dismissed_time_${user.uid}`, Date.now().toString());
          }
          setLayoutToasts((prev) => prev.filter((t) => t.id !== id));
        }}
      />
    </div>
  );
};

export default AppLayout;
