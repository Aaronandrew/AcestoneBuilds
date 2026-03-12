import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// CRM Pipeline Stages
export const CRM_STAGES = [
  "new_lead",
  "calendly_sent",
  "meeting_booked",
  "meeting_completed",
  "estimate_sent",
  "contract_sent",
  "contract_signed",
  "job_in_progress",
  "job_completed",
  "pending_survey",
  "closed",
] as const;

export type CrmStage = typeof CRM_STAGES[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  new_lead: "New Lead",
  calendly_sent: "Calendly Sent",
  meeting_booked: "Meeting Booked",
  meeting_completed: "Meeting Done",
  estimate_sent: "Estimate Sent",
  contract_sent: "Contract Sent",
  contract_signed: "Contract Signed",
  job_in_progress: "Job In Progress",
  job_completed: "Job Completed",
  pending_survey: "Pending Survey",
  closed: "Closed",
};

export const CRM_STAGE_COLORS: Record<CrmStage, string> = {
  new_lead: "bg-yellow-100 text-yellow-800 border-yellow-300",
  calendly_sent: "bg-blue-100 text-blue-800 border-blue-300",
  meeting_booked: "bg-indigo-100 text-indigo-800 border-indigo-300",
  meeting_completed: "bg-purple-100 text-purple-800 border-purple-300",
  estimate_sent: "bg-pink-100 text-pink-800 border-pink-300",
  contract_sent: "bg-orange-100 text-orange-800 border-orange-300",
  contract_signed: "bg-amber-100 text-amber-800 border-amber-300",
  job_in_progress: "bg-cyan-100 text-cyan-800 border-cyan-300",
  job_completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  pending_survey: "bg-teal-100 text-teal-800 border-teal-300",
  closed: "bg-green-100 text-green-800 border-green-300",
};

// CRM Timeline event
export interface CrmTimelineEvent {
  id: string;
  date: string;
  stage: CrmStage;
  event: string;
  notes?: string;
  actor?: string; // "system" | "admin" | "customer" | "worker"
}

// Full CRM data stored as JSONB on the lead
export interface CrmData {
  crmStatus: CrmStage;
  calendlyLink?: string;
  calendlySentAt?: string;
  meetingDate?: string;
  meetingBookedAt?: string;
  meetingNotes?: string;
  meetingRecordingUrl?: string;
  meetingTranscript?: string;
  detailedEstimate?: string;
  estimateSentAt?: string;
  contractAmount?: string;
  contractDepositPercent?: string;
  contractSentAt?: string;
  contractSignedAt?: string;
  contractNotes?: string;
  jobStartDate?: string;
  jobEndDate?: string;
  assignedWorker?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  completionNotes?: string;
  completionDate?: string;
  surveyRating?: number;
  surveyFeedback?: string;
  surveyCompletedAt?: string;
  timeline: CrmTimelineEvent[];
}

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
  crmData: jsonb("crm_data").$type<CrmData>(),
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
  quote: z.string().optional(), // Quote is calculated on client side
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
