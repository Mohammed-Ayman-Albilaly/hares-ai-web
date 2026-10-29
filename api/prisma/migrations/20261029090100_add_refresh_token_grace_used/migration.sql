-- The grace window accepts a replaced extension token exactly once; a second presentation is a replay.
ALTER TABLE "RefreshToken" ADD COLUMN "grace_used" boolean NOT NULL DEFAULT false;
