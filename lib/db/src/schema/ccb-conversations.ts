import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ccbConversations = pgTable("ccb_conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCcbConversationSchema = createInsertSchema(ccbConversations).omit({
  id: true,
  createdAt: true,
});

export type CcbConversation = typeof ccbConversations.$inferSelect;
export type InsertCcbConversation = z.infer<typeof insertCcbConversationSchema>;
