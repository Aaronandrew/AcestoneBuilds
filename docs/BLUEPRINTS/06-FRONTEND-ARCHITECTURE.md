# Frontend Architecture

> Detailed breakdown of the React client application, component hierarchy, state management, and UI patterns.

## Technology Stack

| Technology          | Version  | Purpose                                    |
|---------------------|----------|--------------------------------------------|
| React               | 18.3.x   | UI framework                               |
| TypeScript          | 5.6.3    | Type safety                                |
| Vite                | 5.4.x    | Build tool & dev server                    |
| Tailwind CSS        | 3.4.x    | Utility-first styling                      |
| shadcn/ui + Radix   | Latest   | Accessible component primitives            |
| TanStack Query      | 5.60.x   | Server state management & caching          |
| React Hook Form     | 7.55.x   | Form state & validation                    |
| Zod                 | 3.24.x   | Schema validation (shared with server)     |
| wouter              | 3.3.x    | Lightweight client-side routing            |
| Lucide React        | 0.453.x  | Icon library                               |
| Framer Motion       | 11.13.x  | Animation library (available, not heavily used) |
| Recharts            | 2.15.x   | Charting library (available for dashboards)|

## Entry Point Chain

```
client/index.html
  └── client/src/main.tsx        (React DOM render)
        └── client/src/App.tsx   (QueryClientProvider → TooltipProvider → Layout → Router)
```

## Component Hierarchy

```
App
├── QueryClientProvider (TanStack Query)
│   └── TooltipProvider (Radix)
│       ├── Header
│       │   ├── Logo (ace.jpg)
│       │   └── Nav Links ("Get Quote", "Admin Portal")
│       ├── <Router>
│       │   ├── Route "/" → Home
│       │   │   └── CustomerForm
│       │   │       ├── Hero Section
│       │   │       ├── Gallery Section (4 images)
│       │   │       ├── Quote Form Card
│       │   │       │   ├── Contact Info (fullName, email, phone)
│       │   │       │   ├── Project Details (jobType, sqft, urgency)
│       │   │       │   ├── Additional Info (message, photo upload)
│       │   │       │   └── QuoteDisplay (live calculation)
│       │   │       └── Features Section (3 cards)
│       │   │
│       │   ├── Route "/admin" → Admin
│       │   │   ├── Login Form (unauthenticated)
│       │   │   └── AdminDashboard (authenticated)
│       │   │       ├── Stats Cards (4x: total, new, in-progress, revenue)
│       │   │       ├── Filters & Actions Bar
│       │   │       │   ├── Status Filter (Select)
│       │   │       │   ├── Job Type Filter (Select)
│       │   │       │   └── Action Buttons (Test Angi, Test HA, Export, Refresh)
│       │   │       └── Leads Table
│       │   │           └── Per-row: Customer info, Job type, Quote, Source badge,
│       │   │               Status badge, Date, Action buttons (View, Contact, Start)
│       │   │
│       │   └── Route "*" → NotFound (404)
│       │
│       ├── Footer
│       │   ├── Company Info
│       │   ├── Services List
│       │   └── Contact Info
│       └── Toaster (toast notifications)
```

## Routing

Uses **wouter** (lightweight alternative to React Router):

| Path      | Component  | Description                        |
|-----------|------------|------------------------------------|
| `/`       | `Home`     | Public quote request form          |
| `/admin`  | `Admin`    | Admin login gate + dashboard       |
| `*`       | `NotFound` | 404 catch-all                      |

Navigation is via `<Link>` components in the Header. Active route is highlighted with `useLocation()`.

## State Management

### Server State (TanStack Query)

All API data flows through TanStack Query:

```typescript
// Fetching leads
useQuery<Lead[]>({ queryKey: ["/api/leads"] })

// Fetching stats
useQuery<Stats>({ queryKey: ["/api/leads/stats"] })
```

**Cache strategy:** `staleTime: Infinity` — data never auto-refreshes. Manual invalidation after mutations:
```typescript
queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
queryClient.invalidateQueries({ queryKey: ["/api/leads/stats"] });
```

### Local State (React useState)

| Component         | State                    | Purpose                           |
|-------------------|--------------------------|-----------------------------------|
| `Admin`           | `isAuthenticated`        | Gate between login/dashboard      |
| `Admin`           | `password`               | Login form input                  |
| `CustomerForm`    | `calculatedQuote`        | Live quote display value          |
| `AdminDashboard`  | `statusFilter`           | Dashboard filter selection        |
| `AdminDashboard`  | `jobTypeFilter`          | Dashboard filter selection        |

### Form State (React Hook Form)

The customer quote form uses React Hook Form with Zod resolver:

```typescript
const form = useForm<InsertLead>({
  resolver: zodResolver(insertLeadSchema),
  defaultValues: { fullName: "", email: "", ... }
});
```

- Validation errors rendered via `<FormMessage />`
- Form watches `jobType`, `squareFootage`, `urgency` for live quote calculation
- On submit: calculates final quote and calls `POST /api/leads`

## Pricing Engine (Client-Side)

**File:** `client/src/lib/pricing.ts`

```typescript
PRICING_RATES = { kitchen: 200, bathroom: 150, painting: 2.50, flooring: 5.00, roofing: 9.00 }
RUSH_MARKUP = 0.15  // 15%

calculateQuote(jobType, squareFootage, urgency) → number
formatCurrency(amount) → string  // e.g., "$45,000.00"
```

This module is also imported by the **server** for webhook quote calculations:
```typescript
const { calculateQuote } = await import("../client/src/lib/pricing");
```

## UI Component Library

The project uses **47 shadcn/ui components** in `client/src/components/ui/`:

Key components actively used:
- `Button`, `Card`, `Input`, `Textarea`, `Label`
- `Select` (with Trigger, Content, Item)
- `Form` (with Field, Item, Label, Control, Message)
- `Table` (with Header, Body, Row, Cell, Head)
- `Badge`, `Skeleton`, `Toast`, `Tooltip`

All components use:
- **class-variance-authority (CVA)** for variant styling
- **tailwind-merge** via `cn()` utility for class merging
- **Radix UI** primitives for accessibility

## Styling Architecture

```
Tailwind CSS 3.4 → PostCSS → Browser
```

- **Global styles:** `client/src/index.css` (CSS variables for theming)
- **Component styles:** Tailwind utility classes inline
- **Theme:** Custom color tokens via CSS variables (primary, accent, muted, etc.)
- **Dark mode:** `next-themes` is a dependency but not actively configured
- **Responsive:** Mobile-first with `md:` and `lg:` breakpoints

## Path Aliases

Configured in `vite.config.ts` and `tsconfig.json`:

| Alias      | Resolves To          |
|------------|----------------------|
| `@/*`      | `client/src/*`       |
| `@shared/*`| `shared/*`           |
| `@assets`  | `attached_assets/`   |

## Build Configuration

**Vite Config** (`vite.config.ts`):
- **Root:** `client/`
- **Output:** `dist/public/`
- **Plugins:** `@vitejs/plugin-react`, `@replit/vite-plugin-runtime-error-modal`
- **Dev server:** Strict filesystem access, denies dotfiles
- **Replit plugin:** Cartographer plugin conditionally loaded in dev on Replit

## Authentication Flow (Admin Page)

```
1. User navigates to /admin
2. Admin component renders login form (isAuthenticated = false)
3. Username is hardcoded to "admin" in the login mutation
4. User enters password → POST /api/auth/login
5. On success: isAuthenticated = true → render AdminDashboard
6. On logout button: isAuthenticated = false → back to login form
7. Page refresh: isAuthenticated resets to false (no persistence)
```

## Key Patterns

- **Optimistic UI:** Not implemented — all mutations wait for server confirmation
- **Error handling:** Toast notifications for both success and failure states
- **Loading states:** Skeleton components while data fetches
- **Empty states:** "No leads found" message in table when filtered results are empty
- **Source badges:** Color-coded by lead source (green=Angi, orange=HomeAdvisor, blue=Website, purple=Manual)
- **Status badges:** Color-coded by lead status (yellow=New, blue=Contacted, orange=In Progress, green=Completed)
