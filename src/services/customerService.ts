import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
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

export const findCustomerByCode = async (userId: string, customerCode: string): Promise<Customer | null> => {
  if (!userId || !customerCode.trim()) return null;

  const code = customerCode.trim().toUpperCase();
  const codeDocRef = customerDoc(userId, `code-${code}`);
  const codeSnap = await getDoc(codeDocRef);
  if (codeSnap.exists()) {
    return toCustomer(codeSnap.id, codeSnap.data());
  }

  const q = query(customersCol(userId), where('customerCode', '==', code));
  const snap = await getDocs(q);
  const found = snap.docs.find((entry) => entry.id !== `code-${code}`);
  return found ? toCustomer(found.id, found.data()) : null;
};

export const upsertCustomerProfile = async (
  userId: string,
  oldCustomerId: string,
  customerData: {
    name: string;
    address: string;
    contactNumber: string;
    customerCode?: string;
    currentBalance?: number;
    lastBillNo?: string;
  }
): Promise<string> => {
  if (!userId || !oldCustomerId) {
    throw new Error('User ID and Customer ID are required.');
  }

  const code = (customerData.customerCode || '').trim();

  // Build the new document ID based on the new data
  const newCustomerId = code
    ? `code-${code}`
    : oldCustomerId; // keep old id if no code

  // If a code is used and there's an existing doc with that new ID that isn't this customer, reject
  if (newCustomerId !== oldCustomerId) {
    const newDocRef = customerDoc(userId, newCustomerId);
    const existing = await getDoc(newDocRef);
    if (existing.exists()) {
      throw new Error('Customer ID already in use by another customer.');
    }
  }

  const oldRef = customerDoc(userId, oldCustomerId);
  const oldSnap = await getDoc(oldRef);

  const payload = {
    name: customerData.name.trim(),
    address: customerData.address.trim(),
    contactNumber: customerData.contactNumber.trim(),
    customerCode: code || '',
    currentBalance: Number(customerData.currentBalance ?? (oldSnap.exists() ? oldSnap.data().currentBalance : 0)),
    lastBillNo: customerData.lastBillNo || (oldSnap.exists() ? oldSnap.data().lastBillNo || '' : ''),
    purchaseHistory: (oldSnap.exists() ? oldSnap.data().purchaseHistory : []) || [],
    createdAt: oldSnap.exists() ? oldSnap.data().createdAt : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (newCustomerId !== oldCustomerId && oldSnap.exists()) {
    // ── ID migration: copy profile + ledger to new doc, delete old ──
    const newRef = customerDoc(userId, newCustomerId);
    await setDoc(newRef, payload);

    // Copy all ledger entries to new doc
    const ledgerSnap = await getDocs(customerLedgerCol(userId, oldCustomerId));
    if (!ledgerSnap.empty) {
      let batch = writeBatch(db);
      let batchCount = 0;
      for (const entry of ledgerSnap.docs) {
        const newEntryRef = doc(customerLedgerCol(userId, newCustomerId), entry.id);
        batch.set(newEntryRef, entry.data());
        batch.delete(entry.ref);
        batchCount += 2;
        if (batchCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
      if (batchCount > 0) await batch.commit();
    }

    // Delete old profile doc
    await deleteDoc(oldRef);
  } else {
    // Same ID — just update
    if (!oldSnap.exists()) {
      await setDoc(oldRef, payload);
    } else {
      await runTransaction(db, async (transaction) => {
        transaction.update(oldRef, {
          name: payload.name,
          address: payload.address,
          contactNumber: payload.contactNumber,
          customerCode: payload.customerCode,
          currentBalance: payload.currentBalance,
          updatedAt: Timestamp.now(),
        });
      });
    }
  }

  // ── Cascade name/address/contact changes to historical bills ──
  try {
    const oldName = oldSnap.exists() ? (oldSnap.data().name || '').trim() : '';
    const oldCode = oldSnap.exists() ? (oldSnap.data().customerCode || '').trim() : '';
    const newName = payload.name;
    const newAddress = payload.address;
    const newContact = payload.contactNumber;
    const newCode = payload.customerCode;

    const nameChanged = oldName && oldName.toLowerCase() !== newName.toLowerCase();
    const codeChanged = oldCode !== newCode;

    if (nameChanged || codeChanged) {
      const billsSnap = await getDocs(collection(db, 'users', userId, 'bills'));
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const billDoc of billsSnap.docs) {
        const data = billDoc.data();
        const billCustomerName = (data.customerName || '').trim();
        const billCustomerCode = (data.customerCode || '').trim();

        // Match by old name or old code
        const matches =
          (oldName && billCustomerName.toLowerCase() === oldName.toLowerCase()) ||
          (oldCode && billCustomerCode === oldCode);

        if (matches) {
          batch.update(billDoc.ref, {
            customerName: newName,
            address: newAddress,
            contactNumber: newContact,
            customerCode: newCode,
            updatedAt: Timestamp.now(),
          });
          batchCount++;
          if (batchCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();
    }
  } catch (err) {
    console.error('Failed to cascade customer changes to bills:', err);
  }

  return newCustomerId;
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

  await runTransaction(db, async (transaction) => {
    // Read the customer doc inside the transaction to get the current balance
    const customerSnap = await transaction.get(customerRef);
    const previousBalance = customerSnap.exists()
      ? Number(customerSnap.data().currentBalance || 0)
      : 0;
    const newBalance = previousBalance + (bill.totalAmount || 0);

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

    const profileData: any = {
      name: bill.customerName.trim(),
      address: bill.address.trim(),
      contactNumber: bill.contactNumber.trim(),
      currentBalance: runningBalance,
      lastBillNo: bill.billNo,
      updatedAt: Timestamp.now(),
    };
    if (bill.customerCode) {
      profileData.customerCode = bill.customerCode;
    }

    transaction.set(
      customerRef,
      profileData,
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
    const payload = {
      ...entryData,
      billNo: entryData.billNo || '',
      currentBalance: nextBalance,
      createdAt: Timestamp.now(),
    };

    transaction.set(entryRef, payload);

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
      let billNo = data.billNo || '';
      let note = data.note || '';

      if (entry.id === entryId) {
        debit = updatedData.debit;
        credit = updatedData.credit;
        date = updatedData.date;
        particular = updatedData.particular;
        billNo = updatedData.billNo || '';
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

export const checkCustomerExists = async (userId: string, customerId: string): Promise<boolean> => {
  if (!userId || !customerId) return false;
  const snap = await getDoc(customerDoc(userId, customerId));
  return snap.exists();
};
