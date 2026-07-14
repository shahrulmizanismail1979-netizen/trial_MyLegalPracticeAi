import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { litConversations } from "./lit-conversations";

export const litMessages = pgTable("lit_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => litConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLitMessageSchema = createInsertSchema(litMessages).omit({
  id: true,
  createdAt: true,
});

export type LitMessage = typeof litMessages.$inferSelect;
export type InsertLitMessage = z.infer<typeof insertLitMessageSchema>;
