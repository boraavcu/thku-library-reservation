const UNITS_TR = [
  { max: 60, divisor: 1, singular: 'saniye önce', plural: 'saniye önce' },
  { max: 3600, divisor: 60, singular: 'dakika önce', plural: 'dakika önce' },
  { max: 86400, divisor: 3600, singular: 'saat önce', plural: 'saat önce' },
  { max: 604800, divisor: 86400, singular: 'gün önce', plural: 'gün önce' },
  { max: 2592000, divisor: 604800, singular: 'hafta önce', plural: 'hafta önce' },
  { max: 31536000, divisor: 2592000, singular: 'ay önce', plural: 'ay önce' },
  { max: Infinity, divisor: 31536000, singular: 'yıl önce', plural: 'yıl önce' },
];

const UNITS_EN = [
  { max: 60, divisor: 1, singular: 'second ago', plural: 'seconds ago' },
  { max: 3600, divisor: 60, singular: 'minute ago', plural: 'minutes ago' },
  { max: 86400, divisor: 3600, singular: 'hour ago', plural: 'hours ago' },
  { max: 604800, divisor: 86400, singular: 'day ago', plural: 'days ago' },
  { max: 2592000, divisor: 604800, singular: 'week ago', plural: 'weeks ago' },
  { max: 31536000, divisor: 2592000, singular: 'month ago', plural: 'months ago' },
  { max: Infinity, divisor: 31536000, singular: 'year ago', plural: 'years ago' },
];

export function formatRelativeTime(dateStr, lang = 'tr') {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 5) return lang === 'tr' ? 'az önce' : 'just now';

  const units = lang === 'tr' ? UNITS_TR : UNITS_EN;

  for (const unit of units) {
    if (diff < unit.max) {
      const val = Math.floor(diff / unit.divisor);
      const label = val === 1 ? unit.singular : unit.plural;
      return `${val} ${label}`;
    }
  }
}
