// Edge Function Supabase : libération escrow automatique 72h après livraison
// Cron : toutes les heures via Supabase Dashboard > Edge Functions > Cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const limit72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, seller_id, vendeur_recoit_fcfa, total_amount')
    .eq('status', 'livre')
    .eq('escrow_status', 'held')
    .lt('confirmed_by_buyer_at', limit72h)

  if (error) {
    console.error('[auto-release] query error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let released = 0
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? ''

  for (const order of orders ?? []) {
    try {
      const res = await fetch(`${appUrl}/api/orders/${order.id}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': Deno.env.get('INTERNAL_API_TOKEN') ?? '',
        },
      })
      if (res.ok) {
        released++
        console.log(`[auto-release] Released order ${order.order_number}`)
      }
    } catch (e) {
      console.error(`[auto-release] Failed for order ${order.id}:`, e)
    }
  }

  return new Response(JSON.stringify({ released, total_checked: orders?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
