"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LeadDto, ProductDto, QuotationDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import {
  QuotationItemsEditor,
  emptyQuotationItem,
  toApiQuotationItems,
  type QuotationItemDraft,
} from "@/components/QuotationItemsEditor";

export default function NewQuotationPage() {
  return (
    <Suspense fallback={null}>
      <NewQuotationPageInner />
    </Suspense>
  );
}

function NewQuotationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedLeadId = searchParams.get("leadId") ?? "";

  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [leadId, setLeadId] = useState(preselectedLeadId);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuotationItemDraft[]>([emptyQuotationItem()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void Promise.all([
      apiFetch<LeadDto[]>("/leads").then(setLeads),
      apiFetch<ProductDto[]>("/products?isActive=true").then(setProducts),
    ]).catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const quotation = await apiFetch<QuotationDto>("/quotations", {
        method: "POST",
        body: JSON.stringify({
          leadId: leadId || undefined,
          validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
          notes: notes || undefined,
          items: toApiQuotationItems(items),
        }),
      });
      router.replace(`/quotations/${quotation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create quotation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New quotation</h2>

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Lead</span>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">No linked lead</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Valid until (optional)</span>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <QuotationItemsEditor items={items} products={products} onChange={setItems} />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Creating…" : "Create quotation"}
        </button>
      </form>
    </AppShell>
  );
}
