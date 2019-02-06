import moment from 'moment';

export function getTimestamp(): string {
  const now = moment();
  const formatted = now.format('YYYY-MM-DD hh:mm:ss');
  return formatted;
}
