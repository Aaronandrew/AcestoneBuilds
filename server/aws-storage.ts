import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client
} from "@aws-sdk/client-s3";
import {
  SESClient
} from "@aws-sdk/client-ses";

export class AWSStorage {
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
    this.leadsTable = process.env.DYNAMODB_LEADS_TABLE || "leads";
    this.usersTable = process.env.DYNAMODB_USERS_TABLE || "users";
    this.bucketName = process.env.S3_BUCKET_NAME || "acestone-default-bucket";
    this.fromEmail = process.env.SES_FROM_EMAIL || "no-reply@acestonedev.com";
  }

  // --- Example function: upload to S3 ---
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
