import type { StockLedgerEntry, StockParticular } from '../types';

export const printStockLedger = (
  particular: StockParticular,
  ledger: StockLedgerEntry[],
  businessName: string,
  businessAddress: string,
  _businessContact?: string,
  filterStartDate?: string,
  filterEndDate?: string
): void => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }

  const dateRangeStr = filterStartDate || filterEndDate
    ? `${filterStartDate || 'Beginning'} to ${filterEndDate || 'Present'}`
    : 'All Time';

  const rows = [...ledger].reverse().map(
    (entry) =>
      `<tr>
        <td>${entry.date}</td>
        <td>${entry.note || '—'}</td>
        <td class="center">${entry.billNo || '—'}</td>
        <td class="center">${entry.unit || '—'}</td>
        <td class="right text-success">${entry.debit > 0 ? `${entry.debit}` : '—'}</td>
        <td class="right text-danger">${entry.credit > 0 ? `${entry.credit}` : '—'}</td>
        <td class="right"><strong>${entry.currentStock}</strong></td>
      </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Stock Ledger — ${particular.name}</title>
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
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;
      font-size: 13px;
    }
    .meta-row { display: flex; gap: 5px; align-items: baseline; }
    .meta-label { font-weight: 700; white-space: nowrap; color: #222; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12.5px; }
    thead th {
      background: #1e3a5f;
      color: #fff;
      padding: 7px 10px;
      font-weight: 600;
      border: 1px solid #1e3a5f;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    thead th.left { text-align: left; }
    thead th.center { text-align: center; }
    thead th.right { text-align: right; }
    td { padding: 6px 10px; border: 1px solid #ccc; vertical-align: middle; }
    .center { text-align: center; }
    .right  { text-align: right; }
    .text-success { color: #10b981; }
    .text-danger { color: #ef4444; }
    .toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1e3a5f;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 9999;
    }
    .toolbar-btns { display: flex; gap: 10px; }
    .btn { padding: 7px 18px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .btn-print { background: #10b981; color: #fff; }
    .btn-close { background: rgba(255,255,255,0.15); color: #fff; }
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
    <span>Print Preview — Stock Ledger</span>
    <div class="toolbar-btns">
      <button class="btn btn-print" onclick="window.print()">Print / Save PDF</button>
      <button class="btn btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="header">
    <h1>Stock Ledger</h1>
    <p class="biz-name">${businessName}</p>
    <p class="biz-addr">${businessAddress}</p>
  </div>
  <hr />

  <div class="meta-grid">
    <div class="meta-row">
      <span class="meta-label">Item Name:</span>
      <span>${particular.name}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Date Range:</span>
      <span>${dateRangeStr}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="left" style="width:100px;">Date (BS)</th>
        <th class="left">Note / Description</th>
        <th class="center" style="width:90px;">Bill No</th>
        <th class="center" style="width:70px;">Unit</th>
        <th class="right" style="width:80px;">Debit (+ In)</th>
        <th class="right" style="width:80px;">Credit (- Out)</th>
        <th class="right" style="width:90px;">Running Bal.</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
};
