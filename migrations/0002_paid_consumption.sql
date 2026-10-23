ALTER TYPE presu_credit_kind ADD VALUE IF NOT EXISTS 'paid_consumption';
ALTER TABLE presu_quote ADD COLUMN IF NOT EXISTS mcp_available boolean NOT NULL DEFAULT true;
