import type { Bill } from '../types';
import { formatCurrency } from './numberToWords';

/**
 * Opens a new browser window with a clean bill layout and
 * immediately triggers the browser print dialog — no second click needed.
 */
export const printBill = (
  bill: Bill,
  businessName: string,
  businessAddress: string,
  businessContact?: string
): void => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }

  // Calculate total quantity of items
  const totalQty = bill.items.reduce((sum, item) => sum + item.qty, 0);

  // Build item rows
  const itemRows = bill.items
    .map(
      (item) =>
        `<tr>
          <td class="center">${item.sn}</td>
          <td>${item.particulars}</td>
          <td class="right">${item.qty}</td>
          <td class="right">${formatCurrency(item.rate)}</td>
          <td class="right">${formatCurrency(item.amount)}</td>
        </tr>`
    )
    .join('');

  // Filler rows so the table always has at least 5 rows
  const fillerCount = Math.max(0, 5 - bill.items.length);
  const fillerRows = Array.from({ length: fillerCount })
    .map(() => `<tr class="filler"><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`)
    .join('');

  // Safe date display — never show "undefined" or empty
  const bsDate = bill.nepaliDate && !bill.nepaliDate.includes('undefined') ? bill.nepaliDate : '—';

  const freeDueRow = bill.freeDue
    ? `<div class="payment-row"><span class="meta-label">Note:</span><span>${bill.freeDue}</span></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Bill — ${bill.billNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 2cm 2.5cm;
    }
    .header { text-align: center; margin-bottom: 14px; }
    .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header .biz-name { font-size: 14px; font-weight: 600; margin-top: 4px; }
    .header .biz-addr { font-size: 12px; color: #555; margin-top: 2px; }
    hr { border: none; border-top: 1.5px solid #333; margin: 10px 0; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px 0;
      margin-bottom: 14px;
      font-size: 12.5px;
    }
    .meta-row { display: flex; gap: 5px; align-items: baseline; }
    .meta-label { font-weight: 700; white-space: nowrap; color: #222; }
    .meta-full { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12.5px; }
    thead th {
      background: #1e3a5f;
      color: #fff;
      padding: 7px 10px;
      font-weight: 600;
      text-align: center;
      border: 1px solid #1e3a5f;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    thead th.left { text-align: left; }
    td { padding: 6px 10px; border: 1px solid #ccc; vertical-align: middle; }
    tr.filler td { height: 26px; }
    .center { text-align: center; }
    .right  { text-align: right; }
    tfoot td {
      padding: 7px 10px;
      border: 1px solid #ccc;
      background: #f0f4f8;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .total-label { text-align: right; font-weight: 700; }
    .total-value { text-align: right; font-weight: 700; font-size: 14px; }
    .words {
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 7px 10px;
      margin-bottom: 10px;
      font-size: 12px;
    }
    .words strong { font-weight: 600; }
    .words em { font-style: italic; color: #444; }
    .payment { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 10px; font-size: 12.5px; }
    .payment-row { display: flex; gap: 6px; }
    .signature { margin-top: 40px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
    .sig-box { width: 180px; text-align: center; }
    .sig-line { border-top: 1px solid #111; margin-bottom: 5px; }
    .sig-text { font-size: 13px; font-weight: 600; }
    .footer { text-align: center; font-style: italic; font-size: 12px; color: #555; margin-top: 6px; }
    /* Screen-only toolbar */
    .toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1e3a5f;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 600;
    }
    .toolbar-btns { display: flex; gap: 10px; }
    .btn { padding: 7px 18px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-print { background: #10b981; color: #fff; }
    .btn-print:hover { background: #059669; }
    .btn-close { background: rgba(255,255,255,0.15); color: #fff; }
    .btn-close:hover { background: rgba(255,255,255,0.25); }
    @media screen { body { padding-top: calc(2cm + 52px); } }
    @media print {
      .toolbar { display: none !important; }
      body { padding: 0 !important; }
      @page { size: A4 portrait; margin: 1.5cm 2cm; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>Print Preview — ${bill.billNo}</span>
    <div class="toolbar-btns">
      <button class="btn btn-print" onclick="window.print()">Print / Save as PDF</button>
      <button class="btn btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="header">
    <h1>Estimate Bill</h1>
    <p class="biz-name">${businessName}</p>
    <p class="biz-addr">${businessAddress}${businessContact ? ' | Contact: ' + businessContact : ''}</p>
  </div>
  <hr />

  <!-- Two-column meta grid -->
  <div class="meta-grid">
    <!-- Row 1: Bill No | Date -->
    <div class="meta-row">
      <span class="meta-label">Bill No:</span>
      <span>${bill.billNo}</span>
    </div>
    <div class="meta-row" style="justify-content:flex-end">
      <span class="meta-label">Date:</span>
      <span>${bsDate}</span>
    </div>
    <!-- Row 2: Customer Name (full width) -->
    <div class="meta-row meta-full">
      <span class="meta-label">Customer Name:</span>
      <span>${bill.customerName}</span>
    </div>
    <!-- Row 3: Address | Contact -->
    <div class="meta-row">
      <span class="meta-label">Address:</span>
      <span>${bill.address}</span>
    </div>
    ${bill.contactNumber ? `
    <div class="meta-row" style="justify-content:flex-end">
      <span class="meta-label">Contact:</span>
      <span>${bill.contactNumber}</span>
    </div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:42px">S.N.</th>
        <th class="left">Particulars</th>
        <th style="width:80px">Qty.</th>
        <th style="width:100px">Rate</th>
        <th style="width:110px">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}${fillerRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align: right; font-weight: 700; font-size: 13px; background: #f0f4f8; padding: 8px 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <span style="margin-right: 30px;">Total Qty: ${totalQty}</span>
          <span>Total Amount: &nbsp; &nbsp; ${formatCurrency(bill.totalAmount)}</span>
        </td>
      </tr>
    </tfoot>
  </table>

  <div class="words">
    <strong>In Words: </strong><em>${bill.totalAmountInWords}</em>
  </div>

  <div class="payment">
    ${freeDueRow}
  </div>

  <div class="signature">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-text">Authorized Signature</div>
    </div>
  </div>

  <script>
    // Auto-open print dialog once the page has fully rendered
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
};
