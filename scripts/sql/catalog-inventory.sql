\set ON_ERROR_STOP on

WITH catalog_objects AS (
  SELECT
    'table'::text AS object_type,
    n.nspname::text AS schema_name,
    c.relname::text AS object_name,
    c.relkind::text AS definition
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')

  UNION ALL

  SELECT
    'column',
    table_schema,
    table_name || '.' || column_name,
    concat_ws(
      '|',
      data_type,
      udt_name,
      is_nullable,
      coalesce(column_default, ''),
      coalesce(character_maximum_length::text, ''),
      coalesce(numeric_precision::text, ''),
      coalesce(numeric_scale::text, '')
    )
  FROM information_schema.columns
  WHERE table_schema = 'public'

  UNION ALL

  SELECT
    'constraint',
    n.nspname,
    c.relname || '.' || con.conname,
    pg_get_constraintdef(con.oid, true)
  FROM pg_constraint con
  JOIN pg_namespace n ON n.oid = con.connamespace
  JOIN pg_class c ON c.oid = con.conrelid
  WHERE n.nspname = 'public'

  UNION ALL

  SELECT 'index', schemaname, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'

  UNION ALL

  SELECT
    'function',
    n.nspname,
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    pg_get_functiondef(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')

  UNION ALL

  SELECT
    'trigger',
    n.nspname,
    c.relname || '.' || t.tgname,
    pg_get_triggerdef(t.oid, true)
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal

  UNION ALL

  SELECT
    'enum',
    n.nspname,
    typ.typname || '.' || enum.enumlabel,
    enum.enumsortorder::text
  FROM pg_type typ
  JOIN pg_namespace n ON n.oid = typ.typnamespace
  JOIN pg_enum enum ON enum.enumtypid = typ.oid
  WHERE n.nspname = 'public'
), row_counts AS (
  SELECT
    format('%I.%I', n.nspname, c.relname) AS table_name,
    (
      (xpath(
        '/row/total/text()',
        query_to_xml(
          format('SELECT count(*) AS total FROM %I.%I', n.nspname, c.relname),
          false,
          true,
          ''
        )
      ))[1]::text
    )::bigint AS total
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
), ledger AS (
  SELECT migration_id, btrim(checksum_sha256) AS checksum_sha256
  FROM collab_schema_migrations
)
SELECT jsonb_build_object(
  'formatVersion', 1,
  'objects', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'type', object_type,
        'schema', schema_name,
        'name', object_name,
        'definition', definition
      )
      ORDER BY object_type, schema_name, object_name, definition
    )
    FROM catalog_objects
  ),
  'rowCounts', (
    SELECT jsonb_agg(
      jsonb_build_object('table', table_name, 'total', total)
      ORDER BY table_name
    )
    FROM row_counts
  ),
  'ledger', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'migrationId', migration_id,
        'checksumSha256', checksum_sha256
      )
      ORDER BY migration_id
    )
    FROM ledger
  )
)::text;
