# SMS Africa’s Talking — vérification Sender ID (28 juil. 2026)

## État prod (`/api/health`)

| Flag | Valeur observée | Signification |
|------|-----------------|---------------|
| `SMS_AT` | **true** | Clé AT présente |
| `SMS_AT_USERNAME_LIVE` | **true** | Username live (pas sandbox) |
| `SMS_AT_SENDER_ID` | **false** | Variable Sender ID **absente** sur Vercel |
| `sms_delivery_ready` | **false** | Bloqué tant que Sender ID manquant |

OTP peut quand même arriver selon le pays / la config AT (parfois shortcode par défaut). Health reste **rouge** sans `AT_SENDER_ID`.

## À coller sur Vercel (Production + Preview)

| Name | Value | Notes |
|------|--------|------|
| `AT_SENDER_ID` | *(ton Sender ID approuvé, ex. `GWA`)* | **Nom recommandé** |
| `SMS_AT_SENDER_ID` | *(même valeur)* | Alias aussi accepté par le code |

Aliases reconnus par le code : `AT_SENDER_ID`, `SMS_AT_SENDER_ID`, `AFRICASTALKING_FROM`, `AFRICASTALKING_SENDER_ID`.

Après ajout → **Redeploy** → `/api/health` doit afficher :
- `SMS_AT_SENDER_ID: true`
- `sms_delivery_ready: true`

## Check-list ops

1. Sender ID **approuvé** pour la Côte d’Ivoire dans le dashboard Africa’s Talking.  
2. Username live (déjà OK).  
3. Variable Vercel renseignée (ci-dessus).  
4. Test OTP réel sur un numéro CI.
