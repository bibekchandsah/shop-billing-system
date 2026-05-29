import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Supplier, SupplierLedgerEntry } from '../types';

const suppliersCol = (userId: string) => collection(db, 'users', userId, 'suppliers');

const supplierDoc = (userId: string, supplierId: string) =>
  doc(db, 'users', userId, 'suppliers', supplierId);

const supplierLedgerCol = (userId: string, supplierId: string) =>
  collection(db, 'users', userId, 'suppliers', supplierId, 'ledger');

const cleanText = (value: string) => value.trim().toLowerCase();

const sanitizeId = (value: string) =>
  cleanText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'supplier';

export const buildSupplierId = (supplier: Pick<Supplier, 'name' | 'address' | 'contactNumber' | 'partyCode' | 'supplierCode'>) => {
  const code = (supplier.partyCode || supplier.supplierCode || '').trim();
  if (code) {
    return `code-${code}`;
  }
  const contactNumber = cleanText(supplier.contactNumber || '').replace(/\D/g, '');
  if (contactNumber) {
    return `contact-${contactNumber}`;
  }

  return sanitizeId([supplier.name, supplier.address].join('-'));
};

const toSupplier = (id: string, data: any): Supplier => ({
  id,
  name: data.name || '',
  address: data.address || '',
  contactNumber: data.contactNumber || '',
  partyCode: data.partyCode || data.supplierCode || '',
  supplierCode: data.supplierCode || data.partyCode || '',
  currentBalance: Number(data.currentBalance || 0),
  lastBillNo: data.lastBillNo || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

const toLedgerEntry = (id: string, data: any): SupplierLedgerEntry => ({
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

export const getSuppliers = async (userId: string): Promise<Supplier[]> => {
  if (!userId) return [];
  const q = query(suppliersCol(userId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((entry) => toSupplier(entry.id, entry.data()));
};

export const getSupplierLedgerEntries = async (
  userId: string,
  supplierId: string
): Promise<SupplierLedgerEntry[]> => {
  if (!userId || !supplierId) return [];

  const q = query(supplierLedgerCol(userId, supplierId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((entry) => toLedgerEntry(entry.id, entry.data()));
};

export const upsertSupplierProfile = async (
  userId: string,
  supplierId: string,
  supplierData: {
    name: string;
    address: string;
    contactNumber: string;
    partyCode?: string;
    supplierCode?: string;
    currentBalance?: number;
    lastBillNo?: string;
  }
): Promise<void> => {
  if (!userId || !supplierId) {
    throw new Error('User ID and Supplier ID are required.');
  }

  const ref = supplierDoc(userId, supplierId);
  const code = (supplierData.partyCode || supplierData.supplierCode || '').trim();

  if (code) {
    const codeDocRef = supplierDoc(userId, `code-${code}`);
    const existing = await getDoc(codeDocRef);
    if (existing.exists() && existing.id !== supplierId) {
      throw new Error('Supplier ID already in use by another supplier.');
    }
  }

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const payload = {
      name: supplierData.name.trim(),
      address: supplierData.address.trim(),
      contactNumber: supplierData.contactNumber.trim(),
      partyCode: code || '',
      supplierCode: code || '',
      currentBalance: Number(supplierData.currentBalance || 0),
      lastBillNo: supplierData.lastBillNo || '',
      updatedAt: Timestamp.now(),
    };

    if (!snap.exists()) {
      transaction.set(ref, {
        ...payload,
        createdAt: Timestamp.now(),
      });
      return;
    }

    transaction.update(ref, payload);
  });
};

export const addSupplierLedgerEntry = async (
  userId: string,
  supplierId: string,
  entryData: Omit<SupplierLedgerEntry, 'id' | 'createdAt' | 'currentBalance'>
): Promise<void> => {
  if (!userId || !supplierId) {
    throw new Error('User ID and Supplier ID are required.');
  }

  const supplierRef = supplierDoc(userId, supplierId);
  const entries = await getSupplierLedgerEntries(userId, supplierId);
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].currentBalance : 0;
  const nextBalance = currentBalance + (entryData.debit || 0) - (entryData.credit || 0);
  const entryRef = doc(supplierLedgerCol(userId, supplierId));

  await runTransaction(db, async (transaction) => {
    transaction.set(entryRef, {
      ...entryData,
      currentBalance: nextBalance,
      createdAt: Timestamp.now(),
    });

    transaction.set(
      supplierRef,
      {
        currentBalance: nextBalance,
        lastBillNo: entryData.billNo || '',
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  });
};

export const updateSupplierLedgerEntry = async (
  userId: string,
  supplierId: string,
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
  if (!userId || !supplierId || !entryId) {
    throw new Error('Required IDs are missing.');
  }

  const supplierRef = supplierDoc(userId, supplierId);
  const q = query(supplierLedgerCol(userId, supplierId), orderBy('createdAt', 'asc'));
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

    transaction.update(supplierRef, {
      currentBalance: runningBalance,
      lastBillNo: updatedData.billNo || '',
      updatedAt: Timestamp.now(),
    });
  });
};

export const deleteSupplierLedgerEntry = async (
  userId: string,
  supplierId: string,
  entryId: string
): Promise<void> => {
  if (!userId || !supplierId || !entryId) {
    throw new Error('Required IDs are missing.');
  }

  const supplierRef = supplierDoc(userId, supplierId);
  const q = query(supplierLedgerCol(userId, supplierId), orderBy('createdAt', 'asc'));
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

    transaction.update(supplierRef, {
      currentBalance: runningBalance,
      updatedAt: Timestamp.now(),
    });
  });
};

export const deleteSupplierProfile = async (userId: string, supplierId: string): Promise<void> => {
  if (!userId || !supplierId) {
    throw new Error('User ID and Supplier ID are required.');
  }

  const q = query(supplierLedgerCol(userId, supplierId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);

  snap.docs.forEach((entry) => batch.delete(entry.ref));
  batch.delete(supplierDoc(userId, supplierId));

  await batch.commit();
};