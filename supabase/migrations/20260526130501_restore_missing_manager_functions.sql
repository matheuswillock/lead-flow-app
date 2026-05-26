-- Restore functions[] for managers that were left with empty arrays
-- These were missed by the previous restore migration (20260525132212)
UPDATE public.corretor_studio_team_members
   SET functions = ARRAY['SDR','CLOSER']::"UserFunction"[],
       "updatedAt" = NOW()
 WHERE role = 'manager'
   AND (functions IS NULL OR functions = '{}');
