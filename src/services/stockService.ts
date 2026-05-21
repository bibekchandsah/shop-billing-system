import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  runTransaction,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { StockParticular, StockLedgerEntry, BillItem } from '../types';

// Helper to get stock collection: users/{userId}/stock
const stockCol = (userId: string) => collection(db, 'users', userId, 'stock');

// Helper to get particular doc: users/{userId}/stock/{particularId}
const particularDoc = (userId: string, particularId: string) =>
  doc(db, 'users', userId, 'stock', particularId);

// Helper to get ledger collection: users/{userId}/stock/{particularId}/ledger
const ledgerCol = (userId: string, particularId: string) =>
  collection(db, 'users', userId, 'stock', particularId, 'ledger');

/**
 * Fetch all stock particulars for a user
 */
export const getStockParticulars = async (userId: string): Promise<StockParticular[]> => {
  if (!userId) return [];
  const q = query(stockCol(userId), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate() || new Date(),
    updatedAt: d.data().updatedAt?.toDate() || new Date()
  })) as StockParticular[];
};

/**
 * Fetch all ledger entries for a specific stock particular, sorted chronologically
 */
export const getLedgerEntries = async (
  userId: string,
  particularId: string
): Promise<StockLedgerEntry[]> => {
  if (!userId || !particularId) return [];
  const q = query(ledgerCol(userId, particularId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate() || new Date()
  })) as StockLedgerEntry[];
};

/**
 * Creates a new stock particular document and writes an optional initial ledger entry
 */
export const createStockParticular = async (
  userId: string,
  name: string,
  initialStock: number,
  dateBs: string,
  billNo?: string
): Promise<string> => {
  if (!userId || !name.trim()) {
    throw new Error('User ID and Particular name are required.');
  }

  const particularId = name.toLowerCase().trim();
  const particularRef = particularDoc(userId, particularId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(particularRef);
    if (snap.exists()) {
      throw new Error(`Particular "${name}" already exists.`);
    }

    // Set particular document
    transaction.set(particularRef, {
      name: name.trim(),
      currentStock: initialStock,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Write initial stock ledger entry if initialStock is defined
    if (initialStock > 0) {
      const entryRef = doc(ledgerCol(userId, particularId));
      transaction.set(entryRef, {
        date: dateBs,
        billNo: billNo?.trim() || undefined,
        debit: initialStock,
        credit: 0,
        currentStock: initialStock,
        note: billNo?.trim() ? `Initial Stock (Bill #${billNo.trim()})` : 'Initial Stock',
        createdAt: Timestamp.now()
      });
    }
  });

  return particularId;
};

/**
 * Adds a new transaction to the stock ledger and updates current stock levels atomically
 */
export const addLedgerEntry = async (
  userId: string,
  particularId: string,
  entryData: Omit<StockLedgerEntry, 'id' | 'createdAt' | 'currentStock'>
): Promise<void> => {
  if (!userId || !particularId) {
    throw new Error('User ID and Particular ID are required.');
  }

  const particularRef = particularDoc(userId, particularId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(particularRef);
    if (!snap.exists()) {
      throw new Error('Particular does not exist.');
    }

    const currentStock = snap.data().currentStock || 0;
    const newStock = currentStock + entryData.debit - entryData.credit;

    if (newStock < 0) {
      throw new Error(`Insufficient stock. Cannot credit more than the current stock of ${currentStock} Qty.`);
    }

    // Write the transaction
    const entryRef = doc(ledgerCol(userId, particularId));
    transaction.set(entryRef, {
      ...entryData,
      currentStock: newStock,
      createdAt: Timestamp.now()
    });

    // Update main particular document
    transaction.update(particularRef, {
      currentStock: newStock,
      updatedAt: Timestamp.now()
    });
  });
};

/**
 * Automatically records credits (stock outputs) for items in a saved bill.
 * Creates particulars with negative stock dynamically if they don't already exist.
 */
export const recordBillInventory = async (
  userId: string,
  billNo: string,
  dateBs: string,
  items: BillItem[]
): Promise<void> => {
  if (!userId || items.length === 0) return;

  for (const item of items) {
    const name = item.particulars.trim();
    const particularId = name.toLowerCase().trim();
    if (!particularId) continue;

    const particularRef = particularDoc(userId, particularId);

    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(particularRef);
        let currentStock = 0;

        if (!snap.exists()) {
          // Auto-create particular with 0 initial stock
          transaction.set(particularRef, {
            name,
            currentStock: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        } else {
          currentStock = snap.data().currentStock || 0;
        }

        const newStock = currentStock - item.qty;

        // Add ledger record
        const entryRef = doc(ledgerCol(userId, particularId));
        transaction.set(entryRef, {
          date: dateBs,
          billNo,
          debit: 0,
          credit: item.qty,
          currentStock: newStock,
          note: `Sale (Bill #${billNo})`,
          createdAt: Timestamp.now()
        });

        // Update current stock level
        transaction.update(particularRef, {
          currentStock: newStock,
          updatedAt: Timestamp.now()
        });
      });
    } catch (err) {
      console.error(`Failed to record stock deduction for item "${name}":`, err);
    }
  }
};

/**
 * Updates the display name for a stock particular document
 */
export const updateStockParticularName = async (
  userId: string,
  particularId: string,
  newName: string
): Promise<void> => {
  if (!userId || !particularId || !newName.trim()) {
    throw new Error('User ID, Particular ID and Name are required.');
  }
  const ref = particularDoc(userId, particularId);
  await runTransaction(db, async (transaction) => {
    transaction.update(ref, {
      name: newName.trim(),
      updatedAt: Timestamp.now()
    });
  });
};

/**
 * Deletes a stock particular along with its complete nested ledger collection
 */
export const deleteStockParticular = async (
  userId: string,
  particularId: string
): Promise<void> => {
  if (!userId || !particularId) {
    throw new Error('User ID and Particular ID are required.');
  }

  // 1. Fetch all nested ledger entries
  const q = query(ledgerCol(userId, particularId));
  const snap = await getDocs(q);

  // 2. Execute deletion using a batch write
  const batch = writeBatch(db);

  snap.docs.forEach((d) => {
    batch.delete(d.ref);
  });

  // Delete the parent stock document itself
  batch.delete(particularDoc(userId, particularId));

  await batch.commit();
};

/**
 * Updates a ledger transaction and automatically recalculates all chronologically succeeding running balances
 */
export const updateLedgerEntry = async (
  userId: string,
  particularId: string,
  entryId: string,
  updatedData: {
    date: string;
    billNo?: string;
    debit: number;
    credit: number;
    note?: string;
  }
): Promise<void> => {
  if (!userId || !particularId || !entryId) {
    throw new Error('Required IDs are missing.');
  }

  const particularRef = particularDoc(userId, particularId);

  const q = query(ledgerCol(userId, particularId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);

  await runTransaction(db, async (transaction) => {
    let runningStock = 0;

    // 2. Iterate and sequential recompute all ledger running balances
    snap.docs.forEach((d) => {
      const data = d.data();
      let debit = data.debit || 0;
      let credit = data.credit || 0;
      let date = data.date;
      let billNo = data.billNo || null;
      let note = data.note || '';

      if (d.id === entryId) {
        debit = updatedData.debit;
        credit = updatedData.credit;
        date = updatedData.date;
        billNo = updatedData.billNo || null;
        note = updatedData.note || '';

        runningStock += debit - credit;
        if (runningStock < 0) {
          throw new Error(`This change would result in a negative stock balance of ${runningStock} Qty.`);
        }
        transaction.update(d.ref, {
          debit,
          credit,
          date,
          billNo: billNo || null,
          note,
          currentStock: runningStock
        });
      } else {
        runningStock += debit - credit;
        if (runningStock < 0) {
          throw new Error(`This change would result in a negative stock balance of ${runningStock} Qty at a later transaction date (${date}).`);
        }
        if (data.currentStock !== runningStock) {
          transaction.update(d.ref, {
            currentStock: runningStock
          });
        }
      }
    });

    // 3. Update the parent particular's stock balance
    transaction.update(particularRef, {
      currentStock: runningStock,
      updatedAt: Timestamp.now()
    });
  });
};

/**
 * Deletes a ledger transaction and automatically recalculates remaining running balances chronologically
 */
export const deleteLedgerEntry = async (
  userId: string,
  particularId: string,
  entryId: string
): Promise<void> => {
  if (!userId || !particularId || !entryId) {
    throw new Error('Required IDs are missing.');
  }

  const particularRef = particularDoc(userId, particularId);

  const q = query(ledgerCol(userId, particularId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);

  await runTransaction(db, async (transaction) => {
    let runningStock = 0;

    // 2. Recalculate remaining entries' running balances
    snap.docs.forEach((d) => {
      if (d.id === entryId) {
        transaction.delete(d.ref);
      } else {
        const data = d.data();
        const debit = data.debit || 0;
        const credit = data.credit || 0;
        runningStock += debit - credit;

        if (runningStock < 0) {
          throw new Error(`Deleting this transaction would result in a negative stock balance of ${runningStock} Qty at a later date (${data.date}).`);
        }

        if (data.currentStock !== runningStock) {
          transaction.update(d.ref, {
            currentStock: runningStock
          });
        }
      }
    });

    // 3. Update stock levels on parent particular
    transaction.update(particularRef, {
      currentStock: runningStock,
      updatedAt: Timestamp.now()
    });
  });
};

/**
 * Reverses/removes stock ledger entries associated with a bill and updates parent stock balance.
 */
export const removeBillInventory = async (
  userId: string,
  billNo: string,
  items: BillItem[]
): Promise<void> => {
  if (!userId || !billNo || !items || items.length === 0) return;

  for (const item of items) {
    const name = item.particulars.trim();
    const particularId = name.toLowerCase().trim();
    if (!particularId) continue;

    const particularRef = particularDoc(userId, particularId);

    try {
      const q = query(ledgerCol(userId, particularId), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);

      await runTransaction(db, async (transaction) => {
        let runningStock = 0;
        let modified = false;

        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.billNo === billNo) {
            transaction.delete(d.ref);
            modified = true;
          } else {
            const debit = data.debit || 0;
            const credit = data.credit || 0;
            runningStock += debit - credit;

            if (data.currentStock !== runningStock) {
              transaction.update(d.ref, {
                currentStock: runningStock
              });
              modified = true;
            }
          }
        });

        if (modified) {
          transaction.update(particularRef, {
            currentStock: runningStock,
            updatedAt: Timestamp.now()
          });
        }
      });
    } catch (err) {
      console.error(`Failed to remove stock ledger entries for item "${name}":`, err);
    }
  }
};

