-- Decision 66: TOPIC rules are enforced on the device by a small model that reads an English description
-- and compares its score with a threshold. Both fields exist only on TOPIC rules.
ALTER TABLE "CustomRule" ADD COLUMN "definition_en" TEXT;
ALTER TABLE "CustomRule" ADD COLUMN "threshold" DOUBLE PRECISION;

-- Existing TOPIC rules get the default threshold. Their definition_en stays null, so the extension skips them
-- until an admin writes the English description.
UPDATE "CustomRule" SET "threshold" = 0.3 WHERE "kind" = 'TOPIC';

-- A TOPIC rule may warn or allow, never block (a topic match is a likelihood and cannot be masked).
UPDATE "CustomRule" SET "action" = 'WARN' WHERE "kind" = 'TOPIC' AND "action" = 'BLOCK';

ALTER TABLE "CustomRule" ADD CONSTRAINT "CustomRule_topic_fields_only_on_topic"
  CHECK ("kind" = 'TOPIC' OR ("definition_en" IS NULL AND "threshold" IS NULL));
ALTER TABLE "CustomRule" ADD CONSTRAINT "CustomRule_threshold_range"
  CHECK ("threshold" IS NULL OR ("threshold" >= 0.2 AND "threshold" <= 0.9));
ALTER TABLE "CustomRule" ADD CONSTRAINT "CustomRule_topic_never_blocks"
  CHECK ("kind" <> 'TOPIC' OR "action" <> 'BLOCK');

-- The bundle content changed (a new threshold, maybe a new action): give clients a new version.
UPDATE "PolicyVersion" SET "version" = "version" + 1 WHERE "id" = 1;
