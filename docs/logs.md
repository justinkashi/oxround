July 7 

- would be nice to organize a way to implement multiple features in different tasks/chats of codex/claude in parallel because it is "dangerous" to run different tasks as they may modify the same file, so how would I address this, different branches of github ? i want different chats because sequentially implementing tasks will use up the context and usage very fast as I noticed on claude and codex both.

 July 5

* adding glofit as competitors in the list
* Whats the status of QR codes
* 

July 3

- should have a bilingual version for montreal french
- Scaling to yoga studios, pilates, dance, partnerships with classpass,

July 2

- we need to demonstrate how important user loss is with numbers show thats something unlocked thorugh our dahsboards and analytics
- Boxing knowers: abel, demetre, gym next to circulus talk to dave about the owners,
- Eli for marketing integration.
- theres alot of open source CRMs just adapt their codes/features the best ones for boxing
- we need to get to know the owners and their style and vibe, we can make precision themes, theres gemini people claude people chatgpt people, so people have different tastes, some might like apple or the notion style CRM, some not. Do we make it a boxing themed one the CRM? This capturing of the messy niche the boxing gym owners market the effectiveness in SaaS is that the niche has one unified taste but that is not true, just like how the consumer is more selective.
- Could even have a photoshoot a whole thing like a haircut or a professional headshot to get them on board and make the theme of the CRM
- Justin: include a creative and warm human aspect: on start have like a door opening like the bellum tft map like the demon slayer all the japanese doors opening in a certain way but its photos of the gym owner/ restaurant owner so it gives the human touch and power to the owner and ownership instead of bland generic tech. Also give it some apple themes for impression
- .

Feartures to work on:

**Data and setup**

* Migrate/enter member records, active memberships, attendance history, notes, waivers
* Rebuild membership structures: recurring plans, class packs, drop-ins, punch cards, family memberships, trials, intro offers
* Configure class schedules, capacity limits, waitlists, no-show fees
* Data cleaning: dedupe, fix invalid emails, decide what not to migrate
* Boxing-specific config: rank/level progression tracking (e.g., classes, hours, attendance, or skills-based promotion criteria)

**Operations**

* Front-desk workflows: sign-ups, check-ins, freezes, upgrades, cancellations
* Digital waivers and contracts
* Access control/door integration if the gym has keyed entry
* POS/retail if they sell gear or supplements

**People**

* Staff training — core functions learnable within a day is the adoption benchmark
* Go-live support and parallel running of old and new systems
* Member-facing transition: app installs, booking flow, self-service account management

**Growth/retention layer**

* Lead capture and automated follow-up (website forms, nurture sequences)
* Automated comms: email/SMS reminders, renewals, waitlist notifications
* At-risk member detection from attendance drops and retention workflows
* Reporting: revenue, churn, attendance, expiring memberships

**Ongoing**

* Permanent support channel — support responsiveness is a top selection criterion for small studios with no ops team
* Post-launch optimization: refining workflows based on usage, feature requests per gym
* Monthly review of ops metrics with the owner (renewal rate, attendance trends)

4 main features MVP must have:

- scan to enter (every member has their own unique QR code)
- Logs (scanned at 3pm wednesdays so records activity)
- Interconnected (owner must be able to deactivate membership if not paid)
- community (somewhere the owner can post notes and pictures about holidays, when the gym is closed, fight announcements, event/run announcements, etc.)
- We want to be (1) specific to boxing for now so what other fitness CRMs do not offer that boxing owners need (2) as strong as them but affordable.
- Early demo Links: [g1boxing-gym.netlify.app](https://g1boxing-gym.netlify.app/)
- First customer: [g1boxing.ca](https://g1boxing.ca/)
- 

---

Amir features list:

something 20 gyms will happily pay for.

⸻

🥊 OxRound MVP Report

Version 1.0 (First Paying Customers)

Philosophy

The MVP should solve one problem exceptionally well:

“Run my gym digitally while giving members an app they’ll actually use.”

Everything else (social features, AI coaching, nutrition, community, leaderboards, etc.) can come later.

⸻

Member App MVP

1. Authentication

Login
Register
Forgot password
Join gym via invite code

⸻

2. Dashboard

When members open the app they immediately see:

Today’s classes
Upcoming bookings
Membership status
Coach announcements

⸻

3. Class Schedule

Core feature.

Members can

Browse schedule
Filter by coach
Filter by class type
View available spots
Book class
Cancel booking
Join waitlist

⸻

4. Attendance

Simple check-in.

Either

QR Code
Coach checks attendance

Members can view

Classes attended
Attendance history

⸻

5. Membership

Display

Membership type
Renewal date
Active / Frozen / Expired

Eventually payment can be added later.

⸻

6. Notifications

Push notifications for

Booking confirmed
Class cancelled
Waitlist opened
Gym announcement

⸻

7. Coach Profiles

Each coach has

Photo
Bio
Classes
Experience

Nothing more.

⸻

8. Basic Profile

Name
Picture
Phone
Email
Emergency contact

⸻

Gym CRM MVP

This is actually the product you’re selling.

⸻

Dashboard

Owner logs in and sees

Today’s classes
Today’s attendance
Active members
Expiring memberships
Revenue this month (optional)

⸻

Member Management

Must have

Create member

Edit member

Suspend member

Delete member

Search member

View attendance

View payments

View notes

Membership status

Emergency contact

Medical notes

⸻

Coach Management

Add coach

Remove coach

Permissions

Schedule coach

Coach profile

⸻

Class Management

Create class

Edit class

Delete class

Recurring classes

Capacity

Waitlist

Attendance

Coach assignment

⸻

Membership Management

Create memberships

Monthly

Annual

Drop-in

Punch card

Assign memberships

Freeze memberships

Renew memberships

Expire memberships

⸻

Booking System

Owner sees

Booked members

Waitlist

Remaining spots

Attendance

Late cancellations

⸻

Payments (Basic)

Don’t build Stripe first.

Just allow owners to track

Paid

Pending

Cash

E-transfer

Card

Invoice history

Later:

Stripe

Square

Moneris

⸻

Announcements

Send push notification

Send announcement

Email members

⸻

Reports

Simple reports only

Members

Attendance

Revenue

Popular classes

Coach attendance

Membership renewals

⸻

Settings

Gym logo

Gym information

Opening hours

Membership types

Class colors

Cancellation policy

⸻

Permissions

Owner

Manager

Coach

Receptionist

Different access levels.

⸻

Nice-to-have (Still MVP if easy)

QR Check-in
Digital waiver
Injury notes
Birthday reminders
Export CSV

⸻

NOT MVP (Version 2+)

❌ Community feed

❌ AI Coach

❌ Workout builder

❌ Nutrition

❌ Boxing combinations

❌ Video library

❌ Sparring tracker

❌ Belt ranking

❌ Personal messaging

❌ Marketplace

❌ Equipment store

❌ Mobile payments

❌ Apple Health integration

❌ Wearables

❌ Multi-gym support

❌ AI scheduling

⸻

Phase 2 (20–50 Gyms)

Once you’ve proven demand:

Member App

Workout plans
Skill progression
Belt/level tracking
Personal training bookings
In-app payments
Event registration
Push reminders
Referral program

CRM

Stripe integration
Staff payroll support
Advanced reporting
Lead management
Trial member pipeline
Automated emails/SMS
Multi-location support

⸻

Phase 3 (100+ Gyms)

This is where OxRound becomes much bigger than a CRM.

Member Experience

Boxing training library
MMA training library
Strength & conditioning programs
Nutrition plans
AI boxing coach
AI training recommendations
Community feed
Challenges
Rankings
Gym discovery
Cross-gym memberships
Tournaments
Merchandise
Video analysis
Wearables integration

⸻

🎯 My recommendation

If your goal is to sign your first 20 gyms, I’d keep the first release laser-focused:

App (8 core features)

✅ Authentication
✅ Dashboard
✅ Class schedule
✅ Booking
✅ Attendance
✅ Membership status
✅ Notifications
✅ Profile

CRM (10 core modules)

✅ Dashboard
✅ Member management
✅ Coach management
✅ Class management
✅ Membership management
✅ Booking management
✅ Attendance
✅ Basic payment tracking
✅ Announcements
✅ Reports & settings

This gives you a product that feels complete while staying realistic to build. Everything else can become part of the roadmap that investors and gym owners get excited about after you’ve validated the core business.
