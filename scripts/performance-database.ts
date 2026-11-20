import { performance } from "node:perf_hooks";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import {
  getAdminDashboard,
  listArtists,
  listCategories,
  listProducts,
  listStock,
} from "../src/lib/admin/catalog-repository";
import {
  listPersistedVisibleCategories,
  searchPersistedActiveArtists,
  searchPersistedPublishedProducts,
} from "../src/lib/catalog/public-catalog-repository";
import {
  getFinancialDashboard,
  listFinancialChargeRules,
  listFinancialPolicies,
} from "../src/lib/financial/repository";
import { assertLocalAdminEnvironment } from "./lib/local-admin-environment";
import { assertLocalAdminDatabaseIdentity } from "./lib/local-admin-migration-runner";

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return Number(
    (sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle]
    ).toFixed(2),
  );
}

const databaseUrl = assertLocalAdminEnvironment(process.env);
let observedQueries = 0;
const sql = postgres(databaseUrl.toString(), {
  max: 5,
  prepare: false,
  connect_timeout: 5,
  idle_timeout: 5,
  onnotice: () => undefined,
  debug: () => {
    observedQueries += 1;
  },
});
const database = drizzle({ client: sql, schema });
const listInput = { query: "", page: 1, pageSize: 20, status: null };
const publicProductInput = {
  query: "",
  category: null,
  artist: null,
  availability: "all" as const,
  sort: "newest" as const,
  page: 1,
  pageSize: 12,
};
const publicArtistInput = { query: "", page: 1, pageSize: 12 };
const cases = [
  [
    "/",
    () =>
      Promise.all([
        searchPersistedPublishedProducts(database, {
          ...publicProductInput,
          pageSize: 4,
        }),
        searchPersistedActiveArtists(database, {
          ...publicArtistInput,
          pageSize: 4,
        }),
        listPersistedVisibleCategories(database),
      ]),
  ],
  [
    "/produtos",
    () =>
      Promise.all([
        searchPersistedPublishedProducts(database, publicProductInput),
        listPersistedVisibleCategories(database),
      ]),
  ],
  [
    "/artistas",
    () => searchPersistedActiveArtists(database, publicArtistInput),
  ],
  ["/categorias", () => listPersistedVisibleCategories(database)],
  ["/admin", () => getAdminDashboard(database)],
  ["/admin/artistas", () => listArtists(database, listInput)],
  ["/admin/categorias", () => listCategories(database, listInput)],
  ["/admin/produtos", () => listProducts(database, listInput)],
  ["/admin/estoque", () => listStock(database, listInput)],
  [
    "/admin/financeiro",
    () =>
      Promise.all([
        getFinancialDashboard(database),
        listFinancialPolicies(database),
        listFinancialChargeRules(database),
      ]),
  ],
] as const;

async function main() {
  try {
    const identity = await assertLocalAdminDatabaseIdentity(sql, databaseUrl);
    const results = [];

    for (const [route, operation] of cases) {
      const samples = [];
      const queryCounts = [];
      for (let sample = 0; sample < 6; sample += 1) {
        observedQueries = 0;
        const startedAt = performance.now();
        await operation();
        samples.push(Number((performance.now() - startedAt).toFixed(2)));
        queryCounts.push(observedQueries);
      }
      results.push({
        route,
        firstMs: samples[0],
        warmMedianMs: median(samples.slice(1)),
        firstQueryCount: queryCounts[0],
        warmQueryCount: Math.max(...queryCounts.slice(1)),
        samples,
      });
    }

    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          database: identity.database_name,
          PostgreSQLMajor: Math.floor(identity.server_version_number / 10000),
          note: "Somente consultas SELECT no PostgreSQL local; autenticação não incluída.",
          routes: results,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const safeMessage =
      error instanceof Error
        ? error.message
        : "Falha desconhecida no benchmark local.";
    console.error(safeMessage);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

void main();
