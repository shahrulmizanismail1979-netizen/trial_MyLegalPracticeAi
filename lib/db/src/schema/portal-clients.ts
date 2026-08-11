import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Shared client<->matter link table for all portals (lit/crim/sya/corp/ccb/acc).
 *
 * Lets a lawyer link an existing client record (case_clients) directly to a
 * specific matter, many-to-many. This does NOT duplicate the client directory —
 * it only records links, keyed by the existing case_clients.id. Everything is
 * scoped by portal + owner_key so no tenant can read or modify another tenant's
 * links.
 *
 * Created at boot via direct SQL (ensureCaseClientMatterTable in the api-server)
 * — NOT drizzle push (rename trap). This schema mirrors that table shape.
 *
 * Note: case_clients itself has no drizzle schema (it is a portal-scoped table
 * created via SQL in the api-server), so client_id is a plain integer here.
 */
export const caseClientMatters = pgTable(
  "case_client_matters",
  {
    id: serial("id").primaryKey(),
    portal: text("portal").notNull(),
    clientId: integer("client_id").notNull(),
    matterId: integer("matter_id").notNull(),
    ownerKey: text("owner_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    linkUniq: uniqueIndex("case_client_matters_portal_client_matter_uniq").on(
      t.portal,
      t.clientId,
      t.matterId,
    ),
    matterIdx: index("idx_case_client_matters_matter").on(t.portal, t.matterId),
    ownerIdx: index("idx_case_client_matters_owner").on(t.portal, t.ownerKey),
  }),
);

export type CaseClientMatter = typeof caseClientMatters.$inferSelect;
