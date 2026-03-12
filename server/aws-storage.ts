import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client
} from "@aws-sdk/client-s3";
import {
  SESClient
} from "@aws-sdk/client-ses";
import { randomUUID } from "crypto";
import type { IStorage } from "./storage";
import type { Lead, InsertLead, User, InsertUser, CrmData } from "@shared/schema";

export class AWSStorage implements IStorage {
  private dbClient: DynamoDBDocumentClient;
  private s3Client: S3Client;
  private sesClient: SESClient;

  private leadsTable: string;
  private usersTable: string;
  private bucketName: string;
  private fromEmail: string;

  constructor() {
    const region = process.env.AWS_REGION || "us-east-1";

    // Only set credentials if running locally (keys exist in .env)
    const hasLocalCreds =
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

    const clientConfig = hasLocalCreds
      ? {
          region,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        }
      : { region }; // In Amplify, IAM role provides creds

    // DynamoDB
    this.dbClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

    // S3
    this.s3Client = new S3Client(clientConfig);

    // SES
    this.sesClient = new SESClient(clientConfig);

    // Tables & config
    this.leadsTable = process.env.DYNAMODB_LEADS_TABLE || "acestone-leads";
    this.usersTable = process.env.DYNAMODB_USERS_TABLE || "acestone-users";
    this.bucketName = process.env.S3_BUCKET_NAME || "acestone-uploads";
    this.fromEmail = process.env.SES_FROM_EMAIL || "no-reply@acestonedev.com";
  }

  // --- Initialization: seed default admin user ---
  async initializeTables(): Promise<void> {
    try {
      // Check if admin user already exists
      const existing = await this.getUserByUsername("admin");
      if (!existing) {
        console.log("[AWS] Seeding default admin user...");
        await this.createUser({ username: "admin", password: "admin123" });
        console.log("[AWS] Default admin user created (admin / admin123)");
      } else {
        console.log("[AWS] Admin user already exists");
      }
    } catch (error: any) {
      console.error("[AWS] Error initializing tables:", error.message);
    }
  }

  // --- User methods ---
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.dbClient.send(new GetCommand({
      TableName: this.usersTable,
      Key: { id },
    }));
    return result.Item as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.dbClient.send(new ScanCommand({
      TableName: this.usersTable,
      FilterExpression: "username = :username",
      ExpressionAttributeValues: { ":username": username },
    }));
    return (result.Items && result.Items[0]) as User | undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    await this.dbClient.send(new PutCommand({
      TableName: this.usersTable,
      Item: user,
    }));
    return user;
  }

  // --- Lead methods ---
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const lead: Record<string, any> = {
      ...insertLead,
      id,
      status: "new",
      createdAt: now,
      updatedAt: now,
      photos: insertLead.photos || [],
      message: insertLead.message || null,
      source: insertLead.source || "website",
      externalId: insertLead.externalId || null,
      budget: insertLead.budget || null,
      zipCode: insertLead.zipCode || null,
      crmData: null,
    };

    await this.dbClient.send(new PutCommand({
      TableName: this.leadsTable,
      Item: lead,
    }));
    return lead as Lead;
  }

  async getLeads(): Promise<Lead[]> {
    const result = await this.dbClient.send(new ScanCommand({
      TableName: this.leadsTable,
    }));
    const leads = (result.Items || []) as Lead[];
    return leads.sort(
      (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const result = await this.dbClient.send(new GetCommand({
      TableName: this.leadsTable,
      Key: { id },
    }));
    return result.Item as Lead | undefined;
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead | undefined> {
    const now = new Date().toISOString();
    try {
      const result = await this.dbClient.send(new UpdateCommand({
        TableName: this.leadsTable,
        Key: { id },
        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt": now,
        },
        ReturnValues: "ALL_NEW",
      }));
      return result.Attributes as Lead | undefined;
    } catch (error) {
      return undefined;
    }
  }

  async updateLeadCrm(id: string, crmData: CrmData): Promise<Lead | undefined> {
    const now = new Date().toISOString();
    try {
      const result = await this.dbClient.send(new UpdateCommand({
        TableName: this.leadsTable,
        Key: { id },
        UpdateExpression: "SET crmData = :crmData, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":crmData": crmData,
          ":updatedAt": now,
        },
        ReturnValues: "ALL_NEW",
      }));
      return result.Attributes as Lead | undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getLeadStats(): Promise<{
    totalLeads: number;
    newLeads: number;
    inProgress: number;
    totalRevenue: number;
  }> {
    const result = await this.dbClient.send(new ScanCommand({
      TableName: this.leadsTable,
    }));
    const leads = (result.Items || []) as Lead[];
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

  // --- S3: upload file ---
  async uploadFile(key: string, body: Buffer | Uint8Array | Blob | string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
    });
    return this.s3Client.send(command);
  }
}
