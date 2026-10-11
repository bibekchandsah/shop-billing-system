import React, { useMemo, useState } from 'react';
import type { Bill } from '../types';
import { formatCurrency } from '../utils/numberToWords';
import './TopCustomersList.css';

interface TopCustomersListProps {
  bills: Bill[];
}

interface CustomerStats {
  name: string;
  phone: string;
  address: string;
  totalAmount: number;
  totalQty: number;
  billCount: number;
  lastPurchaseDate: Date | string;
}

interface CustomerEntry extends CustomerStats {
  code: string;
  names: Set<string>;
}

const TopCustomersList: React.FC<TopCustomersListProps> = ({ bills }) => {
  const [showAll, setShowAll] = useState(false);

  const topCustomers = useMemo(() => {
    const isCashCustomer = (n: string) => {
      const norm = (n || '').trim().toLowerCase();
      return norm === 'cash' || norm === 'cash sale' || norm === 'cash sales';
    };

    // ── Phase 1: build two maps in parallel ──────────────────────────────
    // codeMap : bills that carry a customerCode  (key = normalised code)
    // nameMap : bills that have no customerCode  (key = normalised name)
    const codeMap = new Map<string, CustomerEntry>();
    const nameMap = new Map<string, CustomerStats>();

    for (const bill of bills) {
      let   name    = (bill.customerName || 'Unknown').trim();
      let   phone   = (bill.contactNumber || '').trim();
      if (phone === '0' || phone === '-') phone = '';
      let   address = (bill.address || '').trim();
      let   code    = (bill.customerCode || '').trim();

      // Normalize Cash sales — Cash is always a standalone aggregate, never linked to a customer code
      if (isCashCustomer(name)) {
        name = 'Cash';
        code = '';
        phone = '';
        address = '';
      }

      const amount  = Number(bill.totalAmount || 0);
      const qty     = Number(
        bill.totalQty ||
        bill.items.reduce((s: number, i: any) => s + Number(i.qty || 0), 0)
      );

      const updateDate = (entry: CustomerStats, rawDate: string | Date) => {
        const d = new Date(rawDate as string);
        const e = new Date(entry.lastPurchaseDate as string);
        if (!isNaN(d.getTime()) && (isNaN(e.getTime()) || d > e)) {
          entry.lastPurchaseDate = d;
        }
      };

      if (code) {
        const codeKey = code.toLowerCase();
        const existing = codeMap.get(codeKey);
        if (existing) {
          existing.totalAmount += amount;
          existing.totalQty   += qty;
          existing.billCount  += 1;
          if (!isCashCustomer(name)) {
            existing.names.add(name.toLowerCase());
          }
          if (isCashCustomer(existing.name) && !isCashCustomer(name)) {
            existing.name = name;
          }
          updateDate(existing, bill.date || bill.createdAt);
        } else {
          codeMap.set(codeKey, {
            name, phone, address,
            totalAmount: amount, totalQty: qty, billCount: 1,
            lastPurchaseDate: bill.date || bill.createdAt,
            code: codeKey,
            names: new Set(isCashCustomer(name) ? [] : [name.toLowerCase()]),
          });
        }
      } else {
        const nameKey = name.toLowerCase();
        const existing = nameMap.get(nameKey);
        if (existing) {
          existing.totalAmount += amount;
          existing.totalQty   += qty;
          existing.billCount  += 1;
          updateDate(existing, bill.date || bill.createdAt);
        } else {
          nameMap.set(nameKey, {
            name, phone, address,
            totalAmount: amount, totalQty: qty, billCount: 1,
            lastPurchaseDate: bill.date || bill.createdAt,
          });
        }
      }
    }

    // ── Phase 2: merge name-only buckets into matching code buckets ───────
    // If a customer has some bills with a code and some without, their
    // name-only totals get folded into the code bucket so nothing is split.
    for (const [nameKey, nameEntry] of nameMap) {
      if (isCashCustomer(nameKey)) {
        // Cash is always a standalone customer
        codeMap.set('name|cash', {
          ...nameEntry,
          name: 'Cash',
          code: '',
          names: new Set(['cash']),
        });
        continue;
      }

      let merged = false;
      for (const codeEntry of codeMap.values()) {
        if (!isCashCustomer(nameKey) && codeEntry.names.has(nameKey)) {
          codeEntry.totalAmount += nameEntry.totalAmount;
          codeEntry.totalQty   += nameEntry.totalQty;
          codeEntry.billCount  += nameEntry.billCount;
          const d = new Date(nameEntry.lastPurchaseDate as string);
          const e = new Date(codeEntry.lastPurchaseDate as string);
          if (!isNaN(d.getTime()) && (isNaN(e.getTime()) || d > e)) {
            codeEntry.lastPurchaseDate = nameEntry.lastPurchaseDate;
          }
          merged = true;
          break;
        }
      }
      if (!merged) {
        // No matching code bucket — keep as standalone
        codeMap.set(`name|${nameKey}`, {
          ...nameEntry,
          code: '',
          names: new Set([nameKey]),
        });
      }
    }

    return Array.from(codeMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [bills]);

  if (topCustomers.length === 0) {
    return null;
  }

  const displayCount = showAll ? topCustomers.length : Math.min(topCustomers.length, 5);
  const displayedCustomers = topCustomers.slice(0, displayCount);

  return (
    <div className="top-customers-list">
      <div className="list-header">
        <h3 className="list-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Top Customers Leaderboard
        </h3>
        <p className="list-subtitle">Ranking by total purchase amount</p>
      </div>

      <div className="customers-container">
        {displayedCustomers.map((customer, index) => (
          <div key={`${customer.name}-${customer.phone}-${index}`} className="customer-row">
            <div className="customer-rank">
              <span className={`rank-badge rank-${index + 1}`}>{index + 1}</span>
            </div>
            
            <div className="customer-info">
              <h4>{customer.name}</h4>
              <p className="customer-meta">
                {customer.phone && <span>{customer.phone}</span>}
                {customer.phone && customer.address && <span> • </span>}
                {customer.address && <span>{customer.address}</span>}
              </p>
            </div>
            
            <div className="customer-stats">
              <div className="stat-group">
                <span className="stat-label">Qty</span>
                <span className="stat-value qty">{customer.totalQty}</span>
              </div>
              <div className="stat-group">
                <span className="stat-label">Bills</span>
                <span className="stat-value bills">{customer.billCount}</span>
              </div>
              <div className="stat-group amount-group">
                <span className="stat-label">Amount</span>
                <span className="stat-value amount">{formatCurrency(customer.totalAmount)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {topCustomers.length > 5 && (
        <button 
          className="btn-show-all" 
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show Less' : `View All ${topCustomers.length} Customers`}
        </button>
      )}
    </div>
  );
};

export default TopCustomersList;
