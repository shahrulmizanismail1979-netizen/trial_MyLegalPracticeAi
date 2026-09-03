import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { litAccessCodes } from "./lit-access-codes";
import { litMatters } from "./lit-matters";

export const litConversations = pgTable("lit_conversations", {
  id: serial("id").primaryKey(),
  // Bound to the subscriber's access code so conversations are never visible
  // across subscribers. NULL for master-code sessions (Task #21).
  accessCodeId: integer("access_code_id").references(() => litAccessCodes.id, {
    onDelete: "cascade",
  }),
  // Explicitly nullable: legacy conversations stay unlinked and must never be
  // inferred into a matter from their numeric ID or tenant ownership alone.
  matterId: integer("matter_id").references(() => litMatters.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLitConversationSchema = createInsertSchema(litConversations).omit({
  id: true,
  createdAt: true,
  accessCodeId: true, // set server-side from authenticated session; never from body
  matterId: true, // accepted only after the server verifies matter ownership
});

export type LitConversation = typeof litConversations.$inferSelect;
export type InsertLitConversation = z.infer<typeof insertLitConversationSchema>;
