# Security Concerns & Recommendations

> A thorough audit of the current security posture of the Acestone Development system, with prioritized remediation steps.

---

## Critical Issues

### 1. Plaintext Password Storage

**Location:** `server/storage.ts:35`
```typescript
password: "admin123" // In production, this should be hashed
```

**Risk:** Passwords are stored and compared as plaintext strings. Anyone with access to the database (DynamoDB console, memory dump, logs) can read admin credentials.

**Impact:** Full admin dashboard access, lead data exposure, ability to manipulate lead statuses.

**Fix:**
- Use `bcrypt` or `argon2` for password hashing
- Hash on user creation, compare hashes on login
- Rotate the default `admin123` password immediately in production

---

### 2. No Authentication Tokens or Sessions

**Location:** `server/routes.ts:274-290`, `client/src/pages/admin.tsx:13`

**Risk:** The login endpoint validates credentials but does not issue a session cookie, JWT, or any server-side token. Auth state lives entirely in React `useState` — a page refresh logs the user out, and **any client can call protected endpoints without authentication**.

**Impact:** All `/api/leads`, `/api/leads/stats`, and `/api/leads/:id/status` endpoints are publicly accessible. Any unauthenticated user can:
- View all customer PII (names, emails, phones)
- Modify lead statuses
- Access revenue analytics

**Fix:**
- Implement `express-session` with a secure session store (the dependency already exists in `package.json`)
- Or implement JWT-based auth with `httpOnly` cookies
- Add auth middleware to protect `/api/leads*` routes
- The project already has `passport` and `passport-local` as dependencies — wire them up

---

### 3. Unauthenticated Webhook Endpoints

**Location:** `server/routes.ts:100-175`

**Risk:** The Angi and HomeAdvisor webhook endpoints accept POST requests from **any source** with no verification. There is:
- No webhook signature validation
- No shared secret / API key header check
- No IP allowlisting
- No rate limiting

**Impact:** An attacker can flood the system with fake leads, pollute analytics, trigger mass email sending via SES, and waste AWS resources.

**Fix:**
- Implement webhook signature verification (HMAC) for each platform
- Require a shared secret in a custom header (e.g., `X-Webhook-Secret`)
- Add rate limiting middleware (e.g., `express-rate-limit`)
- Validate source IP ranges if platforms publish them

---

## High Severity

### 4. Plaintext Password Comparison on Login

**Location:** `server/routes.ts:281`
```typescript
if (!user || user.password !== password) {
```

**Risk:** Direct string comparison is vulnerable to timing attacks and confirms that passwords are never hashed.

**Fix:** Use `bcrypt.compare()` for constant-time comparison against a hashed password.

---

### 5. No CSRF Protection

**Risk:** The API uses `credentials: "include"` on fetch requests but has no CSRF token validation. If sessions were implemented, state-changing POST/PATCH requests could be forged from malicious sites.

**Fix:**
- Add CSRF middleware (e.g., `csurf` or custom double-submit cookie pattern)
- Validate `Origin` / `Referer` headers on state-changing requests

---

### 6. No Input Sanitization Beyond Zod

**Location:** `shared/schema.ts`, `server/routes.ts`

**Risk:** Zod validates types and basic constraints (e.g., min length, email format) but does **not** sanitize for:
- XSS payloads in `message`, `fullName`, `budget` fields
- SQL injection (mitigated by DynamoDB but relevant if PostgreSQL is used via Drizzle)
- NoSQL injection in DynamoDB query parameters

**Fix:**
- Sanitize HTML/script content in user-submitted text fields
- Use a library like `dompurify` (server-side) or `xss` for output encoding
- Apply strict string patterns via Zod `.regex()` where appropriate

---

## Medium Severity

### 7. Hardcoded Default Admin Credentials

**Location:** `server/storage.ts:33-37`
```typescript
username: "admin",
password: "admin123"
```

**Risk:** Default credentials are committed to source control and identical across all environments.

**Fix:**
- Load admin credentials from environment variables
- Force password change on first login
- Remove hardcoded credentials from source code

---

### 8. No Rate Limiting on Any Endpoint

**Risk:** All endpoints, including login and lead creation, have no rate limiting. This enables:
- Brute-force attacks on `/api/auth/login`
- Lead spam on `/api/leads` and webhook endpoints
- DDoS amplification via email sending

**Fix:**
- Add `express-rate-limit` middleware globally and per-route
- Stricter limits on `/api/auth/login` (e.g., 5 attempts per minute)
- Stricter limits on webhook endpoints

---

### 9. AWS Credentials in Environment Variables

**Location:** `server/aws-storage.ts:28-39`

**Risk:** AWS credentials are passed via environment variables. If the server process is compromised or logs are exposed, credentials could leak.

**Fix:**
- Use IAM roles (instance profiles / task roles) in production instead of access keys
- In AWS Amplify, the app already falls back to IAM role auth — ensure access keys are only used for local development
- Never log environment variables
- Rotate keys regularly

---

### 10. No HTTPS Enforcement

**Risk:** The server binds to `0.0.0.0:PORT` with plain HTTP. In production, TLS must be terminated upstream.

**Fix:**
- Ensure AWS Amplify / CloudFront / ALB provides TLS termination
- Add `Strict-Transport-Security` header
- Redirect HTTP → HTTPS at the load balancer level
- Set `secure: true` on any future session cookies

---

## Low Severity

### 11. Missing Security Headers

**Risk:** No security headers are set (CSP, X-Frame-Options, X-Content-Type-Options, etc.).

**Fix:** Add `helmet` middleware:
```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

### 12. Verbose Error Responses

**Location:** `server/routes.ts` (Zod error details returned to client)
```typescript
res.status(400).json({ error: "Validation error", details: error.errors });
```

**Risk:** Exposes internal validation structure to attackers, aiding reconnaissance.

**Fix:**
- Return generic error messages to clients
- Log detailed errors server-side only

---

### 13. No Logging of Security Events

**Risk:** Failed login attempts, webhook abuse, and unusual activity are not logged or alerted.

**Fix:**
- Log failed auth attempts with IP, timestamp, and username
- Set up CloudWatch alarms for unusual patterns
- Implement an audit trail for lead status changes

---

### 14. Test Endpoints in Production

**Location:** `server/routes.ts:178-272`

**Risk:** `/api/test/angi-lead` and `/api/test/homeadvisor-lead` create fake leads with hardcoded data. These should not exist in production.

**Fix:**
- Gate behind `NODE_ENV !== 'production'` check
- Or require admin authentication to access

---

### 15. Client-Side Photo Upload Not Implemented

**Location:** `client/src/components/customer-form.tsx:285-294`

**Risk:** The photo upload UI exists but is non-functional (button does nothing). The S3 integration exists on the backend (`aws-storage.ts:58-66`) but is not wired to any route.

**Security considerations for when implemented:**
- Validate file types (only images)
- Limit file sizes
- Scan for malware
- Use presigned URLs with short expiration
- Never serve user uploads from the same domain as the app

---

## Summary Priority Matrix

| Priority | Issue | Effort |
|----------|-------|--------|
| **P0** | Plaintext passwords | Medium |
| **P0** | No auth on API routes | Medium |
| **P0** | Unauthenticated webhooks | Low-Medium |
| **P1** | No rate limiting | Low |
| **P1** | Hardcoded admin creds | Low |
| **P1** | No CSRF protection | Medium |
| **P2** | Missing security headers | Low |
| **P2** | Test endpoints in prod | Low |
| **P2** | Input sanitization | Medium |
| **P3** | Verbose error messages | Low |
| **P3** | Security event logging | Medium |
