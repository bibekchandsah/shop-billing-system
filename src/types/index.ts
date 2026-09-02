export interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  customerCode?: string;
  purchaseHistory: string[];
  currentBalance?: number;
  lastBillNo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillItem {
  sn: number;
  particulars: string;
  qty: number;
  unit?: string;
  rate: number;
  amount: number;
}

export interface Bill {
  id: string;
  userId: string;
  billNo: string;
  date: string;
  nepaliDate: string;
  customerName: string;
  address: string;
  contactNumber: string;
  customerCode?: string;
  items: BillItem[];
  totalAmount: number;
  totalAmountInWords: string;
  totalQty?: number;
  paymentMethod?: 'Cash' | 'Due' | 'Mobile Payment' | 'Card' | 'Other';
  freeDue: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Theme = 'light' | 'dark' | 'system';
export type NumberSystem = 'devanagari' | 'international';

export interface AppSettings {
  theme: Theme;
  businessName: string;
  businessAddress: string;
  businessContact: string;
  /** Custom bill header title shown on bills and PDFs */
  billTitle: string;
  actionPinHash?: string;
  maxBillNumber: number;
  billNumberFormat: 'numeric' | 'prefix';
  billNumberPrefix: string;
  /** Number formatting system: Devanagari (20,45,789) or International (2,045,789) */
  numberSystem?: NumberSystem;
  /** Unit dropdown options for billing items */
  unitCategories: string[];
  /** Primary action button for billing screen */
  billPrimaryAction: 'save' | 'pdf' | 'print';
  /** Extra bill actions to run when primary button is clicked */
  billActionAutoSave: boolean;
  billActionAutoGeneratePdf: boolean;
  billActionAutoPrint: boolean;
  billActionAutoClear: boolean;
  /** Base font size (px) used for printed bills and PDFs */
  printFontSize: number;
  /** Number of default print copies (1 or 2). Default: 1 */
  printCopies: number;
  /** BS month number (1–12) when the fiscal year starts. Default: 4 (Shrawan) */
  fiscalYearStart: number;
  /** BS month number (1–12) when the fiscal year ends. Default: 3 (Ashadh) */
  fiscalYearEnd: number;
  /** Active fiscal year label, e.g. "2080-81" */
  activeFiscalYear: string;
  backupReminderFrequency?: 'none' | 'daily' | 'weekly' | 'monthly';
  backupReminderTime?: string;
}

export interface StockParticular {
  id: string;
  name: string;
  currentStock: number;
  defaultUnit?: string;
  particularCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockLedgerEntry {
  id: string;
  date: string;
  billNo?: string;
  debit: number;
  credit: number;
  unit?: string;
  currentStock: number;
  note?: string;
  createdAt: Date;
}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  particular: string;
  billNo?: string;
  debit: number;
  credit: number;
  currentBalance: number;
  note?: string;
  createdAt: Date;
}

export interface Party {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  partyCode?: string;
  supplierCode?: string;
  currentBalance?: number;
  lastBillNo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartyLedgerEntry {
  id: string;
  date: string;
  particular: string;
  billNo?: string;
  debit: number;
  credit: number;
  currentBalance: number;
  note?: string;
  createdAt: Date;
}

export type Supplier = Party;
export type SupplierLedgerEntry = PartyLedgerEntry;
