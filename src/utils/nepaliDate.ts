import NepaliDate from 'nepali-date-converter';

// Convert English date to Nepali date
export const toNepaliDate = (date: Date): string => {
  const nepaliDate = new NepaliDate(date);
  return nepaliDate.format('YYYY-MM-DD');
};

// Convert Nepali date to English date
export const toEnglishDate = (nepaliDateStr: string): Date => {
  const [year, month, day] = nepaliDateStr.split('-').map(Number);
  const nepaliDate = new NepaliDate(year, month - 1, day);
  return nepaliDate.toJsDate();
};

// Format Nepali date for display
export const formatNepaliDate = (date: Date): string => {
  const nepaliDate = new NepaliDate(date);
  return nepaliDate.format('YYYY MMMM DD, dddd');
};

// Get current Nepali date
export const getCurrentNepaliDate = (): string => {
  const nepaliDate = new NepaliDate(new Date());
  return nepaliDate.format('YYYY-MM-DD');
};

// Validate Nepali date
export const isValidNepaliDate = (dateStr: string): boolean => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 32) return false;
    if (year < 2000 || year > 2100) return false;
    
    // Try to create a Nepali date object
    new NepaliDate(year, month - 1, day);
    return true;
  } catch {
    return false;
  }
};
