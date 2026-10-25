/**
 * Temporary market-hours adapter.
 *
 * Keep exchange rules here until the backend provides a live market-status
 * payload. The Dashboard only consumes getMarketStatus(), so replacing this
 * calculation with an API response will not require UI changes.
 */
export const marketSchedule = {
  exchange: "NYSE",
  timezone: "America/New_York",
  openMinutes: 9 * 60 + 30,
  closeMinutes: 16 * 60,
  tradingDays: [1, 2, 3, 4, 5] as readonly number[],
} as const;

type MarketTimeParts = { weekday: number; hour: number; minute: number };

function getMarketTimeParts(date: Date): MarketTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: marketSchedule.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  const hour = Number(values.hour) === 24 ? 0 : Number(values.hour);
  return { weekday, hour, minute: Number(values.minute) };
}

export function getMarketStatus(date = new Date()) {
  const { weekday, hour, minute } = getMarketTimeParts(date);
  const currentMinutes = hour * 60 + minute;
  const isOpen = marketSchedule.tradingDays.includes(weekday) && currentMinutes >= marketSchedule.openMinutes && currentMinutes < marketSchedule.closeMinutes;

  return {
    exchange: marketSchedule.exchange,
    isOpen,
    label: isOpen ? "Market Open" : "Market Closed",
  };
}
