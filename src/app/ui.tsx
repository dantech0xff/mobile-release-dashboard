import Link from "next/link";
import cronstrue from "cronstrue";

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + "Z");
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("vi-VN", { timeZone: process.env.TZ || "UTC" });
}

export function cronHuman(expr: string | null | undefined): string | null {
  if (!expr) return null;
  try {
    return cronstrue.toString(expr);
  } catch {
    return null;
  }
}

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-zinc-700 text-zinc-200",
  running: "bg-blue-900 text-blue-200",
  success: "bg-emerald-900 text-emerald-200",
  failed: "bg-red-900 text-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] || STATUS_STYLES.queued;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function RunStatusLink({
  id,
  status,
  label,
}: {
  id: number;
  status: string;
  label: string;
}) {
  return (
    <Link href={`/runs/${id}`} className="text-sm text-blue-400 hover:underline">
      #{id} {label} <StatusBadge status={status} />
    </Link>
  );
}
