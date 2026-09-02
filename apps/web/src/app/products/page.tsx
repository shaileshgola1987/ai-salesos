"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const canManage =
    user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "SALES_MANAGER";

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!showInactive) params.set("isActive", "true");
      const data = await apiFetch<ProductDto[]>(`/products?${params.toString()}`);
      setProducts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load products");
    }
  }, [showInactive]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filter change -> refetch
    void load();
  }, [load]);

  async function onDeactivate(id: string) {
    if (!confirm("Deactivate this product? It stays on past quotations but won't be selectable for new ones.")) return;
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate product");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Products</h2>
          {canManage && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {showCreate ? "Cancel" : "New product"}
            </button>
          )}
        </div>

        {showCreate && (
          <CreateProductForm
            onCreated={() => {
              setShowCreate(false);
              void load();
            }}
          />
        )}

        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show deactivated products
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Unit price</th>
                <th className="px-4 py-3 font-medium">GST %</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {products?.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</p>
                    {p.description && <p className="text-xs text-zinc-500">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{p.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    ₹{Number(p.unitPrice).toFixed(2)} / {p.unit}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {Number(p.taxRatePercent)}%
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {p.isActive && (
                        <button
                          onClick={() => onDeactivate(p.id)}
                          className="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {products && products.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No products yet.</p>
          )}
          {!products && !error && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">Loading products…</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CreateProductForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    unit: "pcs",
    unitPrice: "",
    taxRatePercent: "18",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          sku: form.sku || undefined,
          description: form.description || undefined,
          unit: form.unit || undefined,
          unitPrice: Number(form.unitPrice),
          taxRatePercent: form.taxRatePercent ? Number(form.taxRatePercent) : undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input
          placeholder="Name"
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="SKU (optional)"
          value={form.sku}
          onChange={(e) => update("sku", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="Unit (pcs, kg, box…)"
          value={form.unit}
          onChange={(e) => update("unit", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Unit price (₹)"
          required
          value={form.unitPrice}
          onChange={(e) => update("unitPrice", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="GST %"
          value={form.taxRatePercent}
          onChange={(e) => update("taxRatePercent", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-3"
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}
