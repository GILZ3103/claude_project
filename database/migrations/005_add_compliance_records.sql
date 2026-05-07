-- Migration 005: Vendor compliance record tracking
-- Vendors log their government submissions (income tax, electric bills, business tax).
-- Each record is owned by a vendor and can be added or deleted by the vendor.

CREATE TABLE IF NOT EXISTS compliance_records (
    record_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id        UUID REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    record_type      VARCHAR(30) NOT NULL CHECK (record_type IN ('INCOME_TAX','ELECTRIC_BILL','BUSINESS_TAX','OTHER')),
    period_label     VARCHAR(50) NOT NULL,
    amount_rm        NUMERIC(12,2),
    reference_number VARCHAR(100),
    submitted_at     DATE NOT NULL,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_vendor ON compliance_records(vendor_id, submitted_at DESC);
