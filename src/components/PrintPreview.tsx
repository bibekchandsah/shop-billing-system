import React, { useRef } from 'react';
import type { Bill } from '../types';
import { formatCurrency } from '../utils/numberToWords';
import './PrintPreview.css';

interface PrintPreviewProps {
  bill: Bill;
  businessName: string;
  businessAddress: string;
  businessContact?: string;
  printFontSize?: number;
  onClose: () => void;
}

const PrintPreview: React.FC<PrintPreviewProps> = ({
  bill,
  businessName,
  businessAddress,
  businessContact,
  printFontSize = 13,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const totalQty = bill.items.reduce((sum, item) => sum + item.qty, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* ── Modal overlay (hidden during print) ── */}
      <div className="print-overlay" onClick={onClose}>
        <div
          className="print-modal"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Toolbar — hidden during print */}
          <div className="print-toolbar no-print">
            <div className="print-toolbar-left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print Preview — {bill.billNo}</span>
            </div>
            <div className="print-toolbar-right">
              <button className="btn btn-primary" onClick={handlePrint}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print / Save PDF
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Close
              </button>
            </div>
          </div>

          {/* ── Printable bill ── */}
          <div className="print-paper" ref={printRef} id="printable-bill" style={{ fontSize: `${printFontSize}px`, ['--print-scale' as any]: (printFontSize / 13).toString() }}>
            <div className="print-scale-wrap">
            {/* Header */}
            <div className="pb-header">
              <h1 className="pb-title">Estimate Bill</h1>
              <p className="pb-business-name">{businessName}</p>
              <p className="pb-business-address">
                {businessAddress}
                {businessContact && ` | Contact: ${businessContact}`}
              </p>
            </div>

            {/* Bill meta */}
            <div className="pb-meta">
              <div className="pb-meta-left">
                <div className="pb-meta-row">
                  <span className="pb-meta-label">Bill No:</span>
                  <span className="pb-meta-value">{bill.billNo}</span>
                </div>
                <div className="pb-meta-row">
                  <span className="pb-meta-label">Customer Name:</span>
                  <span className="pb-meta-value">{bill.customerName}</span>
                </div>
                <div className="pb-meta-row">
                  <span className="pb-meta-label">Address:</span>
                  <span className="pb-meta-value">{bill.address}</span>
                </div>
                {bill.contactNumber && (
                  <div className="pb-meta-row">
                    <span className="pb-meta-label">Contact Number:</span>
                    <span className="pb-meta-value">{bill.contactNumber}</span>
                  </div>
                )}
              </div>
              <div className="pb-meta-right">
                {bill.nepaliDate && (
                  <div className="pb-meta-row">
                    <span className="pb-meta-label">Date (BS):</span>
                    <span className="pb-meta-value">{bill.nepaliDate}</span>
                  </div>
                )}
                {bill.date && (
                  <div className="pb-meta-row">
                    <span className="pb-meta-label">Date (AD):</span>
                    <span className="pb-meta-value">{bill.date}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items table */}
            <table className="pb-table">
              <thead>
                <tr>
                  <th className="pb-th pb-th-sn">S.N.</th>
                  <th className="pb-th pb-th-particulars">Particulars</th>
                  <th className="pb-th pb-th-num">Qty.</th>
                  <th className="pb-th pb-th-num">Rate</th>
                  <th className="pb-th pb-th-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item) => (
                  <tr key={item.sn}>
                    <td className="pb-td pb-td-center">{item.sn}</td>
                    <td className="pb-td">{item.particulars}</td>
                    <td className="pb-td pb-td-center">{item.unit ? `${item.qty} ${item.unit}` : item.qty}</td>
                    <td className="pb-td pb-td-center">{formatCurrency(item.rate)}</td>
                    <td className="pb-td pb-td-center">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
                {/* Empty filler rows so the table always looks full */}
                {bill.items.length < 5 &&
                  Array.from({ length: 5 - bill.items.length }).map((_, i) => (
                    <tr key={`empty-${i}`} className="pb-tr-empty">
                      <td className="pb-td">&nbsp;</td>
                      <td className="pb-td"></td>
                      <td className="pb-td"></td>
                      <td className="pb-td"></td>
                      <td className="pb-td"></td>
                    </tr>
                  ))}
                <tr className="pb-total-row">
                  <td colSpan={2} className="pb-total-label">Total</td>
                  <td className="pb-total-qty">{totalQty}</td>
                  <td className="pb-total-empty">&nbsp;</td>
                  <td className="pb-total-value">{formatCurrency(bill.totalAmount)}</td>
                </tr>
              </tbody>
            </table>

            {/* In words */}
            <div className="pb-words">
              <span className="pb-words-label">In Words: </span>
              <span className="pb-words-text">{bill.totalAmountInWords}</span>
            </div>

            {/* Note */}
            {bill.freeDue && (
              <div className="pb-payment">
                <div className="pb-payment-row">
                  <span className="pb-meta-label">Note:</span>
                  <span className="pb-meta-value">{bill.freeDue}</span>
                </div>
              </div>
            )}

            {/* Signature */}
            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'flex-end', pageBreakInside: 'avoid' }}>
              <div style={{ width: '180px', textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #333', marginBottom: '5px' }}></div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>Authorized Signature</div>
              </div>
            </div>
            </div>
          </div>
          {/* end print-paper */}
        </div>
      </div>
    </>
  );
};

export default PrintPreview;
