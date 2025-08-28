import type { Express } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { insertLeadSchema } from "@shared/schema";
import { z } from "zod";

// Helper functions to map external platform job types to our internal types
function mapAngiJobType(angiCategory: string): string {
  const mapping: { [key: string]: string } = {
    'kitchen-remodeling': 'kitchen',
    'bathroom-remodeling': 'bathroom',
    'interior-painting': 'painting',
    'exterior-painting': 'painting',
    'flooring-installation': 'flooring',
    'hardwood-flooring': 'flooring',
    'tile-flooring': 'flooring',
    'roofing-repair': 'roofing',
    'roof-replacement': 'roofing',
  };
  
  return mapping[angiCategory?.toLowerCase()] || 'kitchen'; // Default to kitchen
}

function mapHomeAdvisorJobType(haCategory: string): string {
  const mapping: { [key: string]: string } = {
    'kitchen-renovation': 'kitchen',
    'bathroom-renovation': 'bathroom',
    'painting-services': 'painting',
    'flooring-services': 'flooring',
    'roofing-services': 'roofing',
  };
  
  return mapping[haCategory?.toLowerCase()] || 'kitchen'; // Default to kitchen
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create a new lead
  app.post("/api/leads", async (req, res) => {
    try {
      const storage = await getStorage();
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create lead" });
      }
    }
  });

  // Get all leads
  app.get("/api/leads", async (req, res) => {
    try {
      const storage = await getStorage();
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get lead stats
  app.get("/api/leads/stats", async (req, res) => {
    try {
      const storage = await getStorage();
      const stats = await storage.getLeadStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Update lead status
  app.patch("/api/leads/:id/status", async (req, res) => {
    try {
      const storage = await getStorage();
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["new", "contacted", "in-progress", "completed"].includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      
      const lead = await storage.updateLeadStatus(id, status);
      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }
      
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to update lead status" });
    }
  });

  // Webhook endpoint for Angi leads
  app.post("/api/webhooks/angi", async (req, res) => {
    try {
      const angiData = req.body;
      
      // Transform Angi data to our lead format
      const leadData = {
        fullName: `${angiData.customer?.firstName || ''} ${angiData.customer?.lastName || ''}`.trim(),
        email: angiData.customer?.email || '',
        phone: angiData.customer?.phone || '',
        jobType: mapAngiJobType(angiData.project?.category) as "kitchen" | "bathroom" | "painting" | "flooring" | "roofing",
        squareFootage: parseInt(angiData.project?.squareFootage) || 500, // Default estimate
        urgency: (angiData.project?.urgency === 'ASAP' ? 'rush' : 'normal') as "normal" | "rush",
        message: angiData.project?.description || undefined,
        photos: angiData.project?.photos || [],
        source: 'angi' as const,
        externalId: angiData.leadId,
        budget: angiData.project?.budget || undefined,
        zipCode: angiData.customer?.zipCode || undefined,
        quote: '0', // Will be calculated
      };

      // Calculate quote
      if (leadData.jobType && leadData.squareFootage) {
        const { calculateQuote } = await import("../client/src/lib/pricing");
        const quote = calculateQuote(leadData.jobType as any, leadData.squareFootage, leadData.urgency as any);
        leadData.quote = quote.toString();
      }

      const lead = await storage.createLead(leadData);
      
      // TODO: Send automatic response email here
      
      res.json({ success: true, leadId: lead.id });
    } catch (error) {
      console.error('Angi webhook error:', error);
      res.status(500).json({ error: "Failed to process Angi lead" });
    }
  });

  // Webhook endpoint for HomeAdvisor leads
  app.post("/api/webhooks/homeadvisor", async (req, res) => {
    try {
      const haData = req.body;
      
      // Transform HomeAdvisor data to our lead format
      const leadData = {
        fullName: haData.homeowner?.name || '',
        email: haData.homeowner?.email || '',
        phone: haData.homeowner?.phoneNumber || '',
        jobType: mapHomeAdvisorJobType(haData.request?.serviceCategory) as "kitchen" | "bathroom" | "painting" | "flooring" | "roofing",
        squareFootage: parseInt(haData.request?.projectSize) || 500, // Default estimate
        urgency: (haData.request?.timeframe === 'ASAP' ? 'rush' : 'normal') as "normal" | "rush",
        message: haData.request?.details || undefined,
        photos: haData.request?.attachments || [],
        source: 'homeadvisor' as const,
        externalId: haData.requestId,
        budget: haData.request?.budgetRange || undefined,
        zipCode: haData.homeowner?.zipCode || undefined,
        quote: '0', // Will be calculated
      };

      // Calculate quote
      if (leadData.jobType && leadData.squareFootage) {
        const { calculateQuote } = await import("../client/src/lib/pricing");
        const quote = calculateQuote(leadData.jobType as any, leadData.squareFootage, leadData.urgency as any);
        leadData.quote = quote.toString();
      }

      const lead = await storage.createLead(leadData);
      
      // TODO: Send automatic response email here
      
      res.json({ success: true, leadId: lead.id });
    } catch (error) {
      console.error('HomeAdvisor webhook error:', error);
      res.status(500).json({ error: "Failed to process HomeAdvisor lead" });
    }
  });

  // Test webhook endpoints (for development/testing)
  app.post("/api/test/angi-lead", async (req, res) => {
    try {
      const sampleAngiData = {
        leadId: "test_angi_" + Date.now(),
        customer: {
          firstName: "John",
          lastName: "Smith",
          email: "john.smith@example.com",
          phone: "(555) 123-4567",
          zipCode: "12345"
        },
        project: {
          category: "kitchen-remodeling",
          description: "Need complete kitchen renovation with new cabinets and countertops",
          squareFootage: "300",
          urgency: "normal",
          budget: "$25,000-$35,000"
        }
      };

      // Process through the same logic as the webhook
      const leadData = {
        fullName: `${sampleAngiData.customer.firstName} ${sampleAngiData.customer.lastName}`,
        email: sampleAngiData.customer.email,
        phone: sampleAngiData.customer.phone,
        jobType: mapAngiJobType(sampleAngiData.project.category) as "kitchen" | "bathroom" | "painting" | "flooring" | "roofing",
        squareFootage: parseInt(sampleAngiData.project.squareFootage),
        urgency: "normal" as const,
        message: sampleAngiData.project.description,
        photos: [],
        source: 'angi' as const,
        externalId: sampleAngiData.leadId,
        budget: sampleAngiData.project.budget,
        zipCode: sampleAngiData.customer.zipCode,
        quote: '0',
      };

      const { calculateQuote } = await import("../client/src/lib/pricing");
      const quote = calculateQuote(leadData.jobType, leadData.squareFootage, leadData.urgency);
      leadData.quote = quote.toString();

      const lead = await storage.createLead(leadData);
      res.json({ success: true, message: "Test Angi lead created", lead });
    } catch (error) {
      res.status(500).json({ error: "Failed to create test Angi lead" });
    }
  });

  app.post("/api/test/homeadvisor-lead", async (req, res) => {
    try {
      const sampleHAData = {
        requestId: "test_ha_" + Date.now(),
        homeowner: {
          name: "Sarah Johnson",
          email: "sarah.johnson@example.com",
          phoneNumber: "(555) 987-6543",
          zipCode: "54321"
        },
        request: {
          serviceCategory: "bathroom-renovation",
          details: "Master bathroom remodel including tile work and new fixtures",
          projectSize: "120",
          timeframe: "rush",
          budgetRange: "$15,000-$20,000"
        }
      };

      const leadData = {
        fullName: sampleHAData.homeowner.name,
        email: sampleHAData.homeowner.email,
        phone: sampleHAData.homeowner.phoneNumber,
        jobType: mapHomeAdvisorJobType(sampleHAData.request.serviceCategory) as "kitchen" | "bathroom" | "painting" | "flooring" | "roofing",
        squareFootage: parseInt(sampleHAData.request.projectSize),
        urgency: "rush" as const,
        message: sampleHAData.request.details,
        photos: [],
        source: 'homeadvisor' as const,
        externalId: sampleHAData.requestId,
        budget: sampleHAData.request.budgetRange,
        zipCode: sampleHAData.homeowner.zipCode,
        quote: '0',
      };

      const { calculateQuote } = await import("../client/src/lib/pricing");
      const quote = calculateQuote(leadData.jobType, leadData.squareFootage, leadData.urgency);
      leadData.quote = quote.toString();

      const lead = await storage.createLead(leadData);
      res.json({ success: true, message: "Test HomeAdvisor lead created", lead });
    } catch (error) {
      res.status(500).json({ error: "Failed to create test HomeAdvisor lead" });
    }
  });

  // Admin authentication
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      
      res.json({ message: "Authentication successful", user: { id: user.id, username: user.username } });
    } catch (error) {
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
