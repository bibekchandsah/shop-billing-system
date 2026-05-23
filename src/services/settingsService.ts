import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppSettings } from '../types';
import NepaliDate from 'nepali-date-converter';

const SETTINGS_KEY = 'shop_billing_settings';

// ── Fiscal Year Helpers ───────────────────────────────────────────────────────

/**
 * Returns the current BS year from today's Nepali date.
 */
export const getCurrentBsYear = (): number => {
  return new NepaliDate(new Date()).getYear();
};

/**
 * Generates fiscal year option labels starting from 2076 up to currentYear + 3.
 * Format: "2076-77", "2077-78", etc.
 */
export const getFiscalYearOptions = (): string[] => {
  const currentYear = getCurrentBsYear();
  const endYear = currentYear + 3;
  const options: string[] = [];
  for (let y = 2076; y <= endYear; y++) {
    const shortNext = String(y + 1).slice(-2);
    options.push(`${y}-${shortNext}`);
  }
  return options;
};

/**
 * Returns the default active fiscal year based on today's BS date and the
 * configured start month. If today's month >= startMonth the fiscal year
 * started this BS year; otherwise it started last BS year.
 */
export const getDefaultActiveFiscalYear = (startMonth = 4): string => {
  const nd = new NepaliDate(new Date());
  const bsYear = nd.getYear();
  const bsMonth = nd.getMonth() + 1; // 1-indexed
  const fyStartYear = bsMonth >= startMonth ? bsYear : bsYear - 1;
  const shortNext = String(fyStartYear + 1).slice(-2);
  return `${fyStartYear}-${shortNext}`;
};

/**
 * Given a fiscal year label (e.g. "2080-81"), start month (1-12) and end month
 * (1-12), returns the BS date strings for the first day of the start month and
 * the last day of the end month.
 *
 * The start year is the first number in the label.
 * The end year is start year + 1 (because fiscal year spans two BS years).
 */
export const getFiscalYearDateRange = (
  fiscalYear: string,
  startMonth: number,
  endMonth: number
): { startBsDate: string; endBsDate: string; startYear: number; endYear: number } => {
  const startYear = parseInt(fiscalYear.split('-')[0], 10);
  const endYear = startYear + 1;
  const startBsDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  // Last day of end month in end year — use day 32 and let the converter clamp,
  // or simply use day 30 as a safe upper bound (all BS months have ≤ 32 days).
  const endBsDate = `${endYear}-${String(endMonth).padStart(2, '0')}-32`;
  return { startBsDate, endBsDate, startYear, endYear };
};

/**
 * Returns true if a bill's nepaliDate falls within the given fiscal year range.
 */
export const isBillInFiscalYear = (
  nepaliDate: string,
  fiscalYear: string,
  startMonth: number,
  endMonth: number
): boolean => {
  if (!nepaliDate) return false;
  const parts = nepaliDate.split('-');
  if (parts.length < 3) return false;

  const billYear = parseInt(parts[0], 10);
  const billMonth = parseInt(parts[1], 10); // 1-indexed

  const startYear = parseInt(fiscalYear.split('-')[0], 10);
  const endYear = startYear + 1;

  // Bill is in fiscal year if:
  // (billYear === startYear AND billMonth >= startMonth) OR
  // (billYear === endYear AND billMonth <= endMonth)
  if (billYear === startYear && billMonth >= startMonth) return true;
  if (billYear === endYear && billMonth <= endMonth) return true;
  return false;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  businessName: 'Shop Billing System',
  businessAddress: 'Garuda, Rautahat, Nepal',
  businessContact: '',
  billNumberFormat: 'numeric',
  billNumberPrefix: 'BILL-',
  billPrimaryAction: 'save',
  billActionAutoSave: false,
  billActionAutoGeneratePdf: false,
  billActionAutoPrint: false,
  billActionAutoClear: true,
  printFontSize: 13,
  fiscalYearStart: 4,   // Shrawan (month 4 in BS, 1-indexed)
  fiscalYearEnd: 3,     // Ashadh (month 3 in BS, 1-indexed)
  activeFiscalYear: getDefaultActiveFiscalYear(4),
};

/** Helper to get settings document reference in Firestore: users/{userId}/settings/preferences */
const settingsDocRef = (userId: string) => doc(db, 'users', userId, 'settings', 'preferences');

/**
 * Loads the application settings for the given user.
 * Attempts to load from Firestore first, then falls back to local storage, and finally defaults.
 */
export const getAppSettings = async (userId: string): Promise<AppSettings> => {
  if (!userId) {
    // Guest or unauthenticated flow: fallback to LocalStorage or defaults
    const local = localStorage.getItem(SETTINGS_KEY);
    if (local) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  }

  try {
    const docSnap = await getDoc(settingsDocRef(userId));
    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<AppSettings>;
      const settings = { ...DEFAULT_SETTINGS, ...data };
      // Cache locally
      localStorage.setItem(`${SETTINGS_KEY}_${userId}`, JSON.stringify(settings));
      return settings;
    }
  } catch (error) {
    console.error('Error loading settings from Firestore:', error);
  }

  // Fallback to local storage cache for that user
  const cached = localStorage.getItem(`${SETTINGS_KEY}_${userId}`);
  if (cached) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
    } catch {
      // Continue to default
    }
  }

  return DEFAULT_SETTINGS;
};

/**
 * Saves the application settings for the given user.
 * Writes to Firestore and caches in LocalStorage.
 */
export const saveAppSettings = async (userId: string, settings: AppSettings): Promise<void> => {
  // Always cache locally first
  const cacheKey = userId ? `${SETTINGS_KEY}_${userId}` : SETTINGS_KEY;
  localStorage.setItem(cacheKey, JSON.stringify(settings));

  if (!userId) return;

  try {
    await setDoc(settingsDocRef(userId), {
      theme: settings.theme,
      businessName: settings.businessName || DEFAULT_SETTINGS.businessName,
      businessAddress: settings.businessAddress || DEFAULT_SETTINGS.businessAddress,
      businessContact: settings.businessContact || '',
      billNumberFormat: settings.billNumberFormat || 'numeric',
      billNumberPrefix: settings.billNumberPrefix || 'BILL-',
      billPrimaryAction: settings.billPrimaryAction ?? DEFAULT_SETTINGS.billPrimaryAction,
      billActionAutoSave: settings.billActionAutoSave ?? DEFAULT_SETTINGS.billActionAutoSave,
      billActionAutoGeneratePdf: settings.billActionAutoGeneratePdf ?? DEFAULT_SETTINGS.billActionAutoGeneratePdf,
      billActionAutoPrint: settings.billActionAutoPrint ?? DEFAULT_SETTINGS.billActionAutoPrint,
      billActionAutoClear: settings.billActionAutoClear ?? DEFAULT_SETTINGS.billActionAutoClear,
      printFontSize: settings.printFontSize ?? DEFAULT_SETTINGS.printFontSize,
      fiscalYearStart: settings.fiscalYearStart ?? DEFAULT_SETTINGS.fiscalYearStart,
      fiscalYearEnd: settings.fiscalYearEnd ?? DEFAULT_SETTINGS.fiscalYearEnd,
      activeFiscalYear: settings.activeFiscalYear || DEFAULT_SETTINGS.activeFiscalYear,
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving settings to Firestore:', error);
    throw new Error('Failed to persist settings in database.');
  }
};
