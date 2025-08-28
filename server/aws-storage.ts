import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Lead, InsertLead, User, InsertUser } from "@shared/schema";
import type { IStorage } from "./storage";
import { randomUUID } from "crypto";

export class AWSStorage implements IStorage {
  private dynamoClient: DynamoDBDocumentClient;
  private dynamoDBClient: DynamoDBClient;
  private sesClient: SESClient;
  private s3Client: S3Client;
  private tableName: string;
  private userTableName: string;
  private bucketName: string;

  constructor() {
    this.dynamoDBClient = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.dynamoClient = DynamoDBDocumentClient.from(this.dynamoDBClient);
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.tableName = process.env.DYNAMODB_LEADS_TABLE || "acestone-leads";
    this.userTableName = process.env.DYNAMODB_USERS_TABLE || "acestone-users";
    this.bucketName = process.env.S3_BUCKET_NAME || "acestone-uploads";
  }

  async initializeTables(): Promise<void> {
    try {
      // Create leads table if it doesn't exist
      await this.createTableIfNotExists(this.tableName, [
        { AttributeName: "id", KeyType: "HASH" }
      ], [
        { AttributeName: "id", AttributeType: "S" }
      ]);

      // Create users table if it doesn't exist
      await this.createTableIfNotExists(this.userTableName, [
        { AttributeName: "id", KeyType: "HASH" }
      ], [
        { AttributeName: "id", AttributeType: "S" }
      ]);

      // Create S3 bucket if it doesn't exist
      await this.createBucketIfNotExists();

      // Create default admin user if it doesn't exist
      await this.createDefaultAdmin();

      console.log("AWS resources initialized successfully");
    } catch (error) {
      console.error("Error initializing AWS resources:", error);
    }
  }

  private async createTableIfNotExists(tableName: string, keySchema: any[], attributeDefinitions: any[]): Promise<void> {
    try {
      await this.dynamoDBClient.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`Table ${tableName} already exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Creating table ${tableName}...`);
        await this.dynamoDBClient.send(new CreateTableCommand({
          TableName: tableName,
          KeySchema: keySchema,
          AttributeDefinitions: attributeDefinitions,
          BillingMode: 'PAY_PER_REQUEST',
        }));
        console.log(`Table ${tableName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  private async createBucketIfNotExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      console.log(`S3 bucket ${this.bucketName} already exists`);
    } catch (error: any) {
      if (error.name === 'NotFound') {
        console.log(`Creating S3 bucket ${this.bucketName}...`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        console.log(`S3 bucket ${this.bucketName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  private async createDefaultAdmin(): Promise<void> {
    try {
      const existingAdmin = await this.getUserByUsername("admin");
      if (!existingAdmin) {
        await this.createUser({
          username: "admin",
          password: "admin123", // In production, this should be hashed
        });
        console.log("Default admin user created");
      }
    } catch (error) {
      console.error("Error creating default admin user:", error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const command = new QueryCommand({
        TableName: this.userTableName,
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
          ":id": id,
        },
      });

      const result = await this.dynamoClient.send(command);
      return result.Items?.[0] as User;
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const command = new ScanCommand({
        TableName: this.userTableName,
        FilterExpression: "username = :username",
        ExpressionAttributeValues: {
          ":username": username,
        },
      });

      const result = await this.dynamoClient.send(command);
      return result.Items?.[0] as User;
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser: User = { ...user, id };

    const command = new PutCommand({
      TableName: this.userTableName,
      Item: newUser,
    });

    await this.dynamoClient.send(command);
    return newUser;
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
      message: insertLead.message || null,
      source: insertLead.source || "website",
      externalId: insertLead.externalId || null,
      budget: insertLead.budget || null,
      zipCode: insertLead.zipCode || null,
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...lead,
        createdAt: lead.createdAt?.toISOString(),
        updatedAt: lead.updatedAt?.toISOString(),
      },
    });

    await this.dynamoClient.send(command);

    // Send email notification
    await this.sendLeadNotification(lead);

    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
      });

      const result = await this.dynamoClient.send(command);
      const leads = (result.Items || []).map(item => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : null,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
      })) as Lead[];

      // Sort by creation date (newest first)
      return leads.sort((a, b) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
    } catch (error) {
      console.error("Error getting leads:", error);
      return [];
    }
  }

  async getLead(id: string): Promise<Lead | undefined> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
          ":id": id,
        },
      });

      const result = await this.dynamoClient.send(command);
      const item = result.Items?.[0];
      
      if (!item) return undefined;

      return {
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : null,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
      } as Lead;
    } catch (error) {
      console.error("Error getting lead:", error);
      return undefined;
    }
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead | undefined> {
    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      });

      const result = await this.dynamoClient.send(command);
      const item = result.Attributes;
      
      if (!item) return undefined;

      return {
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : null,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
      } as Lead;
    } catch (error) {
      console.error("Error updating lead status:", error);
      return undefined;
    }
  }

  async getLeadStats(): Promise<{
    totalLeads: number;
    newLeads: number;
    inProgress: number;
    totalRevenue: number;
  }> {
    try {
      const leads = await this.getLeads();
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
    } catch (error) {
      console.error("Error getting lead stats:", error);
      return {
        totalLeads: 0,
        newLeads: 0,
        inProgress: 0,
        totalRevenue: 0,
      };
    }
  }

  async uploadPhoto(file: Buffer, fileName: string): Promise<string> {
    const key = `photos/${Date.now()}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: "image/jpeg",
    });

    await this.s3Client.send(command);
    
    // Generate signed URL for access
    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    
    return await getSignedUrl(this.s3Client, getCommand, { expiresIn: 3600 * 24 * 7 }); // 7 days
  }

  private async sendLeadNotification(lead: Lead): Promise<void> {
    try {
      const customerEmailCommand = new SendEmailCommand({
        Destination: {
          ToAddresses: [lead.email],
        },
        Message: {
          Body: {
            Html: {
              Charset: "UTF-8",
              Data: `
                <h2>Thank you for contacting Acestone Development LLC</h2>
                <p>Hi ${lead.fullName},</p>
                <p>Thank you for reaching out to Acestone Development. Based on your request, your estimated project cost is <strong>$${parseFloat(lead.quote).toLocaleString()}</strong>.</p>
                <p>We'll follow up shortly to schedule a walkthrough and provide a detailed quote.</p>
                <p><strong>Project Details:</strong></p>
                <ul>
                  <li>Job Type: ${lead.jobType}</li>
                  <li>Square Footage: ${lead.squareFootage}</li>
                  <li>Urgency: ${lead.urgency}</li>
                  ${lead.message ? `<li>Message: ${lead.message}</li>` : ''}
                </ul>
                <p>Best regards,<br>Acestone Development LLC</p>
                <p>Phone: (555) 123-STONE<br>Email: admin@acestonedev.com</p>
              `,
            },
            Text: {
              Charset: "UTF-8",
              Data: `Hi ${lead.fullName}, thank you for reaching out to Acestone Development. Based on your request, your estimated project cost is $${parseFloat(lead.quote).toLocaleString()}. We'll follow up shortly to schedule a walkthrough.`,
            },
          },
          Subject: {
            Charset: "UTF-8",
            Data: `Your Acestone Development Quote - $${parseFloat(lead.quote).toLocaleString()}`,
          },
        },
        Source: process.env.SES_FROM_EMAIL || "admin@acestonedev.com",
      });

      await this.sesClient.send(customerEmailCommand);

      // Send admin notification
      const adminEmailCommand = new SendEmailCommand({
        Destination: {
          ToAddresses: ["admin@acestonedev.com"],
        },
        Message: {
          Body: {
            Html: {
              Charset: "UTF-8",
              Data: `
                <h2>New Lead Received</h2>
                <p><strong>Source:</strong> ${lead.source?.toUpperCase()}</p>
                <p><strong>Customer:</strong> ${lead.fullName}</p>
                <p><strong>Email:</strong> ${lead.email}</p>
                <p><strong>Phone:</strong> ${lead.phone}</p>
                <p><strong>Job Type:</strong> ${lead.jobType}</p>
                <p><strong>Square Footage:</strong> ${lead.squareFootage}</p>
                <p><strong>Urgency:</strong> ${lead.urgency}</p>
                <p><strong>Calculated Quote:</strong> $${parseFloat(lead.quote).toLocaleString()}</p>
                ${lead.message ? `<p><strong>Message:</strong> ${lead.message}</p>` : ''}
                ${lead.budget ? `<p><strong>Budget:</strong> ${lead.budget}</p>` : ''}
                ${lead.zipCode ? `<p><strong>Zip Code:</strong> ${lead.zipCode}</p>` : ''}
                ${lead.externalId ? `<p><strong>External ID:</strong> ${lead.externalId}</p>` : ''}
              `,
            },
          },
          Subject: {
            Charset: "UTF-8",
            Data: `New ${lead.source?.toUpperCase()} Lead - ${lead.fullName} - $${parseFloat(lead.quote).toLocaleString()}`,
          },
        },
        Source: process.env.SES_FROM_EMAIL || "admin@acestonedev.com",
      });

      await this.sesClient.send(adminEmailCommand);
    } catch (error) {
      console.error("Error sending email notifications:", error);
      // Don't throw error - email failure shouldn't break lead creation
    }
  }
}