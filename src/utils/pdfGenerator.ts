import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bill } from '../types';
import { formatCurrency } from './numberToWords';

export const generateBillPDF = (
  bill: Bill,
  businessName: string,
  businessAddress: string,
  businessContact?: string
): void => {
  const doc = new jsPDF();
  
  // Set font
  doc.setFont('helvetica');
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Estimate Bill', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(businessName, 105, 28, { align: 'center' });
  
  const addressLine = `${businessAddress}${businessContact ? ' | Contact: ' + businessContact : ''}`;
  doc.text(addressLine, 105, 34, { align: 'center' });
  
  // Line separator
  doc.setLineWidth(0.5);
  doc.line(15, 38, 195, 38);

  // ── Bill meta — two-column layout ──────────────────────────────────────────
  const date = bill.nepaliDate || bill.date || '—';
  doc.setFontSize(10);

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
  
  autoTable(doc, {
    startY: 68,
    head: [['S.N.', 'Particulars', 'Qty.', 'Rate', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { halign: 'left', cellWidth: 70 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'right', cellWidth: 35 }
    },
    styles: {
      fontSize: 10,
      cellPadding: 3
    }
  });
  
  // Calculate total quantity of items
  const totalQty = bill.items.reduce((sum, item) => sum + item.qty, 0);

  // Get the final Y position after the table
  const finalY = (doc as any).lastAutoTable.finalY || 70;
  
  // Total Qty and Total Amount
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Qty: ${totalQty}`, 110, finalY + 10);
  doc.text(`Total Amount: ${formatCurrency(bill.totalAmount)}`, 195, finalY + 10, { align: 'right' });
  
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
