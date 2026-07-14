import type { Bill } from '../types';
import { getBillHtml } from './billTemplate';

/**
 * Opens a new browser window with a clean bill layout and
 * immediately triggers the browser print dialog — no second click needed.
 */
export const printBill = (
  bill: Bill,
  businessName: string,
  businessAddress: string,
  businessContact?: string,
  printFontSize = 13,
  printCopies = 2,
  billTitle = 'Estimate Bill'
): Promise<void> => {
  return new Promise((resolve) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
      resolve();
      return;
    }

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(timer);
      clearTimeout(fallbackTimeout);
      window.removeEventListener('message', handleMessage);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PRINT_DONE') {
        cleanup();
        resolve();
      }
    };
    window.addEventListener('message', handleMessage);

    const timer = setInterval(() => {
      if (win.closed) {
        cleanup();
        resolve();
      }
    }, 500);

    const fallbackTimeout = setTimeout(() => {
      cleanup();
      resolve();
    }, 30000);

    const html = getBillHtml(
      bill,
      businessName,
      businessAddress,
      businessContact,
      printFontSize,
      printCopies,
      billTitle,
      false // isPdf
    );

    win.document.write(html);
    win.document.close();
    win.focus();
  });
};
