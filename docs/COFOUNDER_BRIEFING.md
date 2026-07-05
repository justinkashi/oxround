# OxRound — co-founder briefing & demo script

*For the first walkthrough with your co-founder (sales, non-technical). ~20 min: 5 story, 10 demo, 5 what's next.*

---

## The one-liner

OxRound is a gym operating system for boxing gyms: the owner runs the whole gym from one web dashboard (members, payments, classes, attendance), and members get a phone app with their check-in QR, the schedule, and gym announcements. First customer target: G1 Boxing.

## Where we are (honest status, July 2026)

- **The owner dashboard (CRM) is fully built and live on the internet** — every screen clickable, running on realistic sample data. This is what you demo.
- **Real login and a real database are built and deployed** — the moment we buy the domain (~$15/yr, this week), we can hand the G1 owner a login and he can start entering his real gym. Days away, not months.
- **The member phone app is designed but not built** — there's a working preview of it inside the demo. Building the real iPhone/Android app is the next stage (~1–2 months) and is deliberately after G1 commits, so we build it with a real gym using it.
- **Cost so far: $0/month.** Everything runs on free tiers until G1 pays us; then it's ~$55/month of infrastructure. The only money spent is the domain.

## Demo script (the app is the pitch — click in this order)

Open the live URL (or localhost:3000 — same thing). The data is fake but the app is real.

1. **Dashboard** — point at the amber box: *"It watches attendance and flags members who are fading before they cancel. Dave trained 8×last month, 0×this month — the owner finds out now, not when the e-transfer stops. This is the retention pitch."*
2. **Attendance** — *"Same idea in numbers: busiest days, per-member trends, and this red figure — dollars per month at risk from fading members."*
3. **Members** — *"The whole member book: search, plans, who's paid, who's overdue. Click one → full profile, check-in history, payment status buttons."*
4. **Classes** — *"Weekly schedule. Click a class → the roster: who's booked, waitlist, mark no-shows. Capacity fills → auto-waitlist."*
5. **Payments** — *"G1 runs on cash and e-transfer. Owner records a payment in 5 seconds, member flips to 'paid', monthly total updates. No Stripe fees, works with how Quebec gyms actually operate."*
6. **Leads** — *"Every DM and walk-in goes on this board — New → Contacted → Trial → Converted. Nothing falls through the cracks. This is the growth pitch."*
7. **Announcements** — *"Replaces the WhatsApp chaos: closures, fight nights, pinned posts, read counts."*
8. **📱 Member app preview** (sidebar) — the closer: *"This is what members get."* Let the doors-splash play. Book a class, show the QR. *"Member scans this at the door — that scan is what feeds every number you just saw."*
9. Pull the same URL up **on your phone** — it works there too.

## How the tech works (the 60-second version, no jargon)

Three pieces. **The app** (all the screens) lives on a service called Vercel — every time we improve the code, the live site updates itself within 2 minutes. **The data** (members, payments) lives in a professional database in **Montreal** — that matters because Quebec's privacy law (Law 25) wants member data kept in Canada, and "your members' data never leaves Quebec" is a selling point against the US competitors. **The code** lives in GitHub — nothing is on anyone's laptop; nothing is lost if a computer dies.

Login has no passwords: the owner types his email, gets a sign-in link, clicks it. Nothing to forget, nothing to leak. Each gym can only ever see its own data — that isolation is enforced by the database itself, not by trust.

## What's left before G1 uses it for real (days)

1. Buy the domain → emails can reach the owner
2. Flip three settings (done in an afternoon)
3. Send the owner his login, sit with him for 2–3 h entering his real members, print QR cards

Then: member app (1–2 months), app stores, kiosk tablet at the front desk.

## What we need from the sales side

- Book the G1 meeting — the demo is ready today
- The pricing conversation (what does G1 pay, when does paying start — pilot free? month 1?)
- The no-show-fee question: does G1 even charge no-shows? (a feature decision waits on this)
- Feature feedback loop: what he asks for in the meeting shapes the next month of building
