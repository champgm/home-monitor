import moment from 'moment';

export function getTimestamp(): string {
  const now = moment();
  const formatted = now.format('YYYY-MM-DD hh:mm:ss');
  return formatted;
}

export async function sleep(milliseconds?: number) {
  const time = milliseconds
    ? milliseconds
    : 100;
  await new Promise(resolve => setTimeout(resolve, time));
}