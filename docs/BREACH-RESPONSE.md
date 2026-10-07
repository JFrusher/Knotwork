# If personal data leaks

What to do when account data may have been read, changed or lost by someone it
does not belong to. UK GDPR gives **72 hours** from becoming aware of it to tell
the ICO, if it is likely to risk anyone's rights.

1. **Contain it.** Rotate whatever was exposed: `SUPABASE_SERVICE_ROLE_KEY` and
   the anon key in Supabase, `CRON_SECRET` in Vercel. Take down affected guest
   or supplier links. Redeploy.
2. **Write down** the time you found out, what happened, which data (emails,
   weddings, guest lists, dietary notes), roughly how many people, and what you
   did. Keep it even if you decide not to report — the ICO can ask for it.
3. **Decide whether to report** (within 72 hours): <https://ico.org.uk/for-organisations/report-a-breach/>.
   Report if it could hurt anyone; dietary or health notes make that likely.
4. **Tell the couples affected** without delay if the risk is high. The Terms
   promise them this. They decide whether to tell their guests.
5. **Fix the cause**, and add a test that would have caught it.
