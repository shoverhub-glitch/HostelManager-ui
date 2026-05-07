const DEFAULT_LOCALE = 'en-US';

interface FormatDateOptions {
  locale?: string;
  fallback?: string;
}

/**
 * Formats date-like values for UI display and falls back safely for invalid input.
 */
export function formatDate(
  value?: string | number | Date | null,
  options: FormatDateOptions = {},
): string {
  const { locale = DEFAULT_LOCALE, fallback = '--' } = options;

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}