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

const TopCustomersList: React.FC<TopCustomersListProps> = ({ bills }) => {
  const [showAll, setShowAll] = useState(false);

  const topCustomers = useMemo(() => {
    const customerMap = new Map<string, CustomerStats>();

    for (const bill of bills) {
      const name = (bill.customerName || 'Unknown').trim();
      const phone = (bill.contactNumber || '').trim();
      const address = (bill.address || '').trim();
      
      // Use name + phone as a unique identifier to avoid merging people with same name
      const key = `${name.toLowerCase()}|${phone}`;
      
      const amount = Number(bill.totalAmount || 0);
      const qty = Number(bill.totalQty || bill.items.reduce((sum, item) => sum + Number(item.qty || 0), 0));
      
      const existing = customerMap.get(key);
      
      if (existing) {
        existing.totalAmount += amount;
        existing.totalQty += qty;
        existing.billCount += 1;
        
        const billDate = new Date(bill.date || bill.createdAt);
        const existingDate = new Date(existing.lastPurchaseDate);
        if (!isNaN(billDate.getTime()) && (!isNaN(existingDate.getTime()) || billDate > existingDate)) {
          existing.lastPurchaseDate = billDate;
        }
      } else {
        customerMap.set(key, {
          name,
          phone,
          address,
          totalAmount: amount,
          totalQty: qty,
          billCount: 1,
          lastPurchaseDate: bill.date || bill.createdAt,
        });
      }
    }

    // Sort by total amount descending
    const sorted = Array.from(customerMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    return sorted;
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
