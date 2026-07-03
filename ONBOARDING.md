# OxRound — Gym Onboarding & Migration Playbook

Use this document when signing a new gym. Reference before every onboarding call.

---

## Gym Data Typology Matrix

Before onboarding any gym, classify them:

| Type | Data State | Member Count | Effort | Approach |
|---|---|---|---|---|
| **A — Paper-only** | Paper sign-in, cash/e-transfer, WhatsApp for comms | < 50 | Low | Manual entry session with owner |
| **B — Spreadsheet** | Google Sheets or Excel member list, e-transfer tracking | 30–150 | Medium | CSV import with field mapping |
| **C — Partial CRM** | Basic tool (Glofox free, Google Forms) | 50–200 | Medium | Export + field mapping + manual cleanup |
| **D — Full CRM** | Mindbody, Wodify, PushPress (paying customer) | 100–300 | High | CRM API export + custom import script |
| **E — Hybrid chaos** | Members split across spreadsheet, WhatsApp, paper | Any | High | Discovery session → decompose into sub-types |

**G1 Boxing is Type A or B.** Most independent boxing gyms in Quebec are A or B. Build migration tooling for A and B first — Types C and D can be handled manually for the first 6 months.

---

## Pre-Integration Discovery (every new gym)

Conduct a 45-minute discovery session after they've signed up — this is customer success, not sales.

**Discovery questionnaire (14 questions):**

1. How many active members do you currently have?
2. How do you define "active"? (Paid this month? Trained in the last 30 days?)
3. Where is your current member list? (Phone contacts, spreadsheet, paper, memory)
4. What information do you have per member? (Name, phone, email, DOB, emergency contact, photo)
5. How do you currently track attendance?
6. How do you currently charge for membership? (Monthly, drop-in, punch cards, annual)
7. How do members pay you? (Cash, e-transfer, card via Square)
8. Do you have liability waivers for members? Where are they stored?
9. Do you have different membership types? Names and prices?
10. Do you have coaches other than yourself? What do they need to see?
11. How do you currently communicate with members? (WhatsApp group, Instagram, email)
12. Do you have a class schedule? Is it fixed or does it change week to week?
13. Do you track youth/minor members separately?
14. What does your typical week look like in terms of classes?

Document the answers → this becomes the gym's **onboarding brief** for data setup.

---

## Migration Playbooks

### Type A — Paper Only

**Timeline:** 1 session (2–3 hours with owner)

1. Sit with the owner (in person or video call with screen share).
2. Open OxRound CRM + owner's phone contacts or paper list side by side.
3. Create each member profile together, one by one. Ask for any missing data (email, DOB).
4. Set each member's membership plan, payment status ("has this person paid this month?"), and join date.
5. QR codes generate automatically on member creation.
6. Print QR card sheet for members who won't download the app immediately (see Member Activation below).
7. Create the class schedule.
8. Set up announcement channels.
9. Walk the owner through deactivating a membership to confirm QR invalidation flow is understood.

**Skip:** Historical attendance. Type A gyms have no records worth importing. Start fresh.  
**Do NOT:** Give the owner a spreadsheet template to fill themselves. Do it with them.

---

### Type B — Spreadsheet (Google Sheets / Excel)

**Timeline:** 1–2 hours pre-work (OxRound team) + 1-hour onboarding session

**Pre-work:**

1. Ask owner to share their spreadsheet.
2. Map columns to OxRound fields:

| Spreadsheet Column | OxRound Field |
|---|---|
| Name / Full Name | `profiles.first_name` + `profiles.last_name` |
| Phone / Cell | `profiles.phone` |
| Email | `auth.users.email` |
| Date of Birth / DOB | `profiles.date_of_birth` |
| Membership Type / Plan | `membership_plans.name` |
| Start Date | `memberships.start_date` |
| Paid / Status | `memberships.payment_status` |
| Emergency Contact | `gym_members.emergency_contact` |
| Notes | Initial `coach_notes.body` per member |

3. Clean the data: remove duplicates, fill blanks, normalize phone formats.
4. Run the CSV import script (see below).

**Import script spec (reuse for every Type B gym):**
```
Input:  CSV [first_name, last_name, email, phone, plan_name, payment_status, start_date]
Output: Creates auth.users (temp password → magic link on first login),
        profiles, gym_members, memberships rows per row
```

Until a CRM import UI exists (Phase 2), use a one-time Node.js script calling Supabase REST API.

**Historical attendance:** Import only if data is clean and consistently structured. Most gym spreadsheets have attendance as "X" marks in date columns — parseable but messy. Import only if owner specifically asks. Otherwise start fresh.

---

### Type C — Partial CRM (Glofox, Google Forms)

**Timeline:** 2–4 hours depending on data cleanliness

1. Export member list from current tool (most support CSV).
2. Map fields as in Type B.
3. Check for class booking history — import only if structured and complete.
4. Do NOT import billing history — OxRound payment tracking starts fresh.
5. If old tool has waivers, export as PDFs and store in Supabase Storage at `waivers/[gym_id]/[member_id]/waiver.pdf`.
6. Cancel old CRM subscription only after **2 weeks of parallel operation**.

**Critical:** Run both systems for 2 weeks before cutting over. This catches missed members and confirms QR system works.

---

### Type D — Full CRM (Mindbody, Wodify, PushPress)

**Timeline:** 1–2 weeks

1. Request data export (most offer CSV — Mindbody and Wodify have data portability options). Warn owner: some CRMs charge an export fee.
2. Map member profiles, membership history, payment records, attendance history.
3. Write a custom one-time import script per CRM (field naming differs between systems).
4. Import members in bulk. Skip class sessions and booking history unless owner specifically needs it.
5. Import payment history only if owner uses it for accounting (rare at boxing gym scale).
6. Run **4-week parallel period** before disconnecting old system.

**What you CANNOT import from Mindbody:**
- Stored payment methods (PCI compliance — card data cannot be transferred)
- Liability waivers signed in Mindbody (export as PDFs, store in Supabase Storage)
- Class booking history older than 1 year (not worth importing)

**Owner communication:** Mindbody gyms have members using the Mindbody app. Send a gym-wide announcement 2 weeks before cutover, 3 days before, and day-of. Expect 20–30% of members to need personal help.

---

### Type E — Hybrid Chaos

**Timeline:** 1-hour discovery first, then execute sub-types in parallel.

Discovery maps out where each member is. Typical finding: "My top 30 members I know by heart, another 20 are in my phone contacts, and I have a handwritten list of maybe 10 more." Treat top 30 as Type A, phone contacts as Type B (export via iPhone Contacts), written list as Type A again.

---

## Member App Activation Strategy

Getting members onto the app is the hardest part of deployment. Owners consistently overestimate how many will download unprompted.

**The problem:** Owner posts in WhatsApp group "please download our new app." ~30% download that day, 20% over the next 2 weeks, 50% never download. At 50% adoption, the QR check-in system is broken.

**The solution stack (in priority order):**

1. **QR card fallback** — Print individual QR code cards (credit card sized) for every member. Hand-deliver at the gym the week before launch. Members who don't download the app can still check in with the physical card. This removes app adoption as a Day 1 blocker.

2. **In-gym QR poster** — Post each member's name + QR code on a board inside the gym. Members scan from the board. Remove once app adoption hits 70%+.

3. **Class booking gating** — Class booking is only available in the app (no phone call or WhatsApp booking). This is the strongest adoption driver — if you want your Saturday sparring spot, you need the app. Implement in Month 2 after core flow is stable.

4. **Onboarding email sequence** — After owner adds a member, the magic link / invite email pre-explains: "Your gym now uses OxRound. Download the app to book classes, see your attendance, and get gym announcements." Deep link directly to App Store / Play Store.

5. **Check-in acknowledgment** — On first app check-in, member sees "Welcome to OxRound" message on the kiosk screen. Small, motivating.

6. **Owner-led in-person activation session** — Schedule a 30-minute "app day" at the gym (all members invited, 15 minutes before class). Walk members through download and first login. Converts 60–80% in one session.

---

## Kiosk Hardware Options

The check-in kiosk requires a tablet at the gym entrance. **Do not provide hardware during the pilot — validate the concept first.**

| Option | Cost (CAD) | Pros | Cons |
|---|---|---|---|
| Owner's existing iPad | $0 | No cost | May be old, competing apps, not dedicated |
| Amazon Fire HD 10 | $130–180 | Cheap, disposable | Lower camera quality for QR scanning |
| Wall-mounted Android kiosk | $150–200 | Purpose-built, locked-down | Setup complexity, sourcing |
| Refurbished iPad 9th gen | $250–350 | Controlled setup, Guided Access, mountable | Capital cost |

**Pilot approach:** Use owner's existing iPad or Android tablet. OxRound installs the app, configures Guided Access (iOS) or kiosk mode (Android), mounts with a cheap wall mount (~$30 Amazon).

**Scale approach (Phase 2+):** Offer optional hardware + setup add-on at $299 one-time (iPad mini, wall mount, power supply, OxRound setup).

---

## Ongoing Integration Touchpoints

**E-Transfer payment recording:** Owners get Interac e-transfer notifications via banking app or email. They need to mark corresponding members as paid without app-switching. CRM needs a daily flow: "Mark payments received today" → shows members with upcoming or overdue billing → one-tap to mark paid with amount and method. This is a UI design problem, not an API integration.

**WhatsApp group migration:** Owners will run both OxRound and WhatsApp in parallel for 2–4 months. Do not try to kill the WhatsApp group. Let it die naturally as OxRound's announcement system becomes objectively better (richer media, read receipts, pinned posts). Design for co-existence.

**Instagram integration (Phase 3):** Many boxing gyms post fight announcements and event promos on Instagram. OxRound could ingest Instagram posts via Instagram Basic Display API as announcements. Low-effort, high-value aggregation for Phase 3.
