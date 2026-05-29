import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFiscalYear } from '../context/FiscalYearContext';
import type { Theme } from '../types';
import ProfilePhotoModal from './ProfilePhotoModal';
import './TopBar.css';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];

const THEME_META: Record<Theme, { label: string; icon: React.ReactNode }> = {
  light: {
    label: 'Light',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  dark: {
    label: 'Dark',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  },
  system: {
    label: 'System',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
};

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/create-bill': 'Create Bill',
  '/records': 'Records',
  '/stock': 'Stock',
  '/settings': 'Settings',
};

interface TopBarProps {
  onMobileMenuOpen: () => void;
  mobileOpen?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ onMobileMenuOpen, mobileOpen = false }) => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout, photoData } = useAuth();
  const { activeFiscalYear, fiscalYearOptions, setActiveFiscalYear, loading: fyLoading } = useFiscalYear();
  const [profileOpen, setProfileOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [fyDropdownOpen, setFyDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const fyRef = useRef<HTMLDivElement>(null);

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Shop Billing';

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  const getInitials = () => {
    if (user?.displayName)
      return user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    return user?.email?.[0].toUpperCase() ?? '?';
  };

  // Navigate to previous fiscal year
  const handlePrevFY = async () => {
    const idx = fiscalYearOptions.indexOf(activeFiscalYear);
    if (idx > 0) await setActiveFiscalYear(fiscalYearOptions[idx - 1]);
  };

  // Navigate to next fiscal year
  const handleNextFY = async () => {
    const idx = fiscalYearOptions.indexOf(activeFiscalYear);
    if (idx < fiscalYearOptions.length - 1) await setActiveFiscalYear(fiscalYearOptions[idx + 1]);
  };

  const currentFYIndex = fiscalYearOptions.indexOf(activeFiscalYear);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (fyRef.current && !fyRef.current.contains(e.target as Node)) {
        setFyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
    <header className="topbar">
      {/* Left: mobile hamburger + page title */}
      <div className="topbar-left">
        <button
          className={`topbar-hamburger ${mobileOpen ? 'topbar-hamburger-open' : ''}`}
          onClick={onMobileMenuOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? (
            /* X / close icon */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            /* Hamburger icon */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
        <h1 className="topbar-title">{pageTitle}</h1>
      </div>

      {/* Right: theme toggle + fiscal year + profile dropdown */}
      <div className="topbar-right">

        {/* Theme cycle button */}
        <button
          className="topbar-icon-btn topbar-theme-btn"
          onClick={cycleTheme}
          title={`Theme: ${theme} — click to switch`}
        >
          {THEME_META[theme].icon}
          <span className="topbar-theme-label">{THEME_META[theme].label}</span>
        </button>

        {/* ── Fiscal Year Switcher ── */}
        {!fyLoading && (
          <div className="topbar-fy-switcher" ref={fyRef}>
            {/* Prev arrow */}
            <button
              className="topbar-fy-arrow"
              onClick={handlePrevFY}
              disabled={currentFYIndex <= 0}
              title="Previous fiscal year"
              aria-label="Previous fiscal year"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Year label — click to open dropdown */}
            <button
              className="topbar-fy-label"
              onClick={() => setFyDropdownOpen(v => !v)}
              title="Select fiscal year"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>FY {activeFiscalYear}</span>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                className={`topbar-fy-chevron ${fyDropdownOpen ? 'open' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Next arrow */}
            <button
              className="topbar-fy-arrow"
              onClick={handleNextFY}
              disabled={currentFYIndex >= fiscalYearOptions.length - 1}
              title="Next fiscal year"
              aria-label="Next fiscal year"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Dropdown list */}
            {fyDropdownOpen && (
              <div className="topbar-fy-dropdown">
                <div className="topbar-fy-dropdown-title">Select Fiscal Year</div>
                <div className="topbar-fy-dropdown-list">
                  {fiscalYearOptions.map(fy => (
                    <button
                      key={fy}
                      className={`topbar-fy-dropdown-item ${fy === activeFiscalYear ? 'active' : ''}`}
                      onClick={async () => {
                        await setActiveFiscalYear(fy);
                        setFyDropdownOpen(false);
                      }}
                    >
                      {fy === activeFiscalYear && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      FY {fy}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile dropdown */}
        {user && (
          <div className="topbar-profile" ref={profileRef}>
            <button
              className="topbar-avatar-btn"
              onClick={() => setProfileOpen(v => !v)}
              aria-label="Profile menu"
            >
              {(photoData || user.photoURL) ? (
                <img
                  src={photoData || user.photoURL!}
                  alt="avatar"
                  className="topbar-avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="topbar-avatar-initials">{getInitials()}</div>
              )}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                className={`topbar-chevron ${profileOpen ? 'open' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {profileOpen && (
              <div className="topbar-dropdown">
                {/* User info header */}
                <div className="topbar-dropdown-header">
                  {(photoData || user.photoURL) ? (
                    <img
                      src={photoData || user.photoURL!}
                      alt="avatar"
                      className="topbar-dropdown-avatar"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="topbar-dropdown-initials">{getInitials()}</div>
                  )}
                  <div className="topbar-dropdown-info">
                    <span className="topbar-dropdown-name">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    <span className="topbar-dropdown-email">{user.email}</span>
                  </div>
                </div>

                <div className="topbar-dropdown-divider" />

                {/* Change / set photo */}
                <button
                  className="topbar-dropdown-item"
                  onClick={() => { setProfileOpen(false); setPhotoModalOpen(true); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {(photoData || user.photoURL) ? 'Change Photo' : 'Set Profile Photo'}
                </button>

                <div className="topbar-dropdown-divider" />

                {/* Sign out */}
                <button
                  className="topbar-dropdown-item topbar-dropdown-signout"
                  onClick={() => { setProfileOpen(false); logout(); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign out
                </button>

                <div className="topbar-dropdown-divider" />

                <a
                  className="topbar-dropdown-item topbar-dropdown-developer"
                  href="https://www.bibekchandsah.com.np/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setProfileOpen(false)}
                >
                  <img
                    src="https://bibekchandsah.github.io/kiitcse/assets/image/developer.jpg"
                    alt="Developer"
                    className="topbar-dropdown-developer-avatar"
                    referrerPolicy="no-referrer"
                  />
                  Developed by Bibek
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </header>

    {/* Profile photo modal */}
    {photoModalOpen && (
      <ProfilePhotoModal onClose={() => setPhotoModalOpen(false)} />
    )}
  </>
  );
};

export default TopBar;
