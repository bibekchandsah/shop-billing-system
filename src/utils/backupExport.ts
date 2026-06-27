import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { getAllBills } from '../services/billService';
import { getCustomers, getCustomerLedgerEntries } from '../services/customerService';
import { getParties, getPartyLedgerEntries } from '../services/partyService';
import { getStockParticulars, getLedgerEntries } from '../services/stockService';
import { getFiscalYearOptions, isBillInFiscalYear } from '../services/settingsService';

export interface BackupOptions {
  /** e.g. "2081-82" — undefined means ALL years */
  fiscalYear?: string;
  startMonth?: number;
  endMonth?: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isInFiscalYear(dateStr: string, fy: string, startMonth: number, endMonth: number): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length < 2) return false;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const startYear = parseInt(fy.split('-')[0], 10);
  const endYear = startYear + 1;
  if (year === startYear && month >= startMonth) return true;
  if (year === endYear && month <= endMonth) return true;
  return false;
}

function autoWidth(ws: XLSX.WorkSheet) {
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (!data.length) return;
  const cols = (data[0] as any[]).map((_: any, ci: number) => ({
    wch: Math.max(12, ...data.map(row => String((row as any[])[ci] ?? '').length + 2)),
  }));
  ws['!cols'] = cols;
}

// ─── Sheet builders matching exact export row shapes from each page ───────────

/**
 * Bills sheet — mirrors Records.tsx handleExport row shape
 */
function buildBillsSheet(bills: any[]): XLSX.WorkSheet {
  const rows = bills.map(bill => {
    const { items, createdAt, updatedAt, id, userId, ...rest } = bill;
    return {
      ...rest,
      items_json: JSON.stringify(items),
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  autoWidth(ws);
  return ws;
}

/**
 * Customers sheet — mirrors CustomerLedger.tsx handleExport row shape
 */
async function buildCustomersRows(
  customers: any[],
  userId: string,
  fyFilter?: (dateStr: string) => boolean
): Promise<any[]> {
  const exportRows: any[] = [];
  for (const c of customers) {
    const entries = await getCustomerLedgerEntries(userId, c.id);
    const filtered = fyFilter
      ? entries.filter(e => fyFilter(e.date))
      : entries;
    exportRows.push({
      "customer ID": c.customerCode || '',
      "customer name": c.name || '',
      "address": c.address || '',
      "contact number": c.contactNumber || '',
      "current balance": c.currentBalance ?? '',
      ledger_json: JSON.stringify(filtered.map(e => ({
        date: e.date,
        particular: e.particular,
        billNo: e.billNo || '',
        debit: e.debit,
        credit: e.credit,
        currentBalance: e.currentBalance,
        note: e.note || '',
      }))),
    });
  }
  return exportRows;
}

/**
 * Parties sheet — mirrors SupplierLedger.tsx handleExport row shape
 */
async function buildPartiesRows(
  parties: any[],
  userId: string,
  fyFilter?: (dateStr: string) => boolean
): Promise<any[]> {
  const exportRows: any[] = [];
  for (const party of parties) {
    const entries = await getPartyLedgerEntries(userId, party.id);
    const filtered = fyFilter
      ? entries.filter(e => fyFilter(e.date))
      : entries;
    exportRows.push({
      "party ID": party.partyCode || '',
      "party name": party.name || '',
      "address": party.address || '',
      "contact number": party.contactNumber || '',
      "current balance": party.currentBalance ?? '',
      ledger_json: JSON.stringify(filtered.map(e => ({
        date: e.date,
        particular: e.particular,
        billNo: e.billNo || '',
        debit: e.debit,
        credit: e.credit,
        currentBalance: e.currentBalance,
        note: e.note || '',
      }))),
    });
  }
  return exportRows;
}

/**
 * Stock sheet — mirrors Stock.tsx handleExport row shape
 */
async function buildStockRows(
  particulars: any[],
  userId: string,
  fyFilter?: (dateStr: string) => boolean
): Promise<any[]> {
  const exportRows: any[] = [];
  for (const p of particulars) {
    const entries = await getLedgerEntries(userId, p.id);
    const filtered = fyFilter
      ? entries.filter(e => fyFilter(e.date))
      : entries;
    exportRows.push({
      "particular ID": p.particularCode || '',
      "particular name": p.name,
      "default unit": p.defaultUnit || '',
      "current stock": p.currentStock,
      ledger_json: JSON.stringify(filtered.map(e => ({
        date: e.date,
        billNo: e.billNo || '',
        debit: e.debit,
        credit: e.credit,
        unit: e.unit || '',
        currentStock: e.currentStock,
        note: e.note || '',
      }))),
    });
  }
  return exportRows;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function buildWorkbook(
  userId: string,
  bills: any[],
  customers: any[],
  parties: any[],
  particulars: any[],
  fyFilter?: (dateStr: string) => boolean
): Promise<XLSX.WorkBook> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Bills (from Records page export shape)
  const billsWS = buildBillsSheet(bills);
  XLSX.utils.book_append_sheet(wb, billsWS, 'Bills');

  // Sheet 2: Customers (from CustomerLedger page export shape)
  const custRows = await buildCustomersRows(customers, userId, fyFilter);
  const custWS = XLSX.utils.json_to_sheet(custRows);
  autoWidth(custWS);
  XLSX.utils.book_append_sheet(wb, custWS, 'Customers');

  // Sheet 3: Parties (from SupplierLedger page export shape)
  const partyRows = await buildPartiesRows(parties, userId, fyFilter);
  const partyWS = XLSX.utils.json_to_sheet(partyRows);
  autoWidth(partyWS);
  XLSX.utils.book_append_sheet(wb, partyWS, 'Parties');

  // Sheet 4: Stock (from Stock page export shape)
  const stockRows = await buildStockRows(particulars, userId, fyFilter);
  const stockWS = XLSX.utils.json_to_sheet(stockRows);
  autoWidth(stockWS);
  XLSX.utils.book_append_sheet(wb, stockWS, 'Stock');

  return wb;
}

// ─── Main export function ─────────────────────────────────────────────────────

export const exportFullBackup = async (
  userId: string,
  _businessName: string,
  options: BackupOptions = {}
): Promise<void> => {
  const { fiscalYear, startMonth = 4, endMonth = 3 } = options;
  const today = new Date().toISOString().slice(0, 10);

  // Fetch master data once
  const [allBills, customers, parties, particulars] = await Promise.all([
    getAllBills(userId),
    getCustomers(userId),
    getParties(userId),      // ← correct: reads users/{userId}/parties
    getStockParticulars(userId),
  ]);

  // ── Single fiscal year → one XLSX ─────────────────────────────────────────
  if (fiscalYear) {
    const bills = allBills.filter(b =>
      isBillInFiscalYear(b.nepaliDate, fiscalYear, startMonth, endMonth)
    );
    const fyFilter = (dateStr: string) =>
      isInFiscalYear(dateStr, fiscalYear, startMonth, endMonth);

    const wb = await buildWorkbook(userId, bills, customers, parties, particulars, fyFilter);
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    triggerDownload(
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `Backup_FY-${fiscalYear}_${today}.xlsx`
    );
    return;
  }

  // ── All years → one XLSX per year in a ZIP ─────────────────────────────────
  const fiscalYears = getFiscalYearOptions();
  const zip = new JSZip();

  for (const fy of fiscalYears) {
    const bills = allBills.filter(b =>
      isBillInFiscalYear(b.nepaliDate, fy, startMonth, endMonth)
    );
    const fyFilter = (dateStr: string) =>
      isInFiscalYear(dateStr, fy, startMonth, endMonth);

    // Skip year if zero bills AND no ledger entries would fall in this year
    // (we still build it if customers/parties/stock have activity)
    const wb = await buildWorkbook(userId, bills, customers, parties, particulars, fyFilter);

    // Check if the workbook has any real data before including in zip
    const billSheet: any = wb.Sheets['Bills'];
    const custSheet: any = wb.Sheets['Customers'];
    const partySheet: any = wb.Sheets['Parties'];
    const stockSheet: any = wb.Sheets['Stock'];

    const hasData =
      (XLSX.utils.sheet_to_json(billSheet).length > 0) ||
      (XLSX.utils.sheet_to_json(custSheet).length > 0) ||
      (XLSX.utils.sheet_to_json(partySheet).length > 0) ||
      (XLSX.utils.sheet_to_json(stockSheet).length > 0);

    if (!hasData) continue;

    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    zip.file(`FY-${fy}.xlsx`, buf);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerDownload(zipBlob, `Backup_All-Years_${today}.zip`);
};
