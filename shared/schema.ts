import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  jobType: text("job_type").notNull(),
  squareFootage: integer("square_footage").notNull(),
  urgency: text("urgency").notNull(),
  message: text("message"),
  photos: jsonb("photos").$type<string[]>().default([]),
  quote: decimal("quote", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("new"),
  source: text("source").notNull().default("website"), // website, angi, homeadvisor, manual
  externalId: text("external_id"), // ID from external platform
  budget: text("budget"), // Customer's stated budget range
  zipCode: text("zip_code"), // Service area
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  jobType: z.enum(["kitchen", "bathroom", "painting", "flooring", "roofing"]),
  squareFootage: z.number().min(1, "Square footage must be greater than 0"),
  urgency: z.enum(["normal", "rush"]),
  message: z.string().optional(),
  photos: z.array(z.string()).optional(),
  source: z.enum(["website", "angi", "homeadvisor", "manual"]).default("website"),
  externalId: z.string().optional(),
  budget: z.string().optional(),
  zipCode: z.string().optional(),
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
