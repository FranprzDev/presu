CREATE TABLE "user" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "session" (
  "id" text NOT NULL PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE "account" (
  "id" text NOT NULL PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "verification" (
  "id" text NOT NULL PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE TABLE "oauthApplication" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "icon" text,
  "metadata" text,
  "clientId" text NOT NULL UNIQUE,
  "clientSecret" text,
  "redirectURLs" text NOT NULL,
  "type" text NOT NULL,
  "disabled" boolean,
  "userId" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "oauthAccessToken" (
  "id" text NOT NULL PRIMARY KEY,
  "accessToken" text NOT NULL UNIQUE,
  "refreshToken" text NOT NULL UNIQUE,
  "accessTokenExpiresAt" timestamp NOT NULL,
  "refreshTokenExpiresAt" timestamp NOT NULL,
  "clientId" text NOT NULL,
  "userId" text REFERENCES "user" ("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "oauthConsent" (
  "id" text NOT NULL PRIMARY KEY,
  "clientId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "consentGiven" boolean NOT NULL
);

CREATE TYPE presu_project_status AS ENUM ('active', 'archived');
CREATE TYPE presu_credit_kind AS ENUM ('free_grant', 'free_consumption', 'paid_purchase');
CREATE TYPE presu_payment_status AS ENUM ('pending', 'paid', 'failed', 'review');

CREATE TABLE presu_account (
  user_id text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  wallet_address text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE presu_project (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  status presu_project_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX presu_project_owner_updated_idx ON presu_project (user_id, updated_at DESC);

CREATE TABLE presu_grilling_usage (
  project_id uuid PRIMARY KEY REFERENCES presu_project (id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE presu_message (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES presu_project (id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (length(content) <= 20000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX presu_message_project_created_idx ON presu_message (project_id, created_at);

CREATE TABLE presu_document (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES presu_project (id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  filename text NOT NULL CHECK (length(filename) <= 255),
  extracted_text text NOT NULL CHECK (length(extracted_text) <= 200000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE presu_brief (
  project_id uuid PRIMARY KEY REFERENCES presu_project (id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE presu_credit_ledger (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  kind presu_credit_kind NOT NULL,
  amount integer NOT NULL CHECK (amount <> 0),
  idempotency_key text NOT NULL UNIQUE,
  project_id uuid REFERENCES presu_project (id) ON DELETE SET NULL,
  quote_id uuid,
  payment_intent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX presu_credit_ledger_user_kind_idx ON presu_credit_ledger (user_id, kind);

CREATE TABLE presu_quote (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES presu_project (id) ON DELETE CASCADE,
  version integer NOT NULL,
  request_key text NOT NULL,
  brief_version integer NOT NULL,
  currency char(3) NOT NULL,
  hourly_rate_cents integer NOT NULL,
  total_min_cents bigint NOT NULL,
  total_max_cents bigint NOT NULL,
  snapshot jsonb NOT NULL,
  pdf bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version),
  UNIQUE (user_id, request_key)
);

CREATE TABLE presu_wallet_challenge (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  address text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE presu_payment_intent (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  amount_wei numeric(78, 0) NOT NULL,
  status presu_payment_status NOT NULL DEFAULT 'pending',
  transaction_hash char(66) UNIQUE,
  review_reason text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE TABLE presu_payment_attempt (
  transaction_hash char(66) PRIMARY KEY,
  user_id text NOT NULL REFERENCES presu_account (user_id) ON DELETE CASCADE,
  payment_intent_id uuid NOT NULL REFERENCES presu_payment_intent (id) ON DELETE CASCADE,
  status presu_payment_status NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
