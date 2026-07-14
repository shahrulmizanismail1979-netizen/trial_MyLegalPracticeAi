import { pgTable, serial, text, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litTheoryTopics = pgTable("lit_theory_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  overview: text("overview").notNull(),
  content: text("content").notNull(),
  legislation: jsonb("legislation").notNull().$type<string[]>(),
  keyPrinciples: jsonb("key_principles").notNull().$type<string[]>(),
  relatedCases: jsonb("related_cases").notNull().$type<string[]>(),
  order: integer("order").notNull().default(0),
});

export const insertLitTheoryTopicSchema = createInsertSchema(litTheoryTopics).omit({ id: true });
export type InsertLitTheoryTopic = z.infer<typeof insertLitTheoryTopicSchema>;
export type LitTheoryTopic = typeof litTheoryTopics.$inferSelect;
