// GWA Platform — Supabase Edge Function : auto-release-escrow
// Cron : toutes les heures via Supabase pg_cron ou webhook externe
// Libère automatiquement l'escrow 72h après livraison sans litige

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Sécurité : cette fonction ne doit être appelée que par le service role
  const authHeader = req.headers.get('Authorization')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(
      JSON.stringify({ error: 'Non autorisé' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
      { auth: { persistSession: false } }
    )

    // Trouver toutes les commandes livrées sans confirmation depuis 72h
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, seller_id, buyer_id, vendeur_recoit_fcfa, order_number')
      .eq('order_status', 'livre')
      .eq('escrow_status', 'held')
      .is('confirmed_by_buyer_at', null)
      .lt('delivered_at', cutoff)

    if (error) throw error

    const results = []

    for (const order of (orders || [])) {
      // Libérer l'escrow
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          escrow_status: 'released',
          confirmed_by_buyer_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (updateErr) {
        results.push({ order_id: order.id, success: false, error: updateErr.message })
        continue
      }

      // Libérer les escrow_transactions
      await supabase
        .from('escrow_transactions')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
        })
        .eq('order_id', order.id)
        .eq('status', 'held')

      // Notifier le vendeur
      await supabase.from('notifications').insert({
        user_id: order.seller_id,
        type: 'payment',
        title: 'Paiement libéré automatiquement',
        message: `Votre paiement de ${new Intl.NumberFormat('fr-FR').format(order.vendeur_recoit_fcfa || 0)} FCFA pour la commande ${order.order_number} a été libéré (72h sans litige).`,
        body: `Commande ${order.order_number} — montant libéré.`,
        data: { order_id: order.id, type: 'escrow_auto_released' },
        read: false,
      })

      // Notifier l'acheteur
      await supabase.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'order_status',
        title: 'Commande finalisée',
        message: `Votre commande ${order.order_number} a été finalisée automatiquement après 72h.`,
        body: `Commande ${order.order_number} finalisée.`,
        data: { order_id: order.id, type: 'order_auto_finalized' },
        read: false,
      })

      // Déclencher recalcul SCG du vendeur
      await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/calculate-scg`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            profile_id: order.seller_id,
            trigger_event: 'order_delivered',
            order_id: order.id,
          }),
        }
      )

      results.push({ order_id: order.id, success: true })
    }

    return new Response(
      JSON.stringify({
        released_count: results.filter(r => r.success).length,
        errors_count:   results.filter(r => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[auto-release-escrow] Error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
