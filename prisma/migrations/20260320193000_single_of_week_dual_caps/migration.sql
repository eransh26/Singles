ALTER TABLE "SingleOfWeekConfig"
ADD COLUMN     "targetDailyCap" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "targetWeeklyCap" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "targetMonthlyCap" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "requesterDailyCap" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "requesterWeeklyCap" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "requesterMonthlyCap" INTEGER NOT NULL DEFAULT 12;

UPDATE "SingleOfWeekConfig"
SET
  "targetDailyCap" = "dailyCap",
  "targetWeeklyCap" = "weeklyCap",
  "targetMonthlyCap" = "monthlyCap"
WHERE TRUE;

ALTER TABLE "SingleOfWeekConfig"
DROP COLUMN "dailyCap",
DROP COLUMN "weeklyCap",
DROP COLUMN "monthlyCap";
