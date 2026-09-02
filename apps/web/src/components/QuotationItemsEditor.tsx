"use client";

import type { ProductDto } from "@ai-salesos/shared";

export interface QuotationItemDraft {
  key: string;
  productId: string; // "" = custom line
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
}

export function emptyQuotationItem(): QuotationItemDraft {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    taxRatePercent: "0",
  };
}

/** Converts editor state to the shape POST/PATCH /quotations expects. */
export function toApiQuotationItems(items: QuotationItemDraft[]) {
  return items.map((i) => ({
    productId: i.productId || undefined,
    description: i.description.trim() || undefined,
    quantity: Number(i.quantity),
    unitPrice: i.unitPrice === "" ? undefined : Number(i.unitPrice),
    taxRatePercent: i.taxRatePercent === "" ? undefined : Number(i.taxRatePercent),
  }));
}

function lineTotal(item: QuotationItemDraft): number {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  return qty * price;
}

export function computePreviewTotals(items: QuotationItemDraft[]) {
  const subtotal = items.reduce((sum, i) => sum + lineTotal(i), 0);
  const taxAmount = items.reduce((sum, i) => sum + (lineTotal(i) * (Number(i.taxRatePercent) || 0)) / 100, 0);
  return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
}

export function QuotationItemsEditor({
  items,
  products,
  onChange,
}: {
  items: QuotationItemDraft[];
  products: ProductDto[];
  onChange: (items: QuotationItemDraft[]) => void;
}) {
  function updateItem(key: string, patch: Partial<QuotationItemDraft>) {
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function selectProduct(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateItem(key, {
      productId,
      description: product?.name ?? "",
      unitPrice: product ? product.unitPrice : "",
      taxRatePercent: product ? product.taxRatePercent : "0",
    });
  }

  function removeItem(key: string) {
    onChange(items.filter((i) => i.key !== key));
  }

  const totals = computePreviewTotals(items);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 font-medium">Qty</th>
              <th className="w-28 px-3 py-2 font-medium">Unit price</th>
              <th className="w-20 px-3 py-2 font-medium">GST %</th>
              <th className="w-28 px-3 py-2 font-medium">Line total</th>
              <th className="w-8 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item) => (
              <tr key={item.key}>
                <td className="px-3 py-2">
                  <select
                    value={item.productId}
                    onChange={(e) => selectProduct(item.key, e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="">Custom line</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item.key, { description: e.target.value })}
                    placeholder="Description"
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.taxRatePercent}
                    onChange={(e) => updateItem(item.key, { taxRatePercent: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">₹{lineTotal(item).toFixed(2)}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    disabled={items.length <= 1}
                    className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-30 dark:hover:text-red-400"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => onChange([...items, emptyQuotationItem()])}
        className="self-start text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400"
      >
        + Add item
      </button>

      <div className="flex flex-col items-end gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        <p>Subtotal: ₹{totals.subtotal.toFixed(2)}</p>
        <p>GST: ₹{totals.taxAmount.toFixed(2)}</p>
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Total: ₹{totals.totalAmount.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
