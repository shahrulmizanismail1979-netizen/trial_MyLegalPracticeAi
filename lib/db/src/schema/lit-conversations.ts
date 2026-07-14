import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litConversations = pgTable("lit_conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLitConversationSchema = createInsertSchema(litConversations).omit({
  id: true,
  createdAt: true,
});

export type LitConversation = typeof litConversations.$inferSelect;
export type InsertLitConversation = z.infer<typeof insertLitConversationSchema>;
