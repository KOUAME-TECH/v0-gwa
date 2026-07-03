// GWA Platform — Supabase Edge Function : send-notification
// Envoie push (OneSignal) + SMS fallback (Africa's Talking)
// Appelé par les API routes après chaque événement métier

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  user_id: string
  title: string
  body: string
  type: string
  data?: Record<string, unknown>
  force_sms?: boolean // forcer SMS même si push token présent
}

async function sendOneSignalPush(
  playerIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<boolean> {
  const apiKey  = Deno.env.get('ONESIGNAL_REST_API_KEY')
  const appId   = Deno.env.get('ONESIGNAL_APP_ID')

  if (!apiKey || !appId) {
    console.warn('[send-notification] OneSignal non configuré — ONESIGNAL_REST_API_KEY ou ONESIGNAL_APP_ID manquant')
    return false
  }

  if (playerIds.length === 0) return false

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: appId,
      include_player_ids: playerIds,
      headings: { fr: title, en: title },
      contents: { fr: body, en: body },
      data,
      android_channel_id: 'gwa_default',
      priority: 10,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('[send-notification] OneSignal error:', err)
    return false
  }
  return true
}

async function sendAfricasTalkingSMS(
  phone: string,
  message: string
): Promise<boolean> {
  const username = Deno.env.get('AFRICASTALKING_USERNAME')
  const apiKey   = Deno.env.get('AFRICASTALKING_API_KEY')

  if (!username || !apiKey) {
    console.error('[send-notification] Africa\'s Talking non configuré — clés manquantes. Ajoutez AFRICASTALKING_USERNAME et AFRICASTALKING_API_KEY.')
    return false
  }

  // Normaliser le numéro CI au format international
  const normalized = phone.replace(/^0/, '+225')

  const params = new URLSearchParams({
    username,
    to: normalized,
    message: message.substring(0, 160), // SMS standard 160 chars
    from: 'GWA',
  })

  const response = await fetch(
    'https://api.africastalking.com/version1/messaging',
    {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('[send-notification] Africa\'s Talking error:', err)
    return false
  }

  const result = await response.json()
  const recipient = result?.SMSMessageData?.Recipients?.[0]
  if (recipient?.status !== 'Success') {
    console.error('[send-notification] SMS non livré:', recipient)
    return false
  }
  return true
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
      { auth: { persistSession: false } }
    )

    const payload: NotificationPayload = await req.json()
    const { user_id, title, body, type, data = {}, force_sms = false } = payload

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'user_id, title et body sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sauvegarder la notification en base
    await supabase.from('notifications').insert({
      user_id,
      type,
      title,
      message: body,
      body,
      data,
      read: false,
    })

    // Récupérer les push tokens OneSignal
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('player_id')
      .eq('user_id', user_id)

    const playerIds = (tokens || []).map((t: { player_id: string }) => t.player_id)
    let pushSent = false
    let smsSent = false

    // Tentative push OneSignal
    if (playerIds.length > 0) {
      pushSent = await sendOneSignalPush(playerIds, title, body, { ...data, type })
    }

    // SMS fallback si pas de push token OU force_sms OU push échoué
    if (!pushSent || force_sms) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user_id)
        .single()

      if (profile?.phone) {
        const smsText = `GWA - ${title}: ${body}`
        smsSent = await sendAfricasTalkingSMS(profile.phone, smsText)
      }
    }

    return new Response(
      JSON.stringify({ success: true, push_sent: pushSent, sms_sent: smsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[send-notification] Error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
