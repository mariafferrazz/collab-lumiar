-- ETAPA 2.3 — Precificação financeira. NÃO APLICAR REMOTAMENTE sem nova autorização.

CREATE TYPE "financial_configuration_status" AS ENUM ('draft', 'approved');
CREATE TYPE "financial_charge_kind" AS ENUM ('payment_fee', 'tax');
CREATE TYPE "financial_incidence_base" AS ENUM ('commercial_base', 'final_merchandise', 'shipping', 'transaction_total');
CREATE TYPE "financial_application_scope" AS ENUM ('per_item', 'per_order');
CREATE TYPE "financial_pricing_status" AS ENUM ('incomplete', 'pending_validation', 'validated');
--> statement-breakpoint

CREATE TABLE "financial_pricing_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(80) NOT NULL,
  "version" integer NOT NULL,
  "commercial_markup_basis_points" integer DEFAULT 4000 NOT NULL,
  "owner_share_basis_points" integer DEFAULT 5000 NOT NULL,
  "organizer_share_basis_points" integer DEFAULT 5000 NOT NULL,
  "status" "financial_configuration_status" DEFAULT 'draft' NOT NULL,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_until" timestamp with time zone,
  "source" text NOT NULL,
  "approved_by_user_id" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_pricing_policies_code_version_unique" UNIQUE ("code", "version"),
  CONSTRAINT "financial_pricing_policies_fixed_agreement" CHECK (
    "commercial_markup_basis_points" = 4000
    AND "owner_share_basis_points" = 5000
    AND "organizer_share_basis_points" = 5000
  ),
  CONSTRAINT "financial_pricing_policies_validity" CHECK (
    "effective_until" IS NULL OR "effective_until" > "effective_from"
  ),
  CONSTRAINT "financial_pricing_policies_source_not_blank" CHECK (char_length(btrim("source")) > 0),
  CONSTRAINT "financial_pricing_policies_approval_complete" CHECK (
    "status" = 'draft' OR ("approved_by_user_id" IS NOT NULL AND "approved_at" IS NOT NULL)
  ),
  CONSTRAINT "financial_pricing_policies_approved_by_user_id_user_id_fk"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE "financial_charge_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" "financial_charge_kind" NOT NULL,
  "name" varchar(160) NOT NULL,
  "payment_method" varchar(60),
  "percentage_basis_points" integer DEFAULT 0 NOT NULL,
  "fixed_amount_in_cents" integer DEFAULT 0 NOT NULL,
  "incidence_base" "financial_incidence_base" NOT NULL,
  "application_scope" "financial_application_scope" NOT NULL,
  "status" "financial_configuration_status" DEFAULT 'draft' NOT NULL,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_until" timestamp with time zone,
  "source" text NOT NULL,
  "approved_by_user_id" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_charge_rules_name_not_blank" CHECK (char_length(btrim("name")) > 0),
  CONSTRAINT "financial_charge_rules_source_not_blank" CHECK (char_length(btrim("source")) > 0),
  CONSTRAINT "financial_charge_rules_values_valid" CHECK (
    "percentage_basis_points" BETWEEN 0 AND 9999
    AND "fixed_amount_in_cents" >= 0
    AND ("kind" = 'tax' OR "percentage_basis_points" > 0 OR "fixed_amount_in_cents" > 0)
  ),
  CONSTRAINT "financial_charge_rules_payment_method" CHECK (
    "kind" <> 'payment_fee'
    OR ("payment_method" IS NOT NULL AND char_length(btrim("payment_method")) > 0)
  ),
  CONSTRAINT "financial_charge_rules_validity" CHECK (
    "effective_until" IS NULL OR "effective_until" > "effective_from"
  ),
  CONSTRAINT "financial_charge_rules_approval_complete" CHECK (
    "status" = 'draft' OR ("approved_by_user_id" IS NOT NULL AND "approved_at" IS NOT NULL)
  ),
  CONSTRAINT "financial_charge_rules_approved_by_user_id_user_id_fk"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE "product_financial_costs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid,
  "variation_id" uuid,
  "policy_id" uuid NOT NULL,
  "artist_cost_in_cents" integer NOT NULL,
  "commercial_addition_in_cents" integer NOT NULL,
  "owner_share_in_cents" integer NOT NULL,
  "organizer_share_in_cents" integer NOT NULL,
  "rounding_residual_in_cents" integer NOT NULL,
  "commercial_base_in_cents" integer NOT NULL,
  "calculation_version" varchar(60) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_financial_costs_exactly_one_target" CHECK (
    ("product_id" IS NULL) <> ("variation_id" IS NULL)
  ),
  CONSTRAINT "product_financial_costs_artist_cost_positive" CHECK ("artist_cost_in_cents" > 0),
  CONSTRAINT "product_financial_costs_fixed_agreement" CHECK (
    "commercial_addition_in_cents" = (((("artist_cost_in_cents")::bigint * 4000) + 5000) / 10000)::integer
    AND "owner_share_in_cents" = "commercial_addition_in_cents" / 2
    AND "organizer_share_in_cents" = "commercial_addition_in_cents" / 2
    AND "rounding_residual_in_cents" = "commercial_addition_in_cents" - "owner_share_in_cents" - "organizer_share_in_cents"
  ),
  CONSTRAINT "product_financial_costs_sums_match" CHECK (
    "commercial_addition_in_cents" = "owner_share_in_cents" + "organizer_share_in_cents" + "rounding_residual_in_cents"
    AND "commercial_base_in_cents" = "artist_cost_in_cents" + "commercial_addition_in_cents"
  ),
  CONSTRAINT "product_financial_costs_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
  CONSTRAINT "product_financial_costs_variation_id_product_variations_id_fk"
    FOREIGN KEY ("variation_id") REFERENCES "product_variations"("id") ON DELETE RESTRICT,
  CONSTRAINT "product_financial_costs_policy_id_financial_pricing_policies_id_fk"
    FOREIGN KEY ("policy_id") REFERENCES "financial_pricing_policies"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE "product_pricing_scenarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cost_id" uuid NOT NULL,
  "payment_method" varchar(60) NOT NULL,
  "payment_fee_rule_id" uuid,
  "tax_rule_id" uuid,
  "expected_payment_fee_in_cents" integer,
  "expected_tax_in_cents" integer,
  "calculation_residual_in_cents" integer,
  "final_merchandise_price_in_cents" integer,
  "status" "financial_pricing_status" DEFAULT 'incomplete' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "calculation_version" varchar(60) NOT NULL,
  "validated_by_user_id" uuid,
  "validated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_pricing_scenarios_cost_method_unique" UNIQUE ("cost_id", "payment_method"),
  CONSTRAINT "product_pricing_scenarios_method_not_blank" CHECK (char_length(btrim("payment_method")) > 0),
  CONSTRAINT "product_pricing_scenarios_values_nonnegative" CHECK (
    coalesce("expected_payment_fee_in_cents", 0) >= 0
    AND coalesce("expected_tax_in_cents", 0) >= 0
    AND coalesce("final_merchandise_price_in_cents", 0) >= 0
  ),
  CONSTRAINT "product_pricing_scenarios_validation_complete" CHECK (
    "status" <> 'validated' OR (
      "payment_fee_rule_id" IS NOT NULL AND "tax_rule_id" IS NOT NULL
      AND "expected_payment_fee_in_cents" IS NOT NULL AND "expected_tax_in_cents" IS NOT NULL
      AND "calculation_residual_in_cents" IS NOT NULL AND "final_merchandise_price_in_cents" IS NOT NULL
      AND "validated_by_user_id" IS NOT NULL AND "validated_at" IS NOT NULL
    )
  ),
  CONSTRAINT "product_pricing_scenarios_cost_id_product_financial_costs_id_fk"
    FOREIGN KEY ("cost_id") REFERENCES "product_financial_costs"("id") ON DELETE RESTRICT,
  CONSTRAINT "product_pricing_scenarios_payment_fee_rule_id_financial_charge_rules_id_fk"
    FOREIGN KEY ("payment_fee_rule_id") REFERENCES "financial_charge_rules"("id") ON DELETE RESTRICT,
  CONSTRAINT "product_pricing_scenarios_tax_rule_id_financial_charge_rules_id_fk"
    FOREIGN KEY ("tax_rule_id") REFERENCES "financial_charge_rules"("id") ON DELETE RESTRICT,
  CONSTRAINT "product_pricing_scenarios_validated_by_user_id_user_id_fk"
    FOREIGN KEY ("validated_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE "financial_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "action" varchar(100) NOT NULL,
  "entity_type" varchar(80) NOT NULL,
  "entity_id" uuid NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_audit_events_action_not_blank" CHECK (char_length(btrim("action")) > 0),
  CONSTRAINT "financial_audit_events_entity_not_blank" CHECK (char_length(btrim("entity_type")) > 0),
  CONSTRAINT "financial_audit_events_details_object" CHECK (jsonb_typeof("details") = 'object'),
  CONSTRAINT "financial_audit_events_actor_user_id_user_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE INDEX "financial_pricing_policies_status_validity_idx"
  ON "financial_pricing_policies" ("status", "effective_from", "effective_until");
CREATE INDEX "financial_charge_rules_lookup_idx"
  ON "financial_charge_rules" ("kind", "status", "payment_method", "effective_from");
CREATE UNIQUE INDEX "product_financial_costs_product_unique"
  ON "product_financial_costs" ("product_id") WHERE "product_id" IS NOT NULL;
CREATE UNIQUE INDEX "product_financial_costs_variation_unique"
  ON "product_financial_costs" ("variation_id") WHERE "variation_id" IS NOT NULL;
CREATE UNIQUE INDEX "product_pricing_scenarios_default_cost_unique"
  ON "product_pricing_scenarios" ("cost_id") WHERE "is_default" = true;
CREATE INDEX "product_pricing_scenarios_status_idx" ON "product_pricing_scenarios" ("status");
CREATE INDEX "financial_audit_events_entity_created_idx"
  ON "financial_audit_events" ("entity_type", "entity_id", "created_at");
--> statement-breakpoint

CREATE FUNCTION "collab_protect_approved_financial_configuration"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'approved' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'approved financial configuration is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION "collab_protect_financial_history"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'financial_audit_events' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'financial audit events are append-only';
  END IF;
  IF OLD."status" = 'validated' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'validated financial history is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION "collab_protect_validated_cost"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "product_pricing_scenarios"
    WHERE "cost_id" = OLD."id" AND "status" = 'validated'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'cost linked to validated pricing is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION "collab_validate_pricing_scenario"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cost_row "product_financial_costs"%ROWTYPE;
  payment_row "financial_charge_rules"%ROWTYPE;
  tax_row "financial_charge_rules"%ROWTYPE;
  policy_row "financial_pricing_policies"%ROWTYPE;
BEGIN
  IF NEW."status" <> 'validated' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO cost_row FROM "product_financial_costs" WHERE "id" = NEW."cost_id";
  SELECT * INTO policy_row FROM "financial_pricing_policies" WHERE "id" = cost_row."policy_id";
  SELECT * INTO payment_row FROM "financial_charge_rules" WHERE "id" = NEW."payment_fee_rule_id";
  SELECT * INTO tax_row FROM "financial_charge_rules" WHERE "id" = NEW."tax_rule_id";

  IF policy_row."status" <> 'approved'
    OR policy_row."effective_from" > now()
    OR (policy_row."effective_until" IS NOT NULL AND policy_row."effective_until" <= now())
    OR payment_row."status" <> 'approved' OR payment_row."kind" <> 'payment_fee'
    OR tax_row."status" <> 'approved' OR tax_row."kind" <> 'tax'
    OR payment_row."payment_method" IS DISTINCT FROM NEW."payment_method"
    OR payment_row."effective_from" > now()
    OR (payment_row."effective_until" IS NOT NULL AND payment_row."effective_until" <= now())
    OR tax_row."effective_from" > now()
    OR (tax_row."effective_until" IS NOT NULL AND tax_row."effective_until" <= now())
    OR payment_row."application_scope" <> 'per_item'
    OR tax_row."application_scope" <> 'per_item' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'validated pricing requires approved per-item policy and rules';
  END IF;

  IF NEW."final_merchandise_price_in_cents" < cost_row."commercial_base_in_cents"
    OR NEW."final_merchandise_price_in_cents" <>
      cost_row."commercial_base_in_cents"
      + NEW."expected_payment_fee_in_cents"
      + NEW."expected_tax_in_cents"
      + NEW."calculation_residual_in_cents" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'validated pricing totals do not reconcile';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION "collab_assert_product_financially_publishable"(target_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "products" WHERE "id" = target_product_id AND "publication_status" = 'published') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "product_financial_costs" c
    JOIN "product_pricing_scenarios" s ON s."cost_id" = c."id"
    JOIN "products" p ON p."id" = c."product_id"
    WHERE c."product_id" = target_product_id
      AND s."status" = 'validated' AND s."is_default" = true
      AND s."final_merchandise_price_in_cents" = p."price_in_cents"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'published product requires validated default financial pricing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "product_variations" v
    LEFT JOIN "product_financial_costs" c ON c."variation_id" = v."id"
    LEFT JOIN "product_pricing_scenarios" s
      ON s."cost_id" = c."id" AND s."status" = 'validated' AND s."is_default" = true
    WHERE v."product_id" = target_product_id AND v."is_active" = true
      AND (c."id" IS NOT NULL OR v."specific_price_in_cents" IS NOT NULL)
      AND (
        c."id" IS NULL OR s."id" IS NULL
        OR v."specific_price_in_cents" IS DISTINCT FROM s."final_merchandise_price_in_cents"
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'active variation financial pricing is incomplete';
  END IF;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION "collab_validate_product_financial_dependencies"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_product_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    target_product_id := COALESCE(NEW."id", OLD."id");
  ELSIF TG_TABLE_NAME = 'product_variations' THEN
    target_product_id := COALESCE(NEW."product_id", OLD."product_id");
  ELSIF TG_TABLE_NAME = 'product_financial_costs' THEN
    target_product_id := COALESCE(
      NEW."product_id", OLD."product_id",
      (SELECT "product_id" FROM "product_variations" WHERE "id" = COALESCE(NEW."variation_id", OLD."variation_id"))
    );
  ELSE
    SELECT COALESCE(c."product_id", v."product_id") INTO target_product_id
    FROM "product_financial_costs" c
    LEFT JOIN "product_variations" v ON v."id" = c."variation_id"
    WHERE c."id" = COALESCE(NEW."cost_id", OLD."cost_id");
  END IF;
  PERFORM "collab_assert_product_financially_publishable"(target_product_id);
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "financial_pricing_policies_set_updated_at"
  BEFORE UPDATE ON "financial_pricing_policies"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
CREATE TRIGGER "financial_charge_rules_set_updated_at"
  BEFORE UPDATE ON "financial_charge_rules"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
CREATE TRIGGER "product_financial_costs_set_updated_at"
  BEFORE UPDATE ON "product_financial_costs"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
CREATE TRIGGER "product_pricing_scenarios_set_updated_at"
  BEFORE UPDATE ON "product_pricing_scenarios"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
CREATE TRIGGER "financial_pricing_policies_protect_approved"
  BEFORE UPDATE OR DELETE ON "financial_pricing_policies"
  FOR EACH ROW EXECUTE FUNCTION "collab_protect_approved_financial_configuration"();
CREATE TRIGGER "financial_charge_rules_protect_approved"
  BEFORE UPDATE OR DELETE ON "financial_charge_rules"
  FOR EACH ROW EXECUTE FUNCTION "collab_protect_approved_financial_configuration"();
CREATE TRIGGER "product_pricing_scenarios_protect_validated"
  BEFORE UPDATE OR DELETE ON "product_pricing_scenarios"
  FOR EACH ROW EXECUTE FUNCTION "collab_protect_financial_history"();
CREATE TRIGGER "financial_audit_events_append_only"
  BEFORE UPDATE OR DELETE ON "financial_audit_events"
  FOR EACH ROW EXECUTE FUNCTION "collab_protect_financial_history"();
CREATE TRIGGER "product_financial_costs_protect_validated"
  BEFORE UPDATE OR DELETE ON "product_financial_costs"
  FOR EACH ROW EXECUTE FUNCTION "collab_protect_validated_cost"();
CREATE CONSTRAINT TRIGGER "product_pricing_scenarios_validate"
  AFTER INSERT OR UPDATE ON "product_pricing_scenarios"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_pricing_scenario"();
CREATE CONSTRAINT TRIGGER "products_validate_financial_pricing"
  AFTER INSERT OR UPDATE ON "products"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_product_financial_dependencies"();
CREATE CONSTRAINT TRIGGER "product_variations_validate_financial_pricing"
  AFTER INSERT OR UPDATE OR DELETE ON "product_variations"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_product_financial_dependencies"();
CREATE CONSTRAINT TRIGGER "product_financial_costs_validate_product"
  AFTER INSERT OR UPDATE OR DELETE ON "product_financial_costs"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_product_financial_dependencies"();
CREATE CONSTRAINT TRIGGER "product_pricing_scenarios_validate_product"
  AFTER INSERT OR UPDATE OR DELETE ON "product_pricing_scenarios"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_product_financial_dependencies"();
