Overview
This is a full-stack contractor management application for Acestone Development LLC. The application allows customers to request construction quotes through an online form and provides an admin dashboard for managing leads and tracking business metrics. The system automatically calculates quotes based on job type, square footage, and urgency, then stores all lead information for follow-up and management.

User Preferences
Preferred communication style: Simple, everyday language.

System Architecture
Frontend Architecture
Framework: React with TypeScript using Vite as the build tool
UI Library: Shadcn/ui components built on Radix UI primitives
Styling: Tailwind CSS with CSS variables for theming
State Management: TanStack Query for server state management
Routing: Wouter for client-side routing
Form Handling: React Hook Form with Zod validation
Backend Architecture
Runtime: Node.js with Express.js framework
Language: TypeScript with ES modules
API Design: RESTful API with JSON responses
Error Handling: Centralized error middleware with structured error responses
Request Logging: Custom middleware for API request/response logging
Data Storage
Database: PostgreSQL with Drizzle ORM for schema management
Development Storage: In-memory storage implementation for development/testing
Connection: Neon Database serverless connection for production
Schema: Shared schema definitions using Drizzle with Zod validation
Authentication & Authorization
Admin Access: Basic username/password authentication
Session Management: Simple in-memory session handling
Default Credentials: Admin user with hardcoded credentials (admin/admin123)
Business Logic
Quote Calculation: Automated pricing based on job type rates, square footage, and rush job multipliers
Lead Management: Status tracking (new, contacted, in-progress, completed)
Analytics: Basic statistics including total leads, revenue tracking, and status breakdowns
Multi-Platform Integration: Webhook endpoints for Angi and HomeAdvisor lead integration
Lead Source Tracking: Visual indicators for lead origins (website, Angi, HomeAdvisor, manual)
External Dependencies
Core Dependencies
@neondatabase/serverless: PostgreSQL database connectivity
drizzle-orm & drizzle-kit: Database ORM and migration tools
express: Web application framework
react & react-dom: Frontend UI framework
@tanstack/react-query: Server state management
react-hook-form: Form handling and validation
zod: Schema validation library
UI & Styling
@radix-ui/*: Comprehensive set of accessible UI primitives
tailwindcss: Utility-first CSS framework
class-variance-authority: Component variant management
lucide-react: Icon library
Development Tools
vite: Build tool and development server
typescript: Type safety and enhanced developer experience
@replit/vite-plugin-*: Replit-specific development enhancements
Utility Libraries
date-fns: Date manipulation and formatting
clsx & tailwind-merge: Conditional CSS class handling
wouter: Lightweight client-side routing
