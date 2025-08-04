import { type Lead, type InsertLead, type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Lead management
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  getLeadStats(): Promise<{
    totalLeads: number;
    newLeads: number;
    inProgress: number;
    totalRevenue: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private leads: Map<string, Lead>;

  constructor() {
    this.users = new Map();
    this.leads = new Map();
    
    // Create default admin user
    const adminId = randomUUID();
    const adminUser: User = {
      id: adminId,
      username: "admin",
      password: "admin123" // In production, this should be hashed
    };
    this.users.set(adminId, adminUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const now = new Date();
    const lead: Lead = {
      ...insertLead,
      id,
      status: "new",
      createdAt: now,
      updatedAt: now,
      photos: insertLead.photos || [],
    };
    this.leads.set(id, lead);
    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values()).sort(
      (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    
    const updatedLead = { ...lead, status, updatedAt: new Date() };
    this.leads.set(id, updatedLead);
    return updatedLead;
  }

  async getLeadStats(): Promise<{
    totalLeads: number;
    newLeads: number;
    inProgress: number;
    totalRevenue: number;
  }> {
    const leads = Array.from(this.leads.values());
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    return {
      totalLeads: leads.length,
      newLeads: leads.filter(lead => 
        lead.createdAt && new Date(lead.createdAt) > weekAgo
      ).length,
      inProgress: leads.filter(lead => lead.status === "in-progress").length,
      totalRevenue: leads
        .filter(lead => lead.status === "completed")
        .reduce((sum, lead) => sum + parseFloat(lead.quote), 0),
    };
  }
}

export const storage = new MemStorage();
