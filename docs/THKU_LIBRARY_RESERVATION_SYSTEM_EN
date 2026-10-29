#  THKU University 24/7 Library Group Study Rooms Reservation & Kiosk Check-In System
### Corporate System Architecture, Security Standards, and Engineering Documentation (v1.0 – v4.0 Production)

---

##  1. Project Overview & Architectural Vision (Executive Overview)

This project is a fully autonomous **Group Study Rooms Reservation, Physical Kiosk QR Check-In, and Analytics Management System** operating 24/7, developed to corporate standards for **University of Turkish Aeronautical Association (THKU)** students, faculty, and library administration.

Built on corporate security, zero-abuse, and autonomous operation principles, the system brings together the following core capabilities under a single roof:
- **Microsoft Entra ID (Azure AD) Single Sign-On (SSO) and Subdomain Role Isolation**,
- **4-Layer Physical Kiosk Security and Incognito-Protected WebGL Hardware Fingerprint Locking**,
- **An Autonomous Lifecycle, Fair No-Show Penalty, and Auto-Ban Engine (`lifecycle.js`) Running Every 30 Seconds**,
- **Dynamic "Walk-In" Time Window Algorithm That Instantly Re-Opens Vacated Rooms during Intermediary Minutes**,
- **Event-Driven Asynchronous Corporate HTML Email Notification Infrastructure (`mail.thk.edu.tr`)**,
- **A 6-Tab Management Center Generating 24/7 Occupancy Heatmaps, Department/Room Analytics, and A4 PDF Activity Reports**.

---

##  2. Tech Stack & Infrastructure Architecture

The project is built on a decoupled, modern Full-Stack JavaScript architecture designed for high availability, zero race conditions, and rapid response times:

- **Frontend (Client Layer):** React.js (Vite), React Router v6, Material-UI (`@mui/material` v5)
- **Design System:** Custom `theme.js` configuration (Corporate color palette, typography hierarchy, and `@media print` A4 reporting compliance)
- **Internationalization (i18n):** **100% Turkish (`TR`) and English (`EN`)** dual-language support across all interfaces, agreements, and notifications via `i18next` & `react-i18next`
- **Backend (Server & API Layer):** Next.js App Router API Routes (`/*`) and Edge Middleware
- **Authentication (SSO):** `next-auth` — Microsoft Entra ID (`azure-ad` OAuth 2.0 / OpenID Connect) + Environment-controlled secure Demo/Presentation Mode
- **Relational Database & ORM:** PostgreSQL & Prisma ORM v5.22 (*Singleton* design pattern on `db.js` to prevent connection pool exhaustion)
- **In-Memory Cache & Kiosk Status Engine:** Redis (`ioredis` — Single-use Kiosk OTP tokens, real-time group attendance sets, and 4-hour device/hardware locks)
- **Corporate Email Engine:** `nodemailer` (`mail.thk.edu.tr` TLS/587 integration, `EmailQueue` database queue, and responsive HTML template engine featuring the THKU logo)

---

##  3. NextAuth + Microsoft Azure AD (Entra ID) Complete Flow & Role Architecture

### 3.1. Purpose and Domain Separation
The system is designed to authenticate both students and library/IT staff through a single Microsoft Azure AD corporate login gateway and route them to isolated panels based on their roles:

- `This will be added later; it's not certain yet.` → **Student Study Room Portal** (`STUDENT`)
- `This will be added later; it's not certain yet.` → **Library Management & Analytics Center** (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`)

### 3.2. Detailed OAuth 2.0 / OpenID Connect Flow Steps
1. **Step 1 — User Login Request:** The user clicks *"Sign in with Microsoft"* on the `Login.jsx` screen (`Frontend → /api/auth/signin/azure-ad`).
2. **Step 2 — NextAuth Provider Initialization:** On the backend, NextAuth initializes the OAuth flow using `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.
3. **Step 3 — Redirection to Azure AD:** The user is redirected to the Microsoft Entra ID sign-in page.
4. **Step 4 — Corporate Authentication:** Azure AD verifies the username, password, and corporate MFA processes; only corporate accounts ending in `@stu.thk.edu.tr` and `@thk.edu.tr` are permitted.
5. **Step 5 — Callback Processing:** Following successful validation, the user is redirected to the backend callback endpoint `/api/auth/callback/azure-ad`, exchanging the authorization code for access/id tokens.
6. **Step 6 — Session / JWT Generation:** NextAuth generates a JWT session cryptographically signed with `NEXTAUTH_SECRET`.
7. **Step 7 — User Record Processing & Autonomous Audit:**
    - If the user does not exist in the database, a record is automatically created with the `STUDENT` role; otherwise, the Microsoft profile picture (`avatarUrl`) is synchronized (existing administrative roles are preserved).
    - **Auto-Unban (`Auto-Unban`):** If a user's `isBanned` status is `true` but their `banUntil` date has passed, the system automatically clears the ban and penalty points upon login, setting active `PenaltyHistory` records to inactive.
    - The user's current `noShowCount`, `isBanned`, `banUntil`, `banReason`, and `acceptedAgreementVersion` attributes are injected directly into the `session.user` object.
8. **Step 8 — Authorization, Agreement, & Routing:**
    - If the user has not yet accepted the active agreement (`v1.0`), they are forcibly redirected to `/rules` (`RulesAcceptance.jsx`).
    - `ADMIN` and `SUPER_ADMIN` users are directed straight to the `/admin` panel; `STUDENT` users are routed to `/dashboard`.

### 3.3. Logical Flow Diagram

    [User Browser]
              |
              v
    [Frontend Login Screen (Login.jsx)]
              |
              v
    ["Sign in with Microsoft"]
              |
              v
    [Backend /api/auth/signin/azure-ad]
              |
              v
    [NextAuth Azure AD Provider]
              |
              v
    [Microsoft Entra ID / Azure AD Login (@stu.thk.edu.tr / @thk.edu.tr)]
              |
              v
    [Backend /api/auth/callback/azure-ad]
              |
              v
    [NextAuth JWT & Session Creation (NEXTAUTH_SECRET)]
              |
              +-----------------------------------+
              |                                   |
              v                                   v
    [Prisma / PostgreSQL]               [Edge Middleware & Session]
    (Upsert, Avatar Sync, Auto-Unban)   (panel.library.thk.edu.tr Role Guard)
              |                                   |
              +-----------------+-----------------+
                                |
                                v
             [Agreement (v1.0) / Role / Ban Check]
                                |
                 +--------------+--------------+
                 |                             |
                 v                             v
       [Student: /dashboard]        [Staff: /admin & /kiosk]

### 3.4. Common Authentication Error Scenarios & Solutions
- **`AADSTS90112` (Application identifier is expected to be a GUID):** `AZURE_AD_CLIENT_ID` was entered incorrectly or left as a placeholder.
- **`NO_SECRET`:** The `NEXTAUTH_SECRET` environment variable is undefined.
- **`OAuthSignin` Error:** The Redirect URI registered in the Azure Portal (`https://library.thk.edu.tr/api/auth/callback/azure-ad`) does not match the backend callback route, or the Client Secret has expired.

---

##  4. Corporate Security & Secret Management Architecture (Production & Key Vault Standards)

### 4.1. Purpose and Environment Separation
Sensitive configurations stored in the `.env` file during development (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `SMTP_PASS`) are designed to be separated from source code in Production environments and managed centrally via secure environment variables or **Azure Key Vault**.

### 4.2. Recommended Key Vault Key Standards
- `library-reservation-azure-client-id`
- `library-reservation-azure-client-secret`
- `library-reservation-azure-tenant-id`
- `library-reservation-nextauth-secret`
- `library-reservation-database-url`

### 4.3. Periodic Secret Rotation Procedure
Azure AD Client Secrets are generated with an expiration date. Before expiration:
1. A new Client Secret is generated via `Azure Portal → App Registrations → Certificates & Secrets`.
2. The new value is assigned to production environment variables or Key Vault.
3. The backend service is restarted, and the old secret is deactivated.
4. `.env` files are never committed to version control (`GitHub`).

---

##  5. Core Engineering Modules & System Innovations

To transform the system into a self-healing corporate automation that cannot be abused in the physical world, the following **5 core modules** were designed and integrated:

### 5.1. 4-Layer Physical Kiosk Door QR and "Anti-Incognito" Hardware Lock (`kiosk/qr`, `checkin/validate`, `api.js`)
To prevent students from submitting fraudulent attendance from home or a single student scanning a QR code in incognito mode to check in absent peers, a **4-stage defense line** is implemented:
1. **Mandatory Physical Door QR:** Access directly via the `/kiosk` URL route is blocked; access is restricted exclusively to the parameter `?door=thku-study-room` found on A4 posters mounted on study room doors.
2. **Campus Wi-Fi (`eduroam` / `THKU-802.1x`), Mobile Data, and Anti-VPN Inspection:** The client's `navigator.connection` network type (`x-net-type: cellular` block), campus VPN IP blocks (`10.254.x.x` block), and official ULAKNET/THKÜ IP subnets (`212.154.67.x`, `10.2.x.x`) are verified in real time.
3. **1 KM Haversine GPS Radius:** High-accuracy browser GPS coordinates are checked against the THKÜ Türkkuşu Campus Library coordinates (`39.945825, 32.690353`) using the Haversine formula; devices located further than 1000 meters are rejected.
4. **Incognito-Protected WebGL Hardware Fingerprint (`x-hardware-fp`):**
   - Even if a student opens an incognito window and clears cookies or `localStorage`, `api.js` hashes the device's **WebGL Graphics Renderer model**, screen resolution, color depth, CPU core count, and timezone into a unique hardware signature (`hw_...`) using a **32-bit FNV-1a Hash** algorithm.
   - The moment Student A completes a check-in from a phone, that device's `httpOnly` cookie, `localStorage` ID, `WebGL GPU` hardware signature, and `IP+UserAgent` summary are locked in Redis for 4 hours (`TTL: 14400s`) exclusively to Student A. Attempts by Student B to check in using the same phone are instantly detected and rejected.

### 5.2. Autonomous Lifecycle Engine, Fair Discipline Algorithm, and "Walk-In" Room Management (`lifecycle.js`)
An autonomous background engine (`runReservationLifecycleChecks`) running every 30 seconds eliminates manual staff tracking:
- **30-Minute Group Invitation Timeout:** `PENDING` bookings where at least one invitee has not accepted within 30 minutes are automatically cancelled (`AUTO_TIMEOUT_CANCELLED`), immediately releasing the slot back to the calendar.
- **Minimum 2-Person Door QR Rule:** Scanning the door QR code as a single individual does not mark the room as `CHECKED_IN`; at least `MIN_PARTICIPANTS` (2 people) must complete verification from their respective mobile devices.
- **Fair No-Show Penalty (`verifiedUsers` vs `absentUsers`):** If insufficient members scan the QR code within `+15 minutes` (`CHECKIN_TOLERANCE_MINUTES`) of the start time, the reservation is marked as `NO_SHOW` and opened to other students. **Fairness Rule:** If a group member visited the library and verified their attendance (`verifiedUsers`), they are **never penalized** for absent peers; penalties (`1/3 No-Show`, 15 points) are applied exclusively to absent members (`absentUsers`).
- **3/3 Automatic Ban Mechanism:** Accumulating 3 No-Show infractions (45 points) within a semester automatically suspends a user for **30 days (`AUTO_NO_SHOW_BANNED`)**, clearing upcoming active bookings and freeing up rooms.
- **Normal Bookings vs. Intermediary Walk-In Rooms (`getReservationKioskWindow`):**
   - Normal bookings created before 16:00 (`createdAt <= startTotalMins`) maintain a strict Kiosk approval window of `start ± 15 mins` (e.g., `15:45 – 16:15`); delayed invite approvals (`updatedAt`) never extend this window.
   - However, if an intermediary group books an unfulfilled slot at 16:20 (`createdAt > startTotalMins`) following a 16:16 `NO_SHOW` or early checkout, they receive an immediate 15-minute Kiosk window (`16:20 – 16:35`) starting from their creation timestamp.

### 5.3. Event-Driven Asynchronous Corporate HTML Email Engine (`lifecycle.js`)
- **Zero-Lag UI:** All email dispatches execute asynchronously (`.catch()`) in the background to prevent UI freezing during invitation acceptances and reservations.
- **THKÜ Corporate HTML Template (`buildCorporateEmailHtml`):** All outgoing emails feature responsive professional formatting with the THKÜ logo, corporate red/blue banners, status badges, and detail tables.
- **4 Critical Operational Report Emails Sent to Library Administration (`library@thk.edu.tr`):**
  1. *Room Allocated (`CONFIRMED`):* Sent precisely once when the 2nd person accepts and finalizes the room (`isInitialConfirmation`), avoiding unnecessary noise for subsequent joins.
  2. *Session Started (`CHECKED_IN`):* Dispatched when at least 2 group members unlock the room via QR verification.
  3. *Confirmed Booking Cancellation:* Notifies management alongside group members whenever an active booking is cancelled.
  4. *Automatic Kiosk No-Show Report:* Summarizes attendance metrics and penalties when a booking expires due to unconfirmed attendance.

### 5.4. 6-Tab Management, Analytics, A4 PDF Activity Report, and Audit Center (`AdminPanel.jsx` & `admin/manage/route.js`)
A full-featured management panel built with tiered role permissions for Library Staff (`LIBRARIAN`), Library Director (`ADMIN`), and IT Administrator (`SUPER_ADMIN`):
- **Tab 0 — Occupancy Analysis & A4 PDF Activity Report:**
  - Provides a *Next 1-Hour Operations Radar*, *24-Hour Room Occupancy Chart (`RoomDensityChart`)*, *Department Usage Distribution*, *Room Preference Ranking*, and *24/7 Hourly Occupancy Heatmap*.
  - **One-Click A4 PDF Export:** Triggering `window.print()` hides navigation elements, displays official THKÜ report headers, and structures report cards using `breakInside: 'avoid'` to prevent mid-page splits.
- **Tab 1 — Phone-Supported Live Reservation Management:**
  - Integrates emergency phone numbers (`📞`) submitted in user profiles into search fields, reservation items, and user cards.
  - Staff can execute *Manual Check-In (`FORCE_CHECKIN`)*, *Early Check-Out (`EARLY_FINISH`)*, *No-Show Flagging (`MARK_NO_SHOW`)*, and *Cancellation (`CANCEL`)* with a single click.
- **Tab 2 — Room Management & Graceful Maintenance Mode (`TOGGLE_ROOM`):**
  - Toggling rooms (`R101`–`R104`) offline preserves existing confirmed bookings while halting new reservations.
- **Tab 3 — Multi-Language (`TR`/`EN`) Prioritized Announcement Center:**
  - Publishes and removes announcements across `URGENT`, `HIGH`, `MEDIUM`, and `LOW` priority levels.
- **Tab 4 — Student Moderation, Scheduled/Permanent Bans & Role Hierarchy:**
  - Administrators can issue temporary bans via calendar selection (with `+7`, `+14`, `+30`, `+90` day chips) or **Permanent (Perma) Bans**, lift bans, and reset warning counters.
  - **Strict Role Hierarchy:** `ADMIN` accounts can only assign `STUDENT <-> LIBRARIAN` roles; assigning `ADMIN` or `SUPER_ADMIN` statuses is restricted exclusively to `SUPER_ADMIN` (IT) accounts.
- **Tab 5 — 7 Dynamic Rule Engines & 180-Day Symmetric Audit Logs:**
  - Adjusts rule parameters (`MIN_PARTICIPANTS`, `MAX_PARTICIPANTS`, `MAX_DURATION_HOURS`, `MAX_ADVANCE_DAYS`, `DAILY_RELEASE_HOUR`, `CHECKIN_TOLERANCE_MINUTES`, `CANCEL_LOCK_MINUTES`) in real time.
  - Displays Student/System logs (`AuditLog`) and Management action logs (`AdminAction`) side-by-side with equal height (`minHeight: 118px`) under a **180-day active display / 365-day archive cleanup** retention policy.

### 5.5. Advanced User Experience (UX) & Role Isolation (`Dashboard`, `MyBookings`, `StudyRooms`, `Navbar`)
- **Consistent Ban Enforcement:** For banned (`isBanned`) users, buttons such as *"Book a Room"*, *"Select Room"*, and *"Accept Group Invitation"* are disabled across `Dashboard.jsx`, `MyBookings.jsx`, and `StudyRooms.jsx`, displaying an *"Account Suspended"* state.
- **Smart Attendee Input (`pendingTypedEmail`):** Valid email addresses typed into the participant field are automatically captured even if the user omits clicking the "Add" button.
- **Time-Locked Early Check-Out & Cancellation:** The *"Early Check-Out"* action becomes available only during active session hours (`isHappeningNow`), while the *"Cancel"* action locks down within `CANCEL_LOCK_MINUTES` (60 mins) of start time.
- **Interactive Notification Center (`Navbar.jsx`):** Students can inspect and respond to pending invitations directly from popup modal dialogs triggered via the notification bell icon.

---

##  6. Database Architecture (Prisma Schema) & Redis Key Map

### 6.1. PostgreSQL / Prisma Tables (`backend/prisma/schema.prisma`)
The system consists of 20 relational tables and 9 enum types:
- **`User`:** Student and personnel records including `role`, `phone`, `avatarUrl`, `penaltyPoints`, `isBanned`, `banUntil`, `banReason`, and `acceptedAgreementVersion`.
- **`Room`:** Study rooms (`R101`–`R104`), capacity constraints, and active status flags.
- **`Reservation` & `ReservationParticipant`:** Booking schedules, states (`PENDING`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW`), `checkedInAt` timestamps, and participant confirmations.
- **`PenaltyHistory`:** Historical logs tracking active/inactive `NO_SHOW` penalties (15 points each).
- **`ReservationRule` & `Agreement`:** Dynamic parameters and version-controlled (`v1.0`) user terms.
- **`Announcement`, `Notification` & `EmailQueue`:** Multilingual announcements, user notifications, and fault-tolerant email dispatch queues.
- **`AuditLog` & `AdminAction`:** Comprehensive activity and administrative audit tracking trails.

### 6.2. Redis In-Memory Key Schema (`backend/src/lib/redis.js`)
- `kiosk:personal_otp:${reservationId}:${userId}` (`TTL: 600s`) — Single-use verification token generated upon door QR code scanning.
- `kiosk:checked_users:${reservationId}` (`Set, TTL: 14400s`) — Set tracking user IDs that have completed room entry confirmation.
- `kiosk:device_lock:${reservationId}:${deviceId}` (`TTL: 14400s`) — Browser device ID lock.
- `kiosk:hw_lock:${reservationId}:${hwFp}` (`TTL: 14400s`) — Incognito-resistant WebGL GPU hardware fingerprint lock.
- `kiosk:ipua_lock:${reservationId}:${ipUaHash}` (`TTL: 14400s`) — Network and user-agent signature lock.

---

##  7. Component-Level Technical Documentation & Development Guidelines (43/43 AI-Ready Docs)

To guarantee long-term maintainability and allow future engineers or AI assistants (Cursor / LLMs) to grasp the codebase instantly, dedicated technical Markdown (`.md`) guides were created across `frontend/docs/` (18 files) and `backend/docs/` (25 files) for **all 43 source files**.

### Development & Safeguard Principles
1. **Strict MUI & Theme-First:** All UI components are constructed using Material-UI (`Box`, `Stack`, `Card`, `Typography`, `Chip`) and styled through `theme.js`.
2. **Europe/Istanbul Timezone Standards:** Regardless of the server's host region, all date and time arithmetic is normalized against the `Europe/Istanbul` timezone and standard `1970-01-01T...Z` UTC formats.
3. **Database & SMTP Safety:** Prisma client instances are accessed strictly via the `@/lib/db` singleton module, while email dispatches run asynchronously through the secure queue (`queueSafeEmail`) inside `@/lib/lifecycle` without blocking UI execution.

---

##  8. Conclusion

The **THKU Library Group Study Rooms Reservation System** has reached production readiness through corporate authentication, physical Kiosk/hardware security, an autonomous lifecycle engine, and comprehensive analytics management:
- **Abuse-Resistant (4-Layer Kiosk + WebGL Hardware Lock),**
- **Self-Healing (Autonomous No-Show handling, Auto-Ban, and Walk-In Room Management),**
- **Fully Auditable (180/365-Day Logs and A4 PDF Activity Reports),**
- **International Standard (TR/EN Dual Language and 43-File Technical Documentation)**.