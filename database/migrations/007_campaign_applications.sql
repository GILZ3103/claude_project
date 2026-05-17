-- Campaign applications submitted by vendors for admin approval
CREATE TABLE IF NOT EXISTS campaign_applications (
  application_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  period_start      DATE,
  period_end        DATE,
  condition_type    VARCHAR(30) NOT NULL DEFAULT 'SPEND_POINTS'
                    CHECK (condition_type IN ('VISIT_STALLS','SPEND_POINTS','DIRECTORY_REBATE')),
  condition_threshold NUMERIC(10,2) NOT NULL DEFAULT 1,
  point_deduction   NUMERIC(10,2),     -- points consumed per consumer participation
  reward_value      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  rejection_reason  TEXT,
  reviewed_by       VARCHAR(20) REFERENCES cards(uid),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_apps_vendor ON campaign_applications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_campaign_apps_status ON campaign_applications(status);
