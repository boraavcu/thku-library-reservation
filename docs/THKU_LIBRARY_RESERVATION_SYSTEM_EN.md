<div align="center">

#  UTAA 24/7 Library Group Study Rooms<br/>Reservation & Kiosk Check-In System

### Enterprise System Architecture, Security Standards & Engineering Documentation (v4.0 SOLID Production)

<p align="center">
  <a href="/README.md"><img src="https://img.shields.io/badge/%F0%9F%8F%9B%EF%B8%8F_Home-Root_README-0F172A?style=for-the-badge" alt="Root README" /></a>
  <a href="/docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md"><img src="https://img.shields.io/badge/%F0%9F%93%91_Dili_De%C4%9Fi%C5%9Ftir-T%C3%BCrk%C3%A7e_(TR)-C8102E?style=for-the-badge" alt="Turkish Version" /></a>
  <a href="/backend/docs/README.md"><img src="https://img.shields.io/badge/%E2%9A%99%EF%B8%8F_Backend_Docs-29_Modules-1E3A8A?style=for-the-badge" alt="Backend Docs" /></a>
  <a href="/frontend/docs/README.md"><img src="https://img.shields.io/badge/%F0%9F%92%BB_Frontend_Docs-21_Modules-047857?style=for-the-badge" alt="Frontend Docs" /></a>
</p>

</div>

---

##  1. Executive Overview & Architectural Vision

Built for the **University of Turkish Aeronautical Association (UTAA / THKÜ)** students, faculty, and library administration following **SOLID** software engineering principles, this platform is a **fully autonomous 24/7 Group Study Rooms Reservation, Physical Kiosk QR Check-In, and Analytics Management System**.

| Core Capability | Engineering Solution & Operational Impact |
| :--- | :--- |
| ** Microsoft Entra ID (Azure AD) SSO & Role Isolation** | Enterprise single sign-on, automated ban expiration checks (`Auto-Unban`), and subdomain-level Edge JWT role isolation. |
| ** 4-Layer Physical Kiosk & WebGL Hardware Lock** | Physical door QR parameter, Campus Wi-Fi (`eduroam`) & Anti-VPN verification, Haversine GPS radius, and Incognito-proof WebGL GPU hardware fingerprinting (`kioskSecurity.js`). |
| ** Autonomous Lifecycle & Fair No-Show Engine** | Background scheduler running every 30 seconds (`lifecycle.js`), fair penalty algorithm protecting verified attendees, and automatic 30-day ban on 3/3 violations (`penaltyService.js`). |
| ** Dynamic "Walk-In" Time Window (`timeUtils.js`)** | Instantly releases vacated or No-Show rooms at intermediate minutes and grants walk-in groups a dedicated 15-minute Kiosk check-in window from creation time. |
| ** Event-Driven Corporate HTML Email Service** | Zero-lag asynchronous notifications backed by an `EmailQueue` database table and responsive corporate HTML templates (`emailService.js`). |
| ** 6-Tab Admin Center, Heatmap & A4 PDF Reporting** | 24/7 occupancy heatmap, department/room analytics, one-click A4 PDF activity report, 7 dynamic reservation rules, and 180-day audit logs (`AdminPanel.jsx` & `handlers.js`). |

---

##  2. Tech Stack & Infrastructure Architecture

The platform is engineered on a decoupled, modern Full-Stack JavaScript architecture designed for high availability, zero race conditions, and rapid response times:

| Layer | Technology / Library | Architectural Role & Purpose |
| :--- | :--- | :--- |
| **Frontend (Client)** | React 19 (Vite 7), React Router v7 | Component-driven Single Page Application (SPA) and client-side routing tree |
| **UI & Design System** | Material-UI (`@mui/material` v7), `theme.js` | Corporate color palette (`#C8102E` & `#0F172A`), typography hierarchy, and `@media print` A4 report styling |
| **Multi-Language (i18n)** | `i18next` & `react-i18next` | **100% Bilingual (`TR` & `EN`)** support across all UI screens, agreements, alerts, and notifications |
| **Backend (API & Edge)** | Next.js 16 (App Router), Edge Middleware | Headless RESTful API endpoints (`/api/*`), autonomous background scheduler, and JWT role firewall |
| **Authentication (SSO)** | `next-auth` (v4) — Azure AD Provider | Microsoft Entra ID OAuth 2.0 / OpenID Connect SSO + `.env`-controlled safe Demo Mode |
| **Relational Database** | PostgreSQL 16 & Prisma ORM (`db.js`) | 20-model relational schema with a *Singleton* connection pool pattern preventing HMR exhaustion |
| **In-Memory Cache & OTP** | Redis (`ioredis` — `redis.js`) | 15-minute single-use Kiosk OTP tokens, real-time group attendance sets, and 4-hour device/hardware locks |
| **Email Engine** | `nodemailer` (`emailService.js`) | Corporate SMTP/TLS integration, fault-tolerant `EmailQueue` persistence, and responsive HTML templates |

---

##  3. NextAuth + Microsoft Azure AD (Entra ID) Flow & Role Architecture

### 3.1. Purpose & Domain Separation
The system authenticates both students and library/IT administrators through a unified Microsoft Azure AD gateway while isolating them into role-specific portals:

- **`<STUDENT_PORTAL_DOMAIN>`** *(Configured in production)* → **Student Study Room Portal** (`STUDENT`)
- **`<ADMIN_PANEL_SUBDOMAIN>`** *(Configured in production)* → **Library Administration & Analytics Center** (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`)

### 3.2. Detailed OAuth 2.0 / OpenID Connect Flow Steps
1. **Step 1 — Sign-In Request:** User clicks *"Sign in with Microsoft"* on `Login.jsx` (`Frontend → /api/auth/signin/azure-ad`).
2. **Step 2 — NextAuth Provider Initialization:** NextAuth initiates the OAuth flow using `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.
3. **Step 3 — Redirect to Azure AD:** User is redirected to the Microsoft Entra ID login portal.
4. **Step 4 — Institutional Authentication:** Azure AD verifies credentials and institutional MFA policies, permitting only authorized university student and staff domains.
5. **Step 5 — Callback Execution:** Upon verification, Azure AD redirects to `/api/auth/callback/azure-ad` where the authorization code is exchanged for access and ID tokens.
6. **Step 6 — Session / JWT Generation:** NextAuth generates a cryptographically signed JWT session using `NEXTAUTH_SECRET`.
7. **Step 7 — User Upsert & Autonomous Audit (`auth/[...nextauth]/route.js`):**
   - First-time users are automatically provisioned with the `STUDENT` role; existing users have their Microsoft profile photo (`avatarUrl`) synchronized without overwriting staff roles.
   - **Automatic Ban Expiration (`Auto-Unban`):** If `isBanned` is `true` but `bannedUntil` has passed, the system automatically clears the ban and penalty points on sign-in, deactivates prior `PenaltyHistory` records, and logs `USER_AUTO_UNBANNED` in `AuditLog`.
   - Live `noShowCount`, `isBanned`, `bannedUntil`, `banReason`, and `acceptedAgreementVersion` fields are embedded directly into `session.user`.
8. **Step 8 — Agreement Guard & Role Routing:**
   - Users who have not yet accepted the active `SystemAgreement` version are routed to `/rules` (`RulesAcceptance.jsx`).
   - `LIBRARIAN`, `ADMIN`, and `SUPER_ADMIN` users are routed to `/admin`; `STUDENT` users are routed to `/dashboard`.

### 3.3. Logical Flow Diagram

```text
+-------------------------------------------------------------------------+
|                    [ User Browser (Login.jsx) ]                         |
+-------------------------------------------------------------------------+
                                     |
                          "Sign in with Microsoft"
                                     |
                                     v
+-------------------------------------------------------------------------+
|              [ Backend: /api/auth/signin/azure-ad ]                     |
|         (NextAuth Azure AD Provider & OAuth 2.0 Handshake)              |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|            [ Microsoft Entra ID (Azure AD) Enterprise SSO ]             |
|          (Institutional Auth + MFA + OAuth Token Exchange)              |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|             [ Backend: /api/auth/callback/azure-ad ]                    |
|         (JWT Signing & Session Enrichment - NEXTAUTH_SECRET)            |
+-------------------------------------------------------------------------+
                   |                                   |
                   v                                   v
+------------------------------------+   +--------------------------------+
|       [ Prisma / PostgreSQL ]      |   |   [ Next.js Edge Middleware ]  |
| - User Upsert & Avatar Sync        |   | - Admin Subdomain Firewall     |
| - Auto-Unban (Expired Suspensions) |   | - Role & Privilege Isolation   |
+------------------------------------+   +--------------------------------+
                   |                                   |
                   +-----------------+-----------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|           [ Active SystemAgreement & Role Router Guard ]                |
+-------------------------------------------------------------------------+
                   |                                   |
            (STUDENT Role)               (LIBRARIAN / ADMIN / SUPER_ADMIN)
                   v                                   v
      [ Student: /dashboard ]                [ Staff: /admin & /kiosk ]
```

### 3.4. Common Authentication Error Scenarios & Resolutions

| Error Code | Observed Behavior | Root Cause & Resolution |
| :--- | :--- | :--- |
| **`AADSTS90112`** | *Application identifier is expected to be a GUID* | `AZURE_AD_CLIENT_ID` in `.env` is malformed or left as a placeholder value. |
| **`NO_SECRET`** | NextAuth runtime initialization failure | `NEXTAUTH_SECRET` environment variable is missing (generate via `openssl rand -base64 32`). |
| **`OAuthSignin`** | Redirect loop back to login screen | Azure Portal Redirect URI does not match `/api/auth/callback/azure-ad` or the Client Secret has expired. |

---

##  4. Enterprise Security & Secret Management Architecture (Production & Key Vault Standards)

### 4.1. Environment Isolation
Sensitive configuration values (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `SMTP_PASS`, `LIBRARY_LAT`, `LIBRARY_LNG`, `CAMPUS_IP_PREFIX`) stored in `.env` during local development are strictly decoupled from source code in Production and managed via secure environment variables or **Azure Key Vault**.

### 4.2. Recommended Key Vault Secret Naming Standards

| Key Vault Secret Name | Mapped Environment Variable | Description |
| :--- | :--- | :--- |
| `library-reservation-azure-client-id` | `AZURE_AD_CLIENT_ID` | Azure AD Application (Client) ID |
| `library-reservation-azure-client-secret` | `AZURE_AD_CLIENT_SECRET` | Azure AD Client Secret Value |
| `library-reservation-azure-tenant-id` | `AZURE_AD_TENANT_ID` | Institutional Directory (Tenant) ID |
| `library-reservation-nextauth-secret` | `NEXTAUTH_SECRET` | 256-bit JWT Signing Secret |
| `library-reservation-database-url` | `DATABASE_URL` | PostgreSQL Connection String |
| `library-reservation-smtp-pass` | `SMTP_PASS` | Institutional SMTP Password |

### 4.3. Periodic Secret Rotation Procedure
1. Generate a new Client Secret under `Azure Portal → App Registrations → Certificates & Secrets` before expiration.
2. Update the production environment variable or Azure Key Vault secret.
3. Restart the backend service and revoke the old secret.
4. Never commit `.env` files to Git version control (`GitHub`).

---

##  5. Core Engineering Modules & System Innovations (SOLID)

To ensure zero physical abuse and self-healing autonomous operation, business logic is decoupled into dedicated **SOLID** service modules:

### 5.1. 4-Layer Physical Kiosk Door QR & "Anti-Incognito" Hardware Lock (`kioskSecurity.js`, `kiosk/qr`, `checkin/validate`, `api.js`)
To prevent remote proxy check-ins or a single student scanning multiple times on behalf of absent teammates using Incognito tabs, a **4-stage defense pipeline** is enforced:
1. **Physical Door QR Requirement:** Direct navigation to `/kiosk` is blocked for students; access requires the signed `?door=thku-study-room` parameter scanned from the physical A4 door poster.
2. **Campus Wi-Fi (`eduroam`), Cellular & Anti-VPN Verification (`validateNetworkSecurity`):** Inspects client `navigator.connection` type (blocking `x-network-type: cellular`), blocks institutional VPN subnets (`CAMPUS_VPN_PREFIX`), and verifies campus Wi-Fi IP ranges (`CAMPUS_IP_PREFIX`).
3. **Haversine GPS Radius (`calculateDistanceMeters`):** Computes the great-circle distance between the user's live GPS coordinates and the library center coordinates (`LIBRARY_LAT`, `LIBRARY_LNG`) configured in `.env`, rejecting devices outside `LIBRARY_RADIUS_METERS` (default 1000m).
4. **Incognito-Proof WebGL Hardware Fingerprint & Eduroam NAT-Safe Device Lock (`validateAndLockDevice`):**
   - Even if a student opens an Incognito tab to clear cookies and `localStorage`, `api.js` hashes the device's **WebGL GPU Renderer model**, screen resolution, color depth, CPU core count, and timezone using a **32-bit FNV-1a Hash** (`x-device-fingerprint`).
   - Once Student A checks in on a phone, its `deviceToken` (`kiosk:devlock`), `WebGL GPU` fingerprint (`kiosk:hwlock`), and hardware-salted `IP+UserAgent` digest (`kiosk:iplock` — salted with device identity so distinct phones sharing a campus Eduroam NAT IP never collide) are locked in Redis for 4 hours (`TTL: 14400s`) exclusively to Student A.

### 5.2. Autonomous Lifecycle Engine (`lifecycle.js`), Fair Penalty Service (`penaltyService.js`) & "Walk-In" Window Calculator (`timeUtils.js`)
An autonomous background engine (`runReservationLifecycleChecks`) executes every 30 seconds without human intervention:
- **Midnight (`00:00`) Boundary Protection:** Queries both `yesterdayDateObj` and `todayDateObj` simultaneously so 24/7 reservations crossing midnight in `Europe/Istanbul` time are seamlessly transitioned and monitored.
- **30-Minute Group Invitation Timeout:** `PENDING` reservations that do not receive at least 1 invitee acceptance within 30 minutes of creation are automatically cancelled (`AUTO_CANCEL_INVITE_TIMEOUT`), freeing the room immediately.
- **Minimum 2 Attendees QR Rule:** Scanning the door QR by only 1 member records their personal attendance in Redis but keeps the room in `CONFIRMED`; the room transitions to `CHECKED_IN` only when at least `MIN_PARTICIPANTS` (2 members) scan from their own devices.
- **Fair No-Show Penalty (`verifiedUsers` vs `absentUsers` — `penaltyService.js`):** If fewer than 2 members scan within `+15 minutes` (`CHECKIN_TOLERANCE_MINUTES`) of start time, the reservation becomes `NO_SHOW` and the room is freed. **Fairness Guarantee:** Any student who physically showed up and scanned the door QR (`verifiedUsers`) is **never penalized**; only absent group members (`absentUsers`) receive a `1/3 No-Show` warning (`15 points`).
- **3/3 Automatic 30-Day Ban:** Upon reaching 3 active No-Show warnings (`45 points`), the student is automatically banned for **30 days**, and all of their remaining same-day and future active reservations (`reservationDate >= todayDate`) are cancelled.
- **Scheduled vs. Walk-In Kiosk Window (`getReservationKioskWindow` — `timeUtils.js`):**
  - Standard reservations created before the slot starts (`createdAt <= startTotalMins`, e.g., booked for `16:00`) have a fixed Kiosk check-in window of **`15:45 – 16:15`**.
  - If the first group fails to show up and the room is released at `16:16` (or vacated early via `EARLY_CHECKOUT`), a new walk-in group booking the `16:00 – 18:00` slot at `16:20` (`createdAt > startTotalMins`) is granted a dedicated 15-minute window of **`[createdAt, createdAt + 15 min]` (`16:20 – 16:35`)** to scan in immediately.

### 5.3. Event-Driven Asynchronous Corporate HTML Email Engine (`emailService.js`)
- **Zero-Lag UI Execution:** All SMTP operations execute asynchronously in the background and are tracked in the `EmailQueue` table so user interactions never block on mail server latency.
- **Corporate HTML Template (`buildCorporateEmailHtml`):** Generates responsive HTML emails styled with the university emblem, `#C8102E` crimson and `#0F172A` navy headers, status badges, and participant tables.
- **4 Operational Reports Delivered to Library Administration (`DIRECTOR_EMAIL`):**
  1. *Room Confirmed (`CONFIRMED` — `handleParticipantAcceptedEmails`):* Sent once when minimum group size is reached (`didConfirmReservation`).
  2. *Session Started (`CHECKED_IN` — `sendKioskCheckInEmailToStaff`):* Sent when at least 2 members complete Kiosk QR verification.
  3. *Confirmed Reservation Cancelled (`sendReservationCancelledEmails`):* Notifies all group members and administration with the cancellation reason.
  4. *Automated No-Show & Warning Report (`sendNoShowWarningEmail`):* Reports attendance status, warning count (`1/3`, `2/3`, `3/3`), and automatic ban enforcement.

### 5.4. 6-Tab Modular Admin Center, Analytics, A4 PDF Report & Audit Logs (`AdminPanel.jsx`, `components/admin/*` & `admin/manage/handlers.js`)
The administration portal is modularized into 6 frontend tab components (`components/admin/*`) and a clean backend dispatcher (`route.js`) + action handler suite (`handlers.js`):

| Tab / Module | Frontend Component | Backend Action (`handlers.js`) | Authorized Roles & Functional Summary |
| :--- | :--- | :--- | :--- |
| **Tab 1: Analytics & A4 PDF Report** | `AnalyticsTab.jsx` | `GET /api/admin/manage` | Next-1-hour operational radar, 24-hour room occupancy chart (`RoomDensityChart`), department breakdown, cancellation pie chart, 7x24 Peak Hours Heatmap (`heatmapMatrix`), and one-click A4 PDF activity report (`window.print()`). |
| **Tab 2: Live Reservations** | `ReservationsTab.jsx` | `FORCE_CONFIRM`, `MARK_NO_SHOW`, `ADMIN_CANCEL` | Emergency phone (`📞`) search; one-click manual check-in, fair No-Show marking, and administrative cancellation. |
| **Tab 3: Room Management** | `RoomsTab.jsx` | `ROOM_ACTION` (`CREATE`, `UPDATE`, `TOGGLE_MAINTENANCE`) | Create/update study rooms and toggle graceful Maintenance Mode (`MAINTENANCE`) without cancelling existing confirmed bookings. |
| **Tab 4: Announcements** | `AnnouncementsTab.jsx` | `CREATE_ANNOUNCEMENT` | Publish and delete bilingual (`TR`/`EN`) announcements across `URGENT`, `HIGH`, `MEDIUM`, and `LOW` priorities. |
| **Tab 5: User Moderation** | `UsersTab.jsx` | `USER_MODERATION` (`BAN_USER`, `UNBAN`, `RESET_PENALTY`, `CHANGE_ROLE`) | Calendar-based (`+7`, `+14`, `+30`, `+90` days) or Permanent bans, unbanning, penalty resets, and strict role hierarchy (`ADMIN` can only assign `STUDENT <-> LIBRARIAN`; only `SUPER_ADMIN` can assign `ADMIN` or `SUPER_ADMIN`). |
| **Tab 6: 7 Dynamic Rules & Logs** | `RulesAndLogsTab.jsx` | `UPDATE_RULE`, `CREATE_AGREEMENT` | Live updates for 7 reservation rules, versioned user agreement publishing (`v1.1`, etc.), and 180-day `AuditLog` inspection. |

### 5.5. Advanced UX & Real-Time Slot Filtering (`StudyRooms.jsx`, `ReserveForm.jsx`, `MyBookings.jsx`, `Navbar.jsx`)
- **Real-Time Continuous Slot Filtering (`hasContinuousAvailableSlot`):** In `StudyRooms.jsx`, selecting a date, time window, and duration (e.g., 2 hours) dynamically filters out rooms lacking a continuous free block and passes the chosen date directly to `ReserveForm.jsx`.
- **Consistent Suspension Locks:** For banned (`isBanned`) students, booking and invitation acceptance buttons across `Dashboard.jsx`, `MyBookings.jsx`, and `StudyRooms.jsx` are disabled in *"Account Suspended"* mode.
- **Time-Locked Early Checkout & Cancellation:** *"Early Checkout"* (`EARLY_CHECKOUT`) activates only while a reservation is currently in progress, immediately freeing remaining time for other students; *"Cancel"* locks automatically within `CANCEL_LOCK_MINUTES` (60 min) of start time.

---

##  6. Database Architecture (Prisma Schema) & Redis Key Map

### 6.1. PostgreSQL / Prisma Models (`backend/prisma/schema.prisma`)
The database comprises 20 relational models and 9 enum types; core models include:

| Model Name | Key Fields & Relations | Architectural Responsibility |
| :--- | :--- | :--- |
| **`User`** | `role`, `phone`, `avatarUrl`, `penaltyPoints`, `isBanned`, `bannedUntil`, `banReason`, `acceptedAgreementVersion` | Student and staff identity, role hierarchy, agreement version, and disciplinary state |
| **`Room`** | `name`, `roomNumber`, `capacity`, `status` (`AVAILABLE`, `MAINTENANCE`), `features` | Study rooms (`R101`–`R104`), capacities, and equipment metadata |
| **`Reservation`** | `reservationDate`, `startTime`, `endTime`, `status`, `checkedInAt`, `reminderSent` | Reservation time slots and lifecycle state machine |
| **`ReservationParticipant`** | `reservationId`, `userId`, `status` (`PENDING`, `ACCEPTED`, `REJECTED`) | Group member invitation and acceptance tracking |
| **`PenaltyHistory`** | `userId`, `reservationId`, `penaltyType` (`NO_SHOW`), `penaltyPoints`, `isActive` | Historical record of active/inactive `1/3`, `2/3`, `3/3` No-Show warnings |
| **`ReservationRule`** | `ruleKey`, `ruleValue`, `description`, `isActive` | 7 dynamic reservation parameters managed live via Admin Panel |
| **`SystemAgreement`** | `version`, `title`, `content` (JSON `tr`/`en`), `isActive` | Versioned, bilingual mandatory user rules agreement |
| **`Announcement` & `Notification`** | `title`, `content`, `priority`, `isRead` | Bilingual library announcements and in-app user notifications |
| **`EmailQueue`** | `recipientEmail`, `subject`, `body`, `status` (`PENDING`, `SENT`, `FAILED`), `attempts` | Fault-tolerant corporate SMTP email delivery queue |
| **`AuditLog` & `AdminAction`** | `userId`, `action`, `details`, `ipAddress`, `createdAt` | Comprehensive student, automation, and administrator audit trail |

### 6.2. Redis In-Memory Key Architecture (`backend/src/lib/redis.js` & `kioskSecurity.js`)

| Redis Key Pattern | Data Type | TTL | Purpose |
| :--- | :---: | :---: | :--- |
| `kiosk:personal_otp:${reservationId}:${userId}` | `String` | `900s` (15 min) | Single-use personal verification token generated upon scanning door QR |
| `kiosk:checked_users:${reservationId}` | `Set` | `14400s` (4 hrs) | Set of group member IDs who have completed physical door QR verification |
| `kiosk:devlock:${reservationId}:${deviceToken}` | `String` | `14400s` (4 hrs) | Browser `Cookie` / `localStorage` device token lock |
| `kiosk:hwlock:${reservationId}:${hwFingerprint}` | `String` | `14400s` (4 hrs) | Incognito-proof WebGL GPU hardware fingerprint lock |
| `kiosk:iplock:${reservationId}:${ipUaHash}` | `String` | `14400s` (4 hrs) | Eduroam shared-NAT-compatible, hardware-salted `IP + User-Agent` lock |

---

##  7. Component-Level Technical Documentation & Engineering Guidelines (50/50 AI-Ready Docs)

To ensure long-term maintainability and rapid onboarding for engineers and AI assistants, **all 50 source code modules** are documented in [`frontend/docs/`](/frontend/docs/README.md) (21 files) and [`backend/docs/`](/backend/docs/README.md) (29 files) using the standardized `# Context:` specification.

### Engineering Guidelines
1. **Strict MUI & Theme-First:** All UI surfaces use Material-UI primitives (`Box`, `Stack`, `Card`, `Typography`, `Chip`) governed by `theme.js`.
2. **Centralized Turkey Timezone (`Europe/Istanbul`):** Regardless of server or browser locale, all date and minute calculations are normalized to `Europe/Istanbul` and `1970-01-01T...Z` fake-UTC time via `@/lib/timeUtils` (Backend) and `src/utils/dateUtils` (Frontend).
3. **SOLID Service Separation:** Database access runs exclusively through the `@/lib/db` singleton, Kiosk security through `@/lib/kioskSecurity`, penalties through `@/lib/penaltyService`, and email dispatch asynchronously through `queueSafeEmail` in `@/lib/emailService`.

---

##  8. Conclusion

The **UTAA 24/7 Library Group Study Rooms Reservation & Kiosk Check-In System** combines enterprise SSO authentication, physical hardware-locked Kiosk security, an autonomous lifecycle engine, and modular analytics into a production-grade platform that is:
- **Abuse-Resistant** *(4-layer Kiosk verification + WebGL GPU Hardware Lock + Eduroam NAT safety)*,
- **Self-Managing** *(Autonomous No-Show detection, Fair Penalty protection, 3/3 Auto-Ban, and Walk-In slot recovery)*,
- **Fully Auditable** *(180-Day Audit Logs, 7x24 Peak Hours Heatmap, and A4 PDF Activity Reporting)*,
- **Internationally Standardized** *(100% TR/EN Bilingual UI, SOLID Architecture, and 50-Module Technical Documentation)*.

---

<div align="center">
  <sub>© 2026 <b>Department of Library & Documentation and IT Directorate</b> • Developer: <b>Bora Avcu</b></sub>
</div>
