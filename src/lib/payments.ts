export type PaymentStatus = "activo" | "por_vencer" | "vencido";

export const PERIODICITY_OPTIONS = [
  { label: "Semanal", days: 7 },
  { label: "Quincenal", days: 15 },
  { label: "Mensual", days: 30 },
  { label: "Bimestral", days: 60 },
  { label: "Trimestral", days: 90 },
  { label: "Anual", days: 365 },
];

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computePaidUntil(paymentPeriods: { periodEnd: string }[]): string | null {
  if (paymentPeriods.length === 0) return null;
  return paymentPeriods.reduce((max, p) => (p.periodEnd > max ? p.periodEnd : max), paymentPeriods[0].periodEnd);
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  const from = new Date(fromISO + "T00:00:00Z").getTime();
  const to = new Date(toISOStr + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86400000);
}

export function getPaymentStatus(paidUntil: string | null, today: string = todayISO()): PaymentStatus {
  if (!paidUntil) return "vencido";
  const diff = daysBetween(today, paidUntil);
  if (diff < 0) return "vencido";
  if (diff <= 5) return "por_vencer";
  return "activo";
}

export function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
