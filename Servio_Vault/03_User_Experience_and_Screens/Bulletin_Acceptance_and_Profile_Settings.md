# Bulletin acceptance and Profile settings

Updated 2026-10-18. See ADR-032 and ADR-033 in `.brain/DECISIONS.md`.

## Bulletin request lifecycle

A Bulletin card is a customer's fixed-catalog request, not a provider advertisement. Tapping opens request details. A Pro in active Pro mode must have stored APPROVED status and offer the exact active SKU to accept another person's request. Acceptance reserves the Pro and displays **Awaiting customer confirmation**. It does not authorize payment or reveal the customer's precise address.

The author returns to Bulletin and selects **Confirm & book Pro**, confirms their own saved pinned address, schedule and payment at checkout, and explicitly authorizes the existing simulated hold. Only then does the active booking exist. The Pro opens that booking to begin the standard job lifecycle. Before confirmation, either participant may release the reservation; after confirmation, cancellation uses the booking's existing rules. Multiple Pros and repeated checkout attempts cannot reserve or authorize the same request twice.

Request details must finish dismissing before navigation so the dialog cannot cover checkout. Pending reservations remain accessible to participants beyond the public feed's newest-100 results. The page refreshes while visible; Pro lookup uses its exact ID.

## Profile settings

**My Services** shows saved offered catalog SKUs for an active Pro. **Change Service Category** initializes from those saved SKUs and updates the display after saving. Failed saves retain the category dialog.

**Payment Methods** saves a GCASH/CARD preference to the account and uses it at checkout, preserving any later choice made within that checkout. Both methods are simulated; no card details, GCash credentials or real charges are involved.

**Help & Community Safety** contains service-booking and acceptance FAQs, basic community safety guidance, policy links, and a working problem-report form. Submitted reports persist under the account and show a reference and review status. Staff can review through restricted API endpoints; no support inbox UI, automatic reply or response-time commitment is present. The form is not an emergency channel.

## Verification

186 database-backed/backend tests and 77 client tests pass. API-backed browser checks exercised card acceptance, customer checkout into Tracking, category saving with real service display, payment preference saving, and report submission. Production migrations and Worker deployment completed; authenticated production smoke checks covered category persistence, preference persistence, support submission/listing and request acceptance/release using temporary test records removed after verification. No production booking/hold was created during smoke checks. Physical phones must rebuild/install the updated client.

## Owner controls and measured distances — 2026-10-18

Discovery offers **Use my location**. Already-granted permission can refresh GPS in the background, but GPS and photos never block initial browsing. Measured distances use a recent device fix and recent provider position, labeled as approximate straight-line distances. Missing/stale data shows unavailable rather than a fabricated number; an own-provider card shows Your profile. The city map center is not presented as the user's location.

Bulletin now includes **My requests**. The author can cancel an unbooked open/urgent or reserved post; other users no longer see it. A confirmed booking must be cancelled using its booking controls and existing money rules. Cancellation preserves the record under My requests. **My Services → Remove** withdraws a single SKU listing; existing jobs remain accessible and any unbooked reservation for the withdrawn service reopens. **Manage** can assign available catalog services again.
