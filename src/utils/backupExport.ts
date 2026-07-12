import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { getAllBills } from '../services/billService';
import { getCustomers, getCustomerLedgerEntries } from '../services/customerService';
import { getParties, getPartyLedgerEntries } from '../services/partyService';
import { getStockParticulars, getLedgerEntries } from '../services/stockService';
import { getFiscalYearOptions, isBillInFiscalYear } from '../services/settingsService';
import { writeBlobToDirectory } from './directoryDB';

export interface BackupOptions {
  /** e.g. "2081-82" — undefined means ALL years */
  fiscalYear?: string;
  startMonth?: number;
  endMonth?: number;
  directoryHandle?: FileSystemDirectoryHandle | null;
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

async function buildStockParticularsListRows(
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
    const firstEntry = filtered.length > 0 ? filtered[0] : null;
    exportRows.push({
      "particular name": p.name || '',
      "particular ID": p.particularCode || '',
      "default unit": p.defaultUnit || '',
      "current stock": p.currentStock ?? '',
      "initial stock": firstEntry ? (firstEntry.debit ?? '') : '',
      "opening date": firstEntry ? (firstEntry.date || '') : '',
      "bill number": firstEntry ? (firstEntry.billNo || '') : '',
    });
  }
  return exportRows;
}

async function buildCustomerListRows(
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
    const firstEntry = filtered.length > 0 ? filtered[0] : null;
    exportRows.push({
      "customer name": c.name || '',
      "address": c.address || '',
      "contact number": c.contactNumber || '',
      "customer ID": c.customerCode || '',
      "current balance": c.currentBalance ?? '',
      "opening amount": firstEntry ? (firstEntry.debit ?? '') : '',
      "date": firstEntry ? (firstEntry.date || '') : '',
      "particular": firstEntry ? (firstEntry.particular || '') : '',
      "bill number": firstEntry ? (firstEntry.billNo || '') : '',
    });
  }
  return exportRows;
}

async function buildPartiesListRows(
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
    const firstEntry = filtered.length > 0 ? filtered[0] : null;
    exportRows.push({
      "party name": party.name || '',
      "address": party.address || '',
      "contact number": party.contactNumber || '',
      "party ID": party.partyCode || '',
      "current balance": party.currentBalance ?? '',
      "opening amount": firstEntry ? (firstEntry.debit ?? '') : '',
      "date": firstEntry ? (firstEntry.date || '') : '',
      "particular": firstEntry ? (firstEntry.particular || '') : '',
      "bill number": firstEntry ? (firstEntry.billNo || '') : '',
    });
  }
  return exportRows;
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

  // 1. bills
  const billsWS = buildBillsSheet(bills);
  XLSX.utils.book_append_sheet(wb, billsWS, 'bills');

  // 2. particulars list
  const partListRows = await buildStockParticularsListRows(particulars, userId, fyFilter);
  const partListWS = XLSX.utils.json_to_sheet(partListRows);
  autoWidth(partListWS);
  XLSX.utils.book_append_sheet(wb, partListWS, 'particulars list');

  // 3. stock
  const stockRows = await buildStockRows(particulars, userId, fyFilter);
  const stockWS = XLSX.utils.json_to_sheet(stockRows);
  autoWidth(stockWS);
  XLSX.utils.book_append_sheet(wb, stockWS, 'stock');

  // 4. customer list
  const custListRows = await buildCustomerListRows(customers, userId, fyFilter);
  const custListWS = XLSX.utils.json_to_sheet(custListRows);
  autoWidth(custListWS);
  XLSX.utils.book_append_sheet(wb, custListWS, 'customer list');

  // 5. customer
  const custRows = await buildCustomersRows(customers, userId, fyFilter);
  const custWS = XLSX.utils.json_to_sheet(custRows);
  autoWidth(custWS);
  XLSX.utils.book_append_sheet(wb, custWS, 'customer');

  // 6. parties list
  const partyListRows = await buildPartiesListRows(parties, userId, fyFilter);
  const partyListWS = XLSX.utils.json_to_sheet(partyListRows);
  autoWidth(partyListWS);
  XLSX.utils.book_append_sheet(wb, partyListWS, 'parties list');

  // 7. parties
  const partyRows = await buildPartiesRows(parties, userId, fyFilter);
  const partyWS = XLSX.utils.json_to_sheet(partyRows);
  autoWidth(partyWS);
  XLSX.utils.book_append_sheet(wb, partyWS, 'parties');

  return wb;
}

// ─── Main export function ─────────────────────────────────────────────────────

export const exportFullBackup = async (
  userId: string,
  _businessName: string,
  options: BackupOptions = {}
): Promise<void> => {
  const { fiscalYear, startMonth = 4, endMonth = 3, directoryHandle } = options;
  const today = new Date().toISOString().slice(0, 10);

  const handleSave = async (blob: Blob, filename: string) => {
    if (directoryHandle) {
      await writeBlobToDirectory(directoryHandle, filename, blob);
    } else {
      triggerDownload(blob, filename);
    }
  };

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
    await handleSave(
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
    const billSheet: any = wb.Sheets['bills'];
    const custSheet: any = wb.Sheets['customer'];
    const partySheet: any = wb.Sheets['parties'];
    const stockSheet: any = wb.Sheets['stock'];
    const particularsListSheet: any = wb.Sheets['particulars list'];
    const customerListSheet: any = wb.Sheets['customer list'];
    const partiesListSheet: any = wb.Sheets['parties list'];

    const hasData =
      (billSheet && XLSX.utils.sheet_to_json(billSheet).length > 0) ||
      (custSheet && XLSX.utils.sheet_to_json(custSheet).length > 0) ||
      (partySheet && XLSX.utils.sheet_to_json(partySheet).length > 0) ||
      (stockSheet && XLSX.utils.sheet_to_json(stockSheet).length > 0) ||
      (particularsListSheet && XLSX.utils.sheet_to_json(particularsListSheet).length > 0) ||
      (customerListSheet && XLSX.utils.sheet_to_json(customerListSheet).length > 0) ||
      (partiesListSheet && XLSX.utils.sheet_to_json(partiesListSheet).length > 0);

    if (!hasData) continue;

    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    zip.file(`FY-${fy}.xlsx`, buf);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  await handleSave(zipBlob, `Backup_All-Years_${today}.zip`);
};
