import { pgTable, serial, text, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "firm_users",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().default(0),
    name: text("name").notNull(),
    role: text("role").notNull().default("staff"),
    title: text("title"),
    email: text("email").notNull(),
    activeStatus: boolean("active_status").notNull().default(true),
    phone: text("phone"),
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    whatsappOptInAt: text("whatsapp_opt_in_at"),
    smsOptIn: boolean("sms_opt_in").notNull().default(false),
    smsOptInAt: text("sms_opt_in_at"),
  },
  (table) => [unique().on(table.workspaceId, table.email)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
