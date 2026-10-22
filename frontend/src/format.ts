export const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const BAND_STYLES: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700 ring-rose-200",
  high: "bg-amber-100 text-amber-800 ring-amber-200",
  medium: "bg-sky-100 text-sky-700 ring-sky-200",
  low: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const CATEGORY_LABELS: Record<string, string> = {
  pothole: "Pothole",
  garbage: "Garbage",
  water_leak: "Water leak",
  streetlight: "Streetlight",
  drainage: "Drainage",
  other: "Other",
};

export const CATEGORY_COLORS: Record<string, string> = {
  pothole: "#c2414b",
  garbage: "#2f7d55",
  water_leak: "#2f6d8a",
  streetlight: "#a16207",
  drainage: "#6d5aa8",
  other: "#7c746b",
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return "Unclassified";
  return CATEGORY_LABELS[key] ?? key.replace(/_/g, " ");
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function bandClass(band: string): string {
  return BAND_STYLES[band] ?? BAND_STYLES.low;
}

export function ageInDays(iso: string): number {
  const created = new Date(iso).getTime();
  return Math.max(0, Math.round(((Date.now() - created) / 86_400_000) * 10) / 10);
}

export function isOverdue(slaDueAt: string | null, status: string): boolean {
  if (!slaDueAt || status === "resolved") return false;
  return new Date(slaDueAt).getTime() < Date.now();
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const percentFormat = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});

const scoreFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return dateTimeFormat.format(parsed);
}

export function formatPercent(value: number): string {
  return percentFormat.format(value);
}

export function formatScore(value: number): string {
  return scoreFormat.format(value);
}
