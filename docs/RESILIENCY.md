VERSION 2.0 OF THE APP PROMPTS

"Run a full audit on our Supabase database schema. Enforce strict foreign key constraints, strict column data types, and default values. Ensure that if the frontend accidentally sends malformed, null, or duplicate data, Supabase will instantly reject it and throw a handled error."

"From now on, we are using Test-Driven Development (TDD). Before you write or modify any feature, write a Playwright end-to-end test for it. Run the test suite automatically after every change. If any test fails, automatically roll back your code change."

"We need to eliminate race conditions and double-submits. Review our core CRM components (forms, pipelines, logins). Implement a strict state pattern for each. Disable all submit buttons automatically the moment a user clicks them, and do not re-enable them until Supabase responds."

Create a standardized, reusable `DestructiveActionModal` component across the entire CRM codebase. 
1. Any button that deletes, overwrites, or clears data must be routed through this modal. 
2. For high-impact deletions (like deleting a company or pipeline), the modal must force the user to explicitly type the name of the item (e.g., type 'DELETE') to unlock the red submission button.
3. At the database level in Supabase, ensure we implement "Soft Deletes" (adding a `deleted_at` timestamp column) instead of hard-deleting rows, so data can always be recovered if an edge case bypasses the frontend.


Review all components that display large lists of data (such as contact directories or activity logs). 
1. Strictly ban the loading of entire database tables into browser memory at once. 
2. Implement strict server-side pagination or cursor-based infinite scrolling, fetching a maximum of 50 records at a time from Supabase.
3. Implement a "virtualized list" component (using a library or clean logic) so the browser only renders the visual elements currently visible on the screen, instantly destroying off-screen elements to prevent memory leaks and tab crashes.

Audit how our CRM updates data visually (like moving a deal from 'Lead' to 'Contacted'). If we are using Optimistic UI updates to make the app feel fast, we must build a strict Rollback Engine:
1. Before updating the frontend state to reflect a user's action, clone a snapshot of the current, pristine data state in memory.
2. Send the request to Supabase. If Supabase returns an error or times out, instantly roll the frontend UI back to the exact snapshot state.
3. Fire a toast notification informing the user: "Changes could not be saved to the server. Rolled back to previous state."

Implement a global "Exponential Backoff" wrapper around all our Supabase and external API fetch utilities to handle rate limits and temporary server overloads.
1. If a database request returns a 429 (Too Many Requests), 503 (Service Unavailable), or 502 (Bad Gateway) error, the app must not crash or show an error to the user.
2. Instead, make the app wait exactly 1 second and automatically try again. If it fails again, wait 2 seconds, then 4 seconds, up to 3 total attempts.
3. Only display an actual error message to the user if all 3 automatic retry attempts completely fail.

Audit our Supabase authentication wrapper. Implement a proactive token refresh and session guard:
1. Intercept all outgoing API and database requests. Before the request leaves the browser, verify if the user's authentication token is expired or within 60 seconds of expiring.
2. If it is expiring, automatically pause the user's action, request a fresh token from Supabase in the background, and once refreshed, seamlessly resume and complete their original action.
3. If the session is completely dead, safely save their current form input to the browser's localStorage, redirect them to login, and restore their form input immediately after they log back in so they never lose work.

Implement an Idempotency Layer for all data-creation actions (like creating contacts, deals, or invoices). 
1. For every creation request, generate a temporary unique transaction ID on the frontend before sending it to the backend/Supabase.
2. Modify the backend/Supabase functions to check if a request with that specific transaction ID has already been processed in the last 5 minutes.
3. If it has, do not create a duplicate row; simply return the data from the first successful creation.

Create a robust "Offline Sync Queue" utility for our CRM data mutations.
1. If an API request to modify data fails strictly due to a network disconnection (e.g., navigator.onLine is false), intercept the payload.
2. Store this pending mutation payload securely inside IndexedDB (browser database storage).
3. Set up a listener that detects when the browser recovers its internet connection. The moment it goes back online, automatically replay all queued actions in order to Supabase in the background and notify the user with a toast: "Offline updates successfully synchronized."


We want to align our CRM database schema with professional open-source CRMs like Twenty and EspoCRM to ensure we handle relational data correctly. 
1. Research the standard database schema structures for a professional CRM, specifically looking at how they link Users, Accounts (Companies), Contacts (People), Opportunities (Deals), and Tasks.
2. Refactor our Supabase schema to use these industry-standard many-to-many and one-to-many relationship structures.
3. Ensure every table has clear audit timestamps like `created_at`, `updated_at`, and `deleted_at`.
https://github.com/twentyhq/twenty

I want our contact detail view to use the layout standard popularized by modern CRMs like Twenty and HubSpot. 
1. Implement a clean, split 3-column view.
2. Left Column: Core profile info (Name, Company, Email, Phone, Status) inside a clean card.
3. Center Column: A chronological, scrollable Activity Timeline showing notes, tasks, and system updates.
4. Right Column: Quick-access widgets showing connected Deals, open Tickets, and Attachments.
5. Use shadcn/ui and Tailwind CSS to ensure it looks modern, responsive, and minimalist.

Prompt 1: The Context Setup (Run First)This tells Claude Code to read Twenty's existing folder layout and understand its core structure before editing anything.textWe have successfully cloned the Twenty CRM repository. We are transforming this into a specialized "Boxing Gym CRM." 
1. Perform a full scan of the directory layout and read Twenty's core schema structure. 
2. Create a `CLAUDE.md` memory bank file in our project root. Document how Twenty structures its standard objects (`Person`, `Company`, `Opportunity`) and its frontend views. 
3. Explicitly note that from this point forward, we will be adapting these standard objects to represent boxing clients and gym business workflows.
Use code with caution.Prompt 2: Transforming the Database Model (The Boxing Schema)This prompt instructs Claude to use Twenty's built-in data framework to establish proper terminology (Fighters, Memberships, Attendance).textLet's redefine Twenty's core database object schemas to fit a boxing gym model. Modify or extend the metadata and database schemas to enforce these exact models:
1. Rename/Map `Person` to `Fighter` (Fields: Name, Weight Class, Emergency Contact, Active Injuries, USABoxing ID number).
2. Create a Custom Object for `Membership` (Fields: Tier [e.g., Unlimited, 10-Class Pass, Amateur Competitor Team], Price, Billing Status, Expiry Date). Link this as One-to-Many with Fighters.
3. Create a Custom Object for `Attendance` (Fields: Date, Class Type [e.g., Heavy Bag, Sparring, Youth Boxing, Mitt Work], Attended [Boolean]). Link this as Many-to-One with Fighters to track class counts.
Use code with caution.Prompt 3: Building the "Glove-Up" Sales PipelineInstead of tracking a corporate sales funnel, this prompt builds a workflow pipeline to track a trial member from their first free session to a signed contract.textLet's adapt Twenty's Kanban board pipeline (`Opportunities`) into a "Member Onboarding & Retention Pipeline". 
1. Update the stages of our pipeline board to read exactly: 
   - New Inquiry (Form Submission/Walk-in)
   - First Free Class Scheduled
   - Free Class Attended (Warm Lead)
   - Active Paying Member
   - Cancelled / Win-Back Campaign
2. Add a safeguard: If a Fighter is moved to the 'Active Paying Member' stage, the frontend must prompt the user to attach an active 'Membership' card to their profile.
Use code with caution.Prompt 4: Creating the "Fighter Card" Layout (Frontend UI)This tells Claude to implement that elegant, professional 3-column layout we researched, but styled specifically for coaches reviewing a boxer's profile.textModify the primary detail view screen for a Fighter profile. We want a modern, high-contrast 3-column layout:
1. Left Column (Profile & Status): Show fighter headshot placeholder, weight class, membership tier, and a big green or red badge saying "MEMBERSHIP CURRENT" or "PAST DUE / ACCESS DENIED."
2. Middle Column (Activity Timeline): Show historical gym logs, private coaching notes (e.g., "Left hook dropping when throwing combinations"), and attendance history.
3. Right Column (Quick Actions): Add shortcut buttons to: "Log Attendance," "Renew Membership," or "View Signed Digital Liability Waiver."
Use code with caution.Prompt 5: The "Safe Sparring" Automation GuardThis enforces the automated testing protocol we covered previously, guaranteeing Claude won't destroy the gym's database structure when adding features later.textNow that our boxing objects are configured, we need to ensure our code remains unbreakable.
1. Write a series of automated end-to-end user tests using Twenty's testing frameworks.
2. The tests must verify: A gym manager can successfully create a new Fighter, assign them a 10-Class Pass Membership, drop their membership balance by 1 when they attend a 'Heavy Bag' class, and fail to log attendance if their membership balance hits 0.
3. Run the test suite right now and verify that all gym core logic passes completely.
Use code with caution.