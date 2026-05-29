import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  runTransaction,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Bill, Customer, CustomerLedgerEntry } from '../types';

type BillLedgerSource = Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>;

const customersCol = (userId: string) => collection(db, 'users', userId, 'customers');

const customerDoc = (userId: string, customerId: string) =>
  doc(db, 'users', userId, 'customers', customerId);

const customerLedgerCol = (userId: string, customerId: string) =>
  collection(db, 'users', userId, 'customers', customerId, 'ledger');

const cleanText = (value: string) => value.trim().toLowerCase();

const sanitizeId = (value: string) =>
  cleanText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'customer';

export const buildCustomerId = (customer: Pick<Bill, 'customerName' | 'address' | 'contactNumber' | 'customerCode'>) => {
  const code = (customer.customerCode || '').trim();
  if (code) {
    return `code-${code}`;
  }
  const contactNumber = cleanText(customer.contactNumber || '').replace(/\D/g, '');
  if (contactNumber) {
    return `contact-${contactNumber}`;
  }

  return sanitizeId([customer.customerName, customer.address].join('-'));
};

const buildBillEntryId = (billNo: string) => `bill_${sanitizeId(billNo)}`;

const toCustomer = (id: string, data: any): Customer => ({
  id,
  name: data.name || '',
  address: data.address || '',
  contactNumber: data.contactNumber || '',
  customerCode: data.customerCode || '',
  purchaseHistory: Array.isArray(data.purchaseHistory) ? data.purchaseHistory : [],
  currentBalance: Number(data.currentBalance || 0),
  lastBillNo: data.lastBillNo || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

const toLedgerEntry = (id: string, data: any): CustomerLedgerEntry => ({
  id,
  date: data.date || '',
  particular: data.particular || '',
  billNo: data.billNo || undefined,
  debit: Number(data.debit || 0),
  credit: Number(data.credit || 0),
  currentBalance: Number(data.currentBalance || 0),
  note: data.note || undefined,
  createdAt: data.createdAt?.toDate() || new Date(),
});

export const getCustomers = async (userId: string): Promise<Customer[]> => {
  if (!userId) return [];

  const q = query(customersCol(userId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((entry) => toCustomer(entry.id, entry.data()));
};

export const getCustomerLedgerEntries = async (
  userId: string,
  customerId: string
): Promise<CustomerLedgerEntry[]> => {
  if (!userId || !customerId) return [];

  const q = query(customerLedgerCol(userId, customerId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((entry) => toLedgerEntry(entry.id, entry.data()));
};

export const upsertCustomerProfile = async (
  userId: string,
  customerId: string,
  customerData: {
    name: string;
    address: string;
    contactNumber: string;
    customerCode?: string;
    currentBalance?: number;
    lastBillNo?: string;
  }
): Promise<void> => {
  if (!userId || !customerId) {
    throw new Error('User ID and Customer ID are required.');
  }

  const ref = customerDoc(userId, customerId);

  // Normalize provided customerCode to a safe 4-char value (preserve as-is but trimmed)
  const code = (customerData.customerCode || '').trim();

  // If a customerCode is provided, check for duplicate by looking up the canonical doc id
  // that would be used when building a customer id from a code (buildCustomerId -> code-{code}).
  if (code) {
    const codeDocRef = customerDoc(userId, `code-${code}`);
    const existing = await getDoc(codeDocRef);
    if (existing.exists() && existing.id !== customerId) {
      throw new Error('Customer ID already in use by another customer.');
    }
  }

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const payload = {
      name: customerData.name.trim(),
      address: customerData.address.trim(),
      contactNumber: customerData.contactNumber.trim(),
      customerCode: code || '',
      currentBalance: Number(customerData.currentBalance || 0),
      lastBillNo: customerData.lastBillNo || '',
      updatedAt: Timestamp.now(),
    };

    if (!snap.exists()) {
      transaction.set(ref, {
        ...payload,
        purchaseHistory: [],
        createdAt: Timestamp.now(),
      });
      return;
    }

    transaction.update(ref, payload);
  });
};

export const recordBillCustomerLedger = async (
  userId: string,
  bill: BillLedgerSource
): Promise<void> => {
  if (!userId || !bill.billNo) return;

  const customerId = buildCustomerId(bill);
  const entryId = buildBillEntryId(bill.billNo);
  const ledgerRef = doc(customerLedgerCol(userId, customerId), entryId);
  const customerRef = customerDoc(userId, customerId);

  const existingEntries = await getCustomerLedgerEntries(userId, customerId);
  const previousBalance = existingEntries.length > 0 ? existingEntries[existingEntries.length - 1].currentBalance : 0;
  const newBalance = previousBalance + (bill.totalAmount || 0);

  await runTransaction(db, async (transaction) => {
    transaction.set(customerRef, {
      name: bill.customerName.trim(),
      address: bill.address.trim(),
      contactNumber: bill.contactNumber.trim(),
      customerCode: bill.customerCode || '',
      currentBalance: newBalance,
      lastBillNo: bill.billNo,
      purchaseHistory: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    transaction.set(ledgerRef, {
      date: bill.nepaliDate || bill.date,
      particular: `bill_${bill.billNo}`,
      billNo: bill.billNo,
      debit: bill.totalAmount || 0,
      credit: 0,
      currentBalance: newBalance,
      note: bill.customerName.trim() || `Bill #${bill.billNo}`,
      createdAt: Timestamp.now(),
    });
  });
};

export const removeBillCustomerLedger = async (
  userId: string,
  bill: BillLedgerSource
): Promise<void> => {
  if (!userId || !bill.billNo) return;

  const customerId = buildCustomerId(bill);
  const entryId = buildBillEntryId(bill.billNo);
  const customerRef = customerDoc(userId, customerId);
  const ledgerRef = customerLedgerCol(userId, customerId);
  const q = query(ledgerRef, orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);

  await runTransaction(db, async (transaction) => {
    let runningBalance = 0;

    snap.docs.forEach((entry) => {
      if (entry.id === entryId) {
        transaction.delete(entry.ref);
        return;
      }

      const data = entry.data();
      const debit = Number(data.debit || 0);
      const credit = Number(data.credit || 0);
      runningBalance += debit - credit;

      if (data.currentBalance !== runningBalance) {
        transaction.update(entry.ref, {
          currentBalance: runningBalance,
        });
      }
    });

    transaction.set(
      customerRef,
      {
        name: bill.customerName.trim(),
        address: bill.address.trim(),
        contactNumber: bill.contactNumber.trim(),
        currentBalance: runningBalance,
        lastBillNo: bill.billNo,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  });
};

export const syncBillCustomerLedger = async (
  userId: string,
  previousBill?: BillLedgerSource | null,
  nextBill?: BillLedgerSource | null
): Promise<void> => {
  if (previousBill?.billNo) {
    await removeBillCustomerLedger(userId, previousBill);
  }

  if (nextBill?.billNo) {
    await recordBillCustomerLedger(userId, nextBill);
  }
};

export const addCustomerLedgerEntry = async (
  userId: string,
  customerId: string,
  entryData: Omit<CustomerLedgerEntry, 'id' | 'createdAt' | 'currentBalance'>
): Promise<void> => {
  if (!userId || !customerId) {
    throw new Error('User ID and Customer ID are required.');
  }

  const customerRef = customerDoc(userId, customerId);
  const entries = await getCustomerLedgerEntries(userId, customerId);
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].currentBalance : 0;
  const nextBalance = currentBalance + (entryData.debit || 0) - (entryData.credit || 0);
  const entryRef = doc(customerLedgerCol(userId, customerId));

  await runTransaction(db, async (transaction) => {
    transaction.set(entryRef, {
      ...entryData,
      currentBalance: nextBalance,
      createdAt: Timestamp.now(),
    });

    transaction.set(
      customerRef,
      {
        currentBalance: nextBalance,
        lastBillNo: entryData.billNo || '',
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  });
};

export const updateCustomerLedgerEntry = async (
  userId: string,
  customerId: string,
  entryId: string,
  updatedData: {
    date: string;
    particular: string;
    billNo?: string;
    debit: number;
    credit: number;
    note?: string;
  }
): Promise<void> => {
  if (!userId || !customerId || !entryId) {
    throw new Error('Required IDs are missing.');
  }

  const customerRef = customerDoc(userId, customerId);
  const q = query(customerLedgerCol(userId, customerId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);

  await runTransaction(db, async (transaction) => {
    let runningBalance = 0;

    snap.docs.forEach((entry) => {
      const data = entry.data();
      let debit = Number(data.debit || 0);
      let credit = Number(data.credit || 0);
      let date = data.date;
      let particular = data.particular || '';
      let billNo = data.billNo || undefined;
      let note = data.note || '';

      if (entry.id === entryId) {
        debit = updatedData.debit;
        credit = updatedData.credit;
        date = updatedData.date;
        particular = updatedData.particular;
        billNo = updatedData.billNo || undefined;
        note = updatedData.note || '';
      }

      runningBalance += debit - credit;

      transaction.update(entry.ref, {
        date,
        particular,
        billNo,
        debit,
        credit,
        note,
        currentBalance: runningBalance,
      });
    });

    transaction.update(customerRef, {
      currentBalance: runningBalance,
      lastBillNo: updatedData.billNo || '',
      updatedAt: Timestamp.now(),
    });
  });
};

export const deleteCustomerLedgerEntry = async (
  userId: string,
  customerId: string,
  entryId: string
): Promise<void> => {
  if (!userId || !customerId || !entryId) {
    throw new Error('Required IDs are missing.');
  }

  const customerRef = customerDoc(userId, customerId);
  const q = query(customerLedgerCol(userId, customerId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);

  await runTransaction(db, async (transaction) => {
    let runningBalance = 0;

    snap.docs.forEach((entry) => {
      if (entry.id === entryId) {
        transaction.delete(entry.ref);
        return;
      }

      const data = entry.data();
      const debit = Number(data.debit || 0);
      const credit = Number(data.credit || 0);
      runningBalance += debit - credit;

      transaction.update(entry.ref, {
        currentBalance: runningBalance,
      });
    });

    transaction.update(customerRef, {
      currentBalance: runningBalance,
      updatedAt: Timestamp.now(),
    });
  });
};

export const deleteCustomerProfile = async (userId: string, customerId: string): Promise<void> => {
  if (!userId || !customerId) {
    throw new Error('User ID and Customer ID are required.');
  }

  const q = query(customerLedgerCol(userId, customerId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);

  snap.docs.forEach((entry) => batch.delete(entry.ref));
  batch.delete(customerDoc(userId, customerId));

  await batch.commit();
};
