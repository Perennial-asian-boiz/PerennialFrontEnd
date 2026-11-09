export type PublicFloat = { value: number; asOf: string; caution: boolean };

export function readPublicFloat(entry: unknown): PublicFloat | null {
  if (!entry || typeof entry !== "object") return null;
  const data = entry as Record<string, unknown>;
  const value = data.public_float;
  const asOf = data.public_float_as_of;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0
    || typeof asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null;
  const date = new Date(`${asOf}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== asOf) return null;
  return { value, asOf, caution: Array.isArray(data.size_flags) && data.size_flags.length > 0 };
}

export function publicFloatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}
