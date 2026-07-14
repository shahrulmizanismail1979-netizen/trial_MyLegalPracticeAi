import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ccbConversations } from "./ccb-conversations";

export const ccbMessages = pgTable("ccb_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => ccbConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCcbMessageSchema = createInsertSchema(ccbMessages).omit({
  id: true,
  createdAt: true,
});

export type CcbMessage = typeof ccbMessages.$inferSelect;
export type InsertCcbMessage = z.infer<typeof insertCcbMessageSchema>;
