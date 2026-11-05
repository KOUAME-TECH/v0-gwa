export type Reservation = {
  productId: string
  mode: "stock" | "preorder"
  stockTaken: number
  preorderTaken: number
  harvestDate: string | null
}

type ReserveClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
}

export async function reserveProduct(
  client: ReserveClient,
  productId: string,
  quantity: number,
): Promise<{ ok: true; reservation: Reservation } | { ok: false; error: string }> {
  const { data, error } = await client.rpc("gwa_reserve_product_stock", {
    p_product_id: productId,
    p_qty: quantity,
  })
  if (error || !data || data.ok !== true) {
    return { ok: false, error: "Capacité de récolte insuffisante" }
  }
  return {
    ok: true,
    reservation: {
      productId,
      mode: data.mode === "preorder" ? "preorder" : "stock",
      stockTaken: Number(data.stock_taken) || 0,
      preorderTaken: Number(data.preorder_taken) || 0,
      harvestDate: typeof data.harvest_date === "string" ? data.harvest_date : null,
    },
  }
}

export async function releaseProduct(client: ReserveClient, reservation: Reservation): Promise<void> {
  await client.rpc("gwa_release_product_stock", {
    p_product_id: reservation.productId,
    p_stock: reservation.stockTaken,
    p_preorder: reservation.preorderTaken,
  })
}

export type StockAllocation =
  | { ok: true; mode: "stock" | "preorder"; stockTaken: number; preorderTaken: number }
  | { ok: false; error: string }

export function allocateStock(
  stockQuantity: number | null,
  preorderQuantity: number | null,
  quantity: number,
): StockAllocation {
  const qty = Math.floor(Number(quantity) || 0)
  if (qty <= 0) return { ok: false, error: "Quantité invalide" }
  if (stockQuantity == null) {
    return { ok: true, mode: "stock", stockTaken: 0, preorderTaken: 0 }
  }
  const stock = Math.max(0, Math.floor(stockQuantity))
  const preorder = Math.max(0, Math.floor(preorderQuantity || 0))
  if (qty <= stock) return { ok: true, mode: "stock", stockTaken: qty, preorderTaken: 0 }
  if (qty <= stock + preorder) {
    return { ok: true, mode: "preorder", stockTaken: stock, preorderTaken: qty - stock }
  }
  return { ok: false, error: "Capacité de récolte insuffisante" }
}
