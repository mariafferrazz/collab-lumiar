import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { getRequiredServerEnvironmentVariable } from "@/lib/server/env";

function createPostgresClient() {
  return postgres(getRequiredServerEnvironmentVariable("DATABASE_URL"), {
    max: 5,
    connect_timeout: 10,
    idle_timeout: 20,
    prepare: false,
  });
}

const globalForDatabase = globalThis as typeof globalThis & {
  collabPostgresClient?: ReturnType<typeof createPostgresClient>;
};

const postgresClient =
  globalForDatabase.collabPostgresClient ?? createPostgresClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.collabPostgresClient = postgresClient;
}

export const database = drizzle({ client: postgresClient, schema });
