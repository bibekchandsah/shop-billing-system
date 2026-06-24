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
  businessContact?: string,
  printFontSize = 13,
  printCopies = 2,
  billTitle = 'Estimate Bill'
): void => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }

  // Calculate total quantity of items
  const totalQty = bill.items.reduce((sum, item) => sum + item.qty, 0);
  const baseFontSize = 13;
  const scale = Math.max(0.8, Math.min(1.6, printFontSize / baseFontSize));
  const scaled = (value: number) => `${Math.round(value * scale)}px`;
  const wrapperScale = scale.toFixed(3);

  // Build item rows
  const itemRows = bill.items
    .map(
      (item) =>
        `<tr>
          <td class="center">${item.sn}</td>
          <td>${item.particulars}</td>
          <td class="center">${item.unit ? `${item.qty} ${item.unit}` : item.qty}</td>
          <td class="center">${formatCurrency(item.rate)}</td>
          <td class="center">${formatCurrency(item.amount)}</td>
        </tr>`
    )
    .join('');

  // Empty filler row that stretches to fill remaining table height
  const fillerRows = `<tr class="filler-stretch"><td></td><td></td><td></td><td></td><td></td></tr>`;

  const totalRow = `
    <tr class="total-row">
      <td colspan="2" class="total-label">Total</td>
      <td class="center">${totalQty}</td>
      <td></td>
      <td class="center total-value">${formatCurrency(bill.totalAmount)}</td>
    </tr>`;

  // Safe date display — never show "undefined" or empty
  const bsDate = bill.nepaliDate && !bill.nepaliDate.includes('undefined') ? bill.nepaliDate : '—';

  const freeDueRow = bill.freeDue
    ? `<div class="payment-row"><span class="meta-label">Note:</span><span>${bill.freeDue}</span></div>`
    : '';

  const renderCopyHtml = () => `
    <div class="print-scale-wrap">
      <div class="header">
        <h1>${billTitle}</h1>
        <p class="biz-name">${businessName}</p>
        <p class="biz-addr">${businessAddress}${businessContact ? ' | Contact: ' + businessContact : ''}</p>
      </div>
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
        <tbody>${itemRows}${fillerRows}${totalRow}</tbody>
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
    </div>
  `;

  let copiesContent = '';
  if (printCopies === 2) {
    copiesContent = `
      ${renderCopyHtml()}
      <div class="page-break"></div>
      <div class="page-break-container"></div>
      ${renderCopyHtml()}
    `;
  } else {
    copiesContent = renderCopyHtml();
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Bill — ${bill.billNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: ${printFontSize}px;
      color: #000;
      background: #fff;
      padding: 2cm 2.5cm;
    }
    .print-scale-wrap {
      transform: scale(${wrapperScale});
      transform-origin: top left;
      width: calc(100% / ${wrapperScale});
      min-height: calc(235mm / ${wrapperScale});
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .header { text-align: center; margin-bottom: 1em; }
    .header h1 { font-size: 2.15em; font-weight: 700; letter-spacing: 0.5px; }
    .header .biz-name { font-size: 1.1em; font-weight: 600; margin-top: 0.2em; }
    .header .biz-addr { font-size: 0.95em; color: #000; margin-top: 0.15em; }
    hr { border: none; border-top: 1.5px solid #000; margin: 10px 0; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px 0;
      margin-bottom: 14px;
      font-size: 0.95em;
    }
    .meta-row { display: flex; gap: 5px; align-items: baseline; }
    .meta-label { font-weight: 700; white-space: nowrap; color: #000; }
    .meta-full { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0.75em; font-size: 0.95em; flex-grow: 1; }
    thead th {
      background: transparent;
      color: #000;
      padding: 0.55em 0.8em;
      font-weight: 700;
      text-transform: uppercase;
      text-align: center;
      border: 1px solid #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    thead th.left { text-align: left; }
    tbody td {
      padding: 0.45em 0.8em;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      border-top: none;
      border-bottom: none;
      vertical-align: middle;
    }
    tr.filler td { height: 1.9em; }
    tbody tr:not(.filler-stretch) td { height: 1px; }
    tr.filler-stretch td { height: auto; }
    .center { text-align: center; }
    .right  { text-align: right; }
    tfoot td {
      padding: 0.55em 0.8em;
      border: 1px solid #000;
      background: transparent;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 0.95em;
    }
    tr.total-row { page-break-inside: avoid; break-inside: avoid; }
    tbody tr.total-row td {
      background: transparent;
      font-weight: 700;
      font-size: 0.95em;
      padding: 0.55em 0.8em;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .total-label { text-align: right; }
    .total-value { font-weight: 700; }
    .words {
      background: transparent;
      border: 1px solid #000;
      border-radius: 4px;
      padding: 0.5em 0.8em;
      margin-bottom: 0.75em;
      font-size: 0.95em;
    }
    .words strong { font-weight: 600; }
    .words em { font-style: italic; color: #000; }
    .payment { display: flex; gap: 2em; flex-wrap: wrap; margin-bottom: 0.75em; font-size: 0.95em; }
    .payment-row { display: flex; gap: 6px; }
    .signature { margin-top: 5em; display: flex; justify-content: flex-end; page-break-inside: avoid; }
    .sig-box { width: 12em; text-align: center; }
    .sig-line { border-top: 1px solid #000; margin-bottom: 5px; }
    .sig-text { font-size: 1em; font-weight: 600; }
    .footer { text-align: center; font-style: italic; font-size: 0.9em; color: #000; margin-top: 0.5em; }
    /* Screen-only toolbar */
    .toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1e3a5f;
      color: #fff;
      padding: ${scaled(10)} ${scaled(20)};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 600;
    }
    .toolbar-btns { display: flex; gap: 10px; }
    .btn { padding: ${scaled(7)} ${scaled(18)}; border: none; border-radius: 6px; font-size: ${scaled(13)}; font-weight: 600; cursor: pointer; }
    .btn-print { background: #10b981; color: #fff; }
    .btn-print:hover { background: #059669; }
    .btn-close { background: rgba(255,255,255,0.15); color: #fff; }
    .btn-close:hover { background: rgba(255,255,255,0.25); }
    .page-break { display: none; }
    .page-break-container { display: none; }
    @media screen {
      body { padding-top: calc(2cm + ${scaled(52)}); }
      .page-break-container {
        display: block;
        border-top: 2px dashed #cbd5e1;
        margin: 3.5rem 0;
        position: relative;
        text-align: center;
      }
      .page-break-container::after {
        content: "✂️ CUT HERE — COPY 2 BELOW";
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        background: #fff;
        padding: 0 15px;
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        letter-spacing: 1px;
      }
    }
    @media print {
      .toolbar { display: none !important; }
      body { padding: 0 !important; }
      .print-scale-wrap { 
        transform: none !important; 
        width: auto !important; 
        min-height: 235mm !important;  /*table height adjustment */
      }
      @page { size: A4 portrait; margin: 1.5cm 2cm; }
      .page-break {
        display: block;
        page-break-before: always;
        break-before: page;
      }
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

  ${copiesContent}

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
