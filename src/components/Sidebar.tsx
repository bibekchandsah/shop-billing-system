import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

// ── Premium Tooltip Content ───────────────────────────────────────────────────
const TOOLTIP_CONTENT: Record<string, { label: string; description: string; tag: string }> = {
  'Home': {
    label: 'Home Dashboard',
    description: 'Pro Dashboard — Real-time billing analytics, daily sales tracking, and secure business summaries.',
    tag: '⚡ PRO ANALYTICS'
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
    label: 'Records Archive',
    description: 'Advanced Archive — Complete billing history, dynamic filters, secure Firestore backups, and print re-generation.',
    tag: '🔒 SECURE DATABASE'
  }
  ,
  'Customers': {
    label: 'Customer Ledger',
    description: 'Track customer dues, payments, and balances in one place.',
    tag: '👥 LEDGER'
  },
  'Parties': {
    label: 'Party Ledger',
    description: 'Track party dues, payments, and balances in one place.',
    tag: '🏷️ LEDGER'
  },
};


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

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
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
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={onMobileClose} />}

      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>

        {/* Brand + collapse toggle */}
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={onMobileClose}>
            <div className="sidebar-brand-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-store" aria-hidden="true">
                <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
                <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />
                <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />
              </svg>
            </div>
            {!collapsed && <span className="sidebar-brand-text">Shop Billing</span>}
          </Link>

          <button
            className="sidebar-collapse-btn"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="sidebar-nav">
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
                onMobileClose();
              }}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
              {isActive(item.to) && <span className="sidebar-active-pill" />}
            </Link>
          ))}
        </nav>

      </aside>

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
    </>
  );
};

export default Sidebar;
