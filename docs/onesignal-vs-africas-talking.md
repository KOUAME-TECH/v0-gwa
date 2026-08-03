# Notifications : OneSignal ≠ Africa’s Talking

**Ils ne font pas la même chose.** Deux canaux distincts, souvent confondus.

| | **Africa’s Talking** | **OneSignal** |
|--|----------------------|---------------|
| **Canal** | SMS | Push navigateur / PWA (et plus tard app native) |
| **Usage GWA** | OTP connexion / inscription (`/api/auth/send-otp`) | Alertes commande, séquestre, digest Harmattan |
| **Moment** | Avant / pendant login | Après login, app installée ou navigateur autorisé |
| **Secret ops** | `AT_USERNAME`, `AT_API_KEY`, **`AT_SENDER_ID`** | `NEXT_PUBLIC_ONESIGNAL_APP_ID`, REST API key |
| **Health** | `sms_delivery_ready` | `onesignal` dans `/api/health` |
| **Docs** | [`ops-auth.md`](./ops-auth.md) | [`ops-notifications.md`](./ops-notifications.md) |

```text
Utilisateur
  │
  ├─ SMS OTP ──────────► Africa’s Talking  (entrer dans le compte)
  │
  └─ Push in-app ──────► OneSignal         (être rappelé d’une commande)
```

## Pourquoi les deux ?

- **SMS** : tout le monde en CI a un téléphone ; obligatoire pour auth sans email fiable.
- **Push** : gratuit côté volume, instantané une fois le permissionnaire OK ; **ne remplace pas** l’OTP.

Ne pas désactiver l’un en croyant que l’autre « fait déjà le job ».

## Checklist ops (sans se tromper)

1. OTP qui n’arrive pas → Africa’s Talking / Sender ID (`ops-auth.md`), **pas** OneSignal.
2. Pas de notification commande → OneSignal workers + permission navigateur (`ops-notifications.md`), **pas** AT.
3. `/api/health` : regarder `sms_delivery_ready` **et** OneSignal séparément.
