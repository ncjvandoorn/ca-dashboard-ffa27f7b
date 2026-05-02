import Papa from "papaparse";
import { useQuery } from "@tanstack/react-query";
import { getDataFileUrl } from "./dataFileUrl";

export interface UserCustomerRow {
  salesRep: string;
  customerName: string;
}

function normalize(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function loadUserCustomers(): Promise<UserCustomerRow[]> {
  try {
    const url = await getDataFileUrl("userCustomer.csv");
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) return [];
    const text = await resp.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    const rows: UserCustomerRow[] = [];
    for (const r of parsed.data as Record<string, string>[]) {
      const rep = (r["Sales rep"] || r["sales rep"] || r["Sales Rep"] || "").trim();
      const cust = (r["Customer name"] || r["customer name"] || r["Customer Name"] || "").trim();
      if (rep && cust) rows.push({ salesRep: rep, customerName: cust });
    }
    return rows;
  } catch {
    return [];
  }
}

export function useUserCustomers() {
  return useQuery({ queryKey: ["userCustomers"], queryFn: loadUserCustomers, staleTime: Infinity });
}

/**
 * Resolve the responsible sales rep for a given customer (or farm) name.
 * Tolerant matching: exact (case-insensitive) → prefix either direction
 * (handles truncated names like "Africa Blooms Limite" vs "Africa Blooms Limited").
 */
export function buildResponsibleResolver(rows: UserCustomerRow[]) {
  const exact = new Map<string, string>();
  const list: { norm: string; rep: string }[] = [];
  for (const r of rows) {
    const n = normalize(r.customerName);
    if (!n) continue;
    if (!exact.has(n)) exact.set(n, r.salesRep);
    list.push({ norm: n, rep: r.salesRep });
  }
  return (name: string | null | undefined): string | null => {
    if (!name) return null;
    const n = normalize(name);
    if (!n) return null;
    if (exact.has(n)) return exact.get(n)!;
    // Prefix match (either direction) — pick the longest matching entry.
    let best: { len: number; rep: string } | null = null;
    for (const { norm, rep } of list) {
      const minLen = Math.min(n.length, norm.length);
      if (minLen < 6) continue;
      const a = n.slice(0, minLen);
      const b = norm.slice(0, minLen);
      if (a === b) {
        if (!best || minLen > best.len) best = { len: minLen, rep };
      }
    }
    return best?.rep ?? null;
  };
}
