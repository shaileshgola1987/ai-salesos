"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ProductDto, QuotationDto } from "@ai-salesos/shared";
import { apiFetch, apiFetchBlob, ApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_STYLES } from "@/lib/badges";
import {
  QuotationItemsEditor,
  toApiQuotationItems,
  type QuotationItemDraft,
} from "@/components/QuotationItemsEditor";

const STATUS_TARGETS = ["ACCEPTED", "REJECTED", "EXPIRED", "DRAFT"];

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [quotation, setQuotation] = useState<QuotationDto | null>(null);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<QuotationItemDraft[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<QuotationDto>(`/quotations/${params.id}`);
      setQuotation(data);
      setNotes(data.notes ?? "");
      setValidUntil(data.validUntil ? data.validUntil.slice(0, 10) : "");
      setItems(
        data.items.map((i) => ({
          key: i.id,
          productId: i.productId ?? "",
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRatePercent: i.taxRatePercent,
        })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load quotation");
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial quotation fetch
    void load();
  }, [load]);

  useEffect(() => {
    void apiFetch<ProductDto[]>("/products?isActive=true")
      .then(setProducts)
      .catch(() => undefined);
  }, []);

  async function onSaveDraft() {
    if (!quotation) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<QuotationDto>(`/quotations/${quotation.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          notes: notes || undefined,
          validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
          items: toApiQuotationItems(items),
        }),
      });
      setQuotation(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save quotation");
    } finally {
      setSaving(false);
    }
  }

  async function onStatusChange(status: string) {
    if (!quotation) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<QuotationDto>(`/quotations/${quotation.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setQuotation(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!quotation) return;
    if (!confirm(`Delete quotation ${quotation.number}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/quotations/${quotation.id}`, { method: "DELETE" });
      router.replace("/quotations");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete quotation");
    }
  }

  async function onDownloadPdf() {
    if (!quotation) return;
    setError(null);
    try {
      const blob = await apiFetchBlob(`/quotations/${quotation.id}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load PDF");
    }
  }

  async function onSendWhatsApp() {
    if (!quotation) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<QuotationDto>(`/quotations/${quotation.id}/send-whatsapp`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setQuotation(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send via WhatsApp");
    } finally {
      setSaving(false);
    }
  }

  if (!quotation) {
    return (
      <AppShell>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <p className="text-sm text-zinc-500">Loading quotation…</p>
        )}
      </AppShell>
    );
  }

  const isDraft = quotation.status === "DRAFT";
  const recipient = quotation.lead ?? quotation.customer;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Quotation {quotation.number}
            </h2>
            {recipient && (
              <p className="text-sm text-zinc-500">
                {recipient.name}
                {recipient.companyName ? ` · ${recipient.companyName}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${QUOTATION_STATUS_STYLES[quotation.status]}`}
            >
              {QUOTATION_STATUS_LABELS[quotation.status]}
            </span>
            <button
              onClick={onDownloadPdf}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Download PDF
            </button>
            <button
              onClick={onSendWhatsApp}
              disabled={saving || !recipient}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Send via WhatsApp
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-zinc-500">Mark as:</span>
          {STATUS_TARGETS.filter((s) => s !== quotation.status).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              disabled={saving}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {QUOTATION_STATUS_LABELS[s]}
            </button>
          ))}
          {quotation.sentAt && (
            <span className="text-xs text-zinc-400">
              Sent {new Date(quotation.sentAt).toLocaleString()}
            </span>
          )}
          {!recipient && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Link a lead to enable WhatsApp sharing.
            </span>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          {isDraft ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Valid until</span>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Notes</span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
              </div>
              <QuotationItemsEditor items={items} products={products} onChange={setItems} />
              <div className="flex items-center gap-3">
                <button
                  onClick={onSaveDraft}
                  disabled={saving}
                  className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button onClick={onDelete} className="text-sm text-red-600 hover:underline dark:text-red-400">
                  Delete quotation
                </button>
              </div>
            </div>
          ) : (
            <ReadOnlyItems quotation={quotation} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ReadOnlyItems({ quotation }: { quotation: QuotationDto }) {
  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
          <tr>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 font-medium">Unit price</th>
            <th className="py-2 font-medium">GST %</th>
            <th className="py-2 font-medium">Line total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {quotation.items.map((item) => (
            <tr key={item.id}>
              <td className="py-2">{item.description}</td>
              <td className="py-2">{item.quantity}</td>
              <td className="py-2">₹{Number(item.unitPrice).toFixed(2)}</td>
              <td className="py-2">{Number(item.taxRatePercent)}%</td>
              <td className="py-2">₹{Number(item.lineTotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col items-end gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        <p>Subtotal: ₹{Number(quotation.subtotal).toFixed(2)}</p>
        <p>GST: ₹{Number(quotation.taxAmount).toFixed(2)}</p>
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Total: ₹{Number(quotation.totalAmount).toFixed(2)}
        </p>
      </div>
      {quotation.notes && (
        <p className="text-sm text-zinc-500">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Notes: </span>
          {quotation.notes}
        </p>
      )}
    </div>
  );
}
