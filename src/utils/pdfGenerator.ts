import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Bill } from '../types';
import { getBillHtml } from './billTemplate';

export const generateBillPDF = async (
  bill: Bill,
  businessName: string,
  businessAddress: string,
  businessContact?: string,
  printFontSize = 13,
  billTitle = 'Estimate Bill'
): Promise<void> => {
  try {
    // Generate the exact same HTML used for printing, but flag it as PDF
    const htmlStr = getBillHtml(
      bill,
      businessName,
      businessAddress,
      businessContact,
      printFontSize,
      1,
      billTitle,
      true
    );

    // Create a hidden iframe to render the HTML securely
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '800px';
    // Give it plenty of height so it doesn't scroll/cut off
    iframe.style.height = '1500px'; 
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      throw new Error('Could not access iframe document');
    }

    doc.open();
    doc.write(htmlStr);
    doc.close();

    // Wait a short moment for fonts and layout to finish painting
    await new Promise((resolve) => setTimeout(resolve, 500));

    const contentWrap = doc.getElementById('pdf-content-wrapper');
    if (!contentWrap) {
      document.body.removeChild(iframe);
      throw new Error('Could not find printable content wrapper');
    }

    // Snapshot the rendered HTML into a canvas
    const canvas = await html2canvas(contentWrap, {
      scale: 2, // higher scale for better resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Generate PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // A4 dimensions: 210 x 297 mm
    const pdfWidth = pdf.internal.pageSize.getWidth();
    // Calculate PDF height to maintain aspect ratio
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    const imgData = canvas.toDataURL('image/png');
    
    // If the content is taller than one page, jsPDF addImage will draw it off the bottom. 
    // In most simple bills, it will easily fit on one page.
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    pdf.save(`Bill_${bill.billNo}_${bill.customerName}.pdf`);
    
    // Cleanup
    document.body.removeChild(iframe);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    alert('An error occurred while generating the PDF. Please try again.');
  }
};
