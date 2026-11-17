import { createHash } from "node:crypto";

function collect(sql, pattern) {
  return Array.from(sql.matchAll(pattern), (match) => match[1]).sort();
}

export function summarizeMigrationObjects(migrations) {
  const sql = migrations.map((migration) => migration.sql).join("\n");

  return {
    enumTypes: collect(sql, /^CREATE TYPE "([^"]+)"/gmu),
    tables: collect(sql, /^CREATE TABLE "([^"]+)"/gmu),
    indexes: collect(sql, /^CREATE (?:UNIQUE )?INDEX "([^"]+)"/gmu),
    functions: collect(sql, /^CREATE FUNCTION "([^"]+)"/gmu),
    triggers: collect(sql, /^CREATE (?:CONSTRAINT )?TRIGGER "([^"]+)"/gmu),
  };
}

export function migrationSetSha256(migrations) {
  return createHash("sha256")
    .update(
      migrations
        .map((migration) => `${migration.id}:${migration.sha256}`)
        .join("\n"),
      "utf8",
    )
    .digest("hex");
}
