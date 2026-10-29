import { Expense, LedgerEntry } from '../types';
import { formatPKR, formatMonthDisplay } from './formatters';

let pdfModulePromise: Promise<typeof import('jspdf')> | null = null;

export function preloadPdfExport(): Promise<typeof import('jspdf')> {
  if (!pdfModulePromise) {
    pdfModulePromise = import('jspdf');
  }
  return pdfModulePromise;
}

export async function exportMonthlyHistoryPDF(
  selectedMonthKey: string,
  filteredExpenses: Expense[]
): Promise<void> {
  const { default: jsPDF } = await preloadPdfExport();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Hisaab Expenses - ${formatMonthDisplay(selectedMonthKey)}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Total count: ${filteredExpenses.length}`, 14, 28);

  let y = 38;
  filteredExpenses.forEach((exp) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(
      `${exp.date}  |  ${exp.title}  |  ${exp.category}  |  ${formatPKR(exp.amount)}`,
      14,
      y
    );
    y += 8;
  });

  doc.save(`Hisaab_${selectedMonthKey}.pdf`);
}

export async function exportFriendStatementPDF(
  friendName: string,
  balance: number,
  entries: LedgerEntry[]
): Promise<void> {
  const { default: jsPDF } = await preloadPdfExport();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const isSettled = balance === 0;
  const isOwed = balance > 0;

  doc.setFillColor(12, 18, 34);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('HISAAB KHATA STATEMENT', 14, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Account with: ${friendName}  |  Generated: ${new Date().toLocaleDateString('en-PK')}`,
    14,
    32
  );

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  const statusStr = isSettled
    ? 'All Settled (PKR 0)'
    : isOwed
    ? `${friendName} Owes You: ${formatPKR(balance)}`
    : `You Owe ${friendName}: ${formatPKR(Math.abs(balance))}`;
  doc.text(`Current Balance: ${statusStr}`, 14, 56);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 62, pageWidth - 14, 62);

  let y = 72;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Date', 14, y);
  doc.text('Description', 45, y);
  doc.text('Type', 130, y);
  doc.text('Amount', 165, y);
  y += 6;
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  entries.forEach((e) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const dStr = e.date;
    const desc = (e.label || e.description || '').slice(0, 42);
    const typeLabel =
      e.type === 'payment'
        ? 'Payment'
        : e.amount > 0
        ? 'Owes You'
        : 'You Owe';
    const amtLabel = formatPKR(Math.abs(e.amount));

    doc.text(dStr, 14, y);
    doc.text(desc, 45, y);
    doc.text(typeLabel, 130, y);
    doc.text(amtLabel, 165, y);
    y += 8;
  });

  doc.save(`Hisaab_${friendName.replace(/\s+/g, '_')}_Statement.pdf`);
}
