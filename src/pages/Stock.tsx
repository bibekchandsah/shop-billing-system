import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useFiscalYear } from '../context/FiscalYearContext';
import ToastContainer from '../components/ToastContainer';
import { useActionPinGuard } from '../hooks/useActionPinGuard';
import { printStockLedger } from '../utils/printStockLedger';
import {
  getStockParticulars,
  getLedgerEntries,
  createStockParticular,
  addLedgerEntry,
  updateStockParticularName,
  deleteStockParticular,
  updateLedgerEntry,
  deleteLedgerEntry
} from '../services/stockService';
import { DEFAULT_SETTINGS } from '../services/settingsService';
import type { StockParticular, StockLedgerEntry } from '../types';
import NepaliDatePickerComponent, { type NepaliDatePickerHandle } from '../components/NepaliDatePicker';
import { getCurrentNepaliDate, toNepaliDate } from '../utils/nepaliDate';
import Papa from 'papaparse';
import './Stock.css';

const Stock: React.FC = () => {
  const { user } = useAuth();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  const { settings, isInActiveFY } = useFiscalYear();
  const { requestAction, pinPrompt } = useActionPinGuard({ pinHash: settings?.actionPinHash, showError });

  // Stock Lists & Ledger States
  const [particulars, setParticulars] = useState<StockParticular[]>([]);
  const [selectedParticular, setSelectedParticular] = useState<StockParticular | null>(null);
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  
  // Loading States
  const [loadingParticulars, setLoadingParticulars] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // App Settings — loaded from FiscalYearContext
  const appSettings = settings;
  const unitOptions = appSettings?.unitCategories ?? DEFAULT_SETTINGS.unitCategories;
  const defaultUnit = unitOptions[0] ?? '';
  const getParticularDefaultUnit = (particular?: StockParticular | null) =>
    particular?.defaultUnit || defaultUnit;

  const normalizeParticularCode = (value: string) => value.replace(/\D/g, '').slice(0, 5);
  const formatParticularCode = (value: string) => {
    const digits = normalizeParticularCode(value);
    return digits ? digits.padStart(5, '0') : '';
  };
  const getNextParticularCode = () => {
    const usedCodes = new Set(
      particulars
        .map(p => formatParticularCode(p.particularCode || ''))
        .filter(Boolean)
    );
    let max = 0;
    usedCodes.forEach((code) => {
      const value = parseInt(code, 10);
      if (!Number.isNaN(value)) {
        max = Math.max(max, value);
      }
    });
    let next = max + 1;
    let nextCode = String(next).padStart(5, '0');
    while (usedCodes.has(nextCode)) {
      next += 1;
      nextCode = String(next).padStart(5, '0');
    }
    return nextCode;
  };

  const capitalizeWords = (str: string) => {
    return str.replace(/(^|[\s\-./])([a-z])/g, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`);
  };

  // Filter States
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modals visibility
  const [showAddParticular, setShowAddParticular] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [isParticularsCollapsed, setIsParticularsCollapsed] = useState(false);

  // New Particular Form States
  const [newPartName, setNewPartName] = useState('');
  const [newPartInitialStock, setNewPartInitialStock] = useState<number>(0);
  const [newPartUnit, setNewPartUnit] = useState('');
  const [newPartCode, setNewPartCode] = useState('');
  const [newPartDate, setNewPartDate] = useState('');
  const [newPartBillNo, setNewPartBillNo] = useState('');
  const [addPartLoading, setAddPartLoading] = useState(false);
  const addPartDatePickerRef = useRef<NepaliDatePickerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Transaction Form States
  const [txType, setTxType] = useState<'debit' | 'credit'>('debit');
  const [txQty, setTxQty] = useState<number>(0);
  const [txUnit, setTxUnit] = useState('');
  const [txBillNo, setTxBillNo] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txDate, setTxDate] = useState('');
  const [addTxLoading, setAddTxLoading] = useState(false);
  const addTxDatePickerRef = useRef<NepaliDatePickerHandle>(null);

  // Edit Particular States
  const [showEditParticular, setShowEditParticular] = useState(false);
  const [editPartName, setEditPartName] = useState('');
  const [editPartUnit, setEditPartUnit] = useState('');
  const [editPartCode, setEditPartCode] = useState('');
  const [editPartLoading, setEditPartLoading] = useState(false);
  const [showDeleteParticularConfirm, setShowDeleteParticularConfirm] = useState(false);
  const [deletePartLoading, setDeletePartLoading] = useState(false);

  // Edit Transaction Form States
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<StockLedgerEntry | null>(null);
  const [editTxType, setEditTxType] = useState<'debit' | 'credit'>('debit');
  const [editTxQty, setEditTxQty] = useState<number>(0);
  const [editTxUnit, setEditTxUnit] = useState('');
  const [editTxBillNo, setEditTxBillNo] = useState('');
  const [editTxNote, setEditTxNote] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxLoading, setEditTxLoading] = useState(false);
  const editTxDatePickerRef = useRef<NepaliDatePickerHandle>(null);

  // Delete Transaction Confirm States
  const [showDeleteTransactionConfirm, setShowDeleteTransactionConfirm] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<StockLedgerEntry | null>(null);
  const [deleteTxLoading, setDeleteTxLoading] = useState(false);

  // Fetch particulars on mount or user change
  useEffect(() => {
    loadParticulars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Fetch ledger whenever selected particular changes
  useEffect(() => {
    if (selectedParticular) {
      loadLedger(selectedParticular.id);
    } else {
      setLedger([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParticular]);

  const loadParticulars = async () => {
    setLoadingParticulars(true);
    try {
      const data = await getStockParticulars(user?.uid || '');
      setParticulars(data);
    } catch (error) {
      console.error('Error fetching particulars:', error);
      showError('Failed to load stock list.');
    } finally {
      setLoadingParticulars(false);
    }
  };

  const loadLedger = async (particularId: string) => {
    setLoadingLedger(true);
    try {
      const data = await getLedgerEntries(user?.uid || '', particularId);
      setLedger(data);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      showError('Failed to load ledger history.');
    } finally {
      setLoadingLedger(false);
    }
  };

  // Handle creating a new stock particular
  const handleCreateParticular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) {
      showError('Please enter a valid item name.');
      return;
    }
    const resolvedCode = formatParticularCode(newPartCode || getNextParticularCode());
    if (!resolvedCode || resolvedCode.length !== 5) {
      showError('Please enter a valid 5-digit particular ID.');
      return;
    }
    const isCodeDuplicate = particulars.some(
      p => formatParticularCode(p.particularCode || '') === resolvedCode
    );
    if (isCodeDuplicate) {
      showError('Particular ID already exists. Please use a different ID.');
      return;
    }
    if (newPartInitialStock > 0 && !newPartBillNo.trim()) {
      showError('Please enter a valid bill number for the initial stock.');
      return;
    }

    setAddPartLoading(true);
    try {
      const dateVal = newPartDate || getCurrentNepaliDate();
      const particularId = await createStockParticular(
        user?.uid || '',
        newPartName.trim(),
        newPartInitialStock,
        dateVal,
        newPartBillNo,
        newPartUnit || undefined,
        resolvedCode
      );

      showSuccess(`Particular "${newPartName}" added successfully.`);
      setShowAddParticular(false);
      
      // Reset Form
      setNewPartName('');
      setNewPartInitialStock(0);
      setNewPartUnit(defaultUnit);
      setNewPartCode(getNextParticularCode());
      setNewPartDate('');
      setNewPartBillNo('');

      // Reload particulars list
      await loadParticulars();
      
      // Auto-select the newly created item
      const addedParticular = particulars.find(p => p.id === particularId) || {
        id: particularId,
        name: newPartName.trim(),
        currentStock: newPartInitialStock,
        defaultUnit: newPartUnit || undefined,
        particularCode: resolvedCode,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setSelectedParticular(addedParticular);
    } catch (error: any) {
      console.error('Error creating particular:', error);
      showError(error.message || 'Failed to add particular.');
    } finally {
      setAddPartLoading(false);
    }
  };

  // Handle adding a manual transaction (Debit/Credit) to a ledger
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParticular) return;
    if (txQty <= 0) {
      showError('Please enter a quantity greater than 0.');
      return;
    }
    if (!txBillNo.trim()) {
      showError('Please enter a valid bill number.');
      return;
    }
    const isCredit = txType === 'credit';
    if (isCredit && txQty > selectedParticular.currentStock) {
      showError(`Insufficient stock. Cannot credit ${txQty} Qty. Only ${selectedParticular.currentStock} Qty available.`);
      return;
    }

    setAddTxLoading(true);
    try {
      const dateVal = txDate || getCurrentNepaliDate();
      const isDebit = txType === 'debit';
      const debitQty = isDebit ? txQty : 0;
      const creditQty = isDebit ? 0 : txQty;
      const resolvedUnit = txUnit || getParticularDefaultUnit(selectedParticular);

      await addLedgerEntry(user?.uid || '', selectedParticular.id, {
        date: dateVal,
        billNo: txBillNo.trim() || undefined,
        debit: debitQty,
        credit: creditQty,
        unit: resolvedUnit || undefined,
        note: txNote.trim() || (isDebit ? 'Manual Stock In' : 'Manual Adjustment Out')
      });

      showSuccess('Transaction added to ledger.');
      setShowAddTransaction(false);

      // Reset transaction form
      setTxQty(0);
      setTxUnit(getParticularDefaultUnit(selectedParticular));
      setTxBillNo('');
      setTxNote('');
      setTxDate('');
      setTxType('debit');

      // Reload ledger entries and refresh particular's stock balance
      await loadLedger(selectedParticular.id);
      
      // Update locally selected particular currentStock so the badges refresh
      const refreshedParticulars = await getStockParticulars(user?.uid || '');
      setParticulars(refreshedParticulars);
      const updatedItem = refreshedParticulars.find(p => p.id === selectedParticular.id);
      if (updatedItem) {
        setSelectedParticular(updatedItem);
      }
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      showError(error.message || 'Failed to record transaction.');
    } finally {
      setAddTxLoading(false);
    }
  };

  // Rename stock particular
  const handleEditParticularName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParticular || !editPartName.trim()) {
      showError('Please enter a valid name.');
      return;
    }
    const resolvedCode = formatParticularCode(editPartCode || '');
    if (!resolvedCode || resolvedCode.length !== 5) {
      showError('Please enter a valid 5-digit particular ID.');
      return;
    }
    const isDuplicateCode = particulars.some(
      p => p.id !== selectedParticular.id && formatParticularCode(p.particularCode || '') === resolvedCode
    );
    if (isDuplicateCode) {
      showError('Particular ID already exists. Please use a different ID.');
      return;
    }
    setEditPartLoading(true);
    try {
      await updateStockParticularName(
        user?.uid || '',
        selectedParticular.id,
        editPartName.trim(),
        editPartUnit || undefined,
        resolvedCode
      );
      showSuccess('Particular renamed successfully.');
      setShowEditParticular(false);
      
      // Reload and update UI
      await loadParticulars();
      setSelectedParticular(prev => prev ? {
        ...prev,
        name: editPartName.trim(),
        defaultUnit: editPartUnit || undefined,
        particularCode: resolvedCode
      } : null);
    } catch (error: any) {
      console.error('Error renaming particular:', error);
      showError(error.message || 'Failed to rename particular.');
    } finally {
      setEditPartLoading(false);
    }
  };

  // Delete stock particular and cascade child entries
  const handleDeleteParticular = async () => {
    if (!selectedParticular) return;
    setDeletePartLoading(true);
    try {
      await deleteStockParticular(user?.uid || '', selectedParticular.id);
      showSuccess('Particular and its entire ledger deleted successfully.');
      setShowDeleteParticularConfirm(false);
      setSelectedParticular(null);
      
      // Reload particulars list
      await loadParticulars();
    } catch (error: any) {
      console.error('Error deleting particular:', error);
      showError(error.message || 'Failed to delete particular.');
    } finally {
      setDeletePartLoading(false);
    }
  };

  // Open edit transaction modal pre-filled
  const openEditTransactionModal = (entry: StockLedgerEntry) => {
    setEditingTransaction(entry);
    setEditTxType(entry.debit > 0 ? 'debit' : 'credit');
    setEditTxQty(entry.debit > 0 ? entry.debit : entry.credit);
    setEditTxUnit(entry.unit || getParticularDefaultUnit(selectedParticular));
    setEditTxBillNo(entry.billNo || '');
    setEditTxNote(entry.note || '');
    setEditTxDate(entry.date);
    setShowEditTransaction(true);
  };

  // Submit edit transaction modifications
  const handleEditTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParticular || !editingTransaction) return;
    if (editTxQty <= 0) {
      showError('Please enter a quantity greater than 0.');
      return;
    }
    if (!editTxBillNo.trim()) {
      showError('Please enter a valid bill number.');
      return;
    }
    const isCredit = editTxType === 'credit';
    const originalDebit = editingTransaction.debit || 0;
    const originalCredit = editingTransaction.credit || 0;
    const baseStock = selectedParticular.currentStock - originalDebit + originalCredit;
    const newStock = baseStock + (isCredit ? -editTxQty : editTxQty);
    if (newStock < 0) {
      showError(`Insufficient stock. This change would result in a negative stock balance of ${newStock} Qty.`);
      return;
    }

    setEditTxLoading(true);
    try {
      const isDebit = editTxType === 'debit';
      const debitQty = isDebit ? editTxQty : 0;
      const creditQty = isDebit ? 0 : editTxQty;

      await updateLedgerEntry(user?.uid || '', selectedParticular.id, editingTransaction.id, {
        date: editTxDate || getCurrentNepaliDate(),
        billNo: editTxBillNo.trim() || undefined,
        debit: debitQty,
        credit: creditQty,
        unit: editTxUnit || undefined,
        note: editTxNote.trim() || undefined
      });

      showSuccess('Transaction updated successfully.');
      setShowEditTransaction(false);
      setEditingTransaction(null);

      // Reload particular details & ledger history
      await loadLedger(selectedParticular.id);
      const refreshedParticulars = await getStockParticulars(user?.uid || '');
      setParticulars(refreshedParticulars);
      const updatedItem = refreshedParticulars.find(p => p.id === selectedParticular.id);
      if (updatedItem) {
        setSelectedParticular(updatedItem);
      }
    } catch (error: any) {
      console.error('Error editing transaction:', error);
      showError(error.message || 'Failed to update transaction.');
    } finally {
      setEditTxLoading(false);
    }
  };

  // Submit delete transaction modification
  const handleDeleteTransactionSubmit = async () => {
    if (!selectedParticular || !deletingTransaction) return;
    const originalDebit = deletingTransaction.debit || 0;
    const originalCredit = deletingTransaction.credit || 0;
    const newStock = selectedParticular.currentStock - originalDebit + originalCredit;
    if (newStock < 0) {
      showError(`Cannot delete this transaction. Deleting it would result in a negative stock balance of ${newStock} Qty.`);
      return;
    }
    setDeleteTxLoading(true);
    try {
      await deleteLedgerEntry(user?.uid || '', selectedParticular.id, deletingTransaction.id);
      showSuccess('Transaction deleted from ledger.');
      setShowDeleteTransactionConfirm(false);
      setDeletingTransaction(null);

      // Reload particular details & ledger history
      await loadLedger(selectedParticular.id);
      const refreshedParticulars = await getStockParticulars(user?.uid || '');
      setParticulars(refreshedParticulars);
      const updatedItem = refreshedParticulars.find(p => p.id === selectedParticular.id);
      if (updatedItem) {
        setSelectedParticular(updatedItem);
      }
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      showError(error.message || 'Failed to delete transaction.');
    } finally {
      setDeleteTxLoading(false);
    }
  };

  // Filter particulars list based on search box input
  const filteredParticulars = particulars.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Styling helper for the Stock status level badge
  const getStockBadgeClass = (qty: number): string => {
    if (qty > 10) return 'badge-success';
    if (qty > 0) return 'badge-warning';
    return 'badge-danger';
  };

  const getStockStatusLabel = (qty: number): string => {
    if (qty > 10) return 'In Stock';
    if (qty > 0) return 'Low Stock';
    return 'Out of Stock';
  };

  // ── Export & Import Handlers ──
  const printStockList = () => {
    const list = filteredParticulars.length > 0 ? filteredParticulars : particulars;
    if (list.length === 0) {
      showError('No stock items to print.');
      return;
    }

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) {
      showError('Pop-up blocked. Please allow pop-ups for this site and try again.');
      return;
    }

    const rows = list
      .map((p) => {
        return `
          <tr>
            <td>${p.name || '—'}</td>
            <td>${p.particularCode || '—'}</td>
            <td class="right"><strong>${p.currentStock}</strong> ${p.defaultUnit || 'Qty'}</td>
          </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Stock Items List</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #111; background: #fff; }
    h1 { font-size: 22px; margin-bottom: 6px; }
    .subtitle { color: #555; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th, td { border: 1px solid #cfcfcf; padding: 8px 10px; vertical-align: top; }
    th { background: #1e3a5f; color: #fff; text-align: left; }
    .right { text-align: right; }
    .toolbar { margin-bottom: 12px; display: flex; justify-content: flex-end; gap: 10px; }
    .btn { padding: 8px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .btn-print { background: #10b981; color: #fff; }
    .btn-close { background: #e5e7eb; color: #111; }
    @media print { .toolbar { display: none; } body { padding: 0; } @page { size: A4 portrait; margin: 1.5cm; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn btn-print" onclick="window.print()">Print / Save PDF</button>
    <button class="btn btn-close" onclick="window.close()">Close</button>
  </div>
  <h1>Stock Items List</h1>
  <div class="subtitle">${list.length} item(s)</div>
  <table>
    <thead>
      <tr>
        <th>Item Name</th>
        <th>Item Code</th>
        <th class="right">Current Stock</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const handleExport = async () => {
    if (particulars.length === 0) {
      showError('No stock particulars to export.');
      return;
    }
    showSuccess('Preparing stock data for export...');
    try {
      const exportRows: any[] = [];
      for (const p of particulars) {
        const entries = await getLedgerEntries(user?.uid || '', p.id);
        exportRows.push({
          particularId: p.id,
          name: p.name,
          particularCode: p.particularCode || '',
          currentStock: p.currentStock,
          ledger_json: JSON.stringify(entries.map(e => ({
            date: e.date,
            billNo: e.billNo || '',
            debit: e.debit,
            credit: e.credit,
            unit: e.unit || '',
            currentStock: e.currentStock,
            note: e.note || ''
          })))
        });
      }

      const csv = Papa.unparse(exportRows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', 'stock_backup.csv');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSuccess(`Stock data exported successfully (${exportRows.length} items).`);
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export stock data.');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          if (!rows || rows.length === 0) {
            showError('No valid rows found in CSV.');
            return;
          }

          let importedCount = 0;
          for (const row of rows) {
            if (!row.name) continue;

            const name = row.name.trim();
            let ledgerEntries: any[] = [];
            try {
              if (row.ledger_json) {
                ledgerEntries = JSON.parse(row.ledger_json);
              }
            } catch (e) {
              console.warn('Could not parse ledger for:', name);
            }

            try {
              // Create the particular with 0 initial stock
              await createStockParticular(
                user?.uid || '',
                name,
                0,
                getCurrentNepaliDate(),
                undefined,
                undefined,
                row.particularCode || undefined
              );
            } catch (e: any) {
              // Particular might already exist – skip creation, continue adding ledger entries
              if (!e.message?.includes('already exists')) {
                console.warn('Error creating particular:', name, e);
                continue;
              }
            }

            // Add ledger entries one by one
            const particularId = name.toLowerCase().trim();
            for (const entry of ledgerEntries) {
              try {
                await addLedgerEntry(user?.uid || '', particularId, {
                  date: entry.date || getCurrentNepaliDate(),
                  billNo: entry.billNo || undefined,
                  debit: parseFloat(entry.debit) || 0,
                  credit: parseFloat(entry.credit) || 0,
                  unit: entry.unit || undefined,
                  note: entry.note || 'Imported entry'
                });
              } catch (err) {
                console.warn('Error importing ledger entry for', name, ':', err);
              }
            }
            importedCount++;
          }

          if (importedCount > 0) {
            showSuccess(`Successfully imported ${importedCount} stock items.`);
            await loadParticulars();
          } else {
            showError('No valid stock items found in the file.');
          }
        } catch (error) {
          console.error('Import error:', error);
          showError('Failed to import. Invalid CSV file.');
        } finally {
          setImportLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error('PapaParse error:', error);
        showError('Failed to read the CSV file.');
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  // Filter ledger based on date range and active fiscal year
  const filteredLedger = ledger.filter(entry => {
    // Apply fiscal year filter if no manual date range is set
    if (!filterStartDate && !filterEndDate) {
      if (!isInActiveFY(entry.date)) return false;
    }
    if (filterStartDate && entry.date < filterStartDate) return false;
    if (filterEndDate && entry.date > filterEndDate) return false;
    return true;
  });

  // Calculate quick metrics for ledger panel summary card
  const totalDebit = filteredLedger.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const totalCredit = filteredLedger.reduce((sum, entry) => sum + (entry.credit || 0), 0);

  return (
    <div className="stock-page fade-in">
      <div className="container-fluid">
        {/* Top Header - Title + Export/Import Buttons */}
        <div className="stock-header-clean">
          <h1 className="stock-title-clean">Stock Management</h1>
          <div className="action-controls">
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImport}
            />
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" disabled={importLoading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {importLoading ? 'Importing...' : 'Import'}
            </button>
            <button onClick={handleExport} className="btn btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
            <button onClick={loadParticulars} className="btn btn-primary btn-refresh">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <polyline points="23 20 23 14 17 14" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`row stock-layout ${isParticularsCollapsed ? 'particulars-collapsed' : ''}`}>
          
          {/* ── LEFT PANEL: Particulars List ── */}
          <div className={`col-12 col-md-4 particulars-panel card ${isParticularsCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header">
              <div className="panel-header-title-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{ margin: 0 }}>Particulars</h2>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: '12px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                    {particulars.length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={printStockList}
                    className="btn-icon-action"
                    title="Print stock list"
                    aria-label="Print stock list"
                    style={{ width: '34px', height: '34px', borderRadius: '8px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsParticularsCollapsed(true)}
                    className="btn-collapse-particulars"
                    title="Collapse Particulars List"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setNewPartDate(getCurrentNepaliDate());
                  setNewPartUnit(defaultUnit);
                  setNewPartCode(getNextParticularCode());
                  setShowAddParticular(true);
                }}
                className="btn btn-primary btn-sm btn-add-part"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Particular
              </button>
            </div>

            <div className="search-bar">
              <span className="search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search particulars..."
                className="input search-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="particulars-list">
              {loadingParticulars ? (
                <div className="panel-loader">
                  <div className="spinner-small" />
                  <p>Loading items...</p>
                </div>
              ) : filteredParticulars.length === 0 ? (
                <div className="panel-empty">
                  <p>No items found.</p>
                </div>
              ) : (
                filteredParticulars.map(p => (
                  <div
                    key={p.id}
                    className={`particular-item-card ${selectedParticular?.id === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedParticular(p)}
                  >
                    <div className="item-details">
                      <strong className="item-name">{p.name}</strong>
                      <span className="item-code">ID: {p.particularCode || '—'}</span>
                      <span className="item-updated">
                        Last Active: {toNepaliDate(p.updatedAt)}
                      </span>
                    </div>
                    <div className="item-badges">
                      <span className={`badge ${getStockBadgeClass(p.currentStock)}`}>
                        {p.currentStock} {p.defaultUnit || 'Qty'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL: Stock Ledger Details ── */}
          <div className="col-12 col-md-8 ledger-panel card" style={{ position: 'relative' }}>
            {!selectedParticular ? (
              <div className="ledger-empty-state" style={{ position: 'relative' }}>
                {isParticularsCollapsed && (
                  <button
                    type="button"
                    onClick={() => setIsParticularsCollapsed(false)}
                    className="btn btn-primary btn-expand-particulars-floating"
                    style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Show Inventory List
                  </button>
                )}
                <div className="empty-graphic">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-tertiary)' }}>
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <h3>No Particular Selected</h3>
                <p>Choose an item from the left inventory list or add a new particular to view its full transaction ledger and maintain stock.</p>
              </div>
            ) : (
              <div className="ledger-details-container">
                {/* Ledger Header */}
                <div className="ledger-header">
                  <div className="lh-left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {isParticularsCollapsed && (
                        <button
                          type="button"
                          onClick={() => setIsParticularsCollapsed(false)}
                          className="btn-expand-particulars"
                          title="Show Particulars List"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      )}
                      <h2>{selectedParticular.name}</h2>
                      <div className="particular-action-buttons">
                        <button
                          onClick={() => void requestAction({ label: 'edit particular', onConfirm: () => {
                            setEditPartName(selectedParticular.name);
                            setEditPartUnit(getParticularDefaultUnit(selectedParticular));
                            setEditPartCode(formatParticularCode(selectedParticular.particularCode || ''));
                            setShowEditParticular(true);
                          } })}
                          className="btn-icon-action btn-edit-part"
                          title="Rename Particular"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => void requestAction({ label: 'delete particular', onConfirm: () => setShowDeleteParticularConfirm(true) })}
                          className="btn-icon-action btn-delete-part"
                          title="Delete Particular & History"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="lh-status">
                      <span className={`status-dot ${selectedParticular.currentStock > 10 ? 'dot-success' : selectedParticular.currentStock > 0 ? 'dot-warning' : 'dot-danger'}`} />
                      <span className="status-text">{getStockStatusLabel(selectedParticular.currentStock)}</span>
                    </div>
                  </div>
                  <div className="lh-right" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div style={{ width: '160px' }}>
                        <NepaliDatePickerComponent placeholder="From Date (BS)" value={filterStartDate} onChange={(bs) => setFilterStartDate(bs)} />
                      </div>
                      <div style={{ width: '160px' }}>
                        <NepaliDatePickerComponent placeholder="To Date (BS)" value={filterEndDate} onChange={(bs) => setFilterEndDate(bs)} />
                      </div>
                      {(filterStartDate || filterEndDate) && (
                        <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="btn btn-secondary" style={{ padding: '0 10px', height: '36px' }} title="Clear Filter">
                          Clear
                        </button>
                      )}
                      <button 
                        onClick={() => printStockLedger(selectedParticular, filteredLedger, appSettings?.businessName || 'Stock Management', appSettings?.businessAddress || '', appSettings?.businessContact || '', filterStartDate, filterEndDate)}
                        className="btn btn-primary"
                        style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        disabled={filteredLedger.length === 0}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 6 2 18 2 18 9" />
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Print
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setTxDate(getCurrentNepaliDate());
                        setTxUnit(getParticularDefaultUnit(selectedParticular));
                        setShowAddTransaction(true);
                      }}
                      className="btn btn-success"
                      style={{ height: '36px', display: 'flex', alignItems: 'center' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Transaction
                    </button>
                  </div>
                </div>

                {/* Grid Metrics */}
                <div className="ledger-metrics-grid">
                  <div className="metric-box bg-box">
                    <span className="mb-label">Total Stock In (Debit)</span>
                    <strong className="mb-value text-success">+{totalDebit}</strong>
                  </div>
                  <div className="metric-box bg-box">
                    <span className="mb-label">Total Billed Out (Credit)</span>
                    <strong className="mb-value text-danger">{totalCredit}</strong>
                  </div>
                  <div className="metric-box bg-box-highlight">
                    <span className="mb-label">Current Stock Balance</span>
                    <strong className={`mb-value ${selectedParticular.currentStock > 10 ? 'text-success' : selectedParticular.currentStock > 0 ? 'text-warning' : 'text-danger'}`}>
                      {selectedParticular.currentStock}
                    </strong>
                  </div>
                </div>

                {/* Ledger Table Section */}
                <div className="ledger-table-section">
                  <h3>Ledger Entries</h3>
                  <div className="table-container">
                    {loadingLedger ? (
                      <div className="panel-loader">
                        <div className="spinner-small" />
                        <p>Loading ledger entries...</p>
                      </div>
                    ) : ledger.length === 0 ? (
                      <div className="panel-empty">
                        <p>No transactions registered for this particular.</p>
                      </div>
                    ) : (
                      <table className="table ledger-table">
                        <thead>
                          <tr>
                            <th style={{ width: '120px' }}>Date (BS)</th>
                            <th>Note / Description</th>
                            <th style={{ width: '100px' }} className="text-center">Bill Number</th>
                            <th style={{ width: '70px' }} className="text-center">Unit</th>
                            <th style={{ width: '90px' }} className="text-right">Debit (+ In)</th>
                            <th style={{ width: '90px' }} className="text-right">Credit (- Out)</th>
                            <th style={{ width: '90px' }} className="text-right">Running Bal.</th>
                            <th style={{ width: '90px' }} className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...filteredLedger].reverse().map((entry) => (
                            <tr key={entry.id}>
                              <td>{entry.date}</td>
                              <td>{entry.note || '—'}</td>
                              <td className="text-center">
                                {entry.billNo ? (
                                  <span className="badge badge-primary font-mono">{entry.billNo}</span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="text-center">
                                {entry.unit ? entry.unit : '—'}
                              </td>
                              <td className="text-right text-success text-bold">
                                {entry.debit > 0 ? `${entry.debit}` : '—'}
                              </td>
                              <td className="text-right text-danger text-bold">
                                {entry.credit > 0 ? `${entry.credit}` : '—'}
                              </td>
                              <td className="text-right text-bold" style={{ color: 'var(--text-primary)' }}>
                                {entry.currentStock}
                              </td>
                              <td className="text-center">
                                <div className="ledger-row-actions">
                                  <button
                                    onClick={() => void requestAction({ label: 'edit transaction', onConfirm: () => openEditTransactionModal(entry) })}
                                    className="btn-row-action btn-edit-row"
                                    title="Edit Transaction"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => void requestAction({ label: 'delete transaction', onConfirm: () => {
                                        setDeletingTransaction(entry);
                                        setShowDeleteTransactionConfirm(true);
                                      } })}
                                    className="btn-row-action btn-delete-row"
                                    title="Delete Transaction"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── MODAL 1: Add New Particular ── */}
      {showAddParticular && (
        <div className="modal-overlay" onClick={() => setShowAddParticular(false)}>
          <div className="modal-content stock-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Stock Particular</h2>
              <button className="modal-close" onClick={() => setShowAddParticular(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateParticular}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Particular Name (Item Description) *</label>
                  <input
                    type="text"
                    className="input"
                    value={newPartName}
                    onChange={e => setNewPartName(capitalizeWords(e.target.value))}
                    placeholder="e.g. Rice, Dal, Soap"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="label">Particular ID (5 digits)</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={newPartCode}
                    onChange={e => setNewPartCode(normalizeParticularCode(e.target.value))}
                    onBlur={e => setNewPartCode(formatParticularCode(e.target.value))}
                    placeholder="e.g. 00001"
                    maxLength={5}
                    inputMode="numeric"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Initial Stock Quantity</label>
                  <input
                    type="number"
                    className="input"
                    value={newPartInitialStock || ''}
                    onChange={e => setNewPartInitialStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="e.g. 50 (leave 0 if none)"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Default Unit</label>
                  <select
                    className="input"
                    value={newPartUnit}
                    onChange={e => setNewPartUnit(e.target.value)}
                  >
                    <option value="">Unit</option>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                {newPartInitialStock > 0 && (
                  <>
                    <div className="form-group">
                      <NepaliDatePickerComponent
                        ref={addPartDatePickerRef}
                        label="Opening Date (BS) *"
                        value={newPartDate}
                        onChange={(bs) => setNewPartDate(bs)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Bill Number *</label>
                      <input
                        type="text"
                        className="input font-mono"
                        value={newPartBillNo}
                        onChange={e => setNewPartBillNo(e.target.value)}
                        placeholder="e.g. 0005 or INV-0012"
                        required
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={addPartLoading}
                >
                  {addPartLoading ? 'Adding...' : 'Add Particular'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddParticular(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Add Transaction ── */}
      {showAddTransaction && selectedParticular && (
        <div className="modal-overlay" onClick={() => setShowAddTransaction(false)}>
          <div className="modal-content stock-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Stock Transaction</h2>
              <button className="modal-close" onClick={() => setShowAddTransaction(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddTransaction}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Transaction Type</label>
                  <div className="tx-type-selector">
                    <button
                      type="button"
                      className={`tx-type-btn btn-debit ${txType === 'debit' ? 'active' : ''}`}
                      onClick={() => setTxType('debit')}
                    >
                      <span className="btn-indicator" />
                      Debit (+ Stock In)
                    </button>
                    <button
                      type="button"
                      className={`tx-type-btn btn-credit ${txType === 'credit' ? 'active' : ''}`}
                      onClick={() => setTxType('credit')}
                    >
                      <span className="btn-indicator" />
                      Credit (- Stock Out)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Quantity *</label>
                  <div className="qty-unit-row">
                    <input
                      type="number"
                      className="input"
                      value={txQty || ''}
                      onChange={e => setTxQty(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="Enter quantity"
                      required
                      min="0.01"
                      step="any"
                      autoFocus
                    />
                    <select
                      className="input unit-select"
                      value={txUnit}
                      onChange={e => setTxUnit(e.target.value)}
                    >
                      <option value="">Unit</option>
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <NepaliDatePickerComponent
                    ref={addTxDatePickerRef}
                    label="Transaction Date (BS) *"
                    value={txDate}
                    onChange={(bs) => setTxDate(bs)}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Bill Number *</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={txBillNo}
                    onChange={e => setTxBillNo(e.target.value)}
                    placeholder="e.g. 0005 or INV-0012"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Notes / Remarks (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={txNote}
                    onChange={e => setTxNote(e.target.value)}
                    placeholder={txType === 'debit' ? 'e.g. Purchased from vendor' : 'e.g. Billed out / adjustment'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={addTxLoading}
                >
                  {addTxLoading ? 'Saving...' : 'Record Transaction'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddTransaction(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Edit Particular (Rename) ── */}
      {showEditParticular && selectedParticular && (
        <div className="modal-overlay" onClick={() => setShowEditParticular(false)}>
          <div className="modal-content stock-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Rename Stock Particular</h2>
              <button className="modal-close" onClick={() => setShowEditParticular(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditParticularName}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Particular Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={editPartName}
                    onChange={e => setEditPartName(capitalizeWords(e.target.value))}
                    placeholder="Enter new particular name"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="label">Particular ID (5 digits)</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={editPartCode}
                    onChange={e => setEditPartCode(normalizeParticularCode(e.target.value))}
                    onBlur={e => setEditPartCode(formatParticularCode(e.target.value))}
                    placeholder="e.g. 00001"
                    maxLength={5}
                    inputMode="numeric"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Default Unit</label>
                  <select
                    className="input"
                    value={editPartUnit}
                    onChange={e => setEditPartUnit(e.target.value)}
                  >
                    <option value="">Unit</option>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={editPartLoading}
                >
                  {editPartLoading ? 'Saving...' : 'Rename Particular'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditParticular(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: Delete Particular Confirm ── */}
      {showDeleteParticularConfirm && selectedParticular && (
        <div className="modal-overlay" onClick={() => setShowDeleteParticularConfirm(false)}>
          <div className="modal-content stock-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Delete Stock Particular
              </h2>
              <button className="modal-close" onClick={() => setShowDeleteParticularConfirm(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the stock particular <strong>"{selectedParticular.name}"</strong>?</p>
              <p className="text-danger" style={{ marginTop: '8px', fontWeight: '500' }}>
                <strong>Warning:</strong> This will delete all of its child ledger entries and transaction history. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                autoFocus
                className="btn btn-danger"
                onClick={handleDeleteParticular}
                disabled={deletePartLoading}
              >
                {deletePartLoading ? 'Deleting...' : 'Yes, Delete Particular'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteParticularConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: Edit Transaction ── */}
      {showEditTransaction && editingTransaction && selectedParticular && (
        <div className="modal-overlay" onClick={() => { setShowEditTransaction(false); setEditingTransaction(null); }}>
          <div className="modal-content stock-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Stock Transaction</h2>
              <button className="modal-close" onClick={() => { setShowEditTransaction(false); setEditingTransaction(null); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditTransactionSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Transaction Type</label>
                  <div className="tx-type-selector">
                    <button
                      type="button"
                      className={`tx-type-btn btn-debit ${editTxType === 'debit' ? 'active' : ''}`}
                      onClick={() => setEditTxType('debit')}
                    >
                      <span className="btn-indicator" />
                      Debit (+ Stock In)
                    </button>
                    <button
                      type="button"
                      className={`tx-type-btn btn-credit ${editTxType === 'credit' ? 'active' : ''}`}
                      onClick={() => setEditTxType('credit')}
                    >
                      <span className="btn-indicator" />
                      Credit (- Stock Out)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Quantity *</label>
                  <div className="qty-unit-row">
                    <input
                      type="number"
                      className="input"
                      value={editTxQty || ''}
                      onChange={e => setEditTxQty(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="Enter quantity"
                      required
                      min="0.01"
                      step="any"
                      autoFocus
                    />
                    <select
                      className="input unit-select"
                      value={editTxUnit}
                      onChange={e => setEditTxUnit(e.target.value)}
                    >
                      <option value="">Unit</option>
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <NepaliDatePickerComponent
                    ref={editTxDatePickerRef}
                    label="Transaction Date (BS) *"
                    value={editTxDate}
                    onChange={(bs) => setEditTxDate(bs)}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Bill Number *</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={editTxBillNo}
                    onChange={e => setEditTxBillNo(e.target.value)}
                    placeholder="e.g. 0005 or INV-0012"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Notes / Remarks (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={editTxNote}
                    onChange={e => setEditTxNote(e.target.value)}
                    placeholder="Enter details"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={editTxLoading}
                >
                  {editTxLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowEditTransaction(false); setEditingTransaction(null); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 6: Delete Transaction Confirm ── */}
      {showDeleteTransactionConfirm && deletingTransaction && (
        <div className="modal-overlay" onClick={() => { setShowDeleteTransactionConfirm(false); setDeletingTransaction(null); }}>
          <div className="modal-content stock-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Delete Ledger Entry
              </h2>
              <button className="modal-close" onClick={() => { setShowDeleteTransactionConfirm(false); setDeletingTransaction(null); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this ledger transaction?</p>
              <table style={{ width: '100%', marginTop: '12px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: 'var(--text-secondary)' }}>Date (BS):</td>
                    <td style={{ padding: '6px 0', fontWeight: 'bold' }}>{deletingTransaction.date}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: 'var(--text-secondary)' }}>Note:</td>
                    <td style={{ padding: '6px 0', fontWeight: 'bold' }}>{deletingTransaction.note || '—'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: 'var(--text-secondary)' }}>Change:</td>
                    <td style={{ padding: '6px 0', fontWeight: 'bold' }} className={deletingTransaction.debit > 0 ? 'text-success' : 'text-danger'}>
                      {deletingTransaction.debit > 0 ? `${deletingTransaction.debit} (Debit)` : `${deletingTransaction.credit} (Credit)`}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-danger" style={{ marginTop: '16px', fontWeight: '500' }}>
                <strong>Warning:</strong> The running balance and stock level of the parent particular will be re-calculated instantly.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteTransactionSubmit}
                disabled={deleteTxLoading}
              >
                {deleteTxLoading ? 'Deleting...' : 'Yes, Delete Transaction'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowDeleteTransactionConfirm(false); setDeletingTransaction(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pinPrompt}
      {pinPrompt}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default Stock;
