-- Count a check-in's day in Pakistan time, not UTC.
--
-- `checkedInOn` was `checkedInAt::date`, and `checkedInAt` is stored in UTC, so
-- the column's day ran from 05:00 to 05:00 Pakistan time. The controller looks
-- for today's row by the gym's own midnight, so the two disagreed for five
-- hours a night: a member checked in at 18:00 and again after midnight landed
-- on the same UTC date, the insert hit the unique key, the lookup for the new
-- local day found nothing, and the desk got a 500.
--
-- Pakistan keeps no daylight saving, so a fixed zone is exact. The app uses
-- the same zone (`GYM_TIME_ZONE` in src/services/dates.ts).
--
-- A generated column's expression cannot be altered in place before
-- Postgres 17, so the column and its constraint are rebuilt.
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_memberId_checkedInOn_key";
ALTER TABLE "Attendance" DROP COLUMN "checkedInOn";

ALTER TABLE "Attendance"
  ADD COLUMN "checkedInOn" DATE
  GENERATED ALWAYS AS ((("checkedInAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')::date) STORED;

-- Two rows that were on different UTC days can now share a Pakistan day (one
-- before 05:00, one after). The earliest survives, as in the migration that
-- first added the rule: every later row that day is the double-press the rule
-- exists to prevent.
DELETE FROM "Attendance" a
USING "Attendance" b
WHERE a."memberId" = b."memberId"
  AND a."checkedInOn" = b."checkedInOn"
  AND (a."checkedInAt" > b."checkedInAt"
       OR (a."checkedInAt" = b."checkedInAt" AND a."id" > b."id"));

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_memberId_checkedInOn_key"
  UNIQUE ("memberId", "checkedInOn");
