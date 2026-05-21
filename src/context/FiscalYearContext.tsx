import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  getAppSettings,
  saveAppSettings,
  getFiscalYearOptions,
  getDefaultActiveFiscalYear,
  isBillInFiscalYear,
} from '../services/settingsService';
import type { AppSettings, Bill } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FiscalYearContextType {
  /** Full app settings (null while loading) */
  settings: AppSettings | null;
  /** Currently active fiscal year label, e.g. "2081-82" */
  activeFiscalYear: string;
  /** BS month (1-12) the fiscal year starts */
  fiscalYearStart: number;
  /** BS month (1-12) the fiscal year ends */
  fiscalYearEnd: number;
  /** All available fiscal year options */
  fiscalYearOptions: string[];
  /** True while settings are being loaded */
  loading: boolean;
  /** Switch the active fiscal year (persists to Firestore) */
  setActiveFiscalYear: (fy: string) => Promise<void>;
  /** Filter a bill array to only those in the active fiscal year */
  filterBillsByFY: (bills: Bill[]) => Bill[];
  /** Check if a single BS date string is in the active fiscal year */
  isInActiveFY: (bsDate: string) => boolean;
}

const FiscalYearContext = createContext<FiscalYearContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────
export const FiscalYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getAppSettings(user?.uid || '');
      setSettings(s);
    } catch (e) {
      console.error('FiscalYearContext: failed to load settings', e);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const activeFiscalYear =
    settings?.activeFiscalYear || getDefaultActiveFiscalYear(settings?.fiscalYearStart ?? 4);
  const fiscalYearStart = settings?.fiscalYearStart ?? 4;
  const fiscalYearEnd = settings?.fiscalYearEnd ?? 3;
  const fiscalYearOptions = getFiscalYearOptions();

  const setActiveFiscalYear = useCallback(
    async (fy: string) => {
      if (!settings) return;
      const updated = { ...settings, activeFiscalYear: fy };
      setSettings(updated); // optimistic update
      try {
        await saveAppSettings(user?.uid || '', updated);
      } catch (e) {
        console.error('FiscalYearContext: failed to save fiscal year', e);
        // revert on failure
        setSettings(settings);
      }
    },
    [settings, user?.uid]
  );

  const isInActiveFY = useCallback(
    (bsDate: string) =>
      isBillInFiscalYear(bsDate, activeFiscalYear, fiscalYearStart, fiscalYearEnd),
    [activeFiscalYear, fiscalYearStart, fiscalYearEnd]
  );

  const filterBillsByFY = useCallback(
    (bills: Bill[]) => {
      return bills.filter(b => {
        const bsDate = b.nepaliDate || '';
        if (!bsDate) return false;
        return isInActiveFY(bsDate);
      });
    },
    [isInActiveFY]
  );

  return (
    <FiscalYearContext.Provider
      value={{
        settings,
        activeFiscalYear,
        fiscalYearStart,
        fiscalYearEnd,
        fiscalYearOptions,
        loading,
        setActiveFiscalYear,
        filterBillsByFY,
        isInActiveFY,
      }}
    >
      {children}
    </FiscalYearContext.Provider>
  );
};

export const useFiscalYear = () => {
  const ctx = useContext(FiscalYearContext);
  if (!ctx) throw new Error('useFiscalYear must be used within FiscalYearProvider');
  return ctx;
};
