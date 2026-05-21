import React, { useMemo, useState } from 'react';
import type { Bill } from '../types';
import { formatCurrency } from '../utils/numberToWords';
import './TopStockList.css';

interface TopStockListProps {
  bills: Bill[];
}

interface StockStats {
  particulars: string;
  totalQty: number;
  totalAmount: number;
  timesSold: number;
}

const TopStockList: React.FC<TopStockListProps> = ({ bills }) => {
  const [showAll, setShowAll] = useState(false);

  const topStock = useMemo(() => {
    const stockMap = new Map<string, StockStats>();

    for (const bill of bills) {
      if (!Array.isArray(bill.items)) continue;
      
      for (const item of bill.items) {
        const name = (item.particulars || 'Unknown Item').trim();
        if (!name) continue;
        
        const key = name.toLowerCase();
        const qty = Number(item.qty || 0);
        const amount = Number(item.amount || (qty * Number(item.rate || 0)));
        
        const existing = stockMap.get(key);
        if (existing) {
          existing.totalQty += qty;
          existing.totalAmount += amount;
          existing.timesSold += 1;
        } else {
          stockMap.set(key, {
            particulars: name,
            totalQty: qty,
            totalAmount: amount,
            timesSold: 1,
          });
        }
      }
    }

    // Sort by total amount descending (could also be by Qty, but amount aligns with revenue)
    const sorted = Array.from(stockMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    return sorted;
  }, [bills]);

  if (topStock.length === 0) {
    return null;
  }

  const displayCount = showAll ? topStock.length : Math.min(topStock.length, 5);
  const displayedStock = topStock.slice(0, displayCount);

  return (
    <div className="top-stock-list">
      <div className="list-header">
        <h3 className="list-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          Top Selling Items
        </h3>
        <p className="list-subtitle">Ranking by total revenue generated</p>
      </div>

      <div className="stock-container">
        {displayedStock.map((stock, index) => (
          <div key={`${stock.particulars}-${index}`} className="stock-row">
            <div className="stock-rank">
              <span className={`rank-badge rank-${index + 1}`}>{index + 1}</span>
            </div>
            
            <div className="stock-info">
              <h4>{stock.particulars}</h4>
              <p className="stock-meta">
                Sold in {stock.timesSold} bill{stock.timesSold !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="stock-stats">
              <div className="stat-group">
                <span className="stat-label">Qty Sold</span>
                <span className="stat-value qty">{stock.totalQty}</span>
              </div>
              <div className="stat-group amount-group">
                <span className="stat-label">Revenue</span>
                <span className="stat-value amount">{formatCurrency(stock.totalAmount)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {topStock.length > 5 && (
        <button 
          className="btn-show-all" 
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show Less' : `View All ${topStock.length} Items`}
        </button>
      )}
    </div>
  );
};

export default TopStockList;
