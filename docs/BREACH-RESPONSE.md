# If personal data leaks

What to do when account data may have been read, changed or lost by someone it
does not belong to. If it is likely to risk anyone's rights, UK GDPR requires
telling the ICO **without undue delay** and, where feasible, within **72 hours**
of becoming aware of it. Report what you know; send the rest when you have it.

1. **Contain it.** Rotate any secret that was exposed: `SUPABASE_SERVICE_ROLE_KEY`
   in Supabase, `CRON_SECRET` in Vercel. The anon key is public by design, so
   rotating it fixes nothing — check the affected tables' grants and RLS
   policies instead. Take down affected guest or supplier links. Redeploy.
2. **Write down** the time you found out, what happened, which data (emails,
   weddings, guest lists, dietary notes), roughly how many people, and what you
   did. Keep it even if you decide not to report — the ICO can ask for it.
3. **Decide promptly whether to report**: <https://ico.org.uk/for-organisations/report-a-breach/>.
   Judge each breach on its facts: report if it is likely to risk people's rights
   and freedoms. Dietary or health notes weigh towards that; they don't decide it.
4. **Tell every couple affected** without undue delay, whatever the risk — the
   Terms promise it. They decide whether their guests need telling.
5. **Fix the cause**, and add a test that would have caught it.
