import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bill } from '../types';
import { formatCurrency } from './numberToWords';

export const generateBillPDF = (
  bill: Bill,
  businessName: string,
  businessAddress: string,
  businessContact?: string,
  printFontSize = 13
): void => {
  const doc = new jsPDF();
  const scale = Math.max(0.8, Math.min(1.6, printFontSize / 13));
  const scaled = (value: number) => Math.round(value * scale);
  
  // Set font
  doc.setFont('helvetica');
  
  // Header
  doc.setFontSize(scaled(20));
  doc.setFont('helvetica', 'bold');
  doc.text('Estimate Bill', 105, 20, { align: 'center' });
  
  doc.setFontSize(scaled(12));
  doc.setFont('helvetica', 'normal');
  doc.text(businessName, 105, 28, { align: 'center' });
  
  const addressLine = `${businessAddress}${businessContact ? ' | Contact: ' + businessContact : ''}`;
  doc.text(addressLine, 105, 34, { align: 'center' });
  
  // ── Bill meta — two-column layout ──────────────────────────────────────────
  const date = bill.nepaliDate || bill.date || '—';
  doc.setFontSize(Math.max(9, scaled(10)));

  // Row 1: Bill No (left) | Date (right)
  doc.setFont('helvetica', 'bold');
  doc.text('Bill No:', 15, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(bill.billNo, 35, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 130, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(date, 145, 46);

  // Row 2: Customer Name (full width)
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Name:', 15, 53);
  doc.setFont('helvetica', 'normal');
  doc.text(bill.customerName, 52, 53);

  // Row 3: Address (left) | Contact (right)
  doc.setFont('helvetica', 'bold');
  doc.text('Address:', 15, 60);
  doc.setFont('helvetica', 'normal');
  doc.text(bill.address, 35, 60);

  if (bill.contactNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text('Contact:', 130, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.contactNumber, 148, 60);
  }

  // Separator before table
  doc.setLineWidth(0.3);
  doc.line(15, 64, 195, 64);
  
  // Items table
  const tableData = bill.items.map(item => [
    item.sn.toString(),
    item.particulars,
    item.qty.toString(),
    formatCurrency(item.rate),
    formatCurrency(item.amount)
  ]);

  // Calculate total quantity of items
  const totalQty = bill.items.reduce((sum, item) => sum + item.qty, 0);
  
  autoTable(doc, {
    startY: 68,
    head: [['S.N.', 'Particulars', 'Qty.', 'Rate', 'Amount']],
    body: tableData,
    theme: 'grid',
    showFoot: 'lastPage',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: scaled(20) },
      1: { halign: 'left', cellWidth: scaled(70) },
      2: { halign: 'center', cellWidth: scaled(25) },
      3: { halign: 'center', cellWidth: scaled(35) },
      4: { halign: 'center', cellWidth: scaled(35) }
    },
    styles: {
      fontSize: Math.max(9, scaled(10)),
      cellPadding: scaled(3)
    },
    foot: [[
      { content: 'Total', colSpan: 2, styles: { halign: 'right', fillColor: [240, 244, 248], textColor: 17, fontStyle: 'bold' } },
      { content: `${totalQty}`, styles: { halign: 'center', fillColor: [240, 244, 248], textColor: 17, fontStyle: 'bold' } },
      { content: '', styles: { fillColor: [240, 244, 248] } },
      { content: formatCurrency(bill.totalAmount), styles: { halign: 'center', fillColor: [240, 244, 248], textColor: 17, fontStyle: 'bold' } },
    ]],
    footStyles: {
      fillColor: [240, 244, 248],
      textColor: 17
    },
    didDrawPage: () => {
      // keep the table footer aligned like the HTML print preview
    }
  });
  
  // Get the final Y position after the table
  const finalY = (doc as any).lastAutoTable.finalY || 70;
  
  // Amount in words
  doc.setFont('helvetica', 'normal');
  doc.text('In Words:', 15, finalY + 20);
  
  // Split long text into multiple lines
  const words = bill.totalAmountInWords;
  const splitWords = doc.splitTextToSize(words, 170);
  doc.text(splitWords, 15, finalY + 26);
  
  const wordsHeight = splitWords.length * 6;
  
  if (bill.freeDue) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Note: ${bill.freeDue}`, 15, finalY + 26 + wordsHeight + 6);
  }
  
  // Signature
  doc.setLineWidth(0.5);
  doc.line(145, 260, 195, 260);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized Signature', 170, 266, { align: 'center' });

  // Footer
  doc.setLineWidth(0.5);
  doc.line(15, 270, 195, 270);
  
  // Save the PDF
  doc.save(`Bill_${bill.billNo}_${bill.customerName}.pdf`);
};
