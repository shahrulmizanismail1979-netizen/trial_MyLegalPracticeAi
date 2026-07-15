import { pgTable, serial, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";

// Links a Microsoft account email to a per-app access code. One link per
// (email, app) pair. Created the first time a user signs in with Microsoft
// and enters their access code; reused on every later Microsoft login.
export const microsoftLinks = pgTable(
  "microsoft_links",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    app: text("app").notNull(),
    accessCode: text("access_code").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (t) => [unique().on(t.email, t.app)],
);

export type MicrosoftLink = typeof microsoftLinks.$inferSelect;
