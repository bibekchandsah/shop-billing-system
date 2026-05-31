import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  Timestamp,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Bill } from '../types';

import { getAppSettings } from './settingsService';

// Path helper: users/{userId}/bills
const billsCol = (userId: string) =>
  collection(db, 'users', userId, 'bills');

// Doc ref helper: users/{userId}/bills/{billId}
const billDoc = (userId: string, billId: string) =>
  doc(db, 'users', userId, 'bills', billId);

// ── Create ────────────────────────────────────────────────────────────────────
export const createBill = async (
  bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const { userId, ...rest } = bill;
  const docRef = await addDoc(billsCol(userId), {
    ...rest,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

// ── Sanitize / Heal Bill Data ─────────────────────────────────────────────────
export const sanitizeBill = (id: string, userId: string, data: any): Bill => {
  const items = Array.isArray(data.items)
    ? data.items.map((item: any) => ({
        sn: Number(item.sn || 0),
        particulars: String(item.particulars || ''),
        qty: Number(item.qty || 0),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
      }))
    : [];

  let totalAmount = Number(data.totalAmount || 0);
  let totalQty = Number(data.totalQty || 0);

  // In-flight healing for corrupted / string-concatenated values
  // A threshold of 10,000,000 (1 Crore) is used to detect corrupted totals
  if (totalAmount > 10000000 && items.length > 0) {
    const computedTotal = items.reduce((sum: number, item: any) => sum + (item.qty * item.rate), 0);
    if (computedTotal > 0 && computedTotal < totalAmount) {
      totalAmount = computedTotal;
    }
  }

  // Heal totalQty if corrupted
  if (totalQty > 1000000 && items.length > 0) {
    const computedQty = items.reduce((sum: number, item: any) => sum + item.qty, 0);
    if (computedQty > 0 && computedQty < totalQty) {
      totalQty = computedQty;
    }
  }

  return {
    ...data,
    id,
    userId,
    items,
    totalAmount,
    totalQty,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Bill;
};

// ── Read all ──────────────────────────────────────────────────────────────────
export const getAllBills = async (userId: string): Promise<Bill[]> => {
  const q = query(billsCol(userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => sanitizeBill(d.id, userId, d.data()));
};

// ── Read Paginated ────────────────────────────────────────────────────────────
export const getBillsPage = async (
  userId: string,
  pageSize: number,
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ bills: Bill[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null }> => {
  let q;
  if (lastVisible) {
    q = query(billsCol(userId), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(pageSize));
  } else {
    q = query(billsCol(userId), orderBy('createdAt', 'desc'), limit(pageSize));
  }
  const snap = await getDocs(q);
  const bills = snap.docs.map((d) => sanitizeBill(d.id, userId, d.data()));
  const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { bills, nextCursor };
};

// ── Update ────────────────────────────────────────────────────────────────────
export const updateBill = async (
  userId: string,
  billId: string,
  bill: Partial<Bill>
): Promise<void> => {
  const { userId: _uid, id: _id, ...rest } = bill as any;
  await updateDoc(billDoc(userId, billId), {
    ...rest,
    updatedAt: Timestamp.now(),
  });
};

// ── Delete ────────────────────────────────────────────────────────────────────
export const deleteBill = async (userId: string, billId: string): Promise<void> => {
  await deleteDoc(billDoc(userId, billId));
};

// ── Next bill number ──────────────────────────────────────────────────────────
export const getNextBillNumber = async (userId: string): Promise<string> => {
  try {
    const settings = await getAppSettings(userId);
    const prefix = settings.billNumberFormat === 'prefix' ? (settings.billNumberPrefix || 'BILL-') : '';
    const maxBillNumber = Number.isFinite(settings.maxBillNumber) && settings.maxBillNumber > 0
      ? Math.floor(settings.maxBillNumber)
      : 100;
    const padWidth = Math.max(4, String(maxBillNumber).length);

    const qMax = query(billsCol(userId), orderBy('createdAt', 'desc'), limit(1));
    const snapMax = await getDocs(qMax);
    
    if (snapMax.empty) {
      return `${prefix}${String(1).padStart(padWidth, '0')}`;
    }

    const latestBillNo = snapMax.docs[0].data().billNo || '';
    const m = latestBillNo.match(/\d+/g);
    const lastNumStr = m ? m[m.length - 1] : '0';
    const num = parseInt(lastNumStr, 10) || 0;
    const next = num >= maxBillNumber ? 1 : num + 1;
    const padded = next.toString().padStart(padWidth, '0');
    return `${prefix}${padded}`;
  } catch (error) {
    console.error('Error generating next bill number:', error);
    try {
      const settings = await getAppSettings(userId);
      const prefix = settings.billNumberFormat === 'prefix' ? (settings.billNumberPrefix || 'BILL-') : '';
      const maxBillNumber = Number.isFinite(settings.maxBillNumber) && settings.maxBillNumber > 0
        ? Math.floor(settings.maxBillNumber)
        : 100;
      const padWidth = Math.max(4, String(maxBillNumber).length);
      return `${prefix}${String(1).padStart(padWidth, '0')}`;
    } catch {
      return '0001';
    }
  }
};
