export const parseAmountToRupeesAndPaisa = (num: number): { rupees: number, paisa: number } => {
  // Safely round to exactly two decimal places to handle long fractional numbers (e.g. 3935 / 12)
  const numStr = Number(num).toFixed(2);
  
  const parts = numStr.split('.');
  let rupees = parseInt(parts[0], 10) || 0;
  let paisa = parseInt(parts[1], 10) || 0;
  
  return { rupees, paisa };
};

// Convert number to words in Nepali/English format
export const numberToWords = (num: number, language: 'en' | 'ne' = 'en'): string => {
  const { rupees, paisa } = parseAmountToRupeesAndPaisa(num);

  if (rupees === 0 && paisa === 0) {
    return language === 'en' ? 'Zero Rupees Only' : 'शून्य रुपैयाँ मात्र';
  }

  const ones = language === 'en' 
    ? ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    : ['', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ'];

  const teens = language === 'en'
    ? ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    : ['दश', 'एघार', 'बाह्र', 'तेह्र', 'चौध', 'पन्ध्र', 'सोह्र', 'सत्र', 'अठार', 'उन्नाइस'];

  const tens = language === 'en'
    ? ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    : ['', '', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठी', 'सत्तरी', 'अस्सी', 'नब्बे'];

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    const hundredWord = language === 'en' ? 'Hundred' : 'सय';
    return ones[hundred] + ' ' + hundredWord + (remainder > 0 ? ' ' + convertLessThanThousand(remainder) : '');
  };

  const convertNumber = (n: number): string => {
    if (n === 0) return language === 'en' ? 'Zero' : 'शून्य';
    
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const remainder = n % 1000;

    let result = '';
    if (crore > 0) result += convertLessThanThousand(crore) + (language === 'en' ? ' Crore ' : ' करोड ');
    if (lakh > 0) result += convertLessThanThousand(lakh) + (language === 'en' ? ' Lakh ' : ' लाख ');
    if (thousand > 0) result += convertLessThanThousand(thousand) + (language === 'en' ? ' Thousand ' : ' हजार ');
    if (remainder > 0) result += convertLessThanThousand(remainder);

    return result.trim();
  };

  let result = '';
  
  if (rupees > 0) {
    result += convertNumber(rupees) + (language === 'en' ? ' Rupees' : ' रुपैयाँ');
  }

  if (paisa > 0) {
    const paisaText = convertNumber(paisa);
    if (result.length > 0) {
      result += language === 'en' ? ' and ' : ' र ';
    }
    result += paisaText + (language === 'en' ? ' Paisa' : ' पैसा');
  }

  if (result.length > 0) {
    result += language === 'en' ? ' Only' : ' मात्र';
  }

  return result.trim();
};

// Format number with commas (Indian numbering system)
export const formatCurrency = (num: number): string => {
  const { rupees, paisa } = parseAmountToRupeesAndPaisa(num);
  
  const numStr = rupees.toString();
  const lastThree = numStr.substring(numStr.length - 3);
  const otherNumbers = numStr.substring(0, numStr.length - 3);
  
  let formattedRupees = lastThree;
  if (otherNumbers !== '') {
    formattedRupees = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }
  
  if (paisa > 0 || num.toString().includes('.')) {
    const formattedPaisa = paisa < 10 ? `0${paisa}` : `${paisa}`;
    return `${formattedRupees}.${formattedPaisa}`;
  }
  
  return formattedRupees;
};
