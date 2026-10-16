# Gmail sign-in codes

SERVIO uses Gmail SMTP to deliver six-digit email codes. The owner supplies the credentials locally; they are never entered in the app or committed. Payments continue to use the mock escrow provider.

## Configure the sender

1. Use a mailbox dedicated to SERVIO. Enable Google 2-Step Verification, then create an [App Password](https://support.google.com/mail/answer/185833?hl=en) named **SERVIO API**. Use that App Password, not the mailbox's regular password. Some managed accounts and Advanced Protection settings do not offer App Passwords.
2. Edit the existing ignored `servio-api/.env` on the Mac running the API. Set these values without sharing the file:

   | Setting | Value |
   | --- | --- |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | The full Gmail sender address |
   | `SMTP_PASSWORD` | Its App Password, without display grouping spaces |
   | `MAIL_FROM` | The same address as `SMTP_USER` |
   | `MAIL_FROM_NAME` | `SERVIO` |

   This client uses implicit TLS on port 465, as supported by [Google's SMTP settings](https://support.google.com/a/answer/176600?hl=en). It does not implement STARTTLS on port 587. Keep the sender address the same as the authenticated mailbox unless a Gmail sending alias has been configured and verified separately.
3. Restart the local API so Wrangler reloads the values. The phones connect to this API over the configured LAN URL; they do not need SMTP credentials. Leave `ENVIRONMENT=development` for local work.

Never paste credentials into chat, screenshots, source files or browser settings. Changing the Google account password revokes its App Passwords; create and configure a replacement if that happens. No cloud resources are created by these steps.

## Verify a real account

1. Open SERVIO in API mode and sign out of any demo account. Use an inbox you own and can receive mail at, with an address that is not a seeded demo account.
2. Request a code once. Check the inbox and spam folder for the message from **SERVIO**. When delivery succeeds, the app does not show the development-log notice. The six-digit code is not returned by the API.
3. Enter the newest code within ten minutes. A new address creates a real customer account after successful verification; an existing address opens its existing account. Finish the name and optional phone profile step.
4. Sign out and request a new code. Confirm the same profile opens. The previous code must fail after use; requesting a replacement invalidates earlier codes. Five wrong attempts exhaust that code.
5. Edit the profile, reload, and confirm the changes persist. Booking and wallet activity still represent simulated payments; configuring email does not enable real payment collection.

The configured `DEMO_LOGIN_CODE` remains restricted to existing `is_demo` accounts outside production. It cannot create an ordinary account. Those demo accounts intentionally skip real mail delivery when that setting is enabled.

## Delivery errors

- **Development-log notice:** `SMTP_USER` or `SMTP_PASSWORD` is missing. The local API writes the code to its private development log. It does not email it.
- **Email could not be sent:** check the App Password, authenticated sender, network access to port 465, and Google account restrictions. SMTP operations time out after 15 seconds and close the connection. A failed delivery invalidates that code; request another after correcting the settings.
- **Too many codes:** use the newest message or wait for the per-address hourly quota to reset. Repeated sign-in attempts also have a short rate limit.
- **Production without credentials:** email requests fail closed; codes are never printed as a production fallback. Future deployment must use dedicated SERVIO Worker secrets instead of committing `.env`.

The automated suite uses fake SMTP connections and the local test database, and never sends email. Actual Gmail delivery remains an owner verification step after local credentials are configured. The sender footer deliberately remains **Business address to follow — prototype** until the owner supplies the business address.
