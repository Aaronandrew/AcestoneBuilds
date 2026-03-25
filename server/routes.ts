import type { Express } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { insertLeadSchema, type Lead } from "@shared/schema";
import { z } from "zod";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import { randomUUID } from "crypto";

// --- SES Email Notifications ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@acestonellc.com";

// --- n8n Webhook Integration ---
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL; // e.g. https://your-n8n.com/webhook/xxx
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || ""; // shared secret for auth

type N8nEvent =
  | "lead.created"
  | "crm.stage_changed"
  | "crm.calendly_sent"
  | "crm.meeting_booked"
  | "crm.meeting_completed"
  | "crm.estimate_sent"
  | "crm.contract_sent"
  | "crm.contract_signed"
  | "crm.job_started"
  | "crm.job_completed"
  | "crm.survey_requested"
  | "crm.closed";

async function fireN8nWebhook(event: N8nEvent, payload: Record<string, any>) {
  if (!N8N_WEBHOOK_URL) return;
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(N8N_WEBHOOK_SECRET ? { "X-Webhook-Secret": N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
    console.log(`[n8n] Fired ${event} → ${res.status}`);
  } catch (error: any) {
    console.error(`[n8n] Failed to fire ${event}:`, error.message);
  }
}

let sesClient: SESClient | null = null;
let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!process.env.S3_BUCKET_NAME) {
    console.log("[S3] S3_BUCKET_NAME not set — skipping uploads");
    return null;
  }
  if (!s3Client) {
    const config: Record<string, any> = { region: process.env.AWS_REGION || "us-east-1" };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
    s3Client = new S3Client(config);
  }
  return s3Client;
}

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

  // Build image gallery for emails using presigned S3 URLs
  let imageGalleryHtml = '';
  let imageListText = '';
  if (lead.photos && lead.photos.length > 0) {
    const client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;
    let emailPhotoUrls: string[] = [];

    if (client && bucketName) {
      for (const proxyUrl of lead.photos) {
        try {
          // Convert proxy URL "/api/photos/leads/xxx" to S3 key "leads/xxx"
          const key = proxyUrl.replace('/api/photos/', '');
          const presigned = await getSignedUrl(client, new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
          }), { expiresIn: 604800 }); // 7 days
          emailPhotoUrls.push(presigned);
        } catch {
          emailPhotoUrls.push(proxyUrl);
        }
      }
    } else {
      emailPhotoUrls = [...lead.photos];
    }

    imageGalleryHtml = `
      <div style="margin-top: 20px;">
        <h3 style="color: #1a1a1a; font-size: 16px; margin-bottom: 10px;">Project Photos (${lead.photos.length})</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
          ${emailPhotoUrls.map(url => `
            <a href="${url}" target="_blank" style="display: block;">
              <img src="${url}" alt="Project photo" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e5e5;" />
            </a>
          `).join('')}
        </div>
      </div>
    `;
    imageListText = `\n\nProject Photos (${lead.photos.length}):\n${emailPhotoUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}`;
  }

  // 1. Email to admin
  sendEmail(
    ADMIN_EMAIL,
    `New Quote Request from ${lead.fullName}`,
    `New lead submitted:\n\nName: ${lead.fullName}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nJob Type: ${jobLabel}\nSquare Footage: ${lead.squareFootage}\nUrgency: ${lead.urgency}\nEstimated Quote: $${lead.quote}\nMessage: ${lead.message || "(none)"}${imageListText}`,
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
        ${imageGalleryHtml}
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

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload file to S3
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      const client = getS3Client();
      if (!client || !req.file) {
        return res.status(400).json({ error: "Upload not configured or no file provided" });
      }

      const bucketName = process.env.S3_BUCKET_NAME!;
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `leads/${randomUUID()}.${fileExtension}`;

      await client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));

      // Generate proxy URL that serves through Express
      const url = `/api/photos/${fileName}`;
      
      console.log(`[S3] Uploaded file: ${fileName}`);
      res.json({ url });
    } catch (error: any) {
      console.error("[S3] Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Serve photos from S3 through Express proxy
  app.get("/api/photos/leads/:key", async (req, res) => {
    try {
      const client = getS3Client();
      if (!client) {
        return res.status(500).json({ error: "S3 not configured" });
      }

      const bucketName = process.env.S3_BUCKET_NAME!;
      const key = `leads/${req.params.key}`;

      const response = await client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));

      if (response.ContentType) {
        res.setHeader("Content-Type", response.ContentType);
      }
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      const stream = response.Body as any;
      stream.pipe(res);
    } catch (error: any) {
      console.error("[S3] Photo fetch error:", error.message);
      res.status(404).json({ error: "Photo not found" });
    }
  });

  // Create a new lead
  app.post("/api/leads", async (req, res) => {
    try {
      const storage = await getStorage();
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      console.log(`[Lead] Created lead ${lead.id} for ${lead.fullName} (storage: ${process.env.AWS_ACCESS_KEY_ID ? 'AWS' : 'MemStorage'})`);
      sendLeadEmails(lead).catch((err) => console.error("[SES] Email error:", err));

      // Fire n8n webhook — kicks off the CRM automation workflow
      fireN8nWebhook("lead.created", {
        lead: {
          id: lead.id,
          fullName: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          jobType: lead.jobType,
          squareFootage: lead.squareFootage,
          urgency: lead.urgency,
          quote: lead.quote,
          message: lead.message,
          photos: lead.photos,
          source: lead.source,
        },
      });

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

  // Get single lead
  app.get("/api/leads/:id", async (req, res) => {
    try {
      const storage = await getStorage();
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  // Update lead CRM data
  app.patch("/api/leads/:id/crm", async (req, res) => {
    try {
      const storage = await getStorage();
      const { id } = req.params;
      const crmData = req.body;
      
      const lead = await storage.updateLeadCrm(id, crmData);
      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      // Fire n8n webhook on CRM stage changes
      const stage = crmData.crmStatus;
      const eventMap: Record<string, N8nEvent> = {
        calendly_sent: "crm.calendly_sent",
        meeting_booked: "crm.meeting_booked",
        meeting_completed: "crm.meeting_completed",
        estimate_sent: "crm.estimate_sent",
        contract_sent: "crm.contract_sent",
        contract_signed: "crm.contract_signed",
        job_in_progress: "crm.job_started",
        job_completed: "crm.job_completed",
        pending_survey: "crm.survey_requested",
        closed: "crm.closed",
      };
      const n8nEvent = eventMap[stage] || "crm.stage_changed";
      fireN8nWebhook(n8nEvent, {
        lead: { id, fullName: lead.fullName, email: lead.email, phone: lead.phone },
        crmData,
      });

      res.json(lead);
    } catch (error) {
      console.error("[CRM] Failed to update CRM data:", error);
      res.status(500).json({ error: "Failed to update CRM data" });
    }
  });

  // n8n callback endpoint — n8n calls this to update CRM status
  app.post("/api/n8n/callback", async (req, res) => {
    try {
      // Verify shared secret
      const secret = req.headers["x-webhook-secret"];
      if (N8N_WEBHOOK_SECRET && secret !== N8N_WEBHOOK_SECRET) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { leadId, crmData, action } = req.body;
      if (!leadId) {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      const storage = await getStorage();
      const existingLead = await storage.getLead(leadId);
      if (!existingLead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      // Merge n8n updates into existing CRM data
      const existingCrm = existingLead.crmData || { crmStatus: "new_lead", timeline: [] };
      const mergedCrm = {
        ...existingCrm,
        ...crmData,
        timeline: [
          ...(existingCrm.timeline || []),
          {
            id: randomUUID(),
            date: new Date().toISOString(),
            stage: crmData?.crmStatus || existingCrm.crmStatus,
            event: action || `Updated by n8n automation`,
            actor: "n8n",
          },
        ],
      };

      const lead = await storage.updateLeadCrm(leadId, mergedCrm);
      console.log(`[n8n] Callback: updated lead ${leadId} → ${mergedCrm.crmStatus}`);
      res.json({ success: true, lead });
    } catch (error: any) {
      console.error("[n8n] Callback error:", error.message);
      res.status(500).json({ error: "Failed to process n8n callback" });
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