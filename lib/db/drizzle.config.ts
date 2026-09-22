import { defineConfig } from "drizzle-kit";
import path from "path";

// Also protect direct `drizzle-kit push --config ...` invocations, not just
// package scripts. Studio/introspection remain available.
const { assertSafeSchemaCommand } = require("./schema-push-policy.cjs");
assertSafeSchemaCommand();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
