import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useFiscalYear } from '../context/FiscalYearContext';
import ToastContainer from '../components/ToastContainer';
import NepaliDatePickerComponent from '../components/NepaliDatePicker';
import { getCurrentNepaliDate } from '../utils/nepaliDate';
import { formatCurrency, formatNumberInputValue } from '../utils/numberToWords';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

import {
  getStockParticulars,
  createStockParticular,
  addLedgerEntry,
} from '../services/stockService';

import {
  getCustomers,
  upsertCustomerProfile,
  addCustomerLedgerEntry,
  findCustomerByCode,
  buildCustomerId,
} from '../services/customerService';

import {
  getParties,
  upsertPartyProfile,
  addPartyLedgerEntry,
  buildPartyId,
} from '../services/partyService';

import { DEFAULT_SETTINGS } from '../services/settingsService';
import type { StockParticular, Customer, Party } from '../types';
import './QuickEntry.css';

interface SearchableSelectOption {
  id: string;
  name: string;
  code?: string;
  address?: string;
  contactNumber?: string;
  extraInfo?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  selectedValue: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  required?: boolean;
  autoFocus?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  selectedValue,
  onChange,
  placeholder,
  label,
  required = false,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-open on mount if autoFocus is requested
  useEffect(() => {
    if (autoFocus) {
      // Small delay so the DOM is ready
      setTimeout(() => {
        setIsOpen(true);
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus input and reset highlight when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLElement>('.searchable-select-option');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const filteredOptions = options.filter(opt => {
    const q = searchQuery.toLowerCase();
    return (
      opt.name.toLowerCase().includes(q) ||
      (opt.code && opt.code.toLowerCase().includes(q)) ||
      (opt.address && opt.address.toLowerCase().includes(q)) ||
      (opt.contactNumber && opt.contactNumber.toLowerCase().includes(q))
    );
  });

  const selectedOption = options.find(opt => opt.id === selectedValue);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].id);
        } else if (filteredOptions.length === 1) {
          // Auto-select single match on Enter
          handleSelect(filteredOptions[0].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(0);
        break;
      default:
        break;
    }
  };

  return (
    <div className="searchable-select-container" ref={containerRef}>
      <label className="label">{label}</label>
      <div className="searchable-select-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="input searchable-select-input"
          placeholder={selectedOption ? selectedOption.name : placeholder}
          value={isOpen ? searchQuery : (selectedOption ? selectedOption.name : '')}
          onChange={e => {
            setSearchQuery(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={e => {
            setIsOpen(true);
            setSearchQuery('');
            e.target.select();
          }}
          onKeyDown={handleKeyDown}
          required={required && !selectedValue}
          autoComplete="off"
        />
        <div
          className={`searchable-select-arrow ${isOpen ? 'open' : ''}`}
          onClick={() => {
            setIsOpen(prev => !prev);
            if (!isOpen) inputRef.current?.focus();
          }}
        />

        {isOpen && (
          <div className="searchable-select-dropdown" ref={listRef}>
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-no-results">No matches found</div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <div
                  key={opt.id}
                  className={`searchable-select-option ${selectedValue === opt.id ? 'selected' : ''} ${highlightedIndex === idx ? 'highlighted' : ''}`}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelect(opt.id)}
                >
                  <div className="option-primary">
                    <span className="option-name">{opt.name}</span>
                    {opt.code && <span className="option-code">#{opt.code}</span>}
                  </div>
                  {(opt.address || opt.contactNumber || opt.extraInfo) && (
                    <div className="option-secondary">
                      {opt.address && <span className="option-address">{opt.address}</span>}
                      {opt.contactNumber && <span className="option-contact">{opt.contactNumber}</span>}
                      {opt.extraInfo && <span className="option-extra">{opt.extraInfo}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

type SectionType = 'stock' | 'customers' | 'parties';
type ActionType = 'add_particular' | 'add_transaction' | 'add_customer' | 'add_party';

const capitalizeWords = (str: string) => {
  return str.replace(/(^|[\s\-./])([a-z])/g, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`);
};

const titleCase = (value: string) => {
  return (value || '')
    .replace(/(^|[\s\-./])([a-z])/g, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`);
};

const normalizeParticularCode = (value: string) => value.replace(/\D/g, '').slice(0, 5);
const formatParticularCode = (value: string) => {
  const digits = normalizeParticularCode(value);
  return digits ? digits.padStart(5, '0') : '';
};

const QuickEntry: React.FC = () => {
  const { activeUid } = useAuth();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  const { settings } = useFiscalYear();

  // App Settings Unit Options
  const unitOptions = settings?.unitCategories ?? DEFAULT_SETTINGS.unitCategories;
  const defaultUnit = unitOptions[0] ?? '';

  // Data lists
  const [particulars, setParticulars] = useState<StockParticular[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Dropdown States
  const [section, setSection] = useState<SectionType>('stock');
  const [action, setAction] = useState<ActionType>('add_particular');

  // Loading States for Form Submissions
  const [addPartLoading, setAddPartLoading] = useState(false);
  const [addTxLoading, setAddTxLoading] = useState(false);
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newPartyLoading, setNewPartyLoading] = useState(false);

  // Reset keys — incrementing forces SearchableSelect to remount & auto-focus
  const [stockTxResetKey, setStockTxResetKey] = useState(0);
  const [custTxResetKey, setCustTxResetKey] = useState(0);
  const [partyTxResetKey, setPartyTxResetKey] = useState(0);

  // Form 1: Stock -> Add New Particular
  const [newPartName, setNewPartName] = useState('');
  const [newPartCode, setNewPartCode] = useState('');
  const [newPartInitialStock, setNewPartInitialStock] = useState<number>(0);
  const [newPartUnit, setNewPartUnit] = useState(defaultUnit);
  const [newPartDate, setNewPartDate] = useState(getCurrentNepaliDate());
  const [newPartBillNo, setNewPartBillNo] = useState('');

  // Form 2: Stock -> Add Transaction
  const [selectedParticularId, setSelectedParticularId] = useState('');
  const [txType, setTxType] = useState<'debit' | 'credit'>('debit');
  const [txQty, setTxQty] = useState<number>(0);
  const [txUnit, setTxUnit] = useState('');
  const [txDate, setTxDate] = useState(getCurrentNepaliDate());
  const [txBillNo, setTxBillNo] = useState('');
  const [txNote, setTxNote] = useState('');

  // Form 3: Customers -> Add New Customer
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerContact, setNewCustomerContact] = useState('');
  const [newCustomerCode, setNewCustomerCode] = useState('');
  const [newCustomerOpeningAmount, setNewCustomerOpeningAmount] = useState<number>(0);
  const [newCustomerOpeningDate, setNewCustomerOpeningDate] = useState(getCurrentNepaliDate());
  const [newCustomerOpeningParticular, setNewCustomerOpeningParticular] = useState('');
  const [newCustomerOpeningBillNo, setNewCustomerOpeningBillNo] = useState('');
  const [newCustomerCodeError, setNewCustomerCodeError] = useState('');

  // Form 4: Customers -> Add Transaction
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [custTxType, setCustTxType] = useState<'debit' | 'credit'>('credit');
  const [custTxDate, setCustTxDate] = useState(getCurrentNepaliDate());
  const [custTxParticular, setCustTxParticular] = useState('');
  const [custTxBillNo, setCustTxBillNo] = useState('');
  const [custTxAmount, setCustTxAmount] = useState<number>(0);
  const [custTxNote, setCustTxNote] = useState('');

  // Form 5: Parties -> Add New Party
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyContact, setNewPartyContact] = useState('');
  const [newPartyCode, setNewPartyCode] = useState('');
  const [newPartyCodeError, setNewPartyCodeError] = useState('');

  // Form 6: Parties -> Add Transaction
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyTxType, setPartyTxType] = useState<'debit' | 'credit'>('debit');
  const [partyTxDate, setPartyTxDate] = useState(getCurrentNepaliDate());
  const [partyTxParticular, setPartyTxParticular] = useState('');
  const [partyTxAmount, setPartyTxAmount] = useState<number>(0);
  const [partyTxNote, setPartyTxNote] = useState('');

  const loadAllData = async () => {
    if (!activeUid) return;
    setLoadingData(true);
    try {
      const [fetchedParticulars, fetchedCustomers, fetchedParties] = await Promise.all([
        getStockParticulars(activeUid),
        getCustomers(activeUid),
        getParties(activeUid),
      ]);
      setParticulars(fetchedParticulars);
      setCustomers(fetchedCustomers);
      setParties(fetchedParties);
    } catch (err) {
      console.error('Error loading Quick Entry data:', err);
      showError('Failed to load initial data lists.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUid]);

  // Adjust default action when section changes
  useEffect(() => {
    if (action === 'add_transaction') {
      return;
    }
    if (section === 'stock') {
      setAction('add_particular');
    } else if (section === 'customers') {
      setAction('add_customer');
    } else if (section === 'parties') {
      setAction('add_party');
    }
  }, [section]);

  // Helper to generate next stock particular code
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

  useEffect(() => {
    if (particulars.length > 0 && action === 'add_particular') {
      setNewPartCode(getNextParticularCode());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particulars, action]);

  // Helper to generate next party code (4-digit numeric, e.g. 0001)
  const getNextPartyCode = () => {
    const usedCodes = new Set(
      parties
        .map(p => (p.partyCode || '').replace(/\D/g, '').padStart(4, '0'))
        .filter(c => c.length === 4 && !isNaN(Number(c)))
    );
    let max = 0;
    usedCodes.forEach(code => {
      const value = parseInt(code, 10);
      if (!Number.isNaN(value)) max = Math.max(max, value);
    });
    let next = max + 1;
    let nextCode = String(next).padStart(4, '0');
    while (usedCodes.has(nextCode)) {
      next += 1;
      nextCode = String(next).padStart(4, '0');
    }
    return nextCode;
  };

  // Auto-fill party code on load / when parties list changes
  useEffect(() => {
    if (section === 'parties' && action === 'add_party') {
      setNewPartyCode(getNextPartyCode());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parties, action, section]);

  // Sync default unit on load
  useEffect(() => {
    if (newPartUnit === '' && defaultUnit) {
      setNewPartUnit(defaultUnit);
    }
  }, [defaultUnit, newPartUnit]);

  // Duplicate Checks
  const checkCustomerCodeDuplicate = async (code: string) => {
    const trimmed = (code || '').trim();
    if (!trimmed || !activeUid) return false;
    try {
      const existing = await findCustomerByCode(activeUid, trimmed);
      return Boolean(existing);
    } catch (error) {
      console.warn('Error checking customer code duplicate:', error);
      return false;
    }
  };

  const checkPartyCodeDuplicate = async (code: string) => {
    const trimmed = (code || '').trim();
    if (!trimmed || !activeUid) return false;
    try {
      const codeId = `code-${trimmed}`;
      const ref = doc(db, 'users', activeUid, 'parties', codeId);
      const snap = await getDoc(ref);
      if (snap.exists()) return true;

      const q = query(collection(db, 'users', activeUid, 'parties'), where('partyCode', '==', trimmed));
      const snap2 = await getDocs(q);
      return !snap2.empty;
    } catch (error) {
      console.warn('Error checking party code duplicate:', error);
      return false;
    }
  };

  // Submit Handlers
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
      await createStockParticular(
        activeUid || '',
        newPartName.trim(),
        newPartInitialStock,
        dateVal,
        newPartBillNo,
        newPartUnit || undefined,
        resolvedCode
      );

      showSuccess(`Particular "${newPartName}" added successfully.`);
      
      // Reset Form
      setNewPartName('');
      setNewPartInitialStock(0);
      setNewPartUnit(defaultUnit);
      setNewPartDate(getCurrentNepaliDate());
      setNewPartBillNo('');

      await loadAllData();
    } catch (error: any) {
      console.error('Error creating particular:', error);
      showError(error.message || 'Failed to add particular.');
    } finally {
      setAddPartLoading(false);
    }
  };

  const handleAddStockTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParticularId) {
      showError('Please select a stock particular.');
      return;
    }
    const p = particulars.find(item => item.id === selectedParticularId);
    if (!p) {
      showError('Selected stock particular not found.');
      return;
    }
    if (txQty <= 0) {
      showError('Please enter a quantity greater than 0.');
      return;
    }
    if (!txBillNo.trim()) {
      showError('Please enter a valid bill number.');
      return;
    }
    const isCredit = txType === 'credit';
    if (isCredit && txQty > p.currentStock) {
      showError(`Insufficient stock. Cannot credit ${txQty} Qty. Only ${p.currentStock} Qty available.`);
      return;
    }

    setAddTxLoading(true);
    try {
      const dateVal = txDate || getCurrentNepaliDate();
      const isDebit = txType === 'debit';
      const debitQty = isDebit ? txQty : 0;
      const creditQty = isDebit ? 0 : txQty;
      const resolvedUnit = txUnit || p.defaultUnit || defaultUnit;

      await addLedgerEntry(activeUid || '', p.id, {
        date: dateVal,
        billNo: txBillNo.trim() || undefined,
        debit: debitQty,
        credit: creditQty,
        unit: resolvedUnit || undefined,
        note: txNote.trim() || (isDebit ? 'Manual Stock In' : 'Manual Adjustment Out')
      });

      showSuccess('Transaction added to stock ledger.');

      // Reset Form
      setTxQty(0);
      setTxUnit('');
      setTxBillNo('');
      setTxNote('');
      setTxDate(getCurrentNepaliDate());
      setTxType('debit');
      setSelectedParticularId('');
      setStockTxResetKey(k => k + 1); // remount SearchableSelect -> auto-focus

      await loadAllData();
    } catch (error: any) {
      console.error('Error adding stock transaction:', error);
      showError(error.message || 'Failed to record transaction.');
    } finally {
      setAddTxLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      showError('Customer name is required.');
      return;
    }
    if (!newCustomerAddress.trim()) {
      showError('Customer address is required.');
      return;
    }
    if (newCustomerCode.trim()) {
      const isDup = await checkCustomerCodeDuplicate(newCustomerCode.trim());
      if (isDup) {
        showError('Customer ID already in use.');
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

      showSuccess('Customer added successfully.');

      // Reset Form
      setNewCustomerName('');
      setNewCustomerAddress('');
      setNewCustomerContact('');
      setNewCustomerCode('');
      setNewCustomerOpeningAmount(0);
      setNewCustomerOpeningDate(getCurrentNepaliDate());
      setNewCustomerOpeningParticular('');
      setNewCustomerOpeningBillNo('');

      await loadAllData();
    } catch (error: any) {
      console.error('Error adding customer:', error);
      showError(error.message || 'Failed to add customer.');
    } finally {
      setNewCustomerLoading(false);
    }
  };

  const handleAddCustomerTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      showError('Please select a customer.');
      return;
    }
    const c = customers.find(item => item.id === selectedCustomerId);
    if (!c) {
      showError('Selected customer not found.');
      return;
    }
    if (!custTxParticular.trim()) {
      showError('Please enter a particular.');
      return;
    }
    if (!custTxBillNo.trim()) {
      showError('Please enter a bill number.');
      return;
    }
    if (custTxAmount <= 0) {
      showError('Please enter a valid amount.');
      return;
    }

    setAddTxLoading(true);
    try {
      await addCustomerLedgerEntry(activeUid || '', c.id, {
        date: custTxDate || getCurrentNepaliDate(),
        particular: custTxParticular.trim(),
        billNo: custTxBillNo.trim() || '',
        debit: custTxType === 'debit' ? custTxAmount : 0,
        credit: custTxType === 'credit' ? custTxAmount : 0,
        note: custTxNote.trim() || '',
      });

      showSuccess('Transaction added to customer ledger.');

      // Reset Form
      setCustTxParticular('');
      setCustTxBillNo('');
      setCustTxAmount(0);
      setCustTxNote('');
      setCustTxDate(getCurrentNepaliDate());
      setCustTxType('credit');
      setSelectedCustomerId('');
      setCustTxResetKey(k => k + 1); // remount SearchableSelect -> auto-focus

      await loadAllData();
    } catch (error: any) {
      console.error('Error adding customer transaction:', error);
      showError(error.message || 'Failed to add transaction.');
    } finally {
      setAddTxLoading(false);
    }
  };

  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) {
      showError('Party name is required.');
      return;
    }
    if (!newPartyAddress.trim()) {
      showError('Party address is required.');
      return;
    }
    if (newPartyCode.trim()) {
      const isDup = await checkPartyCodeDuplicate(newPartyCode.trim());
      if (isDup) {
        showError('Party ID already in use.');
        return;
      }
    }

    setNewPartyLoading(true);
    try {
      const payload = {
        name: titleCase(newPartyName).trim(),
        address: titleCase(newPartyAddress).trim(),
        contactNumber: newPartyContact.trim(),
        partyCode: newPartyCode.trim(),
      };
      const partyId = buildPartyId(payload);

      await upsertPartyProfile(activeUid || '', partyId, {
        ...payload,
        currentBalance: 0,
      });

      showSuccess('Party added successfully.');

      // Reset Form
      setNewPartyName('');
      setNewPartyAddress('');
      setNewPartyContact('');
      setNewPartyCode('');

      await loadAllData();
    } catch (error: any) {
      console.error('Error adding party:', error);
      showError(error.message || 'Failed to add party.');
    } finally {
      setNewPartyLoading(false);
    }
  };

  const handleAddPartyTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId) {
      showError('Please select a party.');
      return;
    }
    const p = parties.find(item => item.id === selectedPartyId);
    if (!p) {
      showError('Selected party not found.');
      return;
    }
    if (!partyTxParticular.trim()) {
      showError('Please enter a particular.');
      return;
    }
    if (partyTxAmount <= 0) {
      showError('Please enter a valid amount.');
      return;
    }

    setAddTxLoading(true);
    try {
      await addPartyLedgerEntry(activeUid || '', p.id, {
        date: partyTxDate || getCurrentNepaliDate(),
        particular: partyTxParticular.trim(),
        billNo: '',
        debit: partyTxType === 'debit' ? partyTxAmount : 0,
        credit: partyTxType === 'credit' ? partyTxAmount : 0,
        note: partyTxNote.trim() || '',
      });

      showSuccess('Transaction added to party ledger.');

      // Reset Form
      setPartyTxParticular('');
      setPartyTxAmount(0);
      setPartyTxNote('');
      setPartyTxDate(getCurrentNepaliDate());
      setPartyTxType('debit');
      setSelectedPartyId('');
      setPartyTxResetKey(k => k + 1); // remount SearchableSelect -> auto-focus

      await loadAllData();
    } catch (error: any) {
      console.error('Error adding party transaction:', error);
      showError(error.message || 'Failed to add transaction.');
    } finally {
      setAddTxLoading(false);
    }
  };

  return (
    <div className="quick-entry-container">
      <div className="quick-entry-header">
        <h1 className="quick-entry-title">Quick Entry</h1>
      </div>

      {/* Premium Segmented Navigation Tabs */}
      <div className="quick-entry-nav-tabs">
        <button
          type="button"
          className={`nav-tab-btn ${section === 'stock' ? 'active' : ''}`}
          onClick={() => setSection('stock')}
        >
          <span className="tab-icon">📦</span>
          <span className="tab-label">Stock Inventory</span>
        </button>
        <button
          type="button"
          className={`nav-tab-btn ${section === 'customers' ? 'active' : ''}`}
          onClick={() => setSection('customers')}
        >
          <span className="tab-icon">👥</span>
          <span className="tab-label">Customer Ledger</span>
        </button>
        <button
          type="button"
          className={`nav-tab-btn ${section === 'parties' ? 'active' : ''}`}
          onClick={() => setSection('parties')}
        >
          <span className="tab-icon">🤝</span>
          <span className="tab-label">Party Ledger</span>
        </button>
      </div>

      {/* Sub-action Selector Pill Bar */}
      <div className="quick-entry-actions-bar">
        {section === 'stock' && (
          <>
            <button
              type="button"
              className={`action-toggle-btn ${action === 'add_particular' ? 'active' : ''}`}
              onClick={() => setAction('add_particular')}
            >
              Add New Particular
            </button>
            <button
              type="button"
              className={`action-toggle-btn ${action === 'add_transaction' ? 'active' : ''}`}
              onClick={() => setAction('add_transaction')}
            >
              Record Stock Transaction
            </button>
          </>
        )}
        {section === 'customers' && (
          <>
            <button
              type="button"
              className={`action-toggle-btn ${action === 'add_customer' ? 'active' : ''}`}
              onClick={() => setAction('add_customer')}
            >
              Add New Customer
            </button>
            <button
              type="button"
              className={`action-toggle-btn ${action === 'add_transaction' ? 'active' : ''}`}
              onClick={() => setAction('add_transaction')}
            >
              Record Customer Transaction
            </button>
          </>
        )}
        {section === 'parties' && (
          <>
            <button
              type="button"
              className={`action-toggle-btn ${action === 'add_party' ? 'active' : ''}`}
              onClick={() => setAction('add_party')}
            >
              Add New Party
            </button>
            <button
              type="button"
              className={`action-toggle-btn ${action === 'add_transaction' ? 'active' : ''}`}
              onClick={() => setAction('add_transaction')}
            >
              Record Party Transaction
            </button>
          </>
        )}
      </div>

      {loadingData ? (
        <div className="quick-entry-loader">
          <div className="spinner" />
          <p>Syncing lists from secure database...</p>
        </div>
      ) : (
        <div className="quick-entry-form-panel">
          {section === 'stock' && action === 'add_particular' && (
            <div className="quick-entry-card fade-in">
              <h2 className="card-title">Add New Stock Particular</h2>
              <form onSubmit={handleCreateParticular}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="label">Particular Name *</label>
                    <input
                      type="text"
                      autoFocus
                      className="input"
                      value={newPartName}
                      onChange={e => setNewPartName(capitalizeWords(e.target.value))}
                      placeholder="e.g. Rice, Dal, Soap"
                      required
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
                      type="text"
                      inputMode="decimal"
                      className="input"
                      value={newPartInitialStock ? formatNumberInputValue(newPartInitialStock, settings?.numberSystem) : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/,/g, '');
                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                          setNewPartInitialStock(raw === '' ? 0 : parseFloat(raw) || 0);
                        }
                      }}
                      placeholder="e.g. 50 (leave 0 if none)"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Default Unit</label>
                    <select
                      className="input"
                      value={newPartUnit}
                      onChange={e => setNewPartUnit(e.target.value)}
                    >
                      <option value="">Select Unit</option>
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
                          placeholder="e.g. INV-001"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addPartLoading}
                  >
                    {addPartLoading ? 'Saving...' : 'Add Particular'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {section === 'stock' && action === 'add_transaction' && (
            <div className="quick-entry-card fade-in">
              <h2 className="card-title">Record Stock Transaction</h2>
              <form onSubmit={handleAddStockTransaction}>
                <div className="form-grid">
                  <SearchableSelect
                    key={stockTxResetKey}
                    autoFocus
                    label="Select Particular *"
                    placeholder="-- Choose Item --"
                    options={particulars.map(p => ({
                      id: p.id,
                      name: p.name,
                      code: p.particularCode,
                      extraInfo: `Stock: ${formatCurrency(p.currentStock)} ${p.defaultUnit || ''}`,
                    }))}
                    selectedValue={selectedParticularId}
                    onChange={value => {
                      setSelectedParticularId(value);
                      const p = particulars.find(item => item.id === value);
                      if (p) setTxUnit(p.defaultUnit || '');
                    }}
                    required
                  />
                  <div className="form-group">
                    <label className="label">Transaction Type</label>
                    <div className="tx-type-selector">
                      <button
                        type="button"
                        className={`tx-type-btn btn-debit ${txType === 'debit' ? 'active' : ''}`}
                        onClick={() => setTxType('debit')}
                      >
                        Debit
                      </button>
                      <button
                        type="button"
                        className={`tx-type-btn btn-credit ${txType === 'credit' ? 'active' : ''}`}
                        onClick={() => setTxType('credit')}
                      >
                        Credit
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label">Quantity *</label>
                    <div className="qty-unit-row">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input"
                        value={txQty ? formatNumberInputValue(txQty, settings?.numberSystem) : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, '');
                          if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                            setTxQty(raw === '' ? 0 : parseFloat(raw) || 0);
                          }
                        }}
                        placeholder="Qty"
                        required
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
                      placeholder="e.g. INV-001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Notes / Remarks</label>
                    <input
                      type="text"
                      className="input"
                      value={txNote}
                      onChange={e => setTxNote(e.target.value)}
                      placeholder="e.g. Purchase / Adjustment"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addTxLoading}
                  >
                    {addTxLoading ? 'Saving...' : 'Record Transaction'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {section === 'customers' && action === 'add_customer' && (
            <div className="quick-entry-card fade-in">
              <h2 className="card-title">Add New Customer</h2>
              <form onSubmit={handleAddCustomer}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="label">Customer Name *</label>
                    <input
                      type="text"
                      autoFocus
                      className="input"
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(titleCase(e.target.value))}
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Address *</label>
                    <input
                      type="text"
                      className="input"
                      value={newCustomerAddress}
                      onChange={e => setNewCustomerAddress(titleCase(e.target.value))}
                      placeholder="Enter address"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Contact Number</label>
                    <input
                      type="text"
                      className="input"
                      maxLength={10}
                      value={newCustomerContact}
                      onChange={e => setNewCustomerContact((e.target.value || '').replace(/\D/g, '').slice(0, 10))}
                      placeholder="10 digit number"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Customer ID (max 4 chars)</label>
                    <input
                      type="text"
                      className="input font-mono"
                      maxLength={4}
                      value={newCustomerCode}
                      onChange={e => {
                        setNewCustomerCode(e.target.value.toUpperCase().slice(0, 4));
                        setNewCustomerCodeError('');
                      }}
                      onBlur={async () => {
                        if (!newCustomerCode.trim()) return;
                        const dup = await checkCustomerCodeDuplicate(newCustomerCode.trim());
                        setNewCustomerCodeError(dup ? 'Customer ID already in use' : '');
                      }}
                      placeholder="e.g. 1001"
                    />
                    {newCustomerCodeError && (
                      <div className="form-error-msg">{newCustomerCodeError}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="label">Opening Balance (Dr)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input"
                      value={newCustomerOpeningAmount ? formatNumberInputValue(newCustomerOpeningAmount, settings?.numberSystem) : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/,/g, '');
                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                          setNewCustomerOpeningAmount(raw === '' ? 0 : parseFloat(raw) || 0);
                        }
                      }}
                      placeholder="Enter opening balance"
                    />
                  </div>
                  {newCustomerOpeningAmount > 0 && (
                    <>
                      <div className="form-group">
                        <NepaliDatePickerComponent
                          label="Date (BS) *"
                          value={newCustomerOpeningDate}
                          onChange={(bs) => setNewCustomerOpeningDate(bs)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">Particular *</label>
                        <input
                          type="text"
                          className="input"
                          value={newCustomerOpeningParticular}
                          onChange={e => setNewCustomerOpeningParticular(e.target.value)}
                          placeholder="e.g. Opening Balance"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">Bill Number *</label>
                        <input
                          type="text"
                          className="input"
                          value={newCustomerOpeningBillNo}
                          onChange={e => setNewCustomerOpeningBillNo(e.target.value)}
                          placeholder="Bill number"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={newCustomerLoading || !!newCustomerCodeError}
                  >
                    {newCustomerLoading ? 'Saving...' : 'Add Customer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {section === 'customers' && action === 'add_transaction' && (
            <div className="quick-entry-card fade-in">
              <h2 className="card-title">Record Customer Transaction</h2>
              <form onSubmit={handleAddCustomerTransaction}>
                <div className="form-grid">
                  <SearchableSelect
                    key={custTxResetKey}
                    autoFocus
                    label="Select Customer *"
                    placeholder="-- Choose Customer --"
                    options={customers.map(c => ({
                      id: c.id,
                      name: c.name,
                      code: c.customerCode,
                      address: c.address,
                      contactNumber: c.contactNumber,
                    }))}
                    selectedValue={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                    required
                  />
                  <div className="form-group">
                    <label className="label">Transaction Type</label>
                    <div className="tx-type-selector">
                      <button
                        type="button"
                        className={`tx-type-btn btn-debit ${custTxType === 'debit' ? 'active' : ''}`}
                        onClick={() => setCustTxType('debit')}
                      >
                        Debit
                      </button>
                      <button
                        type="button"
                        className={`tx-type-btn btn-credit ${custTxType === 'credit' ? 'active' : ''}`}
                        onClick={() => setCustTxType('credit')}
                      >
                        Credit
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <NepaliDatePickerComponent
                      label="Transaction Date (BS) *"
                      value={custTxDate}
                      onChange={(bs) => setCustTxDate(bs)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Particular *</label>
                    <input
                      type="text"
                      className="input"
                      value={custTxParticular}
                      onChange={e => setCustTxParticular(e.target.value)}
                      placeholder="e.g. bill_0001, payment"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Amount *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input"
                      value={custTxAmount ? formatNumberInputValue(custTxAmount, settings?.numberSystem) : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/,/g, '');
                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                          setCustTxAmount(raw === '' ? 0 : parseFloat(raw) || 0);
                        }
                      }}
                      placeholder="Enter amount"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Bill Number *</label>
                    <input
                      type="text"
                      className="input"
                      value={custTxBillNo}
                      onChange={e => setCustTxBillNo(e.target.value)}
                      placeholder="e.g. 0001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Note</label>
                    <input
                      type="text"
                      className="input"
                      value={custTxNote}
                      onChange={e => setCustTxNote(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addTxLoading}
                  >
                    {addTxLoading ? 'Saving...' : 'Add Transaction'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {section === 'parties' && action === 'add_party' && (
            <div className="quick-entry-card fade-in">
              <h2 className="card-title">Add New Party</h2>
              <form onSubmit={handleAddParty}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="label">Party Name *</label>
                    <input
                      type="text"
                      autoFocus
                      className="input"
                      value={newPartyName}
                      onChange={e => setNewPartyName(titleCase(e.target.value))}
                      placeholder="Enter party name"
                      required
                    />
                  </div>
                  <div className="form-grid-item form-group">
                    <label className="label">Address *</label>
                    <input
                      type="text"
                      className="input"
                      value={newPartyAddress}
                      onChange={e => setNewPartyAddress(titleCase(e.target.value))}
                      placeholder="Enter address"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Contact Number</label>
                    <input
                      type="text"
                      className="input"
                      maxLength={10}
                      value={newPartyContact}
                      onChange={e => setNewPartyContact((e.target.value || '').replace(/\D/g, '').slice(0, 10))}
                      placeholder="10 digit number"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Party ID (max 4 chars)</label>
                    <input
                      type="text"
                      className="input font-mono"
                      maxLength={4}
                      value={newPartyCode}
                      onChange={e => {
                        setNewPartyCode(e.target.value.toUpperCase().slice(0, 4));
                        setNewPartyCodeError('');
                      }}
                      onBlur={async () => {
                        if (!newPartyCode.trim()) return;
                        const dup = await checkPartyCodeDuplicate(newPartyCode.trim());
                        setNewPartyCodeError(dup ? 'Party ID already in use' : '');
                      }}
                      placeholder="e.g. V001"
                    />
                    {newPartyCodeError && (
                      <div className="form-error-msg">{newPartyCodeError}</div>
                    )}
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={newPartyLoading || !!newPartyCodeError}
                  >
                    {newPartyLoading ? 'Saving...' : 'Add Party'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {section === 'parties' && action === 'add_transaction' && (
            <div className="quick-entry-card fade-in">
              <h2 className="card-title">Record Party Transaction</h2>
              <form onSubmit={handleAddPartyTransaction}>
                <div className="form-grid">
                  <SearchableSelect
                    key={partyTxResetKey}
                    autoFocus
                    label="Select Party *"
                    placeholder="-- Choose Party --"
                    options={parties.map(p => ({
                      id: p.id,
                      name: p.name,
                      code: p.partyCode || p.supplierCode,
                      address: p.address,
                      contactNumber: p.contactNumber,
                      extraInfo: p.currentBalance !== undefined ? `Bal: ${formatCurrency(Math.abs(p.currentBalance))} ${p.currentBalance < 0 ? 'CR' : 'DR'}` : undefined,
                    }))}
                    selectedValue={selectedPartyId}
                    onChange={setSelectedPartyId}
                    required
                  />
                  <div className="form-group">
                    <label className="label">Transaction Type</label>
                    <div className="tx-type-selector">
                      <button
                        type="button"
                        className={`tx-type-btn btn-debit ${partyTxType === 'debit' ? 'active' : ''}`}
                        onClick={() => setPartyTxType('debit')}
                      >
                        Debit
                      </button>
                      <button
                        type="button"
                        className={`tx-type-btn btn-credit ${partyTxType === 'credit' ? 'active' : ''}`}
                        onClick={() => setPartyTxType('credit')}
                      >
                        Credit
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <NepaliDatePickerComponent
                      label="Transaction Date (BS) *"
                      value={partyTxDate}
                      onChange={(bs) => setPartyTxDate(bs)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Particular *</label>
                    <input
                      type="text"
                      className="input"
                      value={partyTxParticular}
                      onChange={e => setPartyTxParticular(e.target.value)}
                      placeholder="e.g. purchase, payment"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Amount *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input"
                      value={partyTxAmount ? formatNumberInputValue(partyTxAmount, settings?.numberSystem) : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/,/g, '');
                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                          setPartyTxAmount(raw === '' ? 0 : parseFloat(raw) || 0);
                        }
                      }}
                      placeholder="Enter amount"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Note</label>
                    <input
                      type="text"
                      className="input"
                      value={partyTxNote}
                      onChange={e => setPartyTxNote(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addTxLoading}
                  >
                    {addTxLoading ? 'Saving...' : 'Record Transaction'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default QuickEntry;
