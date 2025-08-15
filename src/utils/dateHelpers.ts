export function formatDate(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
}