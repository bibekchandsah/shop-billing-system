import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  orderBy,
  query,
  where,
  runTransaction,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Party, PartyLedgerEntry } from '../types';

const partiesCol = (userId: string) => collection(db, 'users', userId, 'parties');

const partyDoc = (userId: string, partyId: string) =>
  doc(db, 'users', userId, 'parties', partyId);

const partyLedgerCol = (userId: string, partyId: string) =>
  collection(db, 'users', userId, 'parties', partyId, 'ledger');

const cleanText = (value: string) => value.trim().toLowerCase();

const sanitizeId = (value: string) =>
  cleanText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'party';

export const buildPartyId = (party: Pick<Party, 'name' | 'address' | 'contactNumber' | 'partyCode'>) => {
  const code = (party.partyCode || '').trim();
  if (code) {
    return `code-${code}`;
  }
  const contactNumber = cleanText(party.contactNumber || '').replace(/\D/g, '');
  if (contactNumber) {
    return `contact-${contactNumber}`;
  }

  return sanitizeId([party.name, party.address].join('-'));
};

const toParty = (id: string, data: any): Party => ({
  id,
  name: data.name || '',
  address: data.address || '',
  contactNumber: data.contactNumber || '',
  partyCode: data.partyCode || data.supplierCode || '',
  currentBalance: Number(data.currentBalance || 0),
  lastBillNo: data.lastBillNo || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

const toLedgerEntry = (id: string, data: any): PartyLedgerEntry => ({
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

export const getParties = async (userId: string): Promise<Party[]> => {
  if (!userId) return [];
  const q = query(partiesCol(userId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((entry) => toParty(entry.id, entry.data()));
};

export const getPartyLedgerEntries = async (
  userId: string,
  partyId: string
): Promise<PartyLedgerEntry[]> => {
  if (!userId || !partyId) return [];

  const q = query(partyLedgerCol(userId, partyId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((entry) => toLedgerEntry(entry.id, entry.data()));
};

export const upsertPartyProfile = async (
  userId: string,
  oldPartyId: string,
  partyData: {
    name: string;
    address: string;
    contactNumber: string;
    partyCode?: string;
    currentBalance?: number;
    lastBillNo?: string;
  }
): Promise<string> => {
  if (!userId || !oldPartyId) {
    throw new Error('User ID and Party ID are required.');
  }

  const code = (partyData.partyCode || '').trim();

  // Build the new document ID based on updated code
  const newPartyId = code ? `code-${code}` : oldPartyId;

  // If ID will change, check the new doc doesn't already belong to someone else
  if (newPartyId !== oldPartyId) {
    const newDocRef = partyDoc(userId, newPartyId);
    const existing = await getDoc(newDocRef);
    if (existing.exists()) {
      throw new Error('Party ID already in use by another party.');
    }
  } else if (code) {
    // Same ID but check field-level duplicates (legacy records)
    const q = query(partiesCol(userId), where('partyCode', '==', code));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id !== oldPartyId) {
        throw new Error('Party ID already in use by another party.');
      }
    }
  }

  const oldRef = partyDoc(userId, oldPartyId);
  const oldSnap = await getDoc(oldRef);

  const payload = {
    name: partyData.name.trim(),
    address: partyData.address.trim(),
    contactNumber: partyData.contactNumber.trim(),
    partyCode: code || '',
    supplierCode: code || '',
    currentBalance: Number(partyData.currentBalance ?? (oldSnap.exists() ? oldSnap.data().currentBalance : 0)),
    lastBillNo: partyData.lastBillNo || (oldSnap.exists() ? oldSnap.data().lastBillNo || '' : ''),
    createdAt: oldSnap.exists() ? oldSnap.data().createdAt : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (newPartyId !== oldPartyId && oldSnap.exists()) {
    // ── ID migration: copy profile + ledger to new doc, delete old ──
    const newRef = partyDoc(userId, newPartyId);
    await setDoc(newRef, payload);

    // Copy all ledger entries to new doc
    const ledgerSnap = await getDocs(partyLedgerCol(userId, oldPartyId));
    if (!ledgerSnap.empty) {
      let batch = writeBatch(db);
      let batchCount = 0;
      for (const entry of ledgerSnap.docs) {
        const newEntryRef = doc(partyLedgerCol(userId, newPartyId), entry.id);
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
    // Same ID — just update in place
    if (!oldSnap.exists()) {
      await setDoc(oldRef, payload);
    } else {
      await runTransaction(db, async (transaction) => {
        transaction.update(oldRef, {
          name: payload.name,
          address: payload.address,
          contactNumber: payload.contactNumber,
          partyCode: payload.partyCode,
          supplierCode: payload.supplierCode,
          currentBalance: payload.currentBalance,
          updatedAt: Timestamp.now(),
        });
      });
    }
  }

  return newPartyId;
};

export const addPartyLedgerEntry = async (
  userId: string,
  partyId: string,
  entryData: Omit<PartyLedgerEntry, 'id' | 'createdAt' | 'currentBalance'>
): Promise<void> => {
  if (!userId || !partyId) {
    throw new Error('User ID and Party ID are required.');
  }

  const partyRef = partyDoc(userId, partyId);
  const entries = await getPartyLedgerEntries(userId, partyId);
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].currentBalance : 0;
  const nextBalance = currentBalance + (entryData.debit || 0) - (entryData.credit || 0);
  const entryRef = doc(partyLedgerCol(userId, partyId));

  await runTransaction(db, async (transaction) => {
    const payload = {
      ...entryData,
      billNo: entryData.billNo || '',
      currentBalance: nextBalance,
      createdAt: Timestamp.now(),
    };

    transaction.set(entryRef, payload);

    transaction.set(
      partyRef,
      {
        currentBalance: nextBalance,
        lastBillNo: entryData.billNo || '',
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  });
};

export const updatePartyLedgerEntry = async (
  userId: string,
  partyId: string,
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
  if (!userId || !partyId || !entryId) {
    throw new Error('Required IDs are missing.');
  }

  const partyRef = partyDoc(userId, partyId);
  const q = query(partyLedgerCol(userId, partyId), orderBy('createdAt', 'asc'));
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

    transaction.update(partyRef, {
      currentBalance: runningBalance,
      lastBillNo: updatedData.billNo || '',
      updatedAt: Timestamp.now(),
    });
  });
};

export const deletePartyLedgerEntry = async (
  userId: string,
  partyId: string,
  entryId: string
): Promise<void> => {
  if (!userId || !partyId || !entryId) {
    throw new Error('Required IDs are missing.');
  }

  const partyRef = partyDoc(userId, partyId);
  const q = query(partyLedgerCol(userId, partyId), orderBy('createdAt', 'asc'));
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

    transaction.update(partyRef, {
      currentBalance: runningBalance,
      updatedAt: Timestamp.now(),
    });
  });
};

export const deletePartyProfile = async (userId: string, partyId: string): Promise<void> => {
  if (!userId || !partyId) {
    throw new Error('User ID and Party ID are required.');
  }

  const q = query(partyLedgerCol(userId, partyId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);

  snap.docs.forEach((entry) => batch.delete(entry.ref));
  batch.delete(partyDoc(userId, partyId));

  await batch.commit();
};

export const checkPartyExists = async (userId: string, partyId: string): Promise<boolean> => {
  if (!userId || !partyId) return false;
  const snap = await getDoc(partyDoc(userId, partyId));
  return snap.exists();
};