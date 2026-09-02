import type { Party, PartyLedgerEntry } from '../types';
import { formatCurrency } from './numberToWords';

const formatBalanceDisplay = (balance: number) => ({
  amount: Math.abs(balance),
  label: balance < 0 ? 'CR' : 'DR',
});

export const printPartyLedger = (
  party: Party,
  ledger: PartyLedgerEntry[],
  businessName: string,
  businessAddress: string,
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

  const totalDebit = ledger.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const totalCredit = ledger.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  const currentBal = formatBalanceDisplay(party.currentBalance || 0);

  const rows = [...ledger]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
    (entry) => {
      const balance = formatBalanceDisplay(entry.currentBalance);
      return `<tr>
        <td>${entry.date}</td>
        <td>${entry.particular || '—'}</td>
        <td class="right">${entry.debit > 0 ? `${formatCurrency(entry.debit)}` : '—'}</td>
        <td class="right">${entry.credit > 0 ? `${formatCurrency(entry.credit)}` : '—'}</td>
        <td class="right">${formatCurrency(balance.amount)} <span class="balance-tag ${balance.label === 'CR' ? 'cr' : 'dr'}">${balance.label}</span></td>
      </tr>`;
    }
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Party Ledger — ${party.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 2cm 2.5cm; }
    .header { text-align: center; margin-bottom: 14px; }
    .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header .biz-name { font-size: 14px; font-weight: 600; margin-top: 4px; }
    .header .biz-addr { font-size: 12px; color: #555; margin-top: 2px; }
    hr { border: none; border-top: 0px solid #333; margin: 10px 0; }
    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 13px; gap: 12px; font-weight: 600; }
    .meta-left { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; gap: 6px; align-items: baseline; }
    .meta-label { font-weight: 700; white-space: nowrap; color: #222; }
    .meta-right { text-align: right; display: flex; flex-direction: column; gap: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12.5px; }
    thead th {
      background: transparent;
      color: #000;
      padding: 7px 10px;
      font-weight: 700;
      border: none;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    thead th.left { text-align: left; }
    thead th.center { text-align: center; }
    thead th.right { text-align: right; }
    td {
      padding: 6px 10px;
      border: none;
      vertical-align: middle;
      color: #000;
      font-weight: 600;
    }
    tbody tr:last-child td { border-bottom: 0px solid #000; }
    .center { text-align: center; }
    .right { text-align: right; }
    .text-success { color: #10b981; }
    .text-danger { color: #ef4444; }
    .balance-tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700; border: 1px solid #cbd5e1; vertical-align: middle; }
    .balance-tag.dr { color: #000000ff; background: #ffffffff; }
    .balance-tag.cr { color: #000000ff; background: #ffffffff; }
    .summary-box {
      margin-top: 18px;
      margin-left: auto;
      width: fit-content;
      min-width: 250px;
      page-break-inside: avoid;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
      padding: 5px 0;
      border-bottom: 1px solid #000;
      font-size: 13.5px;
    }
    .summary-row:last-child {
      border-bottom: 1.5px solid #000;
    }
    .summary-label {
      font-weight: 700;
      color: #000;
    }
    .summary-value {
      font-weight: 600;
      color: #000;
      text-align: right;
    }
    .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #1e3a5f; color: #fff; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; z-index: 9999; }
    .toolbar-btns { display: flex; gap: 10px; }
    .btn { padding: 7px 18px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .btn-print { background: #10b981; color: #fff; }
    .btn-close { background: rgba(255,255,255,0.15); color: #fff; }
    @media screen { body { padding-top: calc(2cm + 52px); } }
    @media print { .toolbar { display: none !important; } body { padding: 0 !important; } @page { size: A4 portrait; margin: 1.5cm 2cm; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>Print Preview — Party Ledger</span>
    <div class="toolbar-btns">
      <button class="btn btn-print" onclick="window.print()">Print / Save PDF</button>
      <button class="btn btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="header">
    <h1>Party Ledger</h1>
    <p class="biz-name">${businessName}</p>
    <p class="biz-addr">${businessAddress}</p>
  </div>
  <hr />

  <div class="meta-grid">
    <div class="meta-left">
      <div class="meta-row"><span class="meta-label">Party:</span><span>${party.name}</span></div>
      <div class="meta-row"><span class="meta-label">Address:</span><span>${party.address || '—'}</span></div>
      ${party.contactNumber ? `<div class="meta-row"><span class="meta-label">Contact:</span><span>${party.contactNumber}</span></div>` : ''}
      ${party.partyCode ? `<div class="meta-row"><span class="meta-label">Party ID:</span><span>${party.partyCode}</span></div>` : ''}
    </div>
    <div class="meta-right">
      <div class="meta-row"><span class="meta-label">Date Range:</span><span>${dateRangeStr}</span></div>
      <div class="meta-row"><span class="meta-label">Current Balance:</span><span>${formatCurrency(currentBal.amount)} <span class="balance-tag ${currentBal.label === 'CR' ? 'cr' : 'dr'}">${currentBal.label}</span></span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="left" style="width:100px;">Date (BS)</th>
        <th class="left">Particular</th>
        <th class="right" style="width:90px;">Debit</th>
        <th class="right" style="width:90px;">Credit</th>
        <th class="right" style="width:110px;">Running Bal.</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="summary-box">
    <div class="summary-row">
      <span class="summary-label">Total Debit:</span>
      <span class="summary-value">${formatCurrency(totalDebit)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Total Credit:</span>
      <span class="summary-value">${formatCurrency(totalCredit)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Current Balance:</span>
      <span class="summary-value">${formatCurrency(currentBal.amount)} <span class="balance-tag ${currentBal.label === 'CR' ? 'cr' : 'dr'}">${currentBal.label}</span></span>
    </div>
  </div>

  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
};