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
import { formatCurrency, formatNumberInputValue } from '../utils/numberToWords';
import {
  addCustomerLedgerEntry,
  buildCustomerId,
  checkCustomerExists,
  deleteCustomerLedgerEntry,
  deleteCustomerProfile,
  findCustomerByCode,
  getCustomerLedgerEntries,
  getCustomers,
  upsertCustomerProfile,
  updateCustomerLedgerEntry,
} from '../services/customerService';
import './CustomerLedger.css';

const CustomerLedger: React.FC = () => {
  const { activeUid } = useAuth();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  const { settings, isInActiveFY } = useFiscalYear();
  const { requestAction, pinPrompt } = useActionPinGuard({ pinHash: settings?.actionPinHash, showError });

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
  // Reference these to avoid false "declared but its value is never read" TS6133
  // (JSX usage sometimes isn't detected by the analyzer in certain setups).
  void editCustomerCode;
  void setEditCustomerCode;
  const [editCustomerLoading, setEditCustomerLoading] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [pinAddCustomer, setPinAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerContact, setNewCustomerContact] = useState('');
  const [newCustomerCode, setNewCustomerCode] = useState('');
  const [newCustomerOpeningAmount, setNewCustomerOpeningAmount] = useState<number>(0);
  const [newCustomerOpeningDate, setNewCustomerOpeningDate] = useState('');
  const [newCustomerOpeningParticular, setNewCustomerOpeningParticular] = useState('');
  const [newCustomerOpeningBillNo, setNewCustomerOpeningBillNo] = useState('');
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomerCodeError, setNewCustomerCodeError] = useState('');

  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [pinAddTx, setPinAddTx] = useState(false);
  const [txDate, setTxDate] = useState('');
  const [txParticular, setTxParticular] = useState('');
  const [txBillNo, setTxBillNo] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txType, setTxType] = useState<'debit' | 'credit'>('credit');
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
  const newCustomerOpeningDatePickerRef = useRef<NepaliDatePickerHandle>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const newCustomerNameInputRef = useRef<HTMLInputElement>(null);
  const txParticularInputRef = useRef<HTMLInputElement>(null);

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

    const sortedList = [...list].sort((a, b) => {
      const codeA = a.customerCode || '';
      const codeB = b.customerCode || '';
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

    const rows = sortedList
      .map((customer) => {
        const balance = formatBalanceDisplay(customer.currentBalance || 0);
        return `
          <tr>
            <td>${customer.name || '—'}</td>
            <td>${customer.address || '—'}</td>
            <td>${customer.contactNumber || '—'}</td>
            <td>${customer.customerCode || '—'}</td>
            <td class="right">${formatCurrency(balance.amount)} ${balance.label}</td>
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
    th, td { padding: 8px 10px; vertical-align: top; }
    th { background: transparent; color: #000; text-align: left; font-weight: 700; border: 1px solid #000; }
    td { border-left: 1px solid #000; border-right: 1px solid #000; border-top: none; border-bottom: none; color: #000; font-weight: 600; }
    tbody tr:last-child td { border-bottom: 1px solid #000; }
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
    showSuccess('Preparing customer data for export...');
    try {
      const exportRows: any[] = [];
      for (const c of customers) {
        const entries = await getCustomerLedgerEntries(activeUid || '', c.id);
        const firstEntry = entries.length > 0 ? entries[0] : null;
        exportRows.push({
          "customer name": c.name || '',
          "address": c.address || '',
          "contact number": c.contactNumber || '',
          "customer ID": c.customerCode || '',
          "current balance": c.currentBalance ?? '',
          "opening amount": firstEntry ? (firstEntry.debit ?? '') : '',
          "date": firstEntry ? (firstEntry.date || '') : '',
          "particular": firstEntry ? (firstEntry.particular || '') : '',
          "bill number": firstEntry ? (firstEntry.billNo || '') : '',
        });
      }

      const csv = Papa.unparse(exportRows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', 'customer_list.csv');
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

  const handleExportFull = async () => {
    if (customers.length === 0) {
      showError('No customers to export.');
      return;
    }
    showSuccess('Preparing full customer backup...');
    try {
      const exportRows: any[] = [];
      for (const c of customers) {
        const entries = await getCustomerLedgerEntries(activeUid || '', c.id);
        exportRows.push({
          "customer ID": c.customerCode || '',
          "customer name": c.name || '',
          "address": c.address || '',
          "contact number": c.contactNumber || '',
          "current balance": c.currentBalance ?? '',
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

      showSuccess(`Full customer backup exported (${exportRows.length} records).`);
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
            const name = (row['customer name'] || row.name || '').trim();
            if (!name) continue;

            const rawCode = (row['customer ID'] || row.customerId || '').trim();
            const contactNumber = (row['contact number'] || row.contactNumber || '').trim();
            const address = (row.address || '').trim();
            const rawBalance = row['current balance'] ?? row.currentBalance;
            const currentBalance = rawBalance !== '' && rawBalance != null ? parseFloat(rawBalance) || 0 : 0;

            let customerCode: string | undefined = undefined;
            let customerId = '';

            if (rawCode) {
              customerCode = rawCode;
              customerId = `code-${rawCode}`;
            } else if (contactNumber) {
              const digits = contactNumber.replace(/\D/g, '');
              customerId = digits ? `contact-${digits}` : name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '') || 'customer';
            } else {
              customerId = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '') || 'customer';
            }

            // Fetch existing entries and profile
            const existingEntries = await getCustomerLedgerEntries(activeUid || '', customerId);
            const profileExists = await checkCustomerExists(activeUid || '', customerId);

            // Parse incoming entries
            let incomingEntries: any[] = [];
            try {
              if (row.ledger_json) {
                incomingEntries = JSON.parse(row.ledger_json);
              }
            } catch (err) {
              console.warn('Could not parse ledger for:', name);
            }

            if (incomingEntries.length === 0) {
              const openingAmountRaw = row['opening amount'];
              const hasOpeningAmount = openingAmountRaw !== '' && openingAmountRaw != null;
              const openingAmount = hasOpeningAmount ? parseFloat(openingAmountRaw) || 0 : null;
              if (openingAmount !== null && openingAmount !== 0) {
                const openingDate = (row['date'] || '').trim() || getCurrentNepaliDate();
                const openingParticular = (row['particular'] || '').trim() || 'Opening Balance';
                const openingBillNo = (row['bill number'] || '').trim();
                incomingEntries.push({
                  date: openingDate,
                  particular: openingParticular,
                  billNo: openingBillNo,
                  debit: openingAmount,
                  credit: 0,
                  note: ''
                });
              }
            }

            // Filter out duplicate entries
            const uniqueEntries = incomingEntries.filter(incoming => {
              const isDuplicate = existingEntries.some(existing => 
                existing.date === incoming.date &&
                existing.particular === incoming.particular &&
                (existing.billNo || '') === (incoming.billNo || '') &&
                existing.debit === (parseFloat(incoming.debit) || 0) &&
                existing.credit === (parseFloat(incoming.credit) || 0)
              );
              return !isDuplicate;
            });

            try {
              // If profile doesn't exist, we set the initial balance to 0 if there are new entries
              // (which will update it), or currentBalance if no entries. If profile exists, we don't
              // pass currentBalance to avoid resetting it (ledger updates will handle balance changes).
              const balanceToSet = profileExists 
                ? undefined 
                : (uniqueEntries.length > 0 ? 0 : currentBalance);

              await upsertCustomerProfile(activeUid || '', customerId, {
                name: name,
                address: address,
                contactNumber: contactNumber,
                currentBalance: balanceToSet,
                customerCode: customerCode,
              });
            } catch (err: any) {
              console.warn('Error creating/updating customer:', name, err);
              continue;
            }

            // Add unique entries sequentially
            for (const entry of uniqueEntries) {
              try {
                await addCustomerLedgerEntry(activeUid || '', customerId, {
                  date: entry.date || getCurrentNepaliDate(),
                  particular: entry.particular || 'Imported Entry',
                  billNo: entry.billNo || '',
                  debit: parseFloat(entry.debit) || 0,
                  credit: parseFloat(entry.credit) || 0,
                  note: entry.note || '',
                });
              } catch (err) {
                console.warn('Error adding ledger entry for', name, ':', err);
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
      const data = await getCustomers(activeUid || '');
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
      const data = await getCustomerLedgerEntries(activeUid || '', customerId);
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
  }, [activeUid]);

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
      .replace(/(^|[\s\-./])([a-z])/g, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`);
  };

  const openCustomerEdit = () => {
    if (!selectedCustomer) return;
    setEditCustomerName(selectedCustomer.name);
    setEditCustomerAddress(selectedCustomer.address);
    setEditCustomerContact(selectedCustomer.contactNumber);
    setEditCustomerCode(selectedCustomer.customerCode || '');
    setShowEditCustomer(true);
  };

  const openAddCustomer = () => {
    setNewCustomerName('');
    setNewCustomerAddress('');
    setNewCustomerContact('');
    setNewCustomerCode('');
    setNewCustomerOpeningAmount(0);
    setNewCustomerOpeningDate(getCurrentNepaliDate());
    setNewCustomerOpeningParticular('Opening Balance');
    setNewCustomerOpeningBillNo('');
    setNewCustomerCodeError('');
    setShowAddCustomer(true);
  };

  const checkCustomerCodeDuplicate = async (code: string, currentCustomerId?: string) => {
    const trimmed = (code || '').trim();
    if (!trimmed) return false;
    if (!activeUid) return false;

    try {
      const existing = await findCustomerByCode(activeUid, trimmed);
      return Boolean(existing && existing.id !== currentCustomerId);
    } catch (error) {
      console.warn('Error checking customer code duplicate:', error);
      return false;
    }
  };

  const handleAddCustomerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCustomerName.trim()) {
      showError('Customer name is required');
      return;
    }
    if (!newCustomerAddress.trim()) {
      showError('Address is required');
      return;
    }

    if (newCustomerOpeningAmount > 0) {
      if (!newCustomerOpeningDate.trim()) {
        showError('Please enter a date for the opening amount');
        return;
      }
      if (!newCustomerOpeningParticular.trim()) {
        showError('Please enter a particular for the opening amount');
        return;
      }
      if (!newCustomerOpeningBillNo.trim()) {
        showError('Please enter a bill number for the opening amount');
        return;
      }
    }

    if (newCustomerCode.trim()) {
      const isDup = await checkCustomerCodeDuplicate(newCustomerCode.trim());
      if (isDup) {
        setNewCustomerCodeError('Customer ID already in use');
        showError('Customer ID already in use');
        return;
      }
    }

    setNewCustomerLoading(true);
    try {
      const payload = {
        name: titleCase(newCustomerName).trim(),
        address: titleCase(newCustomerAddress).trim(),
        contactNumber: (newCustomerContact || '').replace(/\D/g, '').slice(0, 10),
        customerCode: newCustomerCode.trim().toUpperCase(),
      };
      const customerId = buildCustomerId({
        customerName: payload.name,
        address: payload.address,
        contactNumber: payload.contactNumber,
        customerCode: payload.customerCode,
      });

      await upsertCustomerProfile(activeUid || '', customerId, {
        ...payload,
        currentBalance: 0,
      });

      if (newCustomerOpeningAmount > 0) {
        await addCustomerLedgerEntry(activeUid || '', customerId, {
          date: newCustomerOpeningDate.trim() || getCurrentNepaliDate(),
          particular: newCustomerOpeningParticular.trim() || 'Opening Balance',
          billNo: newCustomerOpeningBillNo.trim(),
          debit: newCustomerOpeningAmount,
          credit: 0,
          note: '',
        });
      }

      showSuccess('Customer added successfully');
      if (!pinAddCustomer) {
        setShowAddCustomer(false);
      } else {
        setNewCustomerName('');
        setNewCustomerAddress('');
        setNewCustomerContact('');
        setNewCustomerCode('');
        setNewCustomerOpeningAmount(0);
        setNewCustomerOpeningDate('');
        setNewCustomerOpeningParticular('');
        setNewCustomerOpeningBillNo('');
        setNewCustomerCodeError('');
        if (newCustomerNameInputRef.current) {
          newCustomerNameInputRef.current.focus();
        }
      }
      setSelectedCustomer({
        id: customerId,
        name: payload.name,
        address: payload.address,
        contactNumber: payload.contactNumber,
        customerCode: payload.customerCode,
        currentBalance: newCustomerOpeningAmount > 0 ? newCustomerOpeningAmount : 0
      } as Customer);
      await loadCustomers();
    } catch (error: any) {
      console.error('Error adding customer:', error);
      showError(error.message || 'Failed to add customer');
    } finally {
      setNewCustomerLoading(false);
    }
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
      const newId = await upsertCustomerProfile(activeUid || '', selectedCustomer.id, {
        name: editCustomerName,
        address: editCustomerAddress,
        contactNumber: editCustomerContact,
        customerCode: editCustomerCode.trim(),
        currentBalance: selectedBalance,
      });
      showSuccess('Customer details updated successfully');
      setShowEditCustomer(false);
      await loadCustomers();
      // Re-select the customer under its (possibly new) ID
      if (newId && newId !== selectedCustomer.id) {
        setSelectedCustomer(prev => prev ? {
          ...prev,
          id: newId,
          name: editCustomerName,
          address: editCustomerAddress,
          contactNumber: editCustomerContact,
          customerCode: editCustomerCode.trim(),
        } : null);
      }
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
    setTxType('credit');
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
      await addCustomerLedgerEntry(activeUid || '', selectedCustomer.id, {
        date: txDate || getCurrentNepaliDate(),
        particular: txParticular.trim(),
        billNo: txBillNo.trim() || '',
        debit: txType === 'debit' ? txAmount : 0,
        credit: txType === 'credit' ? txAmount : 0,
        note: txNote.trim() || '',
      });
      showSuccess('Transaction added successfully');
      if (!pinAddTx) {
        setShowAddTransaction(false);
      } else {
        setTxParticular('');
        setTxBillNo('');
        setTxAmount(0);
        setTxNote('');
        if (txParticularInputRef.current) {
          txParticularInputRef.current.focus();
        }
      }
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
      await updateCustomerLedgerEntry(activeUid || '', selectedCustomer.id, editingTransaction.id, {
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
      await deleteCustomerLedgerEntry(activeUid || '', selectedCustomer.id, deletingTransaction.id);
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
      await deleteCustomerProfile(activeUid || '', selectedCustomer.id);
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
            <button onClick={handleExportFull} className="btn btn-secondary">
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
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-icon-action"
                    title="Import customer list"
                    aria-label="Import customer list"
                    style={{ width: '34px', height: '34px', borderRadius: '8px' }}
                    disabled={loadingCustomers}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="btn-icon-action"
                    title="Export customer list"
                    aria-label="Export customer list"
                    style={{ width: '34px', height: '34px', borderRadius: '8px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
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

              <button
                onClick={openAddCustomer}
                className="btn btn-primary btn-sm btn-add-part"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Customer
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
                className="input customer-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, ID, contact, or address"
                style={{ paddingRight: searchTerm ? '2rem' : undefined }}
              />
              {searchTerm && (
                <button 
                  type="button" 
                  className="clear-search-btn" 
                  onClick={() => setSearchTerm('')}
                  title="Clear search"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
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
                            <span>{formatCurrency(balance.amount)}</span>
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
                    <strong className="mb-value text-success">{formatCurrency(totalDebit)}</strong>
                  </div>
                  <div className="metric-card">
                    <span className="mb-label">Total Credit</span>
                    <strong className="mb-value text-danger">{formatCurrency(totalCredit)}</strong>
                  </div>
                  <div className="metric-card highlight">
                    <span className="mb-label">Current Balance</span>
                    {(() => {
                      const balance = formatBalanceDisplay(selectedBalance);
                      return (
                        <strong className="mb-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{formatCurrency(balance.amount)}</span>
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
                            <td className="text-right text-success">{entry.debit > 0 ? formatCurrency(entry.debit) : '—'}</td>
                            <td className="text-right text-danger">{entry.credit > 0 ? formatCurrency(entry.credit) : '—'}</td>
                            <td className="text-right">
                              {(() => {
                                const balance = formatBalanceDisplay(entry.currentBalance);
                                return (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <strong>{formatCurrency(balance.amount)}</strong>
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
                        
                        {/* Opening Balance Row */}
                        {(() => {
                          let openingBal = 0;
                          if (filteredLedger.length > 0) {
                            const firstTx = filteredLedger[0];
                            const idx = ledger.findIndex(t => t.id === firstTx.id);
                            if (idx > 0) {
                              openingBal = ledger[idx - 1].currentBalance;
                            }
                          } else if (ledger.length > 0) {
                            openingBal = ledger[ledger.length - 1].currentBalance;
                          } else {
                            openingBal = selectedCustomer?.currentBalance || 0;
                          }

                          if (openingBal !== 0) {
                            const bal = formatBalanceDisplay(openingBal);
                            return (
                              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                <td>—</td>
                                <td style={{ fontWeight: 600 }}>Opening Balance (B/F)</td>
                                <td className="text-center">—</td>
                                <td className="text-right">—</td>
                                <td className="text-right">—</td>
                                <td className="text-right">
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <strong>{formatCurrency(bal.amount)}</strong>
                                    <span className={`badge ${bal.label === 'CR' ? 'text-danger' : 'text-success'}`} style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.1rem 0.45rem', fontSize: '0.72rem', fontWeight: 700 }}>
                                      {bal.label}
                                    </span>
                                  </span>
                                </td>
                                <td className="text-center">—</td>
                              </tr>
                            );
                          }
                          
                          // If filteredLedger is empty and opening balance is 0, show a fallback row
                          if (filteredLedger.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                                  No transactions found for the selected date range.
                                </td>
                              </tr>
                            );
                          }
                          return null;
                        })()}
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
              <button className="modal-close" onClick={() => setShowEditCustomer(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleEditCustomerSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Customer Name *</label>
                  <input autoFocus className="input" value={editCustomerName} onChange={(event) => setEditCustomerName(titleCase(event.target.value))} />
                </div>
                <div className="form-group">
                  <label className="label">Address *</label>
                  <input className="input" value={editCustomerAddress} onChange={(event) => setEditCustomerAddress(titleCase(event.target.value))} />
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

      {showAddCustomer && (
        <div className="modal-overlay" onClick={() => setShowAddCustomer(false)}>
          <div className="modal-content stock-modal customer-edit-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Customer</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setPinAddCustomer(!pinAddCustomer)}
                  title={pinAddCustomer ? "Unpin modal" : "Pin modal to keep it open"}
                  style={{ background: 'none', border: 'none', color: pinAddCustomer ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={pinAddCustomer ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 17v5"/>
                    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
                  </svg>
                </button>
                <button className="modal-close" onClick={() => setShowAddCustomer(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddCustomerSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Customer Name *</label>
                  <input autoFocus ref={newCustomerNameInputRef} className="input" value={newCustomerName} onChange={(event) => setNewCustomerName(titleCase(event.target.value))} />
                </div>
                <div className="form-group">
                  <label className="label">Address *</label>
                  <input className="input" value={newCustomerAddress} onChange={(event) => setNewCustomerAddress(titleCase(event.target.value))} />
                </div>
                <div className="form-group">
                  <label className="label">Contact Number</label>
                  <input className="input" maxLength={10} value={newCustomerContact} onChange={(event) => setNewCustomerContact((event.target.value || '').replace(/\D/g, '').slice(0, 10))} />
                </div>
                <div className="form-group">
                  <label className="label">Customer ID (max 4 chars)</label>
                  <input
                    className="input"
                    maxLength={4}
                    value={newCustomerCode}
                    onChange={(event) => { setNewCustomerCode(event.target.value.toUpperCase().slice(0, 4)); setNewCustomerCodeError(''); }}
                    onBlur={async () => {
                      if (!newCustomerCode.trim()) return;
                      const dup = await checkCustomerCodeDuplicate(newCustomerCode.trim());
                      setNewCustomerCodeError(dup ? 'Customer ID already in use' : '');
                    }}
                    placeholder="e.g. 0001 or AB12"
                  />
                  {newCustomerCodeError && <div style={{ color: '#b91c1c', marginTop: '6px', fontSize: '0.9rem' }}>{newCustomerCodeError}</div>}
                </div>
                <div className="form-group">
                  <label className="label">Opening Amount</label>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={newCustomerOpeningAmount ? formatNumberInputValue(newCustomerOpeningAmount, settings?.numberSystem) : ''}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/,/g, '');
                      if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                        setNewCustomerOpeningAmount(raw === '' ? 0 : parseFloat(raw) || 0);
                      }
                    }}
                    placeholder="Enter opening DR amount"
                  />
                </div>
                {newCustomerOpeningAmount > 0 && (
                  <>
                    <div className="form-group">
                      <NepaliDatePickerComponent
                        ref={newCustomerOpeningDatePickerRef}
                        label="Date (BS) *"
                        value={newCustomerOpeningDate}
                        onChange={(bs) => setNewCustomerOpeningDate(bs)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Particular *</label>
                      <input
                        className="input"
                        value={newCustomerOpeningParticular}
                        onChange={(event) => setNewCustomerOpeningParticular(event.target.value)}
                        placeholder="Opening Balance"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Bill Number *</label>
                      <input
                        className="input"
                        value={newCustomerOpeningBillNo}
                        onChange={(event) => setNewCustomerOpeningBillNo(event.target.value)}
                        placeholder="Bill number"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-success" type="submit" disabled={newCustomerLoading || !!newCustomerCodeError}>{newCustomerLoading ? 'Saving...' : 'Add Customer'}</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowAddCustomer(false)}>Cancel</button>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setPinAddTx(!pinAddTx)}
                  title={pinAddTx ? "Unpin modal" : "Pin modal to keep it open"}
                  style={{ background: 'none', border: 'none', color: pinAddTx ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={pinAddTx ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 17v5"/>
                    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
                  </svg>
                </button>
                <button className="modal-close" onClick={() => setShowAddTransaction(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
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
                  <input autoFocus ref={txParticularInputRef} className="input" value={txParticular} onChange={(event) => setTxParticular(event.target.value)} placeholder="bill_0001 or payment" />
                </div>
                <div className="form-group">
                  <label className="label">Bill Number *</label>
                  <input className="input" value={txBillNo} onChange={(event) => setTxBillNo(event.target.value)} placeholder="0001" />
                </div>
                <div className="form-group">
                  <label className="label">Amount *</label>
                  <input className="input" type="text" inputMode="decimal" value={txAmount ? formatNumberInputValue(txAmount, settings?.numberSystem) : ''} onChange={(event) => { const raw = event.target.value.replace(/,/g, ''); if (raw === '' || /^\d*\.?\d*$/.test(raw)) { setTxAmount(raw === '' ? 0 : parseFloat(raw) || 0); } }} />
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
              <button className="modal-close" onClick={() => setShowEditTransaction(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
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
                  <input className="input" type="text" inputMode="decimal" value={editTxAmount ? formatNumberInputValue(editTxAmount, settings?.numberSystem) : ''} onChange={(event) => { const raw = event.target.value.replace(/,/g, ''); if (raw === '' || /^\d*\.?\d*$/.test(raw)) { setEditTxAmount(raw === '' ? 0 : parseFloat(raw) || 0); } }} />
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
              <button className="modal-close" onClick={() => setShowDeleteTransactionConfirm(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
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
              <button className="modal-close" onClick={() => setShowDeleteCustomerConfirm(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="modal-body">
              <p>Delete <strong>{selectedCustomer.name}</strong> and all of its ledger entries?</p>
            </div>
            <div className="modal-footer">
              <button autoFocus className="btn btn-danger" onClick={handleDeleteCustomer} disabled={deleteCustomerLoading}>{deleteCustomerLoading ? 'Deleting...' : 'Delete Customer'}</button>
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
