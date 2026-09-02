import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  getAppSettings,
  getFiscalYearOptions,
  getDefaultActiveFiscalYear,
  isBillInFiscalYear,
} from '../services/settingsService';
import { setGlobalNumberSystem } from '../utils/numberToWords';
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
  refreshSettings: () => Promise<void>;
}

const FiscalYearContext = createContext<FiscalYearContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────
export const FiscalYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeUid } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getAppSettings(activeUid || '');
      setSettings(s);
      if (s?.numberSystem) {
        setGlobalNumberSystem(s.numberSystem);
      }
    } catch (e) {
      console.error('FiscalYearContext: failed to load settings', e);
    } finally {
      setLoading(false);
    }
  }, [activeUid]);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await getAppSettings(activeUid || '');
      setSettings(s);
      if (s?.numberSystem) {
        setGlobalNumberSystem(s.numberSystem);
      }
    } catch (e) {
      console.error('FiscalYearContext: failed to refresh settings', e);
    }
  }, [activeUid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (settings?.numberSystem) {
      setGlobalNumberSystem(settings.numberSystem);
    }
  }, [settings?.numberSystem]);

  const activeFiscalYear =
    settings?.activeFiscalYear || getDefaultActiveFiscalYear(settings?.fiscalYearStart ?? 4);
  const fiscalYearStart = settings?.fiscalYearStart ?? 4;
  const fiscalYearEnd = settings?.fiscalYearEnd ?? 3;
  const fiscalYearOptions = getFiscalYearOptions();

  const setActiveFiscalYear = useCallback(
    async (fy: string) => {
      if (!activeUid) return;

      const updated = settings ? { ...settings, activeFiscalYear: fy } : null;
      if (updated) {
        setSettings(updated); // optimistic update
      }
      try {
        await setDoc(
          doc(db, 'users', activeUid, 'settings', 'preferences'),
          {
            activeFiscalYear: fy,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      } catch (e) {
        console.error('FiscalYearContext: failed to save fiscal year', e);
        // revert on failure
        if (settings) {
          setSettings(settings);
        }
      }
    },
    [settings, activeUid]
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
        refreshSettings,
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
