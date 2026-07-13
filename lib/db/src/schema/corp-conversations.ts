import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { corpAccessCodes } from "./corp-access-codes";

export const corpConversations = pgTable("corp_conversations", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => corpAccessCodes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCorpConversationSchema = createInsertSchema(corpConversations).omit({
  id: true,
  createdAt: true,
});

export type CorpConversation = typeof corpConversations.$inferSelect;
export type InsertCorpConversation = z.infer<typeof insertCorpConversationSchema>;
