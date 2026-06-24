import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bill } from '../types';
import { formatCurrency } from './numberToWords';

export const generateBillPDF = (
  bill: Bill,
  businessName: string,
  businessAddress: string,
  businessContact?: string,
  printFontSize = 13,
  billTitle = 'Estimate Bill'
): void => {
  const doc = new jsPDF();
  const scale = Math.max(0.8, Math.min(1.6, printFontSize / 13));
  const scaled = (value: number) => Math.round(value * scale);
  
  // Set font
  doc.setFont('helvetica');
  
  // Header
  doc.setFontSize(scaled(20));
  doc.setFont('helvetica', 'bold');
  doc.text(billTitle, 105, 20, { align: 'center' });
  
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

  // Separator before table removed
  
  // Items table
  const tableData = bill.items.map(item => [
    item.sn.toString(),
    item.particulars,
    item.unit ? `${item.qty} ${item.unit}` : item.qty.toString(),
    formatCurrency(item.rate),
    formatCurrency(item.amount)
  ]);

  // Pad with empty rows to simulate stretched table borders
  while (tableData.length < 15) {
    tableData.push(['', '', '', '', '', '', '', '', '']);
  }

  // Calculate total quantity of items
  const totalQty = bill.items.reduce((sum, item) => sum + item.qty, 0);
  
  autoTable(doc, {
    startY: 68,
    head: [['S.N.', 'PARTICULARS', 'QTY.', 'RATE', 'AMOUNT']],
    body: tableData,
    theme: 'grid',
    showFoot: 'lastPage',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.2,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 35 },
      4: { halign: 'center', cellWidth: 35 }
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    bodyStyles: {
      lineWidth: 0,
      fillColor: false as any
    },
    foot: [[
      { content: 'Total', colSpan: 2, styles: { halign: 'right', fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.2, lineColor: [0, 0, 0] } },
      { content: `${totalQty}`, styles: { halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.2, lineColor: [0, 0, 0] } },
      { content: '', styles: { fillColor: [255, 255, 255], lineWidth: 0.2, lineColor: [0, 0, 0] } },
      { content: formatCurrency(bill.totalAmount), styles: { halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.2, lineColor: [0, 0, 0] } },
    ]],
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0]
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
        doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
      if (data.section === 'head') {
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });
  
  // Get the final Y position after the table
  let finalY = (doc as any).lastAutoTable.finalY || 70;
  
  // If finalY is too close to bottom, add a new page for footer
  if (finalY > 230) {
    doc.addPage();
    finalY = 20;
  }
  
  // Amount in words box
  doc.setFont('helvetica', 'bold');
  doc.text('In Words:', 18, finalY + 8);
  doc.setFont('helvetica', 'italic');
  const splitWords = doc.splitTextToSize(bill.totalAmountInWords, 140);
  doc.text(splitWords, 38, finalY + 8);
  
  const wordsHeight = splitWords.length * 5 + 3;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(15, finalY + 3, 180, wordsHeight);
  
  if (bill.freeDue) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Note: ${bill.freeDue}`, 15, finalY + 5 + wordsHeight + 5);
  }
  
  // Signature
  doc.setLineWidth(0.5);
  doc.line(145, 260, 195, 260);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized Signature', 170, 266, { align: 'center' });

  // Footer line removed
  
  // Save the PDF
  doc.save(`Bill_${bill.billNo}_${bill.customerName}.pdf`);
};
