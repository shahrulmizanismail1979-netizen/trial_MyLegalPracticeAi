import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ccbAccessCodes } from "./ccb-access-codes";

export const ccbConversations = pgTable("ccb_conversations", {
  id: serial("id").primaryKey(),
  // Bound to the subscriber's access code so conversations are never visible
  // across subscribers. NULL for admin/static-code sessions (Task #21).
  accessCodeId: integer("access_code_id").references(() => ccbAccessCodes.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCcbConversationSchema = createInsertSchema(ccbConversations).omit({
  id: true,
  createdAt: true,
  accessCodeId: true, // set server-side from authenticated session; never from body
});

export type CcbConversation = typeof ccbConversations.$inferSelect;
export type InsertCcbConversation = z.infer<typeof insertCcbConversationSchema>;
