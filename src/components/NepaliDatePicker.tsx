import { useEffect, useRef, useId, useImperativeHandle, forwardRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import './NepaliDatePicker.css';

// ── Actual library API (from https://nepalidate.omkumarpandey.com.np/datepicker.html) ──
// getDate() returns: { bs: { year, month, day }, ad: { year, month, day }, formatted: 'YYYY-MM-DD' }
// onSelect/onChange receives: { value, year, month, day, bs: { year, month, day }, ad: { year, month, day } }

export interface NDPDatePart {
  year: number;
  month: number;
  day: number;
}

export interface NDPDateResult {
  bs: NDPDatePart;
  ad: NDPDatePart;
  formatted?: string;
  value?: string;
  year?: number;
  month?: number;
  day?: number;
}

export interface NDPOptions {
  mode?: 'light' | 'dark' | 'bilingual' | 'nepali' | 'english';
  language?: 'nepali' | 'english';
  miniEnglishDates?: boolean;
  theme?: 'default' | 'ocean' | 'forest' | 'sunset' | 'rose';
  dark?: boolean;
  dateFormat?: string;
  range?: boolean;
  multiple?: boolean;
  inline?: boolean;
  animation?: 'fade' | 'slide';
  unicodeDate?: boolean;
  minDate?: NDPDatePart | string;
  maxDate?: NDPDatePart | string;
  disableDates?: string[];
  disableDaysBefore?: number;
  disableDaysAfter?: number;
  disableToday?: boolean;
  placeholder?: string;
  placeholderEn?: string;
  value?: string | null;
  onSelect?: (date: NDPDateResult | null) => void;
  onChange?: (date: NDPDateResult | null) => void;
  onClose?: (selectedDates?: any) => void;
}

export interface NDPInstance {
  inputElement?: HTMLInputElement;
  options: NDPOptions;
  getDate: () => NDPDateResult | null;
  setDate: (y: number | NDPDatePart, m?: number, d?: number) => void;
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
    NepaliFunctions?: any;
    NepaliDatePicker: {
      init: (selector: string | HTMLElement, options?: NDPOptions) => NDPInstance;
      utils: {
        bsToAd: (y: number | NDPDatePart, m?: number, d?: number) => { year: number; month: number; day: number; dow?: number };
        adToBs: (y: number | NDPDatePart, m?: number, d?: number) => { year: number; month: number; day: number };
        toNepali: (n: number | string) => string;
        getToday: () => { year: number; month: number; day: number };
        getDaysInMonth: (y: number, m: number) => number;
      };
    };
  }
}

// ── Public handle exposed via ref ─────────────────────────────────────────────
export interface NepaliDatePickerHandle {
  /** Returns current BS and AD as "YYYY-MM-DD" strings, or null if nothing selected */
  getSelectedDate: () => { bs: string; ad: string } | null;
  /** Programmatically set the date (y, m, d) */
  setDate?: (y: number, m: number, d: number) => void;
  /** Clear the selected date */
  clear?: () => void;
  /** Open the calendar popup */
  open?: () => void;
  /** Close the calendar popup */
  close?: () => void;
  /** Toggle the calendar popup */
  toggle?: () => void;
  /** Access the input element */
  getInputElement?: () => HTMLInputElement | null;
}

// ── Component props ───────────────────────────────────────────────────────────
export interface NepaliDatePickerProps {
  /** Fires with (bsString "YYYY-MM-DD", adString "YYYY-MM-DD").
   *  Both are empty strings when the user clears the picker. */
  onChange: (bs: string, ad: string) => void;
  /** Controlled BS value "YYYY-MM-DD". Pass empty string to clear. */
  value?: string;
  label?: string;
  /** If provided, shows this text as the input placeholder instead of a label above */
  placeholder?: string;
  placeholderEn?: string;
  required?: boolean;
  /** Language mode: 'english' | 'nepali' | 'bilingual' (for backward-compatibility) */
  mode?: 'bilingual' | 'nepali' | 'english';
  /** Language setting: 'english' | 'nepali' */
  language?: 'nepali' | 'english';
  /** Show small AD day numbers inside calendar cells */
  miniEnglishDates?: boolean;
  /** Calendar color theme */
  theme?: 'default' | 'ocean' | 'forest' | 'sunset' | 'rose';
  /** Popup animation */
  animation?: 'fade' | 'slide';
  /** Date format: 'YYYY-MM-DD', 'DD-MM-YYYY', etc. */
  dateFormat?: string;
  /** Convert date numbers to Devanagari numerals */
  unicodeDate?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

const toStrings = (result: NDPDateResult) => ({
  bs: result.bs ? `${result.bs.year}-${pad(result.bs.month)}-${pad(result.bs.day)}` : (result.value || ''),
  ad: result.ad ? `${result.ad.year}-${pad(result.ad.month)}-${pad(result.ad.day)}` : '',
});

// ── Component ─────────────────────────────────────────────────────────────────
const NepaliDatePickerComponent = forwardRef<NepaliDatePickerHandle, NepaliDatePickerProps>(
  (
    {
      onChange,
      value,
      label,
      placeholder,
      placeholderEn,
      required = false,
      mode = 'english',
      language,
      miniEnglishDates,
      theme = 'default',
      animation = 'fade',
      dateFormat = 'YYYY-MM-DD',
      unicodeDate = false,
    },
    ref
  ) => {
    const uid         = useId().replace(/:/g, '');
    const containerId = `ndp-${uid}`;
    const instanceRef = useRef<NDPInstance | null>(null);
    const isReadyRef  = useRef(false);
    const { effectiveTheme } = useTheme();
    const isDark = effectiveTheme === 'dark';

    // Resolve language:
    // If language prop is provided, use it.
    // Otherwise derive from mode: 'nepali' -> 'nepali', 'english'|'bilingual' -> 'english'
    const resolvedLanguage: 'nepali' | 'english' =
      language ?? (mode === 'nepali' ? 'nepali' : 'english');

    // Resolve mini English dates (bilingual AD day numbers):
    const resolvedMiniEnglishDates: boolean =
      miniEnglishDates ?? (mode === 'bilingual');

    // English & Nepali placeholders
    const resolvedEnglishPlaceholder = placeholderEn || placeholder || 'Select Date (BS)';
    const resolvedNepaliPlaceholder  = placeholder || 'मिति छान्नुहोस्';
    const activePlaceholder =
      resolvedLanguage === 'english' ? resolvedEnglishPlaceholder : resolvedNepaliPlaceholder;

    // Expose handle methods to parent via ref
    useImperativeHandle(ref, () => ({
      getSelectedDate: () => {
        if (!instanceRef.current) return null;
        const result = instanceRef.current.getDate();
        if (result && result.bs) return toStrings(result);
        // Fallback: parse current input value if available
        const val = instanceRef.current.inputElement?.value?.trim();
        if (val) {
          const parts = val.split('-').map(Number);
          if (parts.length === 3 && parts.every((p) => p > 0)) {
            const ad = window.NepaliDatePicker?.utils?.bsToAd?.(parts[0], parts[1], parts[2]);
            if (ad) {
              return {
                bs: `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`,
                ad: `${ad.year}-${pad(ad.month)}-${pad(ad.day)}`,
              };
            }
          }
        }
        return null;
      },
      setDate: (y: number, m: number, d: number) => {
        instanceRef.current?.setDate(y, m, d);
      },
      clear: () => {
        instanceRef.current?.clear();
        onChange('', '');
      },
      open: () => instanceRef.current?.open(),
      close: () => instanceRef.current?.close(),
      toggle: () => instanceRef.current?.toggle(),
      getInputElement: () => instanceRef.current?.inputElement || null,
    }));

    // ── Init ────────────────────────────────────────────────────────────────
    useEffect(() => {
      let cancelled = false;

      // Tracks WHY the picker closed so handleClose can decide whether to refocus.
      let dateWasSelected = false; // true when user clicked a date cell
      let tabWasPressed   = false; // true when user pressed Tab to dismiss

      const handleDateSelect = (date: NDPDateResult | null) => {
        if (!date || !date.bs) {
          onChange('', '');
          return;
        }
        const { bs, ad } = toStrings(date);
        onChange(bs, ad);
        dateWasSelected = true; // picker will close next; handleClose will refocus
      };

      const handleClose = () => {
        const shouldRefocus = dateWasSelected && !tabWasPressed;
        dateWasSelected = false;
        tabWasPressed   = false;

        if (!shouldRefocus) return; // user clicked outside or pressed Tab — leave focus where it landed

        // Date was selected via mouse click → restore focus to input so the
        // user can press Tab to advance to the next field.
        requestAnimationFrame(() => {
          instanceRef.current?.inputElement?.focus();
        });
      };

      const init = () => {
        if (cancelled || !window.NepaliDatePicker) return;

        instanceRef.current = window.NepaliDatePicker.init(`#${containerId}`, {
          language: resolvedLanguage,
          miniEnglishDates: resolvedMiniEnglishDates,
          mode: isDark ? 'dark' : 'light',
          dark: isDark,
          theme,
          animation,
          dateFormat,
          unicodeDate,
          placeholder: resolvedNepaliPlaceholder,
          placeholderEn: resolvedEnglishPlaceholder,
          onSelect: handleDateSelect,
          onChange: handleDateSelect,
          onClose: handleClose,
        });

        isReadyRef.current = true;

        // Ensure the input element's placeholder is accurately set
        if (instanceRef.current?.inputElement) {
          const inputEl = instanceRef.current.inputElement;
          inputEl.placeholder = activePlaceholder;
          if (required) {
            inputEl.required = required;
          }

          // Handle manual clearing in the input field
          const handleInput = () => {
            if (!inputEl.value.trim()) {
              onChange('', '');
            }
          };
          inputEl.addEventListener('input', handleInput);

          // On Tab: set the tabWasPressed flag so handleClose skips refocusing,
          // close the popup, then let the browser's native Tab move focus forward.
          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
              tabWasPressed = true;
              instanceRef.current?.close();
              // Do NOT preventDefault — browser Tab navigation handles the rest.
            }
          };
          inputEl.addEventListener('keydown', handleKeyDown);
        }

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
    }, [containerId, resolvedLanguage, resolvedMiniEnglishDates, theme, animation, dateFormat, unicodeDate]);

    // ── Placeholder sync ─────────────────────────────────────────────────────
    useEffect(() => {
      if (instanceRef.current?.inputElement) {
        instanceRef.current.inputElement.placeholder = activePlaceholder;
      }
    }, [activePlaceholder]);

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
        <div id={containerId} className="ndp-input-host" />
      </div>
    );
  }
);

NepaliDatePickerComponent.displayName = 'NepaliDatePicker';
export default NepaliDatePickerComponent;
