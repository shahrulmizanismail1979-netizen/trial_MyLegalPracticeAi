import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { corpConversations } from "./corp-conversations";

export const corpMessages = pgTable("corp_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => corpConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCorpMessageSchema = createInsertSchema(corpMessages).omit({
  id: true,
  createdAt: true,
});

export type CorpMessage = typeof corpMessages.$inferSelect;
export type InsertCorpMessage = z.infer<typeof insertCorpMessageSchema>;
