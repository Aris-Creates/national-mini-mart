import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Triggers the browser's print dialog, styled for a thermal receipt.
 * @param receiptElement - The ref to the HTML element containing the receipt.
 */
export const printThermalReceipt = (receiptElement: HTMLElement) => {
  // Find or create a container for printing
  let printContainer = document.getElementById('print-thermal-container');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'print-thermal-container';
    document.body.appendChild(printContainer);
  }

  // Clone the receipt content into the print container
  printContainer.innerHTML = '';
  printContainer.appendChild(receiptElement.cloneNode(true));
  
  // Trigger the print dialog
  window.print();
};

/**
 * Generates and downloads a PDF of the receipt.
 * @param receiptElement - The ref to the HTML element containing the receipt.
 *- * @param fileName - The desired name for the downloaded PDF file.
 */
export const downloadPdfReceipt = async (receiptElement: HTMLElement, fileName: string = 'receipt.pdf') => {
  if (!receiptElement) return;

  // Use html2canvas to capture the element as an image
  const canvas = await html2canvas(receiptElement);
  const imgData = canvas.toDataURL('image/png');

  // Calculate dimensions for a 3-inch (80mm) wide PDF
  const pdfWidth = 80; 
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  // Create a new PDF document
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight]
  });

  // Add the image to the PDF and save it
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(fileName);
};