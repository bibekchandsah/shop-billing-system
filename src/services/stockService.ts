import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  orderBy,
  runTransaction,
  Timestamp,
  where,
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
  billNo?: string,
  defaultUnit?: string,
  particularCode?: string
): Promise<string> => {
  if (!userId || !name.trim()) {
    throw new Error('User ID and Particular name are required.');
  }

  const particularId = name.toLowerCase().trim();
  const particularRef = particularDoc(userId, particularId);

  if (particularCode) {
    const codeQuery = query(stockCol(userId), where('particularCode', '==', particularCode), limit(1));
    const codeSnap = await getDocs(codeQuery);
    if (!codeSnap.empty) {
      throw new Error('Particular ID already exists.');
    }
  }

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(particularRef);
    if (snap.exists()) {
      throw new Error(`Particular "${name}" already exists.`);
    }

    // Set particular document
    transaction.set(particularRef, {
      name: name.trim(),
      currentStock: initialStock,
      defaultUnit: defaultUnit || null,
      particularCode: particularCode || null,
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
        unit: defaultUnit || undefined,
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
 * Items with the same particularId are merged so only ONE transaction touches each
 * stock document — avoiding Firestore optimistic-concurrency conflicts.
 */
export const recordBillInventory = async (
  userId: string,
  billNo: string,
  dateBs: string,
  items: BillItem[]
): Promise<void> => {
  if (!userId || items.length === 0) return;

  // Resolve true particular IDs from names to handle renamed items properly.
  const allStock = await getStockParticulars(userId);
  const nameToId = new Map(allStock.map(s => [s.name.toLowerCase().trim(), s.id]));

  // Merge rows that refer to the same stock particular so we never run two
  // concurrent transactions on the same Firestore document (which would cause
  // "stored version does not match required base version" errors).
  const merged = new Map<string, { name: string; totalQty: number; unit: string }>();
  for (const item of items) {
    const name = item.particulars.trim();
    if (!name) continue;
    const lookupName = name.toLowerCase();
    
    // Use the actual ID if the particular exists, otherwise fallback to lowercase name
    const particularId = nameToId.get(lookupName) || lookupName;

    const existing = merged.get(particularId);
    if (existing) {
      existing.totalQty += item.qty;
    } else {
      merged.set(particularId, { name, totalQty: item.qty, unit: item.unit || '' });
    }
  }

  const mergedEntries = Array.from(merged.entries());
  if (mergedEntries.length === 0) return;

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Fetch all stock particular documents inside the transaction in parallel (Reads)
      const stockRefs = mergedEntries.map(([particularId]) => particularDoc(userId, particularId));
      const snaps = await Promise.all(stockRefs.map(ref => transaction.get(ref)));

      // 2. Perform calculations and write all updates (Writes)
      snaps.forEach((snap, idx) => {
        const [particularId, { name, totalQty, unit }] = mergedEntries[idx];
        const particularRef = stockRefs[idx];
        let currentStock = 0;

        if (!snap.exists()) {
          // Auto-create particular with 0 initial stock
          transaction.set(particularRef, {
            name,
            currentStock: 0,
            defaultUnit: unit || null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        } else {
          currentStock = snap.data().currentStock || 0;
        }

        const newStock = currentStock - totalQty;

        // Add a single merged ledger record for this bill
        const entryRef = doc(ledgerCol(userId, particularId));
        transaction.set(entryRef, {
          date: dateBs,
          billNo,
          debit: 0,
          credit: totalQty,
          unit: unit || undefined,
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
    });
  } catch (err) {
    console.error(`Failed to record stock deduction:`, err);
    throw err;
  }
};


/**
 * Updates the display name for a stock particular document
 */
export const updateStockParticularName = async (
  userId: string,
  particularId: string,
  oldName: string,
  newName: string,
  defaultUnit?: string,
  particularCode?: string
): Promise<void> => {
  if (!userId || !particularId || !newName.trim()) {
    throw new Error('User ID, Particular ID and Name are required.');
  }
  const ref = particularDoc(userId, particularId);
  if (particularCode) {
    const codeQuery = query(stockCol(userId), where('particularCode', '==', particularCode), limit(1));
    const codeSnap = await getDocs(codeQuery);
    if (!codeSnap.empty && codeSnap.docs[0].id !== particularId) {
      throw new Error('Particular ID already exists.');
    }
  }
  await runTransaction(db, async (transaction) => {
    transaction.update(ref, {
      name: newName.trim(),
      defaultUnit: defaultUnit || null,
      particularCode: particularCode || null,
      updatedAt: Timestamp.now()
    });
  });

  // 2. Cascade changes to ledgers and bills
  try {
    let batch = writeBatch(db);
    let opsCount = 0;

    const addOpAndCommitIfFull = async (docRef: any, updateData: any) => {
      batch.update(docRef, updateData);
      opsCount++;
      if (opsCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opsCount = 0;
      }
    };

    // A. Update Ledger Entries (if defaultUnit is provided or explicitly empty)
    if (defaultUnit !== undefined) {
      const ledgerQuery = query(ledgerCol(userId, particularId));
      const ledgerSnap = await getDocs(ledgerQuery);
      for (const docSnap of ledgerSnap.docs) {
        await addOpAndCommitIfFull(docSnap.ref, { unit: defaultUnit || null });
      }
    }

    // B. Update Historical Bills
    if (oldName.trim()) {
      const billsQuery = query(collection(db, 'users', userId, 'bills'));
      const billsSnap = await getDocs(billsQuery);
      for (const docSnap of billsSnap.docs) {
        const data = docSnap.data();
        let updated = false;
        const items = data.items || [];
        
        const newItems = items.map((item: any) => {
          if (item.particulars?.trim().toLowerCase() === oldName.trim().toLowerCase()) {
            updated = true;
            return {
              ...item,
              particulars: newName.trim(),
              ...(defaultUnit !== undefined && { unit: defaultUnit || '' })
            };
          }
          return item;
        });

        if (updated) {
          await addOpAndCommitIfFull(docSnap.ref, { items: newItems, updatedAt: Timestamp.now() });
        }
      }
    }

    if (opsCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error('Failed to cascade particular updates to ledgers/bills:', error);
  }
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
    unit?: string;
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
      let unit = data.unit || null;
      let note = data.note || '';

      if (d.id === entryId) {
        debit = updatedData.debit;
        credit = updatedData.credit;
        date = updatedData.date;
        billNo = updatedData.billNo || null;
        unit = updatedData.unit || null;
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
          unit: unit || null,
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

  // Resolve true particular IDs from names to handle renamed items properly.
  const allStock = await getStockParticulars(userId);
  const nameToId = new Map(allStock.map(s => [s.name.toLowerCase().trim(), s.id]));

  // Deduplicate items by particularId so we only query each particular once
  const uniqueParticulars = new Map<string, string>(); // particularId -> originalName
  for (const item of items) {
    const name = item.particulars.trim();
    if (!name) continue;
    const lookupName = name.toLowerCase();
    const particularId = nameToId.get(lookupName) || lookupName;
    uniqueParticulars.set(particularId, name);
  }

  const particularEntries = Array.from(uniqueParticulars.entries());
  if (particularEntries.length === 0) return;

  try {
    // 1. Fetch all ledger subcollections in parallel
    const ledgerSnaps = await Promise.all(
      particularEntries.map(([particularId]) => {
        const q = query(ledgerCol(userId, particularId), orderBy('createdAt', 'asc'));
        return getDocs(q);
      })
    );

    // 2. Perform all deletions and updates in a single runTransaction
    await runTransaction(db, async (transaction) => {
      particularEntries.forEach(([particularId], idx) => {
        const snap = ledgerSnaps[idx];
        const particularRef = particularDoc(userId, particularId);
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
    });
  } catch (err) {
    console.error(`Failed to remove stock ledger entries for bill ${billNo}:`, err);
    throw err;
  }
};

export const checkStockParticularExists = async (userId: string, particularId: string): Promise<boolean> => {
  if (!userId || !particularId) return false;
  const snap = await getDoc(particularDoc(userId, particularId));
  return snap.exists();
};

