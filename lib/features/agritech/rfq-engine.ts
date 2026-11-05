export function requestIsMatched(volumeRequested: number, volumesCommitted: number[]): boolean {
  const asked = Math.floor(volumeRequested)
  const got = volumesCommitted.reduce((sum, value) => sum + Math.max(0, Math.floor(value)), 0)
  return asked > 0 && got >= asked
}

type RfqClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>
      }
    }
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: { id?: string } | null; error: { message: string } | null }>
      }
    }
    update: (patch: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

export async function joinBuyerRequest(
  client: RfqClient,
  input: {
    buyerRequestId: string
    producerId: string
    volumeCommitted: number
    priceOffered?: number | null
    flagsOpen: boolean
    committedAfterJoin: number
  },
): Promise<{ ok: true; matched: boolean } | { ok: false; error: string }> {
  if (!input.flagsOpen) {
    return { ok: false, error: "Cette offre groupée n’est pas encore ouverte." }
  }
  const volume = Math.floor(input.volumeCommitted)
  if (volume <= 0) return { ok: false, error: "Le volume proposé est invalide." }

  const { data: request } = await client
    .from("buyer_requests")
    .select("id, buyer_id, volume_requested, status")
    .eq("id", input.buyerRequestId)
    .maybeSingle()
  if (!request || request.status !== "open") {
    return { ok: false, error: "Cette demande n’est plus ouverte." }
  }

  const inserted = await client
    .from("aggregated_offers")
    .insert({
      buyer_request_id: input.buyerRequestId,
      producer_id: input.producerId,
      volume_committed: volume,
      price_offered: input.priceOffered ?? null,
      status: "pending",
    })
    .select("id")
    .maybeSingle()
  if (inserted.error || !inserted.data) {
    return { ok: false, error: "Impossible de rejoindre cette offre." }
  }

  const asked = Number(request.volume_requested) || 0
  const matched = requestIsMatched(asked, [input.committedAfterJoin])
  if (matched) {
    const updated = await client
      .from("buyer_requests")
      .update({ status: "matched" })
      .eq("id", input.buyerRequestId)
    if (updated.error) {
      return { ok: false, error: "L’offre est enregistrée, mais le regroupement n’a pas pu être clos." }
    }
  }
  return { ok: true, matched }
}
