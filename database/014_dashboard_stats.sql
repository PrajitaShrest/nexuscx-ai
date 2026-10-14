-- =====================================================================
-- 014  Dashboard charts and filters   (Week 7)
-- Run after 013.
--
-- 1. cases.resolved_at: when a case was resolved or closed, so we can count
--    "resolved per day". A trigger keeps it right; old rows are filled in.
-- 2. public.case_stats(): one call that returns every number and chart series
--    for the staff dashboard, for a period and optional filters.
--    SECURITY INVOKER: Row Level Security still decides which cases count.
-- =====================================================================

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

UPDATE public.cases SET resolved_at = coalesce(closed_at, updated_at)
WHERE status IN ('resolved','closed') AND resolved_at IS NULL;

CREATE OR REPLACE FUNCTION private.set_resolved_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IN ('resolved','closed') THEN
    -- first time it is resolved (closing after resolving keeps the first time)
    IF OLD.status NOT IN ('resolved','closed') OR NEW.resolved_at IS NULL THEN
      NEW.resolved_at := coalesce(NEW.resolved_at, now());
    END IF;
  ELSE
    NEW.resolved_at := NULL;   -- reopened
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cases_resolved_at ON public.cases;
CREATE TRIGGER trg_cases_resolved_at BEFORE UPDATE OF status ON public.cases
FOR EACH ROW EXECUTE FUNCTION private.set_resolved_at();

CREATE INDEX IF NOT EXISTS idx_cases_created ON public.cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_resolved ON public.cases(resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escalations_case ON public.escalations(case_id, created_at);

-- p_days:      7, 30 or 90 (anything else becomes 30)
-- p_intents:   null = all topics, else a list of intents (order_status, refund_request, ...)
-- p_sentiment: null = all, else angry / negative / neutral / positive
-- p_priority:  null = all, else low / medium / high / urgent
CREATE OR REPLACE FUNCTION public.case_stats(
  p_days int DEFAULT 30, p_intents text[] DEFAULT NULL, p_sentiment text DEFAULT NULL, p_priority text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
WITH params AS (
  SELECT d, date_trunc('day', now()) - (d - 1) * interval '1 day' AS start_at,
            date_trunc('day', now()) - (2 * d - 1) * interval '1 day' AS prev_start
  FROM (SELECT CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END AS d) x
),
-- every case that matches the filters, with what happened to it
c AS (
  SELECT k.case_id, k.created_at, k.resolved_at, k.status, coalesce(k.intent, 'general') AS intent,
         coalesce(k.sentiment, 'neutral') AS sentiment, k.priority, k.sla_due_at, k.first_response_at,
         (SELECT min(e.created_at) FROM public.escalations e WHERE e.case_id = k.case_id) AS escalated_at,
         (SELECT min(a.assigned_at) FROM public.case_assignments a WHERE a.case_id = k.case_id) AS staff_at
  FROM public.cases k
  WHERE (p_intents IS NULL OR k.intent = ANY (p_intents))
    AND (p_sentiment IS NULL OR k.sentiment = p_sentiment)
    AND (p_priority IS NULL OR k.priority = p_priority)
),
cur  AS (SELECT c.* FROM c, params p WHERE c.created_at >= p.start_at),
prev AS (SELECT c.* FROM c, params p WHERE c.created_at >= p.prev_start AND c.created_at < p.start_at),
summary AS (
  SELECT
    count(*)                                                                          AS cases,
    count(*) FILTER (WHERE escalated_at IS NULL AND staff_at IS NULL)                 AS ai_only,
    count(*) FILTER (WHERE escalated_at IS NOT NULL)                                  AS escalated,
    count(*) FILTER (WHERE resolved_at IS NOT NULL)                                   AS resolved,
    count(*) FILTER (WHERE resolved_at IS NOT NULL AND sla_due_at IS NOT NULL)        AS resolved_with_sla,
    count(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= sla_due_at)     AS resolved_in_sla,
    round(avg(extract(epoch FROM staff_at - escalated_at) / 60)
          FILTER (WHERE staff_at > escalated_at))::int                                AS wait_for_person_min,
    round(avg(extract(epoch FROM resolved_at - created_at) / 3600)
          FILTER (WHERE resolved_at IS NOT NULL)::numeric, 1)                         AS hours_to_resolve
  FROM cur
),
prev_summary AS (
  SELECT count(*) AS cases,
         count(*) FILTER (WHERE escalated_at IS NULL AND staff_at IS NULL) AS ai_only,
         count(*) FILTER (WHERE escalated_at IS NOT NULL) AS escalated
  FROM prev
),
rating AS (
  SELECT round(avg(f.rating) FILTER (WHERE f.created_at >= p.start_at), 1) AS csat,
         round(avg(f.rating) FILTER (WHERE f.created_at >= p.prev_start AND f.created_at < p.start_at), 1) AS prev_csat,
         count(*) FILTER (WHERE f.created_at >= p.start_at) AS ratings
  FROM public.feedback f JOIN c ON c.case_id = f.case_id, params p
),
days AS (
  SELECT generate_series(p.start_at, date_trunc('day', now()), interval '1 day') AS day FROM params p
),
daily AS (
  SELECT d.day,
    (SELECT count(*) FROM c WHERE c.created_at  >= d.day AND c.created_at  < d.day + interval '1 day') AS new,
    (SELECT count(*) FROM c WHERE c.escalated_at >= d.day AND c.escalated_at < d.day + interval '1 day') AS escalated,
    (SELECT count(*) FROM c WHERE c.resolved_at >= d.day AND c.resolved_at < d.day + interval '1 day') AS resolved
  FROM days d
)
SELECT jsonb_build_object(
  'days', (SELECT d FROM params),
  'summary', (SELECT to_jsonb(s) FROM summary s),
  'previous', (SELECT to_jsonb(s) FROM prev_summary s),
  'rating', (SELECT to_jsonb(r) FROM rating r),
  'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'new', new, 'escalated', escalated, 'resolved', resolved) ORDER BY day) FROM daily), '[]'),
  -- where the cases in this period are now
  'outcomes', jsonb_build_object(
     'ai_only',        (SELECT count(*) FROM cur WHERE escalated_at IS NULL AND staff_at IS NULL),
     'staff_resolved', (SELECT count(*) FROM cur WHERE (escalated_at IS NOT NULL OR staff_at IS NOT NULL) AND status IN ('resolved','closed')),
     'with_staff',     (SELECT count(*) FROM cur WHERE (escalated_at IS NOT NULL OR staff_at IS NOT NULL) AND status IN ('human_handling','waiting','ai_handling')),
     'waiting',        (SELECT count(*) FROM cur WHERE status = 'escalated')),
  'topics', coalesce((SELECT jsonb_agg(t ORDER BY t.total DESC) FROM (
     SELECT intent, count(*) AS total, count(*) FILTER (WHERE escalated_at IS NOT NULL) AS escalated,
            count(*) FILTER (WHERE resolved_at IS NOT NULL) AS resolved
     FROM cur GROUP BY intent) t), '[]'),
  'sentiment', coalesce((SELECT jsonb_object_agg(sentiment, n) FROM (SELECT sentiment, count(*) AS n FROM cur GROUP BY sentiment) s), '{}'),
  'priority',  coalesce((SELECT jsonb_object_agg(priority, n) FROM (SELECT priority, count(*) AS n FROM cur GROUP BY priority) s), '{}')
)
$$;

REVOKE ALL ON FUNCTION public.case_stats(int, text[], text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.case_stats(int, text[], text, text) TO authenticated;
