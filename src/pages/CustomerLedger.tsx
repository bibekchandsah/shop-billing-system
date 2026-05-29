import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useFiscalYear } from '../context/FiscalYearContext';
import ToastContainer from '../components/ToastContainer';
import NepaliDatePickerComponent, { type NepaliDatePickerHandle } from '../components/NepaliDatePicker';
import { getCurrentNepaliDate } from '../utils/nepaliDate';
import { useActionPinGuard } from '../hooks/useActionPinGuard';
import Papa from 'papaparse';
import type { Customer, CustomerLedgerEntry } from '../types';
import { printCustomerLedger } from '../utils/printCustomerLedger';
import {
  addCustomerLedgerEntry,
  deleteCustomerLedgerEntry,
  deleteCustomerProfile,
  getCustomerLedgerEntries,
  getCustomers,
  upsertCustomerProfile,
  updateCustomerLedgerEntry,
} from '../services/customerService';
import './CustomerLedger.css';

const CustomerLedger: React.FC = () => {
  const { user } = useAuth();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  const { settings, isInActiveFY } = useFiscalYear();
  const { requestAction, pinPrompt } = useActionPinGuard({ pinHash: settings.actionPinHash, showError });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [isCustomersCollapsed, setIsCustomersCollapsed] = useState(false);
  
  // Settings come from FiscalYearContext
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editCustomerContact, setEditCustomerContact] = useState('');
  const [editCustomerCode, setEditCustomerCode] = useState('');
  const [editCustomerLoading, setEditCustomerLoading] = useState(false);

  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [txDate, setTxDate] = useState('');
  const [txParticular, setTxParticular] = useState('');
  const [txBillNo, setTxBillNo] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txType, setTxType] = useState<'debit' | 'credit'>('debit');
  const [txNote, setTxNote] = useState('');
  const [addTxLoading, setAddTxLoading] = useState(false);

  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<CustomerLedgerEntry | null>(null);
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxParticular, setEditTxParticular] = useState('');
  const [editTxBillNo, setEditTxBillNo] = useState('');
  const [editTxAmount, setEditTxAmount] = useState<number>(0);
  const [editTxType, setEditTxType] = useState<'debit' | 'credit'>('debit');
  const [editTxNote, setEditTxNote] = useState('');
  const [editTxLoading, setEditTxLoading] = useState(false);

  const [showDeleteTransactionConfirm, setShowDeleteTransactionConfirm] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<CustomerLedgerEntry | null>(null);
  const [deleteTxLoading, setDeleteTxLoading] = useState(false);

  const [showDeleteCustomerConfirm, setShowDeleteCustomerConfirm] = useState(false);
  const [deleteCustomerLoading, setDeleteCustomerLoading] = useState(false);

  const editDatePickerRef = useRef<NepaliDatePickerHandle>(null);
  const txDatePickerRef = useRef<NepaliDatePickerHandle>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const printCustomerList = () => {
    const list = filteredCustomers.length > 0 ? filteredCustomers : customers;
    if (list.length === 0) {
      showError('No customers to print.');
      return;
    }

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) {
      showError('Pop-up blocked. Please allow pop-ups for this site and try again.');
      return;
    }

    const rows = list
      .map((customer) => {
        const balance = formatBalanceDisplay(customer.currentBalance || 0);
        return `
          <tr>
            <td>${customer.name || '—'}</td>
            <td>${customer.address || '—'}</td>
            <td>${customer.contactNumber || '—'}</td>
            <td>${customer.customerCode || '—'}</td>
            <td class="right"><strong>${balance.amount}</strong> ${balance.label}</td>
          </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Customer List</title>
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
  <h1>Customer List</h1>
  <div class="subtitle">${list.length} customer(s)</div>
  <table>
    <thead>
      <tr>
        <th>Customer Name</th>
        <th>Address</th>
        <th>Contact</th>
        <th>Customer ID</th>
        <th class="right">Current Balance</th>
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
    if (customers.length === 0) {
      showError('No customers to export.');
      return;
    }
    showSuccess('Preparing customer ledger data for export...');
    try {
      const exportRows: any[] = [];
      for (const c of customers) {
        // Fetch full ledger for this customer to ensure complete backup
        const entries = await getCustomerLedgerEntries(user?.uid || '', c.id);
        exportRows.push({
          customerId: c.id,
          name: c.name,
          address: c.address,
          contactNumber: c.contactNumber,
          currentBalance: c.currentBalance,
          ledger_json: JSON.stringify(entries.map(e => ({
            date: e.date,
            particular: e.particular,
            billNo: e.billNo || '',
            debit: e.debit,
            credit: e.credit,
            currentBalance: e.currentBalance,
            note: e.note || ''
          })))
        });
      }

      const csv = Papa.unparse(exportRows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', 'customer_ledger_backup.csv');
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showSuccess(`Customers exported successfully (${exportRows.length} records).`);
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export customer data.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingCustomers(true);
    showSuccess('Importing customer data...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          if (!rows || rows.length === 0) {
            showError('No valid rows found in CSV.');
            setLoadingCustomers(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          let importedCount = 0;
          for (const row of rows) {
            if (!row.name) continue;

            const name = row.name.trim();
            const customerId = row.customerId || name.toLowerCase().replace(/[^a-z0-9]/g, '_');

            let ledgerEntries: any[] = [];
            try {
              if (row.ledger_json) {
                ledgerEntries = JSON.parse(row.ledger_json);
              }
            } catch (err) {
              console.warn('Could not parse ledger for:', name);
            }

            try {
              await upsertCustomerProfile(user?.uid || '', customerId, {
                name: name,
                address: row.address || '',
                contactNumber: row.contactNumber || '',
                currentBalance: parseFloat(row.currentBalance) || 0,
              });
            } catch (err: any) {
              console.warn('Error creating/updating customer:', name, err);
              continue;
            }

            for (const entry of ledgerEntries) {
              try {
                await addCustomerLedgerEntry(user?.uid || '', customerId, {
                  date: entry.date || getCurrentNepaliDate(),
                  particular: entry.particular || 'Imported Entry',
                  billNo: entry.billNo || '',
                  debit: parseFloat(entry.debit) || 0,
                  credit: parseFloat(entry.credit) || 0,
                  note: entry.note || '',
                });
              } catch (err) {
                console.warn('Error importing ledger entry for', name, ':', err);
              }
            }
            importedCount++;
          }

          if (importedCount > 0) {
            showSuccess(`Successfully imported ${importedCount} customers.`);
            await loadCustomers();
          } else {
            showError('No valid customers found in the file.');
          }
        } catch (error) {
          console.error('Import error:', error);
          showError('Failed to import. Invalid CSV file.');
        } finally {
          setLoadingCustomers(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error('Papa Parse error:', error);
        showError('Failed to parse CSV file.');
        setLoadingCustomers(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const data = await getCustomers(user?.uid || '');
      setCustomers(data);
      setSelectedCustomer((current) => {
        if (!current) {
          return data[0] || null;
        }
        return data.find((item) => item.id === current.id) || current;
      });
    } catch (error) {
      console.error('Error loading customers:', error);
      showError('Failed to load customer ledger list');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadLedger = async (customerId: string) => {
    setLoadingLedger(true);
    try {
      const data = await getCustomerLedgerEntries(user?.uid || '', customerId);
      setLedger(data);
    } catch (error) {
      console.error('Error loading customer ledger:', error);
      showError('Failed to load customer ledger');
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    if (selectedCustomer) {
      loadLedger(selectedCustomer.id);
    } else {
      setLedger([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer]);

  const filteredCustomers = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase();
    if (!lower) return customers;
    return customers.filter((customer) => {
      const customerCode = (customer.customerCode || '').toLowerCase();
      return (
        customer.name.toLowerCase().includes(lower) ||
        customerCode.includes(lower) ||
        customer.address.toLowerCase().includes(lower) ||
        customer.contactNumber.toLowerCase().includes(lower)
      );
    });
  }, [customers, searchTerm]);

  const filteredLedger = useMemo(() => {
    return ledger.filter(entry => {
      // Apply fiscal year filter when no manual date range is set
      if (!filterStartDate && !filterEndDate) {
        if (!isInActiveFY(entry.date)) return false;
      }
      if (filterStartDate && entry.date < filterStartDate) return false;
      if (filterEndDate && entry.date > filterEndDate) return false;
      return true;
    });
  }, [ledger, filterStartDate, filterEndDate, isInActiveFY]);

  const selectedBalance = ledger.length > 0 ? ledger[ledger.length - 1].currentBalance : (selectedCustomer?.currentBalance || 0);
  const totalDebit = filteredLedger.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const totalCredit = filteredLedger.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  const formatBalanceDisplay = (balance: number) => {
    const isCredit = balance < 0;
    return {
      amount: Math.abs(balance),
      label: isCredit ? 'CR' : 'DR',
    };
  };

  const titleCase = (value: string) => {
    return (value || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const openCustomerEdit = () => {
    if (!selectedCustomer) return;
    setEditCustomerName(selectedCustomer.name);
    setEditCustomerAddress(selectedCustomer.address);
    setEditCustomerContact(selectedCustomer.contactNumber);
    setEditCustomerCode(selectedCustomer.customerCode || '');
    setShowEditCustomer(true);
  };

  const handleEditCustomerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;
    if (!editCustomerName.trim()) {
      showError('Customer name is required');
      return;
    }
    if (!editCustomerAddress.trim()) {
      showError('Address is required');
      return;
    }
    setEditCustomerLoading(true);
    try {
      await upsertCustomerProfile(user?.uid || '', selectedCustomer.id, {
        name: editCustomerName,
        address: editCustomerAddress,
        contactNumber: editCustomerContact,
        customerCode: editCustomerCode.trim(),
        currentBalance: selectedBalance,
      });
      showSuccess('Customer details updated successfully');
      setShowEditCustomer(false);
      await loadCustomers();
    } catch (error: any) {
      console.error('Error updating customer:', error);
      showError(error.message || 'Failed to update customer details');
    } finally {
      setEditCustomerLoading(false);
    }
  };

  const openAddTransaction = () => {
    setTxDate(getCurrentNepaliDate());
    setTxParticular('');
    setTxBillNo('');
    setTxAmount(0);
    setTxType('debit');
    setTxNote('');
    setShowAddTransaction(true);
  };

  const handleAddTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;
    if (!txParticular.trim()) {
      showError('Please enter a particular');
      return;
    }
    if (!txBillNo.trim()) {
      showError('Please enter a bill number');
      return;
    }
    if (!txAmount || txAmount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    setAddTxLoading(true);
    try {
      await addCustomerLedgerEntry(user?.uid || '', selectedCustomer.id, {
        date: txDate || getCurrentNepaliDate(),
        particular: txParticular.trim(),
        billNo: txBillNo.trim() || '',
        debit: txType === 'debit' ? txAmount : 0,
        credit: txType === 'credit' ? txAmount : 0,
        note: txNote.trim() || '',
      });
      showSuccess('Transaction added successfully');
      setShowAddTransaction(false);
      await loadCustomers();
      await loadLedger(selectedCustomer.id);
    } catch (error: any) {
      console.error('Error adding customer transaction:', error);
      showError(error.message || 'Failed to add transaction');
    } finally {
      setAddTxLoading(false);
    }
  };

  const openEditTransaction = (entry: CustomerLedgerEntry) => {
    setEditingTransaction(entry);
    setEditTxDate(entry.date);
    setEditTxParticular(entry.particular);
    setEditTxBillNo(entry.billNo || '');
    setEditTxAmount(entry.debit > 0 ? entry.debit : entry.credit);
    setEditTxType(entry.debit > 0 ? 'debit' : 'credit');
    setEditTxNote(entry.note || '');
    setShowEditTransaction(true);
  };

  const handleEditTransactionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer || !editingTransaction) return;
    if (!editTxParticular.trim()) {
      showError('Please enter a particular');
      return;
    }
    if (!editTxBillNo.trim()) {
      showError('Please enter a bill number');
      return;
    }
    if (!editTxAmount || editTxAmount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    setEditTxLoading(true);
    try {
      await updateCustomerLedgerEntry(user?.uid || '', selectedCustomer.id, editingTransaction.id, {
        date: editTxDate || getCurrentNepaliDate(),
        particular: editTxParticular.trim(),
        billNo: editTxBillNo.trim() || '',
        debit: editTxType === 'debit' ? editTxAmount : 0,
        credit: editTxType === 'credit' ? editTxAmount : 0,
        note: editTxNote.trim() || '',
      });
      showSuccess('Transaction updated successfully');
      setShowEditTransaction(false);
      setEditingTransaction(null);
      await loadCustomers();
      await loadLedger(selectedCustomer.id);
    } catch (error: any) {
      console.error('Error updating customer transaction:', error);
      showError(error.message || 'Failed to update transaction');
    } finally {
      setEditTxLoading(false);
    }
  };

  const handleDeleteTransactionSubmit = async () => {
    if (!selectedCustomer || !deletingTransaction) return;
    setDeleteTxLoading(true);
    try {
      await deleteCustomerLedgerEntry(user?.uid || '', selectedCustomer.id, deletingTransaction.id);
      showSuccess('Transaction deleted successfully');
      setShowDeleteTransactionConfirm(false);
      setDeletingTransaction(null);
      await loadCustomers();
      await loadLedger(selectedCustomer.id);
    } catch (error: any) {
      console.error('Error deleting customer transaction:', error);
      showError(error.message || 'Failed to delete transaction');
    } finally {
      setDeleteTxLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    setDeleteCustomerLoading(true);
    try {
      await deleteCustomerProfile(user?.uid || '', selectedCustomer.id);
      showSuccess('Customer deleted successfully');
      setShowDeleteCustomerConfirm(false);
      setSelectedCustomer(null);
      await loadCustomers();
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      showError(error.message || 'Failed to delete customer');
    } finally {
      setDeleteCustomerLoading(false);
    }
  };

  return (
    <div className="customer-ledger-page fade-in">
      <div className="container-fluid">
        <div className="customer-ledger-header">
          <div>
            <h1 className="customer-ledger-title">Customer Ledger</h1>
          </div>
          <div className="customer-ledger-header-actions">
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImport}
            />
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import
            </button>
            <button onClick={handleExport} className="btn btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
            <button className="btn btn-secondary" onClick={loadCustomers}>
              Refresh
            </button>
          </div>
        </div>

        <div className={`customer-ledger-layout ${isCustomersCollapsed ? 'customers-collapsed' : ''}`}>
          <div className={`customer-list-panel card ${isCustomersCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header">
              <div className="panel-header-title-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{ margin: 0 }}>Customers</h2>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: '12px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                    {customers.length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={printCustomerList}
                    className="btn-icon-action"
                    title="Print customer list"
                    aria-label="Print customer list"
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
                    onClick={() => setIsCustomersCollapsed(true)}
                    className="btn-collapse-customers"
                    title="Collapse Customers List"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="search-bar">
              <span className="search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                className="input customer-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, ID, contact, or address"
              />
            </div>

            <div className="customer-list">
              {loadingCustomers ? (
                <div className="panel-loader">
                  <div className="spinner-small" />
                  <p>Loading customers...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="panel-empty">
                  <p>No customer records found.</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className={`customer-item ${selectedCustomer?.id === customer.id ? 'active' : ''}`}
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <div className="item-details">
                      <strong className="item-name" title={customer.name}>{customer.name}</strong>
                      <span className="item-updated">{customer.address || 'No address'}</span>
                      <span className="item-updated">{customer.customerCode ? `ID: ${customer.customerCode}` : 'No customer ID'}</span>
                      <span className="item-updated">{customer.contactNumber || 'No contact'}</span>
                    </div>
                    <div className="item-badges">
                      {(() => {
                        const balance = formatBalanceDisplay(customer.currentBalance || 0);
                        return (
                          <span className="badge" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{balance.amount}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{balance.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="customer-ledger-panel card">
            {!selectedCustomer ? (
              <div className="panel-empty ledger-empty">
                {isCustomersCollapsed && (
                  <button
                    type="button"
                    onClick={() => setIsCustomersCollapsed(false)}
                    className="btn btn-primary btn-expand-customers-floating"
                    style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Show Customers
                  </button>
                )}
                <p>Select a customer to view the ledger.</p>
              </div>
            ) : (
              <>
                <div className="ledger-header" style={{ marginBottom: '1.75rem' }}>
                  <div className="lh-left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {isCustomersCollapsed && (
                        <button
                          type="button"
                          onClick={() => setIsCustomersCollapsed(false)}
                          className="btn-expand-customers"
                          title="Show Customers List"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      )}
                      <h2>{selectedCustomer.name}</h2>
                      <div className="particular-action-buttons">
                        <button
                          className="btn-icon-action btn-edit-row"
                          onClick={() => void requestAction({ label: 'edit customer', onConfirm: openCustomerEdit })}
                          aria-label="Edit customer"
                          title="Edit customer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="btn-icon-action btn-delete-row"
                          onClick={() => void requestAction({ label: 'delete customer', onConfirm: () => setShowDeleteCustomerConfirm(true) })}
                          aria-label="Delete customer"
                          title="Delete customer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="lh-status" style={{ marginTop: '0.25rem', display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)' }}>
                      {selectedCustomer.address && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span style={{ fontSize: '0.875rem' }}>{selectedCustomer.address}</span>
                        </div>
                      )}
                      {selectedCustomer.contactNumber && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          <span style={{ fontSize: '0.875rem' }}>{selectedCustomer.contactNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="lh-right" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
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
                        onClick={() => printCustomerLedger(selectedCustomer!, filteredLedger, settings?.businessName || 'Customer Ledger', settings?.businessAddress || '', filterStartDate, filterEndDate)}
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
                      <button className="btn btn-success customer-add-transaction" onClick={openAddTransaction} disabled={!selectedCustomer} style={{ height: '36px', display: 'flex', alignItems: 'center', padding: '0 1.25rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Transaction
                      </button>
                    </div>
                  </div>
                </div>

                <div className="customer-metrics-grid" style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
                  <div className="metric-card">
                    <span className="mb-label">Total Debit</span>
                    <strong className="mb-value text-success">{totalDebit}</strong>
                  </div>
                  <div className="metric-card">
                    <span className="mb-label">Total Credit</span>
                    <strong className="mb-value text-danger">{totalCredit}</strong>
                  </div>
                  <div className="metric-card highlight">
                    <span className="mb-label">Current Balance</span>
                    {(() => {
                      const balance = formatBalanceDisplay(selectedBalance);
                      return (
                        <strong className="mb-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{balance.amount}</span>
                          <span className={`badge ${balance.label === 'CR' ? 'text-danger' : 'text-success'}`} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.1rem 0.45rem', fontSize: '0.72rem', fontWeight: 700 }}>
                            {balance.label}
                          </span>
                        </strong>
                      );
                    })()}
                  </div>
                </div>

                <div className="table-container">
                  {loadingLedger ? (
                    <div className="panel-loader">
                      <div className="spinner-small" />
                      <p>Loading ledger entries...</p>
                    </div>
                  ) : ledger.length === 0 ? (
                    <div className="panel-empty">
                      <p>No transactions recorded for this customer.</p>
                    </div>
                  ) : (
                    <table className="table customer-ledger-table">
                      <thead>
                        <tr>
                          <th>Date (BS)</th>
                          <th>Particular</th>
                          <th className="text-center">Bill Number</th>
                          <th className="text-right">Debit</th>
                          <th className="text-right">Credit</th>
                          <th className="text-right">Current Balance</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredLedger].reverse().map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.date}</td>
                            <td>{entry.particular}</td>
                            <td className="text-center">{entry.billNo || '—'}</td>
                            <td className="text-right text-success">{entry.debit > 0 ? entry.debit : '—'}</td>
                            <td className="text-right text-danger">{entry.credit > 0 ? entry.credit : '—'}</td>
                            <td className="text-right">
                              {(() => {
                                const balance = formatBalanceDisplay(entry.currentBalance);
                                return (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <strong>{balance.amount}</strong>
                                    <span className={`badge ${balance.label === 'CR' ? 'text-danger' : 'text-success'}`} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.1rem 0.45rem', fontSize: '0.72rem', fontWeight: 700 }}>
                                      {balance.label}
                                    </span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="text-center">
                              <div className="row-actions">
                                <button
                                  className="btn-icon-action btn-edit-row"
                                  onClick={() => void requestAction({ label: 'edit transaction', onConfirm: () => openEditTransaction(entry) })}
                                  aria-label={`Edit transaction ${entry.particular}`}
                                  title="Edit"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>

                                <button
                                  className="btn-icon-action btn-delete-row"
                                    onClick={() => void requestAction({ label: 'delete transaction', onConfirm: () => {
                                      setDeletingTransaction(entry);
                                      setShowDeleteTransactionConfirm(true);
                                    } })}
                                  aria-label={`Delete transaction ${entry.particular}`}
                                  title="Delete"
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
              </>
            )}
          </div>
        </div>
      </div>

      {showEditCustomer && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowEditCustomer(false)}>
          <div className="modal-content stock-modal customer-edit-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Customer</h2>
              <button className="modal-close" onClick={() => setShowEditCustomer(false)}>×</button>
            </div>
            <form onSubmit={handleEditCustomerSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Customer Name *</label>
                  <input className="input" value={editCustomerName} onChange={(event) => setEditCustomerName(event.target.value)} onBlur={() => setEditCustomerName(titleCase(editCustomerName))} />
                </div>
                <div className="form-group">
                  <label className="label">Address *</label>
                  <input className="input" value={editCustomerAddress} onChange={(event) => setEditCustomerAddress(event.target.value)} onBlur={() => setEditCustomerAddress(titleCase(editCustomerAddress))} />
                </div>
                <div className="form-group">
                  <label className="label">Contact Number</label>
                  <input className="input" maxLength={10} value={editCustomerContact} onChange={(event) => setEditCustomerContact((event.target.value || '').replace(/\D/g, '').slice(0, 10))} />
                </div>
                <div className="form-group">
                  <label className="label">Customer ID (max 4 chars)</label>
                  <input
                    className="input"
                    maxLength={4}
                    value={editCustomerCode}
                    onChange={(event) => setEditCustomerCode(event.target.value.toUpperCase().slice(0, 4))}
                    placeholder="e.g. 0001 or AB12"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-success" type="submit" disabled={editCustomerLoading}>{editCustomerLoading ? 'Saving...' : 'Save Changes'}</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowEditCustomer(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddTransaction && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowAddTransaction(false)}>
          <div className="modal-content stock-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Transaction</h2>
              <button className="modal-close" onClick={() => setShowAddTransaction(false)}>×</button>
            </div>
            <form onSubmit={handleAddTransaction}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Transaction Type</label>
                  <div className="tx-type-selector">
                    <button type="button" className={`tx-type-btn btn-debit ${txType === 'debit' ? 'active' : ''}`} onClick={() => setTxType('debit')}>
                      <span className="btn-indicator" />
                      Debit
                    </button>
                    <button type="button" className={`tx-type-btn btn-credit ${txType === 'credit' ? 'active' : ''}`} onClick={() => setTxType('credit')}>
                      <span className="btn-indicator" />
                      Credit
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <NepaliDatePickerComponent ref={txDatePickerRef} label="Date (BS) *" value={txDate} onChange={(bs) => setTxDate(bs)} />
                </div>
                <div className="form-group">
                  <label className="label">Particular *</label>
                  <input className="input" value={txParticular} onChange={(event) => setTxParticular(event.target.value)} placeholder="bill_0001 or payment" />
                </div>
                <div className="form-group">
                  <label className="label">Bill Number *</label>
                  <input className="input" value={txBillNo} onChange={(event) => setTxBillNo(event.target.value)} placeholder="0001" />
                </div>
                <div className="form-group">
                  <label className="label">Amount *</label>
                  <input className="input" type="number" min="0" value={txAmount || ''} onChange={(event) => setTxAmount(Number(event.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="label">Note</label>
                  <input className="input" value={txNote} onChange={(event) => setTxNote(event.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-success" type="submit" disabled={addTxLoading}>{addTxLoading ? 'Saving...' : 'Add Transaction'}</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowAddTransaction(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditTransaction && editingTransaction && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowEditTransaction(false)}>
          <div className="modal-content stock-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Transaction</h2>
              <button className="modal-close" onClick={() => setShowEditTransaction(false)}>×</button>
            </div>
            <form onSubmit={handleEditTransactionSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Transaction Type</label>
                  <div className="tx-type-selector">
                    <button type="button" className={`tx-type-btn btn-debit ${editTxType === 'debit' ? 'active' : ''}`} onClick={() => setEditTxType('debit')}>
                      <span className="btn-indicator" />
                      Debit
                    </button>
                    <button type="button" className={`tx-type-btn btn-credit ${editTxType === 'credit' ? 'active' : ''}`} onClick={() => setEditTxType('credit')}>
                      <span className="btn-indicator" />
                      Credit
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <NepaliDatePickerComponent ref={editDatePickerRef} label="Date (BS) *" value={editTxDate} onChange={(bs) => setEditTxDate(bs)} />
                </div>
                <div className="form-group">
                  <label className="label">Particular *</label>
                  <input className="input" value={editTxParticular} onChange={(event) => setEditTxParticular(event.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Bill Number *</label>
                  <input className="input" value={editTxBillNo} onChange={(event) => setEditTxBillNo(event.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Amount *</label>
                  <input className="input" type="number" min="0" value={editTxAmount || ''} onChange={(event) => setEditTxAmount(Number(event.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="label">Note</label>
                  <input className="input" value={editTxNote} onChange={(event) => setEditTxNote(event.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-success" type="submit" disabled={editTxLoading}>{editTxLoading ? 'Saving...' : 'Save Changes'}</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowEditTransaction(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteTransactionConfirm && deletingTransaction && (
        <div className="modal-overlay" onClick={() => setShowDeleteTransactionConfirm(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Transaction</h2>
              <button className="modal-close" onClick={() => setShowDeleteTransactionConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this ledger entry?</p>
              <p><strong>{deletingTransaction.particular}</strong></p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={handleDeleteTransactionSubmit} disabled={deleteTxLoading}>{deleteTxLoading ? 'Deleting...' : 'Delete'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowDeleteTransactionConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteCustomerConfirm && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowDeleteCustomerConfirm(false)}>
          <div className="modal-content stock-modal customer-edit-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Customer</h2>
              <button className="modal-close" onClick={() => setShowDeleteCustomerConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Delete <strong>{selectedCustomer.name}</strong> and all of its ledger entries?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={handleDeleteCustomer} disabled={deleteCustomerLoading}>{deleteCustomerLoading ? 'Deleting...' : 'Delete Customer'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowDeleteCustomerConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {pinPrompt}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default CustomerLedger;
