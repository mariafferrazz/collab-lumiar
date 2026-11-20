CREATE TABLE "user" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "role" text DEFAULT 'CUSTOMER' NOT NULL,
  "banned" boolean DEFAULT false NOT NULL,
  "ban_reason" text,
  "ban_expires" timestamp,
  CONSTRAINT "user_email_unique" UNIQUE ("email"),
  CONSTRAINT "user_name_length"
    CHECK (char_length(btrim("name")) BETWEEN 2 AND 160),
  CONSTRAINT "user_email_not_blank"
    CHECK (char_length(btrim("email")) > 0),
  CONSTRAINT "user_role_allowed"
    CHECK ("role" IN ('CUSTOMER', 'ADMIN'))
);
--> statement-breakpoint

CREATE TABLE "session" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" uuid NOT NULL,
  "impersonated_by" text,
  CONSTRAINT "session_token_unique" UNIQUE ("token"),
  CONSTRAINT "session_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user" ("id")
    ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "account" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "account_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user" ("id")
    ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "verification" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "session_userId_idx" ON "session" ("user_id");
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique"
  ON "account" ("provider_id", "account_id");
--> statement-breakpoint
CREATE INDEX "verification_identifier_idx"
  ON "verification" ("identifier");
--> statement-breakpoint

ALTER TABLE "customer_addresses"
  ADD CONSTRAINT "customer_addresses_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user" ("id")
  ON DELETE CASCADE;
