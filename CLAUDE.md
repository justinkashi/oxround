# OxRound — context for Claude

B2B SaaS for boxing gyms: web CRM for owners (`apps/web`) + member mobile app (`apps/mobile`, not started). First customer: G1 Boxing (Vaudreuil-Dorion, QC). The founder is a non-engineer — explain in plain language, keep answers short, don't create new planning documents.

## Production-only focus

The deployed app runs on real Supabase auth + data. Work against the live/Supabase code path. "demo mode" is only a local fallback that kicks in when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are unset — do NOT treat it as the product's state, design around it, or raise it in explanations unless the founder asks about it directly.

## Read first, in this order

1. `README.md` — CURRENT STATUS block at top = the single source of truth for what phase we're in. HOWEVER MOST OF THE TIME IT WILL BE OUTDATED BY A FEW CODING SESSIONS, SO README.MD CAN HELP FOR VAGUE CONTEXT BUT IT IS NOT NECESSARILY THE TRUTH OF THE CURRENT STATE OF THE APP.
2. `FEATURES.md` — master feature checklist (✅ built / ⬜ not). The single list of record. AGAIN IT IS LIKELY NOT FULLY UP TO DATE SO IT ONLY SERVES AS VERY VAGUE STATUS NOT INDICATIVE OF CURRENT APP STATE.
3. Only then the specific files being changed. Do NOT re-read the whole repo or the `docs/` folder.

## After any feature work

Flip the matching ⬜→✅ in `FEATURES.md` and refresh the CURRENT STATUS block in `README.md`. That is the entire state-update ritual.
