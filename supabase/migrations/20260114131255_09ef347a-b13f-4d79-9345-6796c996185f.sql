-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a function to trigger the scheduled snapshot
-- This calls the edge function via pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the job to run daily at 3:30 PM IST (10:00 UTC)
-- IST is UTC+5:30, so 3:30 PM IST = 10:00 AM UTC
SELECT cron.schedule(
  'daily-portfolio-snapshot',
  '0 10 * * 1-5', -- At 10:00 UTC (3:30 PM IST), Mon-Fri (market days)
  $$
  SELECT net.http_post(
    url := 'https://nlnevxvsgholniaeigst.supabase.co/functions/v1/scheduled-snapshot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);