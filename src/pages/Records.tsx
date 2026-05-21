import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Bill, BillItem } from '../types';
import { collection, query, orderBy, limit, getDocs, endBefore, startAfter, limitToLast, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAllBills, deleteBill, updateBill, createBill } from '../services/billService';
import { getAppSettings, isBillInFiscalYear } from '../services/settingsService';
import { recordBillInventory, removeBillInventory } from '../services/stockService';
import { syncBillCustomerLedger } from '../services/customerService';
import type { AppSettings } from '../types';
import { formatCurrency, numberToWords } from '../utils/numberToWords';
import { generateBillPDF } from '../utils/pdfGenerator';
import { printBill } from '../utils/printBill';
import Papa from 'papaparse';
import NepaliDate from 'nepali-date-converter';
import NepaliDatePickerComponent from '../components/NepaliDatePicker';
import ToastContainer from '../components/ToastContainer';
import { useAuth } from '../context/AuthContext';
import { useFiscalYear } from '../context/FiscalYearContext';
import { useToast } from '../hooks/useToast';
import './Records.css';

const Records: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type SortKey = 'billNo' | 'date' | 'customerName' | 'address' | 'contactNumber' | 'totalQty' | 'totalAmount';
  type SortDirection = 'asc' | 'desc' | null;

  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: SortDirection }>({
    key: null,
    direction: null,
  });

  // Pagination state
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const totalPages = Math.ceil(totalCount / pageSize);

  // View modal
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Edit modal
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [originalBill, setOriginalBill] = useState<Bill | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const { toasts, showSuccess, showError, removeToast } = useToast();
  const { user } = useAuth();
  const { settings, activeFiscalYear, fiscalYearStart, fiscalYearEnd, isInActiveFY } = useFiscalYear();

  const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }), []);

  const getBillDateValue = (bill: Bill) => {
    const adDate = new Date(bill.date).getTime();
    if (!Number.isNaN(adDate)) {
      return adDate;
    }

    return bill.createdAt instanceof Date ? bill.createdAt.getTime() : new Date(String(bill.createdAt)).getTime();
  };

  const sortBills = (sourceBills: Bill[]) => {
    if (!sortConfig.key || !sortConfig.direction) {
      return sourceBills;
    }

    const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

    return [...sourceBills].sort((left, right) => {
      let comparison = 0;

      switch (sortConfig.key) {
        case 'billNo':
          comparison = collator.compare(left.billNo ?? '', right.billNo ?? '');
          break;
        case 'date':
          comparison = getBillDateValue(left) - getBillDateValue(right);
          break;
        case 'customerName':
          comparison = collator.compare(left.customerName ?? '', right.customerName ?? '');
          break;
        case 'address':
          comparison = collator.compare(left.address ?? '', right.address ?? '');
          break;
        case 'contactNumber':
          comparison = collator.compare(left.contactNumber ?? '', right.contactNumber ?? '');
          break;
        case 'totalQty': {
          const leftQty = left.items?.reduce((sum, item) => sum + item.qty, 0) || 0;
          const rightQty = right.items?.reduce((sum, item) => sum + item.qty, 0) || 0;
          comparison = leftQty - rightQty;
          break;
        }
        case 'totalAmount':
          comparison = (left.totalAmount ?? 0) - (right.totalAmount ?? 0);
          break;
        default:
          comparison = 0;
      }

      return comparison * directionMultiplier;
    });
  };

  const sortedBills = useMemo(() => sortBills(bills), [bills, collator, sortConfig]);
  const sortedAllBills = useMemo(() => sortBills(allBills), [allBills, collator, sortConfig]);
  const isSortedMode = Boolean(sortConfig.key && sortConfig.direction);

  // Apply fiscal year filter to bills
  const applyFyFilter = (sourceBills: Bill[]) => {
    if (!activeFiscalYear || !settings) return sourceBills;
    return sourceBills.filter(b => {
      let bsDate = b.nepaliDate;
      if (!bsDate) {
        try {
          const d = new Date(b.date || b.createdAt);
          if (!Number.isNaN(d.getTime())) {
            bsDate = new NepaliDate(d).format('YYYY-MM-DD');
          }
        } catch { /* skip */ }
      }
      if (!bsDate) return false;
      return isBillInFiscalYear(bsDate, activeFiscalYear, fiscalYearStart, fiscalYearEnd);
    });
  };

  const displayedBills = useMemo(() => {
    const base = isSortedMode && !isSearchMode ? sortedAllBills : sortedBills;
    return applyFyFilter(base);
  }, [sortedBills, sortedAllBills, isSortedMode, isSearchMode, activeFiscalYear, fiscalYearStart, fiscalYearEnd, settings]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const timer = setTimeout(() => {
        handleSearchMode();
      }, 500); // debounce search
      return () => clearTimeout(timer);
    } else {
      if (user?.uid) {
        fetchTotalCount().then(() => loadPageForward(0));
      }
    }
  }, [searchTerm, pageSize, user]);

  const fetchTotalCount = async () => {
    try {
      const coll = collection(db, 'users', user?.uid || '', 'bills');
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (e) {
      console.error('Error fetching count:', e);
    }
  };

  useEffect(() => {
    if (isSearchMode) {
      return;
    }

    if (isSortedMode) {
      loadAllBillsForSort();
    } else {
      setAllBills([]);
    }
  }, [isSortedMode, isSearchMode]);

  const handleSearchMode = async () => {
    try {
      setLoading(true);
      const data = await getAllBills(user?.uid || '');
      const lowerSearchTerm = searchTerm.toLowerCase();
      const filtered = data.filter(bill => {
        return (
          bill.billNo.toLowerCase().includes(lowerSearchTerm) ||
          bill.customerName.toLowerCase().includes(lowerSearchTerm) ||
          bill.address.toLowerCase().includes(lowerSearchTerm) ||
          bill.contactNumber.includes(searchTerm) ||
          (bill.paymentMethod?.toLowerCase().includes(lowerSearchTerm) ?? false) ||
          (bill.items?.reduce((sum, item) => sum + item.qty, 0).toString() || '').includes(searchTerm) ||
          bill.date.includes(searchTerm) ||
          bill.nepaliDate.includes(searchTerm)
        );
      });
      setBills(filtered);
      setAllBills(filtered);
      setIsSearchMode(true);
    } catch (e) {
      console.error('Error searching bills:', e);
      showError('Failed to search bills');
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key !== key) {
        return { key, direction: 'asc' };
      }

      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }

      if (current.direction === 'desc') {
        return { key: null, direction: null };
      }

      return { key, direction: 'asc' };
    });
  };

  const getSortDirection = (key: SortKey) => (sortConfig.key === key ? sortConfig.direction : null);

  const renderSortButton = (label: string, key: SortKey) => {
    const direction = getSortDirection(key);
    const isActive = direction !== null;

    return (
      <button
        type="button"
        className={`sort-header-button ${isActive ? 'active' : ''}`}
        onClick={() => toggleSort(key)}
        aria-label={`${label} sort ${direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'unsorted'}`}
        title={`${label} ${direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'unsorted'}`}
      >
        <span>{label}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`sort-icon ${direction === 'asc' ? 'asc' : direction === 'desc' ? 'desc' : 'none'}`}
          aria-hidden="true"
        >
          <path d="M6 15l6 6 6-6" />
          <path d="M6 9l6-6 6 6" />
        </svg>
      </button>
    );
  };

  const loadPageForward = async (targetPage: number, cursorDoc?: any) => {
    try {
      setLoading(true);
      setIsSearchMode(false);
      
      let q;
      if (cursorDoc) {
        q = query(collection(db, 'users', user?.uid || '', 'bills'), orderBy('createdAt', 'desc'), startAfter(cursorDoc), limit(pageSize));
      } else {
        q = query(collection(db, 'users', user?.uid || '', 'bills'), orderBy('createdAt', 'desc'), limit(pageSize));
      }
      
      const snap = await getDocs(q);
      const newBills = snap.docs.map((d) => ({
        id: d.id,
        userId: user?.uid,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
      })) as Bill[];
      
      setBills(newBills);
      setCurrentPage(targetPage);
    } catch (error) {
      console.error('Error loading paginated bills:', error);
      showError('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const loadPageBackward = async (targetPage: number, cursorDoc: any) => {
    try {
      setLoading(true);
      setIsSearchMode(false);
      
      const q = query(
        collection(db, 'users', user?.uid || '', 'bills'), 
        orderBy('createdAt', 'desc'), 
        endBefore(cursorDoc), 
        limitToLast(pageSize)
      );
      
      const snap = await getDocs(q);
      const newBills = snap.docs.map((d) => ({
        id: d.id,
        userId: user?.uid,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
      })) as Bill[];
      
      setBills(newBills);
      setCurrentPage(targetPage);
    } catch (error) {
      console.error('Error fetching previous page:', error);
      showError('Failed to fetch previous page');
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1 && bills.length > 0) {
      // The cursor is the createdAt timestamp of the last bill on the current screen
      loadPageForward(currentPage + 1, Timestamp.fromDate(bills[bills.length - 1].createdAt));
    }
  };

  const handlePrevPage = async () => {
    if (currentPage > 0 && bills.length > 0) {
      // The cursor is the createdAt timestamp of the first bill on the current screen
      loadPageBackward(currentPage - 1, Timestamp.fromDate(bills[0].createdAt));
    }
  };

  const handleLastPage = async () => {
    if (totalPages <= 1) return;
    try {
      setLoading(true);
      setIsSearchMode(false);
      
      // Calculate how many items are on the last page to fetch exactly that many, 
      // or just fetch pageSize. If total is 12, and pageSize is 10, last page has 2 items.
      const remainder = totalCount % pageSize;
      const fetchCount = remainder === 0 ? pageSize : remainder;
      
      const q = query(collection(db, 'users', user?.uid || '', 'bills'), orderBy('createdAt', 'asc'), limit(fetchCount));
      const snap = await getDocs(q);
      
      const oldestBills = snap.docs.map((d) => ({
        id: d.id,
        userId: user?.uid,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
      })) as Bill[];
      
      oldestBills.reverse();
      setBills(oldestBills);
      setCurrentPage(totalPages - 1);
    } catch (error) {
      console.error('Error fetching last page:', error);
      showError('Failed to fetch last page');
    } finally {
      setLoading(false);
    }
  };

  const loadAllBillsForSort = async () => {
    try {
      setLoading(true);
      const data = await getAllBills(user?.uid || '');
      setAllBills(data);
    } catch (error) {
      console.error('Error loading all bills for sorting:', error);
      showError('Failed to load all bills for sorting');
    } finally {
      setLoading(false);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(0);
  };

  const loadBills = async () => {
    await fetchTotalCount();
    if (searchTerm.trim()) {
      handleSearchMode();
    } else {
      loadPageForward(currentPage); // reload current page
    }
  };

  const handleViewBill = (bill: Bill) => {
    setSelectedBill(bill);
    setShowModal(true);
  };

  const handleDeleteBill = async (id: string) => {
    const billToDelete = bills.find(b => b.id === id) || allBills.find(b => b.id === id);
    if (!billToDelete) {
      showError('Could not find the bill record.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete bill #${billToDelete.billNo}?`)) {
      return;
    }

    try {
      // 1. Delete from Firestore
      await deleteBill(user?.uid || '', id);
      
      // 2. Revert stock levels
      if (billToDelete.billNo) {
        await removeBillInventory(user?.uid || '', billToDelete.billNo, billToDelete.items || []);
      }
      await syncBillCustomerLedger(user?.uid || '', billToDelete, null);

      showSuccess('Bill and associated stock records deleted successfully');
      loadBills();
      if (selectedBill?.id === id) {
        setShowModal(false);
        setSelectedBill(null);
      }
    } catch (error) {
      console.error('Error deleting bill:', error);
      showError('Failed to delete bill');
    }
  };

  const handleDownloadPDF = (bill: Bill) => {
    try {
      generateBillPDF(
        bill,
        settings?.businessName || 'Shop Billing System',
        settings?.businessAddress || 'Garuda, Rautahat, Nepal',
        settings?.businessContact || ''
      );
      showSuccess('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Failed to generate PDF');
    }
  };

  const handlePrintBill = (bill: Bill) => {
    printBill(
      bill,
      settings?.businessName || 'Shop Billing System',
      settings?.businessAddress || 'Garuda, Rautahat, Nepal',
      settings?.businessContact || ''
    );
  };

  const handleExport = async () => {
    let exportData = bills;
    if (!isSearchMode) {
      showSuccess('Fetching all records for export...');
      try {
        exportData = await getAllBills(user?.uid || '');
      } catch (e) {
        showError('Failed to fetch full records for export');
        return;
      }
    }

    if (exportData.length === 0) {
      showError('No records to export');
      return;
    }
    
    const csvData = exportData.map(bill => {
      const { items, createdAt, updatedAt, id, userId, ...rest } = bill;
      return {
        ...rest,
        items_json: JSON.stringify(items)
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute("download", "bills_backup.csv");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showSuccess("Bills exported successfully as CSV");
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
          const importedRows = results.data as any[];
          if (!importedRows || importedRows.length === 0) {
            showError("No valid rows found in CSV.");
            return;
          }

          let importedCount = 0;
          for (const row of importedRows) {
            if (row.customerName && row.billNo) {
              let items = [];
              try {
                if (row.items_json) {
                  items = JSON.parse(row.items_json);
                }
              } catch (e) {
                console.warn('Could not parse items for bill:', row.billNo);
              }

              const billData: any = {
                userId: user?.uid || '',
                billNo: row.billNo,
                date: row.date || '',
                nepaliDate: row.nepaliDate || '',
                customerName: row.customerName,
                address: row.address || '',
                contactNumber: row.contactNumber || '',
                totalAmount: parseFloat(row.totalAmount) || 0,
                totalAmountInWords: row.totalAmountInWords || '',
                paymentMethod: row.paymentMethod || 'Cash',
                freeDue: row.freeDue || '',
                items: items,
              };

              await createBill(billData);
              await syncBillCustomerLedger(user?.uid || '', null, billData as Bill);
              importedCount++;
            }
          }
          
          if (importedCount > 0) {
            showSuccess(`Successfully imported ${importedCount} bills`);
            loadBills();
          } else {
            showError("No valid bills found in the file.");
          }
        } catch (error) {
          console.error('Error importing CSV:', error);
          showError("Failed to import. Invalid CSV file.");
        } finally {
          setImportLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error('PapaParse error:', error);
        showError("Failed to read the CSV file.");
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  // ── Edit handlers ────────────────────────────────────────────────────────
  const handleOpenEdit = (bill: Bill) => {
    setEditBill({ ...bill, items: bill.items.map(i => ({ ...i })) });
    setOriginalBill(bill);
    setShowEditModal(true);
  };

  const handleEditField = (field: keyof Bill, value: string) => {
    if (!editBill) return;
    setEditBill({ ...editBill, [field]: value });
  };

  const handleEditDateChange = (bs: string, ad: string) => {
    if (!editBill) return;
    setEditBill({ ...editBill, nepaliDate: bs, date: ad });
  };

  const handleEditItemChange = (index: number, field: keyof BillItem, value: string | number) => {
    if (!editBill) return;
    const newItems = editBill.items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'qty' || field === 'rate') {
        updated.amount = updated.qty * updated.rate;
      }
      return updated;
    });
    setEditBill({ ...editBill, items: newItems });
  };

  const handleEditAddItem = () => {
    if (!editBill) return;
    const newItem: BillItem = {
      sn: editBill.items.length + 1,
      particulars: '',
      qty: 0,
      rate: 0,
      amount: 0,
    };
    setEditBill({ ...editBill, items: [...editBill.items, newItem] });
  };

  const handleEditRemoveItem = (index: number) => {
    if (!editBill || editBill.items.length === 1) return;
    const newItems = editBill.items
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, sn: i + 1 }));
    setEditBill({ ...editBill, items: newItems });
  };

  const calcEditTotal = () =>
    editBill ? editBill.items.reduce((s, i) => s + i.amount, 0) : 0;

  const handleSaveEdit = async () => {
    if (!editBill) return;

    if (!editBill.customerName.trim()) { showError('Customer name is required'); return; }
    if (!editBill.address.trim())      { showError('Address is required'); return; }
    if (!editBill.contactNumber.trim()){ showError('Contact number is required'); return; }

    const validItems = editBill.items.filter(
      i => i.particulars.trim() && i.qty > 0 && i.rate > 0
    );
    if (validItems.length === 0) { showError('Add at least one valid item'); return; }

    setEditLoading(true);
    try {
      // 1. Revert stock levels from original bill first
      if (originalBill && originalBill.billNo) {
        await removeBillInventory(user?.uid || '', originalBill.billNo, originalBill.items || []);
      }

      // 2. Save the edited bill to Firestore
      const totalAmount = calcEditTotal();
      const totalQty = validItems.reduce((sum, item) => sum + item.qty, 0);
      const updated: Partial<Bill> = {
        billNo:              editBill.billNo,
        date:                editBill.date,
        nepaliDate:          editBill.nepaliDate,
        customerName:        editBill.customerName,
        address:             editBill.address,
        contactNumber:       editBill.contactNumber,
        items:               validItems,
        totalAmount,
        totalAmountInWords:  numberToWords(totalAmount),
        totalQty,
        paymentMethod:       editBill.paymentMethod || 'Cash',
        freeDue:             editBill.freeDue,
      };
      await updateBill(user?.uid || '', editBill.id, updated);

      // 3. Record new stock levels for updated bill
      await recordBillInventory(
        user?.uid || '',
        editBill.billNo,
        editBill.nepaliDate || editBill.date,
        validItems
      );
      await syncBillCustomerLedger(
        user?.uid || '',
        originalBill,
        { ...editBill, items: validItems, totalAmount, totalAmountInWords: numberToWords(totalAmount), totalQty } as Bill
      );

      showSuccess('Bill and associated stock records updated successfully!');
      setShowEditModal(false);
      setEditBill(null);
      setOriginalBill(null);
      loadBills();
    } catch (err) {
      console.error('Error updating bill:', err);
      showError('Failed to update bill. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };


  return (
    <div className="records-page">
      <div className="container">
        
        {/* Top Header - Title + Export Buttons */}
        <div className="records-header-clean">
          <h1 className="records-title-clean">Bill Records</h1>
          
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
            <button onClick={loadBills} className="btn btn-primary btn-refresh">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <polyline points="23 20 23 14 17 14" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
          </div>
        </div>

        <div className="table-container-card card fade-in">
          
          <div className="table-search-bar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="input search-input-inside"
              placeholder="Search by Bill No, Name, Address, Contact, or Date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading bills...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="empty-state card fade-in">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <h3>No bills found</h3>
            <p>
              {searchTerm ? 'Try adjusting your search criteria' : 'Create your first bill to get started'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>{renderSortButton('Bill No', 'billNo')}</th>
                  <th>{renderSortButton('Date', 'date')}</th>
                  <th>{renderSortButton('Customer Name', 'customerName')}</th>
                  <th>{renderSortButton('Address', 'address')}</th>
                  <th>{renderSortButton('Contact', 'contactNumber')}</th>
                  <th>{renderSortButton('Total Qty', 'totalQty')}</th>
                  <th>{renderSortButton('Total Amount', 'totalAmount')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedBills.map((bill) => (
                  <tr key={bill.id}>
                    <td><strong>{bill.billNo}</strong></td>
                    <td>
                      <div>{bill.nepaliDate || bill.date}</div>
                      {bill.nepaliDate && bill.date && (
                        <div className="nepali-date">{bill.date}</div>
                      )}
                    </td>
                    <td>{bill.customerName}</td>
                    <td className="address-cell">{bill.address}</td>
                    <td>{bill.contactNumber}</td>
                    <td>{bill.items?.reduce((sum, item) => sum + item.qty, 0) || 0}</td>
                    <td><strong>{formatCurrency(bill.totalAmount)}</strong></td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleViewBill(bill)}
                          className="btn btn-sm btn-primary"
                          title="View details"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleOpenEdit(bill)}
                          className="btn btn-sm btn-warning"
                          title="Edit bill"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDownloadPDF(bill)}
                          className="btn btn-sm btn-success"
                          title="Download PDF"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDeleteBill(bill.id)}
                          className="btn btn-sm btn-danger"
                          title="Delete bill"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          </div>
        )}
        
        <div className="search-results-info-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span>
            {isSearchMode 
              ? `Found ${displayedBills.length} bills matching "${searchTerm}" in FY ${activeFiscalYear}`
              : `Showing ${displayedBills.length} bills in FY ${activeFiscalYear}`
            }
          </span>

          {!isSearchMode && (
            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="pageSize" style={{ fontSize: '0.875rem' }}>Rows per page:</label>
                <select 
                  id="pageSize" 
                  value={pageSize} 
                  onChange={handlePageSizeChange}
                  className="select"
                  style={{ padding: '0.25rem 2rem 0.25rem 0.5rem', width: 'auto', minWidth: '70px' }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => loadPageForward(0)} 
                  disabled={currentPage === 0}
                  style={{ padding: '0.25rem 0.75rem' }}
                >
                  First
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handlePrevPage} 
                  disabled={currentPage === 0}
                  style={{ padding: '0.25rem 0.75rem' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleNextPage} 
                  disabled={currentPage >= totalPages - 1}
                  style={{ padding: '0.25rem 0.75rem' }}
                >
                  Next
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleLastPage} 
                  disabled={currentPage >= totalPages - 1}
                  style={{ padding: '0.25rem 0.75rem' }}
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Bill Details Modal */}
        {showModal && selectedBill && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Bill Details</h2>
                <button onClick={() => setShowModal(false)} className="modal-close">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                <div className="bill-detail-section">
                  <h3>Bill Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Bill No:</span>
                      <span className="detail-value">{selectedBill.billNo}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">{selectedBill.date}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Nepali Date:</span>
                      <span className="detail-value">{selectedBill.nepaliDate}</span>
                    </div>
                  </div>
                </div>

                <div className="bill-detail-section">
                  <h3>Customer Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Name:</span>
                      <span className="detail-value">{selectedBill.customerName}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Address:</span>
                      <span className="detail-value">{selectedBill.address}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Contact:</span>
                      <span className="detail-value">{selectedBill.contactNumber}</span>
                    </div>
                  </div>
                </div>

                <div className="bill-detail-section">
                  <h3>Items</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>S.N.</th>
                          <th>Particulars</th>
                          <th>Qty.</th>
                          <th>Rate</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBill.items.map((item) => (
                          <tr key={item.sn}>
                            <td>{item.sn}</td>
                            <td>{item.particulars}</td>
                            <td>{item.qty}</td>
                            <td>{formatCurrency(item.rate)}</td>
                            <td><strong>{formatCurrency(item.amount)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5} className="detail-total-row">
                            <span style={{ marginRight: '30px' }}>
                              Total Qty: {selectedBill.items.reduce((sum, item) => sum + item.qty, 0)}
                            </span>
                            <span>
                              Total Amount: {formatCurrency(selectedBill.totalAmount)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="bill-detail-section">
                  <div className="detail-words">
                    <span className="detail-label">In Words:</span>
                    <span className="detail-value">{selectedBill.totalAmountInWords}</span>
                  </div>
                  {selectedBill.freeDue && (
                    <div className="detail-item full-width" style={{ marginTop: '12px' }}>
                      <span className="detail-label" style={{ fontWeight: 'bold', marginRight: '8px' }}>Note:</span>
                      <span className="detail-value">{selectedBill.freeDue}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button onClick={() => handlePrintBill(selectedBill)} className="btn btn-info">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print
                </button>
                <button onClick={() => handleDownloadPDF(selectedBill)} className="btn btn-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PDF
                </button>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Bill Modal ─────────────────────────────────────────────── */}
        {showEditModal && editBill && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>

              <div className="modal-header">
                <h2>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Bill — {editBill.billNo}
                </h2>
                <button onClick={() => setShowEditModal(false)} className="modal-close">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">

                {/* Bill info row */}
                <div className="edit-section">
                  <h3 className="edit-section-title">Bill Information</h3>
                  <div className="edit-grid-3">
                    <div className="form-group">
                      <label className="label">Bill No</label>
                      <input className="input" value={editBill.billNo}
                        onChange={e => handleEditField('billNo', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <NepaliDatePickerComponent
                        label="Date (BS)"
                        value={editBill.nepaliDate}
                        onChange={handleEditDateChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Customer info */}
                <div className="edit-section">
                  <h3 className="edit-section-title">Customer Information</h3>
                  <div className="edit-grid-3">
                    <div className="form-group">
                      <label className="label">Customer Name *</label>
                      <input className="input" value={editBill.customerName}
                        onChange={e => handleEditField('customerName', e.target.value)}
                        placeholder="Customer name" />
                    </div>
                    <div className="form-group">
                      <label className="label">Address *</label>
                      <input className="input" value={editBill.address}
                        onChange={e => handleEditField('address', e.target.value)}
                        placeholder="Address" />
                    </div>
                    <div className="form-group">
                      <label className="label">Contact Number *</label>
                      <input className="input" value={editBill.contactNumber}
                        onChange={e => handleEditField('contactNumber', e.target.value)}
                        placeholder="Contact number" />
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="edit-section">
                  <div className="edit-section-header">
                    <h3 className="edit-section-title" style={{ borderBottom: 'none', marginBottom: 0 }}>Items</h3>
                  </div>
                  <div className="table-container">
                    <table className="table items-table">
                      <thead>
                        <tr>
                          <th style={{ width: 50 }}>S.N.</th>
                          <th>Particulars</th>
                          <th style={{ width: 90 }}>Qty.</th>
                          <th style={{ width: 110 }}>Rate</th>
                          <th style={{ width: 120 }}>Amount</th>
                          <th style={{ width: 60 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editBill.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="text-center">{item.sn}</td>
                            <td>
                              <input className="input" value={item.particulars}
                                onChange={e => handleEditItemChange(idx, 'particulars', e.target.value)}
                                placeholder="Description" />
                            </td>
                            <td>
                              <input type="number" className="input" value={item.qty || ''}
                                onChange={e => handleEditItemChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                                min="0" step="0.01" />
                            </td>
                            <td>
                              <input type="number" className="input" value={item.rate || ''}
                                onChange={e => handleEditItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                                min="0" step="0.01" />
                            </td>
                            <td className="text-right"><strong>{formatCurrency(item.amount)}</strong></td>
                            <td className="text-center">
                              <button onClick={() => handleEditRemoveItem(idx)}
                                className="btn btn-danger btn-sm"
                                disabled={editBill.items.length === 1} title="Remove">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={handleEditAddItem} className="btn btn-primary btn-add-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Item
                  </button>
                </div>

                {/* Total Section */}
                <div className="total-section">
                  <div className="total-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <span className="total-label">Total Quantity:</span>
                    <span className="total-amount" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {editBill.items.reduce((sum, item) => sum + (item.qty || 0), 0)}
                    </span>
                  </div>
                  <div className="total-row">
                    <span className="total-label">Total Amount:</span>
                    <span className="total-amount">{formatCurrency(calcEditTotal())}</span>
                  </div>
                  <div className="total-words">
                    <span className="words-label">In Words:</span>
                    <span className="words-text">{numberToWords(calcEditTotal())}</span>
                  </div>
                </div>

                {/* Notes / Remarks */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="label">Note / Free Due</label>
                  <input className="input" value={editBill.freeDue}
                    onChange={e => handleEditField('freeDue', e.target.value)}
                    placeholder="Additional notes or instructions" />
                </div>

              </div>{/* end modal-body */}

              <div className="modal-footer">
                <button onClick={handleSaveEdit} className="btn btn-success" disabled={editLoading}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setShowEditModal(false)} className="btn btn-secondary" disabled={editLoading}>
                  Cancel
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default Records;
