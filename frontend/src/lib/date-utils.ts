import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * Format date to Japanese locale (YYYY/MM/DD)
 *
 * @param date - Date to format (Date object, ISO string, or null/undefined)
 * @returns Formatted date string in Japanese format, or '-' if date is invalid/null
 *
 * @example
 * ```typescript
 * formatDateJP(new Date('2024-11-05')) // '2024/11/05'
 * formatDateJP('2024-11-05T10:30:00Z') // '2024/11/05'
 * formatDateJP(null) // '-'
 * ```
 */
export function formatDateJP(date: Date | string | null | undefined): string {
  if (!date) return '-';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateObj);
  } catch {
    return '-';
  }
}

/**
 * Format date to short format (MM/DD)
 *
 * @param date - Date to format (Date object, ISO string, or null/undefined)
 * @returns Formatted date string in short format, or '-' if date is invalid/null
 *
 * @example
 * ```typescript
 * formatDateShort(new Date('2024-11-05')) // '11/05'
 * formatDateShort('2024-11-05T10:30:00Z') // '11/05'
 * formatDateShort(null) // '-'
 * ```
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '-';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MM/dd', { locale: ja });
  } catch {
    return '-';
  }
}
