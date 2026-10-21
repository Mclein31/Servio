// legal policy text
export interface PolicySection { heading: string; paragraphs: string[] }
export interface Policy { title: string; updated: string; intro: string; sections: PolicySection[] }

export const POLICIES: Record<string, Policy> = {
  terms: {
    title: 'Terms of Use',
    updated: 'October 21, 2026',
    intro: 'SERVIO connects people in Tuguegarao City with verified neighbors who offer services at fixed catalog prices. By creating an account or booking a service you agree to these terms.',
    sections: [
      { heading: 'Pilot status', paragraphs: ['SERVIO is in a pilot. Payments, escrow holds, tips and payouts are currently simulated, so no real money is charged or transferred. We will tell you before real payments are switched on.'] },
      { heading: 'Your account', paragraphs: ['You sign in with a 6-digit code sent to your email. Codes expire after 10 minutes and a limited number may be requested per hour. Keep your email secure and do not share sign-in codes.', 'Give accurate details, keep one account per person and keep your phone number current so your booking partner can reach you.'] },
      { heading: 'Bookings', paragraphs: ['Services are booked from the catalog at the listed price plus a ₱50 trust fee per booking. Extra parts or labor are added only through an add-on request that you approve in the app.', 'You cannot book yourself or accept your own request. Keep booking communication and payment inside SERVIO so escrow protection applies.'] },
      { heading: 'SERVIO Pros', paragraphs: ['Only approved Pros receive jobs. A Pro chooses when to go online, must complete accepted jobs as described and may only release payment with the customer’s completion PIN.'] },
      { heading: 'Reviews and tips', paragraphs: ['Customers may leave one review per completed booking. Reviews must be honest and about the service. Tips are optional and go entirely to the Pro.'] },
      { heading: 'Not allowed', paragraphs: ['Harassment, discrimination, unsafe work, fraud, fake reviews, asking for off-app payment, or misusing another person’s information. We may suspend or close accounts that break these rules.'] },
      { heading: 'Help and disputes', paragraphs: ['Report a problem from Help & Community Safety. Disputes about work that has started are reviewed by SERVIO support before any money moves.'] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'October 21, 2026',
    intro: 'This explains what SERVIO collects, why, and who can see it.',
    sections: [
      { heading: 'What we collect', paragraphs: ['Your email, name, phone number and profile photo; saved addresses and their map pins; bookings, chat messages, add-on and job photos, reviews and tips; your preferred payment method; support reports; and the notifications we send you.', 'We never ask for or store your GCash PIN, card number or other payment credentials.'] },
      { heading: 'Location', paragraphs: ['Customers set a map pin for each service address. To fill in the street name we send the pin through our server to OpenStreetMap’s address lookup.', 'Pros share a location fix when they go online, so nearby jobs can be offered, and share live location while traveling to a customer. That live location is visible only to the customer on that booking. Location is used only while the app is open.'] },
      { heading: 'Who can see your information', paragraphs: ['Your booking partner sees your name, photo, the service address and, during an active booking, your phone number so they can call you. Only the two people on a booking can read its chat and photos.', 'Approved Pros appear in the directory with their name, photo, service, rating and price. Bulletin requests show the request details to nearby users. ID documents uploaded for Pro approval are visible only to you and authorized SERVIO staff.'] },
      { heading: 'Device permissions', paragraphs: ['Location (addresses and trips), camera and photos (profile, job and add-on photos) and notifications (alerts on your phone). Notifications are shown by the app itself; no third-party push service receives your data. You can turn permissions off in your phone settings.'] },
      { heading: 'Storage and security', paragraphs: ['Data is stored with Cloudflare and Neon. Photos are fetched through short-lived signed links. Sign-in sessions last up to 30 days and can be ended by signing out. Sign-in codes are delivered by email.'] },
      { heading: 'Keeping and deleting data', paragraphs: ['You can edit your profile and delete saved addresses at any time. To close your account, contact support from Help. Booking, payment and ledger records are kept for disputes and accounting even after an account is closed.'] },
    ],
  },
  escrow: {
    title: 'Escrow Protection Policy',
    updated: 'October 21, 2026',
    intro: 'Escrow protects both sides: the customer’s money is held, not paid, until the job is done, and the Pro knows the money is there before starting. During the pilot all holds and payouts are simulated.',
    sections: [
      { heading: 'How a payment is held', paragraphs: ['At checkout the service price plus the ₱50 trust fee is held in escrow. Add-ons are added to the hold only after the customer approves them in the app.'] },
      { heading: 'Releasing payment', paragraphs: ['When the work is finished the customer gives the Pro their 4-digit completion PIN. The payment is released only when the Pro enters the correct PIN. After 5 wrong attempts completion is locked until support reviews it.', 'On release the Pro receives 85% of the service and approved add-ons. SERVIO keeps 15% and the trust fee.'] },
      { heading: 'Cancellations', paragraphs: ['Customer cancels before the Pro leaves: full refund.', 'Customer cancels while the Pro is on the way: ₱100 goes to the Pro and the rest is refunded. After the Pro arrives: ₱200 goes to the Pro and the rest is refunded. These fees go entirely to the Pro.', 'Once work has started the booking cannot be cancelled in the app; contact support to open a dispute.', 'If the Pro cancels at any point, the customer is refunded in full.'] },
      { heading: 'Late or no-show Pros', paragraphs: ['An on-demand booking still waiting for the Pro to leave after 15 minutes can be cancelled for free. If the Pro has not arrived 30 minutes after the expected arrival time (or after the end of a scheduled window), the customer can cancel for a full refund.'] },
      { heading: 'Tips and Pro payouts', paragraphs: ['Tips are paid to the Pro in full and never pass through escrow.', 'Released earnings appear in the Pro wallet. Pros can cash out to GCash from ₱500, with a ₱15 transfer fee. Money still in escrow cannot be cashed out.'] },
    ],
  },
};
