import React, { useState, useEffect, useRef } from 'react';
import type { Bill, BillItem, AppSettings, StockParticular, Customer } from '../types';
import { numberToWords, formatCurrency } from '../utils/numberToWords';
import { getCurrentNepaliDate, toEnglishDate } from '../utils/nepaliDate';
import { generateBillPDF } from '../utils/pdfGenerator';
import { printBill } from '../utils/printBill';
import { createBill, getNextBillNumber } from '../services/billService';
import { DEFAULT_SETTINGS, getAppSettings } from '../services/settingsService';
import { recordBillInventory, getStockParticulars } from '../services/stockService';
import { syncBillCustomerLedger, getCustomers, upsertCustomerProfile, findCustomerByCode } from '../services/customerService';
import { useAuth } from '../context/AuthContext';
import ToastContainer from '../components/ToastContainer';
import NepaliDatePickerComponent, { type NepaliDatePickerHandle } from '../components/NepaliDatePicker';
import { useToast } from '../hooks/useToast';
import './CreateBill.css';

const CreateBill: React.FC = () => {
  const [billNo, setBillNo] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // nepaliDate stores "YYYY-MM-DD" in BS; date stores "YYYY-MM-DD" in AD
  const [nepaliDate, setNepaliDate] = useState('');
  const [date, setDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [customerCodeMessage, setCustomerCodeMessage] = useState('');
  const [items, setItems] = useState<BillItem[]>([
    { sn: 1, particulars: '', qty: 0, unit: DEFAULT_SETTINGS.unitCategories[0] ?? '', rate: 0, amount: 0 }
  ]);
  const [freeDue, setFreeDue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [stockParticulars, setStockParticulars] = useState<StockParticular[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState<number>(-1);
  const itemParticularRefs = useRef<Array<HTMLInputElement | null>>([]);
  const itemQtyRefs = useRef<Array<HTMLInputElement | null>>([]);
  const itemRateRefs = useRef<Array<HTMLInputElement | null>>([]);
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pendingFocusItemIndex, setPendingFocusItemIndex] = useState<number | null>(null);

  // Ref to read the picker's current date directly — more reliable than state
  const datePickerRef = useRef<NepaliDatePickerHandle>(null);
  const customerNameRef = useRef<HTMLInputElement | null>(null);
  const customerCodeRef = useRef<HTMLInputElement | null>(null);
  const noteRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const { toasts, showSuccess, showError, removeToast } = useToast();

  useEffect(() => {
    initializeBill();
  }, []);

  useEffect(() => {
    if (pendingFocusItemIndex === null) return;
    focusItemParticular(pendingFocusItemIndex);
    setPendingFocusItemIndex(null);
  }, [items.length, pendingFocusItemIndex]);

  const initializeBill = async () => {
    try {
      const fetchedSettings = await getAppSettings(user?.uid || '');
      setSettings(fetchedSettings);
      setItems(prev => prev.map(item => (item.unit ? item : { ...item, unit: getDefaultUnit(fetchedSettings) })));

      const nextBillNo = await getNextBillNumber(user?.uid || '');
      setBillNo(nextBillNo);
      // Set today's Nepali date as default
      const todayBs = getCurrentNepaliDate();
      setNepaliDate(todayBs);
      // Derive AD date from BS
      const [y, m, d] = todayBs.split('-').map(Number);
      const adDate = toEnglishDate(`${y}-${m}-${d}`);
      setDate(adDate.toISOString().split('T')[0]);

      if (user?.uid) {
        const particulars = await getStockParticulars(user.uid);
        setStockParticulars(particulars);
        const fetchedCustomers = await getCustomers(user.uid);
        setCustomers(fetchedCustomers);
        // After initial load, focus customer ID to speed up new billing
        setTimeout(() => flashAndScroll(customerCodeRef), 250);
      }
    } catch (error) {
      console.error('Error initializing bill:', error);
      showError('Failed to initialize bill');
    }
  };

  const getLatestPrintSettings = async () => {
    const latestSettings = await getAppSettings(user?.uid || '');
    setSettings(latestSettings);
    return latestSettings;
  };

  /** Called by the Nepali date picker whenever user picks a date */
  const handleDateChange = (bs: string, ad: string) => {
    setNepaliDate(bs);
    setDate(ad);
  };

  const handleContactNumberChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setContactNumber(digitsOnly);
  };

  const getDefaultUnit = (currentSettings?: AppSettings | null) =>
    currentSettings
      ? currentSettings.unitCategories?.[0] ?? ''
      : DEFAULT_SETTINGS.unitCategories[0] ?? '';

  const toTitleCase = (value: string) =>
    value
      .toLowerCase()
      .replace(/(^|[\s\-./])([a-z])/g, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`);

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(toTitleCase(value));
  };

  const flashAndScroll = (elRef: React.RefObject<HTMLElement | null>) => {
    const el = elRef.current as HTMLElement | null;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('input-flash');
      window.setTimeout(() => el.classList.remove('input-flash'), 900);
      (el as HTMLInputElement).focus?.();
    } catch (e) {
      // ignore
    }
  };

  const handleCustomerCodeChange = (value: string) => {
    const norm = value.toUpperCase().slice(0, 4);
    setCustomerCode(norm);
    setCustomerCodeMessage('');
    if (!norm) return;
    const match = customers.find(c => (c.customerCode || '').toUpperCase() === norm);
    if (match) {
      setCustomerName(toTitleCase(match.name));
      if (match.address) setAddress(toTitleCase(match.address));
      if (match.contactNumber) setContactNumber(match.contactNumber);
    }
  };

  const normalizeName = (value: string) => value.trim().toLowerCase();
  const normalizeAddress = (value: string) => value.trim().toLowerCase();
  const normalizeContact = (value: string) => value.replace(/\D/g, '').trim();

  const validateCustomerCode = async () => {
    const code = customerCode.trim().toUpperCase();
    if (!code) {
      setCustomerCodeMessage('');
      return true;
    }

    const existing = await findCustomerByCode(user?.uid || '', code);
    if (!existing) {
      setCustomerCodeMessage('');
      return true;
    }

    const sameCustomer =
      normalizeName(existing.name) === normalizeName(customerName) &&
      normalizeAddress(existing.address) === normalizeAddress(address) &&
      normalizeContact(existing.contactNumber) === normalizeContact(contactNumber);

    if (sameCustomer) {
      setCustomerCodeMessage('');
      return true;
    }

    const message = `Customer ID ${code} is already used by ${existing.name}. Please use a different ID.`;
    setCustomerCodeMessage(message);
    showError(message);
    return false;
  };

  const handleCustomerCodeBlur = async () => {
    await validateCustomerCode();
  };

  const handleAddressChange = (value: string) => {
    setAddress(toTitleCase(value));
  };

  const handleItemChange = (index: number, field: keyof BillItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Calculate amount
    if (field === 'qty' || field === 'rate') {
      const qty = Number(newItems[index].qty);
      const rate = Number(newItems[index].rate);
      newItems[index].amount = qty * rate;
    }

    // Enforce stock limit when quantity or particulars change
    if (field === 'qty' || field === 'particulars') {
      const part = newItems[index].particulars.trim().toLowerCase();
      if (part) {
        const stockItem = stockParticulars.find(p => p.name.toLowerCase() === part);
        if (field === 'particulars') {
          newItems[index].unit = stockItem?.defaultUnit || newItems[index].unit || getDefaultUnit(settings);
        }
        
        // Enforce stock existence check instantly when entering quantity
        if (field === 'qty' && !stockItem) {
          newItems[index].qty = 0;
          newItems[index].amount = 0;
          showError(`Item "${newItems[index].particulars}" does not exist in stock. Please select a valid item from the suggestions dropdown.`);
        } else if (stockItem) {
          // Calculate qty in all OTHER rows for the same item
          const otherRowsQty = items.reduce((sum, item, idx) => {
            if (idx !== index && item.particulars.trim().toLowerCase() === part) {
              return sum + Number(item.qty || 0);
            }
            return sum;
          }, 0);
          const availableStock = stockItem.currentStock - otherRowsQty;

          if (Number(newItems[index].qty) > availableStock) {
            // Clear the input (use 0 in state so the input renders blank) instead of clamping
            newItems[index].qty = 0;
            newItems[index].amount = 0;
            showError(`Entered quantity exceeds available stock (${availableStock}) for "${stockItem.name}". Please enter a smaller quantity.`);
          }
        }
      }
    }

    setItems(newItems);
  };

  const focusItemParticular = (index: number) => {
    window.setTimeout(() => {
      const input = itemParticularRefs.current[index];
      if (!input) return;
      input.focus();
      input.select?.();
      input.classList.add('input-flash');
      window.setTimeout(() => input.classList.remove('input-flash'), 900);
    }, 0);
  };

  const focusItemRate = (index: number) => {
    window.setTimeout(() => {
      const input = itemRateRefs.current[index];
      if (!input) return;
      input.focus();
      input.select?.();
      input.classList.add('input-flash');
      window.setTimeout(() => input.classList.remove('input-flash'), 900);
    }, 0);
  };

  const handleQtyTab = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Tab' || event.shiftKey) return;
    event.preventDefault();
    focusItemRate(index);
  };

  const handleRateTab = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Tab' || event.shiftKey) return;
    event.preventDefault();
    const nextIndex = index + 1;
    if (nextIndex < items.length) {
      focusItemParticular(nextIndex);
      return;
    }
    addItemButtonRef.current?.focus();
  };

  const getNextCustomerCode = (list: Customer[]) => {
    try {
      const nums = list
        .map((c) => {
          if (!c.customerCode) return NaN;
          const m = c.customerCode.match(/\d+/);
          return m ? parseInt(m[0], 10) : NaN;
        })
        .filter((n) => !isNaN(n));
      const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      return String(next).padStart(4, '0');
    } catch {
      return '0001';
    }
  };

  const sanitizeId = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'customer';

  const buildCustomerDocId = (name: string, address: string, contact: string, code?: string) => {
    const c = (code || '').trim();
    if (c) return `code-${c}`;
    const digits = (contact || '').replace(/\D/g, '');
    if (digits) return `contact-${digits}`;
    return sanitizeId([name, address].join('-'));
  };

  const handleSelectSuggestion = (index: number, name: string) => {
    handleItemChange(index, 'particulars', name);
    setFocusedRowIndex(null);
    setHighlightedSuggestionIndex(-1);
  };

  const addItem = () => {
    // Prevent adding a new row if the current last row is incomplete
    const last = items[items.length - 1];
    if (last) {
      if (!last.particulars || !String(last.particulars).trim()) {
        showError('Please enter item description before adding a new item');
        return;
      }
      if (!last.qty || Number(last.qty) <= 0) {
        showError('Please enter a valid quantity before adding a new item');
        return;
      }
      if (!last.rate || Number(last.rate) <= 0) {
        showError('Please enter a valid rate before adding a new item');
        return;
      }
    }

    setItems([
      ...items,
      { sn: items.length + 1, particulars: '', qty: 0, unit: getDefaultUnit(settings), rate: 0, amount: 0 }
    ]);
    setPendingFocusItemIndex(items.length);
  };

  const handleAddItemButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      addItem();
      return;
    }

    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      window.setTimeout(() => {
        noteRef.current?.focus();
        noteRef.current?.select?.();
        noteRef.current?.classList.add('input-flash');
        window.setTimeout(() => noteRef.current?.classList.remove('input-flash'), 900);
      }, 0);
    }
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      // Renumber items
      newItems.forEach((item, i) => {
        item.sn = i + 1;
      });
      setItems(newItems);
    }
  };

  const calculateTotal = (): number => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const getBillDates = () => {
    // 1. Try reading directly from the picker instance (most reliable)
    const picked = datePickerRef.current?.getSelectedDate();
    if (picked?.bs && picked?.ad) {
      return { bsDate: picked.bs, adDate: picked.ad };
    }
    // 2. Fall back to React state (set by onChange)
    if (nepaliDate && date) {
      return { bsDate: nepaliDate, adDate: date };
    }
    // 3. Last resort: compute today
    try {
      const todayBs = getCurrentNepaliDate();
      const [y, m, d] = todayBs.split('-').map(Number);
      const adDate = toEnglishDate(`${y}-${m}-${d}`).toISOString().split('T')[0];
      return { bsDate: todayBs, adDate };
    } catch {
      return { bsDate: '', adDate: new Date().toISOString().split('T')[0] };
    }
  };

  type BillPrimaryAction = 'save' | 'pdf' | 'print';
  type BillAction = BillPrimaryAction | 'clear';
  type BillPayload = { bill: Bill; validItems: BillItem[]; bsDate: string };

  const buildBillPayload = async (): Promise<BillPayload | null> => {
    if (!customerName.trim()) {
      showError('Please enter customer name');
      return null;
    }

    if (!address.trim()) {
      showError('Please enter address');
      return null;
    }

    if (!(await validateCustomerCode())) {
      flashAndScroll(customerCodeRef);
      return null;
    }

    // Validate that all added items are complete
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const hasParticulars = Boolean(item.particulars.trim());
      const hasQty = Number(item.qty) > 0;
      const hasRate = Number(item.rate) > 0;

      if (!hasParticulars || !hasQty || !hasRate) {
        showError(`Item row ${i + 1} is empty or incomplete. Please fill in the description, quantity, and rate, or remove the row.`);
        return null;
      }
    }

    const validItems = items;

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const selectedParticular = item.particulars.trim().toLowerCase();
      const stockItem = stockParticulars.find(p => p.name.toLowerCase() === selectedParticular);
      
      if (!stockItem) {
        showError(`Item "${item.particulars}" at row ${i + 1} does not exist in stock. Please select a valid item from the suggestions dropdown.`);
        return null;
      }

      const otherRowsQty = validItems.reduce((sum, otherItem, idx) => {
        if (idx !== i && otherItem.particulars.trim().toLowerCase() === selectedParticular) {
          return sum + Number(otherItem.qty || 0);
        }
        return sum;
      }, 0);
      const availableStock = stockItem.currentStock - otherRowsQty;

      if (item.qty > availableStock) {
        showError(`Insufficient stock for "${stockItem.name}" at row ${i + 1}. Only ${availableStock} Qty available.`);
        return null;
      }
    }

    const totalAmount = calculateTotal();
    const totalQty = validItems.reduce((sum, item) => sum + item.qty, 0);
    const { bsDate, adDate } = getBillDates();

    const bill: Bill = {
      id: '',
      userId: user?.uid || '',
      billNo,
      date: adDate,
      nepaliDate: bsDate,
      customerName,
      address,
      contactNumber,
      customerCode: customerCode.trim(),
      items: validItems,
      totalAmount,
      totalAmountInWords: numberToWords(totalAmount),
      totalQty,
      paymentMethod: 'Cash',
      freeDue,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { bill, validItems, bsDate };
  };

  const saveBillCore = async (
    payload: BillPayload,
    options: { autoClear: boolean; manageLoading: boolean }
  ): Promise<boolean> => {
    if (options.manageLoading) {
      setLoading(true);
    }

    try {
      const { bill, validItems, bsDate } = payload;
      // Preserve a manually entered customerCode; only generate one when blank.
      let customerCodeToUse = (bill.customerCode || '').trim();
      const existing = customers.find(
        (c) =>
          c.name.trim().toLowerCase() === bill.customerName.trim().toLowerCase() ||
          (bill.contactNumber && c.contactNumber === bill.contactNumber)
      );
      if (existing) {
        if (!customerCodeToUse) {
          customerCodeToUse = existing.customerCode || '';
        }
        if (!customerCodeToUse) {
          customerCodeToUse = getNextCustomerCode(customers);
          const docId = buildCustomerDocId(existing.name, existing.address, existing.contactNumber, customerCodeToUse);
          await upsertCustomerProfile(user?.uid || '', docId, {
            name: existing.name,
            address: existing.address,
            contactNumber: existing.contactNumber,
            customerCode: customerCodeToUse,
            currentBalance: existing.currentBalance || 0,
          });
        }
      } else {
        // New customer - use typed code if present, otherwise generate one.
        if (!customerCodeToUse) {
          customerCodeToUse = getNextCustomerCode(customers);
        }
        const docId = buildCustomerDocId(bill.customerName, bill.address, bill.contactNumber, customerCodeToUse);
        await upsertCustomerProfile(user?.uid || '', docId, {
          name: bill.customerName,
          address: bill.address,
          contactNumber: bill.contactNumber,
          customerCode: customerCodeToUse,
          currentBalance: 0,
        });
      }

      // attach customerCode to bill before saving ledger
      bill.customerCode = customerCodeToUse;
      const { id, createdAt, updatedAt, ...billForSave } = bill;

      await createBill(billForSave);
      await recordBillInventory(user?.uid || '', bill.billNo, bsDate, validItems);
      await syncBillCustomerLedger(user?.uid || '', null, billForSave);

      showSuccess('Bill saved successfully!');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      // After saving, preserve focus and scroll to customer ID for next billing
      flashAndScroll(customerCodeRef);

      if (options.autoClear) {
        setTimeout(() => {
          void handleClearForm({ preserveCustomerCode: true });
        }, 1500);
      }
      return true;
    } catch (error) {
      console.error('Error saving bill:', error);
      showError('Failed to save bill. Please try again.');
      return false;
    } finally {
      if (options.manageLoading) {
        setLoading(false);
      }
    }
  };

  const generatePdfCore = (payload: BillPayload, latestSettings: AppSettings) => {
    try {
      generateBillPDF(
        payload.bill,
        latestSettings.businessName || 'Invoice Billing System',
        latestSettings.businessAddress || 'Garuda, Rautahat, Nepal',
        latestSettings.businessContact || '',
        latestSettings.printFontSize ?? DEFAULT_SETTINGS.printFontSize,
        latestSettings.billTitle || DEFAULT_SETTINGS.billTitle
      );
      showSuccess('PDF generated successfully!');
      flashAndScroll(customerCodeRef);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Failed to generate PDF. Please try again.');
    }
  };

  const printCore = (payload: BillPayload, latestSettings: AppSettings) => {
    try {
      printBill(
        payload.bill,
        latestSettings.businessName || 'Invoice Billing System',
        latestSettings.businessAddress || 'Garuda, Rautahat, Nepal',
        latestSettings.businessContact || '',
        latestSettings.printFontSize ?? DEFAULT_SETTINGS.printFontSize,
        latestSettings.printCopies ?? DEFAULT_SETTINGS.printCopies,
        latestSettings.billTitle || DEFAULT_SETTINGS.billTitle
      );
    } catch (error) {
      console.error('Error printing bill:', error);
      showError('Failed to print bill. Please try again.');
    }
    flashAndScroll(customerCodeRef);
  };

  const handleSaveBill = async () => {
    const payload = await buildBillPayload();
    if (!payload) return;
    await saveBillCore(payload, { autoClear: true, manageLoading: true });
  };

  const handleGeneratePDF = async () => {
    const payload = await buildBillPayload();
    if (!payload) return;
    try {
      const latestSettings = await getLatestPrintSettings();
      generatePdfCore(payload, latestSettings);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Failed to generate PDF. Please try again.');
    }
  };

  const handlePrint = async () => {
    const payload = await buildBillPayload();
    if (!payload) return;
    try {
      const latestSettings = await getLatestPrintSettings();
      printCore(payload, latestSettings);
    } catch (error) {
      console.error('Error printing bill:', error);
      showError('Failed to print bill. Please try again.');
    }
  };

  const handlePrimaryAction = async () => {
    const latestSettings = await getLatestPrintSettings();
    const primaryAction = latestSettings.billPrimaryAction ?? DEFAULT_SETTINGS.billPrimaryAction;
    const actions = new Set<BillAction>([primaryAction]);

    if (latestSettings.billActionAutoSave) actions.add('save');
    if (latestSettings.billActionAutoGeneratePdf) actions.add('pdf');
    if (latestSettings.billActionAutoPrint) actions.add('print');
    if (latestSettings.billActionAutoClear) actions.add('clear');

    const payload = await buildBillPayload();
    if (!payload) return;

    const manageLoading = actions.has('save');
    if (manageLoading) {
      setLoading(true);
    }

    let saveOk = true;
    if (actions.has('save')) {
      saveOk = await saveBillCore(payload, { autoClear: false, manageLoading: false });
    }

    if (saveOk) {
      if (actions.has('pdf')) {
        generatePdfCore(payload, latestSettings);
      }
      if (actions.has('print')) {
        printCore(payload, latestSettings);
      }
      if (actions.has('clear')) {
        await handleClearForm();
      }
    }

    if (manageLoading) {
      setLoading(false);
    }
  };

  const handleClearForm = async (options?: { preserveCustomerCode?: boolean } | React.MouseEvent) => {
    const shouldPreserveCustomerCode = options && typeof options === 'object' && 'preserveCustomerCode' in options
      ? (options as any).preserveCustomerCode === true
      : false;
    const preservedCustomerCode = shouldPreserveCustomerCode ? customerCode : '';

    setCustomerName('');
    setAddress('');
    setContactNumber('');
    setCustomerCode(preservedCustomerCode);
    setItems([{ sn: 1, particulars: '', qty: 0, unit: getDefaultUnit(settings), rate: 0, amount: 0 }]);
    setFreeDue('');
    // Reset dates — passing empty string clears the picker
    setNepaliDate('');
    setDate('');
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
    await initializeBill();
    // After clearing for next billing, focus customer ID
    flashAndScroll(customerCodeRef);
  };

  const primaryBillAction = settings?.billPrimaryAction ?? DEFAULT_SETTINGS.billPrimaryAction;
  const isPrimaryAction = (action: BillPrimaryAction) => primaryBillAction === action;
  const unitOptions = settings?.unitCategories ?? DEFAULT_SETTINGS.unitCategories;

  const hasValidItem = items.some(item => 
    item.particulars.trim() !== '' && Number(item.qty) > 0 && Number(item.rate) > 0
  );

  return (
    <div className="create-bill-page">
      <div className="container bill-layout-container">
        <div className="bill-form card fade-in">
          <div className="bill-header">
            <h1>{settings?.billTitle || 'Estimate Bill'}</h1>
            <p className="business-name" style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {settings?.businessName || 'Invoice Billing System'}
            </p>
            <p className="business-address">
              {settings?.businessAddress || 'Garuda, Rautahat, Nepal'}
              {settings?.businessContact && ` | Contact: ${settings.businessContact}`}
            </p>
          </div>

          {/* ── Row 1: Bill No | Date ── */}
          <div className="bill-meta-row">
            <div className="form-group">
              <label className="label">Bill No</label>
              <input
                type="text"
                className="input"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
              />
            </div>
            <div className="form-group">
              <NepaliDatePickerComponent
                ref={datePickerRef}
                label="Date (BS)"
                value={nepaliDate}
                onChange={handleDateChange}
              />
            </div>
          </div>

          {/* ── Row 2: Customer Name (full width) ── */}
          <div className="form-group" style={{ position: 'relative', zIndex: 20 }}>
            <label className="label">Customer Name *</label>
              <input
                type="text"
                className="input"
                ref={customerNameRef}
                value={customerName}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
                onFocus={() => setCustomerDropdownOpen(true)}
                onBlur={() => setCustomerDropdownOpen(false)}
                placeholder="Enter customer name"
                autoComplete="off"
              />
            {customerDropdownOpen && (() => {
              const matches = customers.filter(c => 
                c.name.toLowerCase().includes(customerName.toLowerCase())
              );
              if (matches.length === 0 || (matches.length === 1 && matches[0].name.toLowerCase() === customerName.trim().toLowerCase())) return null;
              return (
                <div className="suggestions-dropdown">
                  {matches.slice(0, 8).map(c => (
                    <div
                      key={c.id}
                      className="suggestion-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCustomerName(toTitleCase(c.name));
                        if (c.address) setAddress(toTitleCase(c.address));
                        if (c.contactNumber) setContactNumber(c.contactNumber);
                        setCustomerCode(c.customerCode || '');
                        setCustomerDropdownOpen(false);
                      }}
                    >
                      <div className="suggestion-inline-row">
                        <span className="suggestion-name">{c.name}</span>
                        {c.customerCode && <span className="suggestion-code">ID: {c.customerCode}</span>}
                        {c.address && <span className="suggestion-sub suggestion-sub-inline">{c.address}</span>}
                        {c.contactNumber && <span className="suggestion-stock suggestion-stock-inline">{c.contactNumber}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── Row 3: Address | Contact ── */}
          <div className="bill-meta-row customer-meta-row">
            <div className="form-group">
              <label className="label">Address *</label>
              <input
                type="text"
                className="input"
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="Enter address"
              />
            </div>
            <div className="form-group">
              <label className="label">Contact Number</label>
              <input
                type="text"
                className="input"
                value={contactNumber}
                onChange={(e) => handleContactNumberChange(e.target.value)}
                placeholder="Enter contact number"
                maxLength={10}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
            <div className="form-group">
              <label className="label">Customer ID</label>
              <input
                ref={customerCodeRef}
                type="text"
                className="input"
                value={customerCode}
                onChange={(e) => handleCustomerCodeChange(e.target.value)}
                onBlur={handleCustomerCodeBlur}
                placeholder="Max 4 chars"
                maxLength={4}
              />
              {customerCodeMessage && (
                <div style={{ marginTop: '6px', fontSize: '0.875rem', color: customerCodeMessage.includes('already used') ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {customerCodeMessage}
                </div>
              )}
            </div>
          </div>

          <div className="items-section">
            <div className="items-header">
              <h3>Items</h3>
            </div>

            <div className="table-container">
              <table className="table items-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>S.N.</th>
                    <th>Particulars</th>
                    <th style={{ width: '100px' }}>Qty.</th>
                    <th style={{ width: '90px' }}>Unit</th>
                    <th style={{ width: '120px' }}>Rate</th>
                    <th style={{ width: '140px' }}>Amount</th>
                    <th style={{ width: '80px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="text-center">{item.sn}</td>
                      <td style={{ position: 'relative', zIndex: focusedRowIndex === index ? 10 : 1 }}>
                        <input
                          ref={(el) => { itemParticularRefs.current[index] = el; }}
                          type="text"
                          className="input"
                          value={item.particulars}
                          onChange={(e) => {
                            handleItemChange(index, 'particulars', e.target.value);
                            setHighlightedSuggestionIndex(-1);
                          }}
                          onFocus={() => {
                            setFocusedRowIndex(index);
                            setHighlightedSuggestionIndex(-1);
                          }}
                          onBlur={() => setFocusedRowIndex(null)}
                          onKeyDown={(e) => {
                            if (focusedRowIndex !== index) return;
                            const matches = stockParticulars.filter(p =>
                              p.name.toLowerCase().includes(item.particulars.toLowerCase())
                            ).slice(0, 8);
                            if (matches.length === 0) return;

                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHighlightedSuggestionIndex(prev =>
                                prev < matches.length - 1 ? prev + 1 : 0
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHighlightedSuggestionIndex(prev =>
                                prev > 0 ? prev - 1 : matches.length - 1
                              );
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (highlightedSuggestionIndex >= 0 && highlightedSuggestionIndex < matches.length) {
                                handleSelectSuggestion(index, matches[highlightedSuggestionIndex].name);
                              }
                            } else if (e.key === 'Escape') {
                              setFocusedRowIndex(null);
                              setHighlightedSuggestionIndex(-1);
                            }
                          }}
                          placeholder="Item description"
                          autoComplete="off"
                        />
                        {focusedRowIndex === index && (() => {
                          const matches = stockParticulars.filter(p =>
                            p.name.toLowerCase().includes(item.particulars.toLowerCase())
                          );
                          if (matches.length === 0) return null;
                          return (
                            <div className="suggestions-dropdown">
                              {matches.slice(0, 8).map((p, sIdx) => (
                                <div
                                  key={p.id}
                                  className={`suggestion-item suggestion-item-stock${sIdx === highlightedSuggestionIndex ? ' suggestion-highlighted' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectSuggestion(index, p.name);
                                  }}
                                  onMouseEnter={() => setHighlightedSuggestionIndex(sIdx)}
                                >
                                  <span className="suggestion-name">{p.name}</span>
                                  <span className="suggestion-stock">Stock: {(() => {
                                    const otherRowsQty = items.reduce((sum, otherItem, idx) => {
                                      if (idx !== index && otherItem.particulars.trim().toLowerCase() === p.name.toLowerCase()) {
                                        return sum + Number(otherItem.qty || 0);
                                      }
                                      return sum;
                                    }, 0);
                                    return p.currentStock - otherRowsQty;
                                  })()} {p.defaultUnit || 'Qty'}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const stockItem = stockParticulars.find(
                            p => p.name.toLowerCase() === item.particulars.trim().toLowerCase()
                          );
                          return (
                            <input
                              ref={(el) => { itemQtyRefs.current[index] = el; }}
                              type="number"
                              className="input"
                              value={item.qty || ''}
                              onChange={(e) => handleItemChange(index, 'qty', parseFloat(e.target.value) || 0)}
                              onKeyDown={(e) => handleQtyTab(e, index)}
                              min="0"
                              max={stockItem ? stockItem.currentStock - items.reduce((sum, otherItem, idx) => {
                                if (idx !== index && otherItem.particulars.trim().toLowerCase() === item.particulars.trim().toLowerCase()) {
                                  return sum + Number(otherItem.qty || 0);
                                }
                                return sum;
                              }, 0) : undefined}
                              step="1"
                            />
                          );
                        })()}
                      </td>
                      <td>
                        <select
                          className="input"
                          value={item.unit || ''}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        >
                          <option value="">Unit</option>
                          {unitOptions.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          ref={(el) => { itemRateRefs.current[index] = el; }}
                          type="number"
                          className="input"
                          value={item.rate || ''}
                          onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleRateTab(e, index)}
                          min="0"
                          step="1"
                        />
                      </td>
                      <td className="text-right">
                        <strong>{formatCurrency(item.amount)}</strong>
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="btn btn-danger btn-sm"
                          disabled={items.length === 1}
                          title="Remove item"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

            <button
              ref={addItemButtonRef}
              type="button"
              onClick={addItem}
              onKeyDown={handleAddItemButtonKeyDown}
              className="btn btn-primary btn-add-item"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Item
            </button>
          </div>

          <div className="total-section">
            <div className="total-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <span className="total-label">Total Quantity:</span>
              <span className="total-amount" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                {items.reduce((sum, item) => sum + (item.qty || 0), 0)}
              </span>
            </div>
            <div className="total-row">
              <span className="total-label">Total Amount:</span>
              <span className="total-amount">{formatCurrency(calculateTotal())}</span>
            </div>
            <div className="total-words">
              <span className="words-label">In Words:</span>
              <span className="words-text">{numberToWords(calculateTotal())}</span>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="label">Note / Free Due</label>
            <input
              ref={noteRef}
              type="text"
              className="input"
              value={freeDue}
              onChange={(e) => setFreeDue(e.target.value)}
              placeholder="Additional notes or instructions"
            />
          </div>

          <div className="bill-footer">
          </div>

          {hasValidItem && (
            <div className="form-actions fade-in">
              <button
              onClick={isPrimaryAction('save') ? handlePrimaryAction : handleSaveBill}
              className={`btn btn-success ${saved ? 'btn-feedback' : ''}`}
              disabled={loading}
            >
              {saved ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Saved
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {loading ? 'Saving...' : 'Save Bill'}
                </>
              )}
            </button>

            <button
              onClick={isPrimaryAction('pdf') ? handlePrimaryAction : handleGeneratePDF}
              className="btn btn-primary"
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Generate PDF
            </button>

            <button
              onClick={isPrimaryAction('print') ? handlePrimaryAction : handlePrint}
              className="btn btn-info"
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print
            </button>

            <button onClick={handleClearForm} className={`btn btn-secondary ${cleared ? 'btn-feedback-clear' : ''}`} disabled={loading}>
              {cleared ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Cleared
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10" />
                    <polyline points="23 20 23 14 17 14" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                  Clear Form
                </>
              )}
            </button>
            </div>
          )}
        </div>

        {hasValidItem && (
          <div className="form-actions-sidebar card fade-in speed-dial-container">
            <div className="speed-dial-secondary">
              {primaryBillAction !== 'save' && (
                <button
                  onClick={handleSaveBill}
                  className={`btn btn-success ${saved ? 'btn-feedback' : ''}`}
                  disabled={loading}
                  title={loading ? 'Saving...' : 'Save Bill'}
                >
                  {saved ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                  )}
                </button>
              )}

              {primaryBillAction !== 'pdf' && (
                <button
                  onClick={handleGeneratePDF}
                  className="btn btn-primary"
                  disabled={loading}
                  title="Generate PDF"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              )}

              {primaryBillAction !== 'print' && (
                <button
                  onClick={handlePrint}
                  className="btn btn-info"
                  disabled={loading}
                  title="Print Bill"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                </button>
              )}

              <button
                onClick={handleClearForm}
                className={`btn btn-secondary ${cleared ? 'btn-feedback-clear' : ''}`}
                disabled={loading}
                title="Clear Form"
              >
                {cleared ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10" />
                    <polyline points="23 20 23 14 17 14" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                )}
              </button>
            </div>

            <div className="speed-dial-primary">
              {primaryBillAction === 'save' && (
                <button
                  onClick={handlePrimaryAction}
                  className={`btn btn-success ${saved ? 'btn-feedback' : ''}`}
                  disabled={loading}
                  title={loading ? 'Saving...' : 'Save Bill (Primary)'}
                >
                  {saved ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                  )}
                </button>
              )}
              {primaryBillAction === 'pdf' && (
                <button
                  onClick={handlePrimaryAction}
                  className="btn btn-primary"
                  disabled={loading}
                  title="Generate PDF (Primary)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              )}
              {primaryBillAction === 'print' && (
                <button
                  onClick={handlePrimaryAction}
                  className="btn btn-info"
                  disabled={loading}
                  title="Print Bill (Primary)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default CreateBill;
