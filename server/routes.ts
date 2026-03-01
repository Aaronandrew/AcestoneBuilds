import type { Express } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { insertLeadSchema, type Lead } from "@shared/schema";
import { z } from "zod";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// --- SES Email Notifications ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@acestonellc.com";

let sesClient: SESClient | null = null;
function getSesClient(): SESClient | null {
  if (!process.env.SES_FROM_EMAIL) {
    console.log("[SES] SES_FROM_EMAIL not set — skipping email");
    return null;
  }
  if (!sesClient) {
    const config: Record<string, any> = { region: process.env.AWS_REGION || "us-east-1" };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
    sesClient = new SESClient(config);
  }
  return sesClient;
}

async function sendEmail(to: string, subject: string, textBody: string, htmlBody: string) {
  const client = getSesClient();
  const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;
  if (!client || !SES_FROM_EMAIL) return;

  try {
    await client.send(new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: textBody },
          Html: { Data: htmlBody },
        },
      },
    }));
    console.log(`[SES] Email sent to ${to}: ${subject}`);
  } catch (error: any) {
    console.error(`[SES] Failed to send email to ${to}:`, error.message);
  }
}

async function sendLeadEmails(lead: Lead) {
  const jobLabel = lead.jobType.charAt(0).toUpperCase() + lead.jobType.slice(1);

  // 1. Email to admin
  sendEmail(
    ADMIN_EMAIL,
    `New Quote Request from ${lead.fullName}`,
    `New lead submitted:\n\nName: ${lead.fullName}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nJob Type: ${jobLabel}\nSquare Footage: ${lead.squareFootage}\nUrgency: ${lead.urgency}\nEstimated Quote: $${lead.quote}\nMessage: ${lead.message || "(none)"}`,
    `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #1a1a1a;">New Quote Request</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${lead.fullName}</td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;"><a href="tel:${lead.phone}">${lead.phone}</a></td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold;">Job Type:</td><td style="padding: 8px;">${jobLabel}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Square Footage:</td><td style="padding: 8px;">${lead.squareFootage} sq ft</td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold;">Urgency:</td><td style="padding: 8px;">${lead.urgency}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Estimated Quote:</td><td style="padding: 8px; font-size: 18px; color: #2563eb;"><strong>$${lead.quote}</strong></td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold;">Message:</td><td style="padding: 8px;">${lead.message || "(none)"}</td></tr>
        </table>
      </div>
    `,
  ).catch(() => {});

  // 2. Email to the customer
  sendEmail(
    lead.email,
    `Your Acestone Development Quote — $${lead.quote}`,
    `Hi ${lead.fullName},\n\nThank you for requesting a free estimate from Acestone Development!\n\nHere's a summary of your request:\n- Job Type: ${jobLabel}\n- Square Footage: ${lead.squareFootage} sq ft\n- Urgency: ${lead.urgency}\n- Estimated Quote: $${lead.quote}\n\nOur team will review your project and get back to you within 24 hours with a detailed proposal.\n\nBest regards,\nAcestone Development Team`,
    `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #1a1a1a;">Thank You, ${lead.fullName}!</h2>
        <p>We've received your free estimate request. Here's a summary:</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Job Type:</strong> ${jobLabel}</p>
          <p style="margin: 4px 0;"><strong>Square Footage:</strong> ${lead.squareFootage} sq ft</p>
          <p style="margin: 4px 0;"><strong>Urgency:</strong> ${lead.urgency}</p>
          <p style="margin: 8px 0; font-size: 20px; color: #2563eb;"><strong>Estimated Quote: $${lead.quote}</strong></p>
        </div>
        <p>Our team will review your project and get back to you within <strong>24 hours</strong> with a detailed proposal.</p>
        <p style="color: #666;">Best regards,<br/>Acestone Development Team</p>
      </div>
    `,
  ).catch(() => {});
}

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
      console.log(`[Lead] Created lead ${lead.id} for ${lead.fullName} (storage: ${process.env.AWS_ACCESS_KEY_ID ? 'AWS' : 'MemStorage'})`);
      sendLeadEmails(lead).catch((err) => console.error("[SES] Email error:", err));
      res.json(lead);
    } catch (error) {
      console.error("[Lead] Failed to create lead:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create lead" });
      }
    }
  });

  // Debug endpoint to check storage mode
  app.get("/api/debug/storage", async (req, res) => {
    const storage = await getStorage();
    const isAWS = storage.constructor.name === 'AWSStorage';
    res.json({
      storage: isAWS ? 'AWS' : 'MemStorage',
      hasAwsCreds: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      region: process.env.AWS_REGION,
      leadsTable: process.env.DYNAMODB_LEADS_TABLE,
      usersTable: process.env.DYNAMODB_USERS_TABLE,
      sesFromEmail: process.env.SES_FROM_EMAIL,
      adminEmail: process.env.ADMIN_EMAIL,
    });
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

      const storage = await getStorage();
      const lead = await storage.createLead(leadData);
      
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

      const storage = await getStorage();
      const lead = await storage.createLead(leadData);
      
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

      const storage = await getStorage();
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

      const storage = await getStorage();
      const lead = await storage.createLead(leadData);
      res.json({ success: true, message: "Test HomeAdvisor lead created", lead });
    } catch (error) {
      res.status(500).json({ error: "Failed to create test HomeAdvisor lead" });
    }
  });

  // Admin authentication
  app.post("/api/auth/login", async (req, res) => {
    try {
      const storage = await getStorage();
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