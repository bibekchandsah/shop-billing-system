import { useEffect, useRef, useId, useImperativeHandle, forwardRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import './NepaliDatePicker.css';

// ── Actual library API (from the docs) ────────────────────────────────────────
// getDate() returns: { bs: { year, month, day }, ad: { year, month, day }, formatted: '...' }
// onChange receives the same shape, or null on clear

interface NDPDatePart {
  year: number;
  month: number;
  day: number;
}

interface NDPDateResult {
  bs: NDPDatePart;
  ad: NDPDatePart;
  formatted?: string;
}

interface NDPOptions {
  mode?: 'bilingual' | 'nepali' | 'english';
  theme?: 'default' | 'ocean' | 'forest' | 'sunset' | 'rose';
  dark?: boolean;
  closeOnSelect?: boolean;
  showToday?: boolean;
  showClear?: boolean;
  showClose?: boolean;
  showDisplay?: boolean;
  placeholder?: string;
  placeholderEn?: string;
  onChange?: (date: NDPDateResult | null) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

interface NDPInstance {
  getDate: () => NDPDateResult | null;
  setDate: (year: number, month: number, day: number) => void;
  open: () => void;
  close: () => void;
  clear: () => void;
  toggle: () => void;
  setTheme: (theme: string) => void;
  setDark: (dark: boolean) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    NepaliDatePicker: {
      init: (selector: string, options?: NDPOptions) => NDPInstance;
      utils: {
        bsToAd: (y: number, m: number, d: number) => { year: number; month: number; day: number; dow?: number };
        adToBs: (y: number, m: number, d: number) => { year: number; month: number; day: number };
        toNepali: (n: number) => string;
        getToday: () => { year: number; month: number; day: number };
      };
    };
  }
}

// ── Public handle exposed via ref ─────────────────────────────────────────────
export interface NepaliDatePickerHandle {
  /** Returns current BS and AD as "YYYY-MM-DD" strings, or null if nothing selected */
  getSelectedDate: () => { bs: string; ad: string } | null;
}

// ── Component props ───────────────────────────────────────────────────────────
interface NepaliDatePickerProps {
  /** Fires with (bsString "YYYY-MM-DD", adString "YYYY-MM-DD").
   *  Both are empty strings when the user clears the picker. */
  onChange: (bs: string, ad: string) => void;
  /** Controlled BS value "YYYY-MM-DD". Pass empty string to clear. */
  value?: string;
  label?: string;
  /** If provided, shows this text as the input placeholder instead of a label above */
  placeholder?: string;
  required?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

const toStrings = (result: NDPDateResult) => ({
  bs: `${result.bs.year}-${pad(result.bs.month)}-${pad(result.bs.day)}`,
  ad: `${result.ad.year}-${pad(result.ad.month)}-${pad(result.ad.day)}`,
});

// ── Component ─────────────────────────────────────────────────────────────────
const NepaliDatePickerComponent = forwardRef<NepaliDatePickerHandle, NepaliDatePickerProps>(
  ({ onChange, value, label, placeholder, required = false }, ref) => {
    const uid         = useId().replace(/:/g, '');
    const containerId = `ndp-${uid}`;
    const instanceRef = useRef<NDPInstance | null>(null);
    const isReadyRef  = useRef(false);
    const { effectiveTheme } = useTheme();
    const isDark = effectiveTheme === 'dark';

    // Expose getSelectedDate() to parent via ref
    useImperativeHandle(ref, () => ({
      getSelectedDate: () => {
        if (!instanceRef.current) return null;
        const result = instanceRef.current.getDate();
        if (!result) return null;
        return toStrings(result);
      },
    }));

    // ── Init ────────────────────────────────────────────────────────────────
    useEffect(() => {
      let cancelled = false;

      const init = () => {
        if (cancelled || !window.NepaliDatePicker) return;

        instanceRef.current = window.NepaliDatePicker.init(`#${containerId}`, {
          mode: 'english', // 'bilingual', 'nepali', or 'english'
          theme: 'default',
          dark: isDark,
          closeOnSelect: true,
          showToday: true,
          showClear: true,
          showClose: true,
          showDisplay: false,
          placeholderEn: placeholder || 'Select Date (BS)',
          placeholder: 'मिति छान्नुहोस्',
          onChange: (date: NDPDateResult | null) => {
            if (!date) {
              onChange('', '');
              return;
            }
            const { bs, ad } = toStrings(date);
            onChange(bs, ad);
          },
        });

        isReadyRef.current = true;

        // Set initial value without triggering onChange
        if (value) {
          const parts = value.split('-').map(Number);
          if (parts.length === 3 && parts.every((p) => p > 0)) {
            instanceRef.current.setDate(parts[0], parts[1], parts[2]);
          }
        }
      };

      if (window.NepaliDatePicker) {
        init();
      } else {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (window.NepaliDatePicker) {
            clearInterval(interval);
            init();
          } else if (attempts > 50) {
            clearInterval(interval);
            console.warn('NepaliDatePicker CDN script did not load.');
          }
        }, 100);
        return () => { cancelled = true; clearInterval(interval); };
      }

      return () => {
        cancelled = true;
        instanceRef.current?.destroy();
        instanceRef.current = null;
        isReadyRef.current  = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerId]);

    // ── Dark mode sync ───────────────────────────────────────────────────────
    useEffect(() => {
      if (isReadyRef.current) instanceRef.current?.setDark(isDark);
    }, [isDark]);

    // ── Controlled value sync ────────────────────────────────────────────────
    useEffect(() => {
      if (!isReadyRef.current || !instanceRef.current) return;
      if (!value) {
        if (instanceRef.current.getDate()) instanceRef.current.clear();
      } else {
        const parts = value.split('-').map(Number);
        if (parts.length === 3 && parts.every((p) => p > 0)) {
          instanceRef.current.setDate(parts[0], parts[1], parts[2]);
        }
      }
    }, [value]);

    return (
      <div className="ndp-wrapper">
        {label && !placeholder && (
          <label className="label">
            {label}
            {required && <span className="ndp-required"> *</span>}
          </label>
        )}
        {required && !label && !placeholder && <span className="ndp-required"> *</span>}
        {label && placeholder && required && (
          <label className="label" style={{ visibility: 'hidden', height: 0, margin: 0 }} />
        )}
        <div id={containerId} className="ndp-container" />
      </div>
    );
  }
);

NepaliDatePickerComponent.displayName = 'NepaliDatePicker';
export default NepaliDatePickerComponent;
