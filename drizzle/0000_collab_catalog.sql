-- ETAPA 2.1 — SQL preparado para revisão. NÃO EXECUTAR sem autorização.

CREATE TYPE "product_publication_status" AS ENUM ('draft', 'published', 'archived');
--> statement-breakpoint

CREATE TABLE "artists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artistic_name" varchar(160) NOT NULL,
  "biography" text NOT NULL,
  "photo_path" text,
  "instagram_handle" varchar(30),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artists_artistic_name_not_blank"
    CHECK (char_length(btrim("artistic_name")) > 0),
  CONSTRAINT "artists_biography_not_blank"
    CHECK (char_length(btrim("biography")) > 0),
  CONSTRAINT "artists_instagram_handle_format"
    CHECK ("instagram_handle" IS NULL OR "instagram_handle" ~ '^[A-Za-z0-9._]{1,30}$')
);
--> statement-breakpoint

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "slug" varchar(160) NOT NULL,
  "description" text,
  "parent_id" uuid,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "categories_slug_unique" UNIQUE ("slug"),
  CONSTRAINT "categories_name_not_blank"
    CHECK (char_length(btrim("name")) > 0),
  CONSTRAINT "categories_slug_format"
    CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT "categories_display_order_nonnegative"
    CHECK ("display_order" >= 0),
  CONSTRAINT "categories_parent_not_self"
    CHECK ("parent_id" IS NULL OR "parent_id" <> "id"),
  CONSTRAINT "categories_parent_id_categories_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL
);
--> statement-breakpoint

CREATE TABLE "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(180) NOT NULL,
  "slug" varchar(200) NOT NULL,
  "description" text,
  "artist_id" uuid NOT NULL,
  "material" text,
  "production_technique" text,
  "characteristics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "price_in_cents" integer NOT NULL,
  "publication_status" "product_publication_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "products_slug_unique" UNIQUE ("slug"),
  CONSTRAINT "products_name_not_blank"
    CHECK (char_length(btrim("name")) > 0),
  CONSTRAINT "products_slug_format"
    CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT "products_characteristics_object"
    CHECK (jsonb_typeof("characteristics") = 'object'),
  CONSTRAINT "products_price_nonnegative"
    CHECK ("price_in_cents" >= 0),
  CONSTRAINT "products_published_fields_complete"
    CHECK (
      "publication_status" <> 'published'
      OR (
        "published_at" IS NOT NULL
        AND "description" IS NOT NULL
        AND char_length(btrim("description")) > 0
        AND "material" IS NOT NULL
        AND char_length(btrim("material")) > 0
        AND "production_technique" IS NOT NULL
        AND char_length(btrim("production_technique")) > 0
      )
    ),
  CONSTRAINT "products_artist_id_artists_id_fk"
    FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE "product_categories" (
  "product_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_categories_pk" PRIMARY KEY ("product_id", "category_id"),
  CONSTRAINT "product_categories_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "product_categories_category_id_categories_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "product_variations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "sku" varchar(80) NOT NULL,
  "color" varchar(80),
  "size" varchar(80),
  "characteristics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "available_quantity" integer DEFAULT 0 NOT NULL,
  "specific_price_in_cents" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_variations_sku_unique" UNIQUE ("sku"),
  CONSTRAINT "product_variations_sku_format"
    CHECK ("sku" ~ '^[A-Z0-9][A-Z0-9._-]*$'),
  CONSTRAINT "product_variations_characteristics_object"
    CHECK (jsonb_typeof("characteristics") = 'object'),
  CONSTRAINT "product_variations_quantity_nonnegative"
    CHECK ("available_quantity" >= 0),
  CONSTRAINT "product_variations_price_nonnegative"
    CHECK ("specific_price_in_cents" IS NULL OR "specific_price_in_cents" >= 0),
  CONSTRAINT "product_variations_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE "product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "file_path" text NOT NULL,
  "alt_text" varchar(300) NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_images_product_order_unique"
    UNIQUE ("product_id", "display_order"),
  CONSTRAINT "product_images_file_path_not_blank"
    CHECK (char_length(btrim("file_path")) > 0),
  CONSTRAINT "product_images_alt_text_not_blank"
    CHECK (char_length(btrim("alt_text")) > 0),
  CONSTRAINT "product_images_display_order_nonnegative"
    CHECK ("display_order" >= 0),
  CONSTRAINT "product_images_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE "shipping_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid,
  "variation_id" uuid,
  "item_weight_grams" integer NOT NULL,
  "item_height_cm" numeric(8, 2) NOT NULL,
  "item_width_cm" numeric(8, 2) NOT NULL,
  "item_length_cm" numeric(8, 2) NOT NULL,
  "package_weight_grams" integer NOT NULL,
  "package_height_cm" numeric(8, 2) NOT NULL,
  "package_width_cm" numeric(8, 2) NOT NULL,
  "package_length_cm" numeric(8, 2) NOT NULL,
  "is_fragile" boolean DEFAULT false NOT NULL,
  "ships_separately" boolean DEFAULT false NOT NULL,
  "units_per_package" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shipping_profiles_exactly_one_target"
    CHECK (("product_id" IS NULL) <> ("variation_id" IS NULL)),
  CONSTRAINT "shipping_profiles_item_measurements_positive"
    CHECK (
      "item_weight_grams" > 0
      AND "item_height_cm" > 0
      AND "item_width_cm" > 0
      AND "item_length_cm" > 0
    ),
  CONSTRAINT "shipping_profiles_package_measurements_positive"
    CHECK (
      "package_weight_grams" > 0
      AND "package_height_cm" > 0
      AND "package_width_cm" > 0
      AND "package_length_cm" > 0
    ),
  CONSTRAINT "shipping_profiles_package_weight_valid"
    CHECK ("package_weight_grams" >= "item_weight_grams"),
  CONSTRAINT "shipping_profiles_units_per_package_positive"
    CHECK ("units_per_package" > 0),
  CONSTRAINT "shipping_profiles_separate_package_single_unit"
    CHECK ("ships_separately" = false OR "units_per_package" = 1),
  CONSTRAINT "shipping_profiles_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
  CONSTRAINT "shipping_profiles_variation_id_product_variations_id_fk"
    FOREIGN KEY ("variation_id") REFERENCES "product_variations"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE "customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "label" varchar(60) NOT NULL,
  "recipient_name" varchar(160) NOT NULL,
  "postal_code" varchar(8) NOT NULL,
  "street" varchar(200) NOT NULL,
  "number" varchar(30) NOT NULL,
  "complement" varchar(120),
  "neighborhood" varchar(120) NOT NULL,
  "city" varchar(120) NOT NULL,
  "state_code" varchar(2) NOT NULL,
  "country_code" varchar(2) DEFAULT 'BR' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_addresses_label_not_blank"
    CHECK (char_length(btrim("label")) > 0),
  CONSTRAINT "customer_addresses_recipient_name_not_blank"
    CHECK (char_length(btrim("recipient_name")) > 0),
  CONSTRAINT "customer_addresses_street_not_blank"
    CHECK (char_length(btrim("street")) > 0),
  CONSTRAINT "customer_addresses_number_not_blank"
    CHECK (char_length(btrim("number")) > 0),
  CONSTRAINT "customer_addresses_neighborhood_not_blank"
    CHECK (char_length(btrim("neighborhood")) > 0),
  CONSTRAINT "customer_addresses_city_not_blank"
    CHECK (char_length(btrim("city")) > 0),
  CONSTRAINT "customer_addresses_postal_code_format"
    CHECK ("postal_code" ~ '^[0-9]{8}$'),
  CONSTRAINT "customer_addresses_state_code_format"
    CHECK ("state_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "customer_addresses_country_code_format"
    CHECK ("country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint

CREATE INDEX "artists_active_name_idx"
  ON "artists" ("is_active", "artistic_name");
--> statement-breakpoint
CREATE INDEX "categories_parent_order_idx"
  ON "categories" ("parent_id", "display_order");
--> statement-breakpoint
CREATE INDEX "products_artist_idx" ON "products" ("artist_id");
--> statement-breakpoint
CREATE INDEX "products_status_published_idx"
  ON "products" ("publication_status", "published_at");
--> statement-breakpoint
CREATE INDEX "product_categories_category_idx"
  ON "product_categories" ("category_id");
--> statement-breakpoint
CREATE INDEX "product_variations_product_active_idx"
  ON "product_variations" ("product_id", "is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_variations_default_product_unique"
  ON "product_variations" ("product_id")
  WHERE "is_default" = true;
--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_primary_product_unique"
  ON "product_images" ("product_id")
  WHERE "is_primary" = true;
--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_profiles_product_unique"
  ON "shipping_profiles" ("product_id")
  WHERE "product_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_profiles_variation_unique"
  ON "shipping_profiles" ("variation_id")
  WHERE "variation_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "customer_addresses_user_idx"
  ON "customer_addresses" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_default_user_unique"
  ON "customer_addresses" ("user_id")
  WHERE "is_default" = true;
--> statement-breakpoint

COMMENT ON COLUMN "customer_addresses"."user_id" IS
  'ID do usuário gerenciado pelo Better Auth; a FK será adicionada após o schema oficial de autenticação.';
--> statement-breakpoint

CREATE FUNCTION "collab_set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "artists_set_updated_at"
  BEFORE UPDATE ON "artists"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "categories_set_updated_at"
  BEFORE UPDATE ON "categories"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "products_set_updated_at"
  BEFORE UPDATE ON "products"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "product_variations_set_updated_at"
  BEFORE UPDATE ON "product_variations"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "product_images_set_updated_at"
  BEFORE UPDATE ON "product_images"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "shipping_profiles_set_updated_at"
  BEFORE UPDATE ON "shipping_profiles"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "customer_addresses_set_updated_at"
  BEFORE UPDATE ON "customer_addresses"
  FOR EACH ROW EXECUTE FUNCTION "collab_set_updated_at"();
--> statement-breakpoint

CREATE FUNCTION "collab_prevent_category_cycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."parent_id" IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('collab.categories.hierarchy'));

  IF EXISTS (
    WITH RECURSIVE "ancestors" AS (
      SELECT "id", "parent_id"
      FROM "categories"
      WHERE "id" = NEW."parent_id"

      UNION

      SELECT "categories"."id", "categories"."parent_id"
      FROM "categories"
      INNER JOIN "ancestors"
        ON "categories"."id" = "ancestors"."parent_id"
    )
    SELECT 1
    FROM "ancestors"
    WHERE "id" = NEW."id"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'category hierarchy cycle is not allowed';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "categories_prevent_cycle"
  BEFORE INSERT OR UPDATE OF "parent_id" ON "categories"
  FOR EACH ROW EXECUTE FUNCTION "collab_prevent_category_cycle"();
--> statement-breakpoint

CREATE FUNCTION "collab_assert_product_publishable"("target_product_id" uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "products"
    WHERE "id" = "target_product_id"
      AND "publication_status" = 'published'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "product_categories"
      WHERE "product_id" = "target_product_id"
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'published product requires at least one category';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM "product_variations"
      WHERE "product_id" = "target_product_id"
        AND "is_active" = true
        AND "is_default" = true
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'published product requires one active default variation';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM "product_images"
      WHERE "product_id" = "target_product_id"
        AND "is_primary" = true
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'published product requires one primary image';
    END IF;
  END IF;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION "collab_validate_product_dependencies"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    PERFORM "collab_assert_product_publishable"(
      CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END
    );
  ELSE
    IF TG_OP = 'INSERT' THEN
      PERFORM "collab_assert_product_publishable"(NEW."product_id");
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM "collab_assert_product_publishable"(OLD."product_id");
    ELSE
      PERFORM "collab_assert_product_publishable"(NEW."product_id");

      IF OLD."product_id" IS DISTINCT FROM NEW."product_id" THEN
        PERFORM "collab_assert_product_publishable"(OLD."product_id");
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER "products_validate_publication"
  AFTER INSERT OR UPDATE ON "products"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_product_dependencies"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "product_categories_validate_publication"
  AFTER INSERT OR UPDATE OR DELETE ON "product_categories"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_product_dependencies"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "product_variations_validate_publication"
  AFTER INSERT OR UPDATE OR DELETE ON "product_variations"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_product_dependencies"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "product_images_validate_publication"
  AFTER INSERT OR UPDATE OR DELETE ON "product_images"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "collab_validate_product_dependencies"();
