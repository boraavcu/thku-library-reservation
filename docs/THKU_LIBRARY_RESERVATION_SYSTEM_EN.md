<div align="center">

# UTAA 24/7 Library Group Study Rooms<br/>Reservation & Kiosk Check-In System

### Enterprise System Architecture, Security Standards & Engineering Documentation (v5.0 SOLID Production)

<p align="center">
  <a href="/README.md"><img src="https://img.shields.io/badge/%F0%9F%8F%9B%EF%B8%8F_Home-Root_README-0F172A?style=for-the-badge" alt="Root README" /></a>
  <a href="/docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md"><img src="https://img.shields.io/badge/%F0%9F%93%91_Dili_De%C4%9Fi%C5%9Ftir-T%C3%BCrk%C3%A7e_(TR)-C8102E?style=for-the-badge" alt="Turkish Version" /></a>
  <a href="/backend/docs/README.md"><img src="https://img.shields.io/badge/%E2%9A%99%EF%B8%8F_Backend_Docs-38_Modules-1E3A8A?style=for-the-badge" alt="Backend Docs" /></a>
  <a href="/frontend/docs/README.md"><img src="https://img.shields.io/badge/%F0%9F%92%BB_Frontend_Docs-24_Modules-047857?style=for-the-badge" alt="Frontend Docs" /></a>
  <a href="/deploy/README.md"><img src="https://img.shields.io/badge/%F0%9F%9A%80_Deployment-Apache_%2B_PM2-7C3AED?style=for-the-badge" alt="Deploy Docs" /></a>
</p>

</div>

---

## 1. Executive Overview & Architectural Vision

Built for the **University of Turkish Aeronautical Association (UTAA / THKÜ)** students, faculty, and library administration following **SOLID** software engineering principles, this platform is a **fully autonomous 24/7 Group Study Rooms Reservation, Physical Kiosk QR Check-In, and Analytics Management System** powered entirely by **PostgreSQL atomic row locks** with zero external cache/Redis dependency.

| Core Capability | Engineering Solution & Operational Impact |
| :--- | :--- |
| **Microsoft Entra ID SSO & Institutional Staff Password Auth** | Microsoft Entra ID (Azure AD) SSO for students & faculty, plus institutional `@thk.edu.tr` staff password sign-in (`scrypt` `N=16384`), 72-hour one-time temporary passwords, mandatory password rotation (`mustChangePassword`), instant `sessionVersion` revocation, and PostgreSQL brute-force rate limiting (`loginRateLimit.js`). |
| **PostgreSQL Atomic 4-Layer Kiosk & WebGL Hardware Lock** | Physical door QR parameter, Campus Wi-Fi (`eduroam`) & Anti-VPN verification, optional Haversine GPS radius, and Incognito-proof WebGL GPU + IP/UA device locking (`kioskSecurity.js`, `kioskStore.js`, `SELECT ... FOR UPDATE`). |
| **Autonomous Lifecycle & Fair No-Show Engine** | Background scheduler running every 30 seconds (`lifecycle.js`), seamless `CONFIRMED` & `CHECKED_IN -> COMPLETED` end-time transitions, fair penalty protection for verified attendees, and automatic 30-day ban on 3/3 violations (`penaltyService.js`). |
| **Centralized Reservation Policy & Quota Engine** | 7 dynamic rules, daily 1-booking quota, night (`21:00–24:00`) / morning (`00:00–08:00`) consecutive rule, and fair banned-user reservation cleanup (`reservationPolicy.js`). |
| **Dynamic "Walk-In" Time Window (`timeUtils.js`)** | Instantly releases vacated or No-Show rooms at intermediate minutes and grants walk-in groups a dedicated 15-minute Kiosk check-in window from creation time. |
| **Event-Driven Corporate HTML Email Service** | Zero-lag asynchronous notifications backed by an `EmailQueue` database table and XSS-hardened responsive corporate HTML templates (`emailService.js`). |
| **`/randevu` Subpath & Apache + PM2 Production Architecture** | Isolated subpath deployment (`runtimePaths.js`, `publicPaths.js`, `apache-randevu.conf`) coexisting cleanly with existing university web services on Windows Server. |

---

## 2. Tech Stack & Infrastructure Architecture

| Layer | Technology / Library | Architectural Role & Purpose |
| :--- | :--- | :--- |
| **Frontend (Client)** | React 19 (Vite 7), React Router v7 | `/randevu` subpath-aware (`runtimePaths.js`) Single Page Application (SPA) |
| **UI & Design System** | Material-UI (`@mui/material` v7), `theme.js` | Corporate color palette (`#C8102E` & `#0F172A`), typography hierarchy, and `@media print` A4 report styling |
| **Multi-Language (i18n)** | `i18next` & `react-i18next` | **100% Bilingual (`TR` & `EN`)** support across all UI screens, agreements, alerts, and notifications |
| **Backend (API & Edge)** | Next.js 16 (App Router), Edge Middleware | Headless RESTful API endpoints (`/api/*`), autonomous background scheduler, and JWT role firewall |
| **Authentication** | `next-auth` (v4) — Azure AD + Credentials | Microsoft Entra ID SSO + `@thk.edu.tr` Staff Password Auth (`scrypt`) + `.env`-guarded Demo Mode |
| **Database & Kiosk State** | PostgreSQL 16 & Prisma ORM (`db.js`) | **24-model** relational schema with `Serializable` booking transactions and `FOR UPDATE` row-locked Kiosk OTP, attendance, and 4-hour device lock tables (`kioskStore.js`) |
| **Email Engine** | `nodemailer` (`emailService.js`, `staffMail.js`) | Corporate SMTP/TLS integration, fault-tolerant `EmailQueue` persistence, and XSS-safe responsive HTML templates |
| **Production Runtime** | Apache (`*:443` Reverse Proxy) + PM2 | Direct static serving of `frontend/dist`, `/randevu/api/` reverse proxy, and `thku-randevu-api` process supervision |

---

## 3. Dual Authentication Architecture: Azure AD SSO & Institutional Staff Password Sign-In

1. **Microsoft Entra ID (Azure AD) Enterprise SSO (`azure-ad`):**
   - `@stu.thk.edu.tr` students and Microsoft-enabled staff sign in with a single click.
   - First-time users are provisioned as `STUDENT`; existing privileged roles (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) are preserved while synchronizing profile metadata, and expired suspensions are cleared automatically (`Auto-Unban`).
2. **Institutional `@thk.edu.tr` Staff Password Sign-In (`staff-login`):**
   - Exclusively accepts institutional `@thk.edu.tr` staff addresses (explicitly excluding `@stu.thk.edu.tr`).
   - Passwords are hashed using Node.js native `crypto.scrypt` (`N=16384, r=8, p=1, 64 bytes`) with random 16-byte salts and verified in constant time via `timingSafeEqual` (`staffAuth.mjs`).
   - `SUPER_ADMIN` administrators provision accounts or reset credentials with **72-hour one-time temporary passwords** (`mustChangePassword = true`).
   - Both the frontend `<RequirePasswordChanged>` guard (`App.jsx`) and backend `checkMustChangePassword` gate (`passwordGate.js`) enforce password rotation on `/change-password` before granting API or UI access.
   - Password changes, role updates, or account deactivation (`isActive = false`) increment `sessionVersion`, immediately revoking any previously issued JWTs.
   - `login_rate_limits` enforces atomic 10-minute brute-force rate limiting per email and client IP (`loginRateLimit.js`).

---

## 4. Core Engineering Modules & System Innovations (SOLID)

### 4.1. PostgreSQL-Native 4-Layer Physical Kiosk Door QR & Hardware Lock (`kioskSecurity.js`, `kioskStore.js`, `kiosk/qr`, `checkin/validate`, `api.js`)
1. **Physical Door QR & Post-Login Return Memory:** Students can only open the check-in screen via `?door=thku-study-room` from the physical door poster. If scanned while logged out, `sessionStorage` (`thku_kiosk_return_door`) preserves the door token and redirects straight back to Kiosk check-in after authentication.
2. **Campus Wi-Fi (`eduroam`), Cellular & Anti-VPN Verification (`verifyCampusNetworkAndVpn`):** Blocks cellular data (`x-net-type: cellular`) and institutional VPN subnets (`CAMPUS_VPN_PREFIX`), and validates campus IP ranges when `ENFORCE_CAMPUS_WIFI="true"`.
3. **Optional Haversine GPS Radius (`ENFORCE_CAMPUS_GPS`):** Validates great-circle distance to `LIBRARY_LAT` / `LIBRARY_LNG` within `LIBRARY_RADIUS_METERS`.
4. **Incognito-Proof Hardware Fingerprint & NAT-Safe PostgreSQL Device Locks:**
   - `api.js` computes an FNV-1a digest of WebGL GPU renderer, orientation-normalized screen metrics, CPU cores, and timezone (`x-hardware-fp`), while `sanitizeDeviceId` strips placeholder tokens (`no-dev-id`, `dev_fallback_browser`, `no-hw`) to prevent false-positive collisions behind shared campus `eduroam` NAT.
   - `finalizeKioskCheckIn` (`kioskStore.js`) acquires a PostgreSQL `SELECT ... FOR UPDATE` lock on the `reservations` row, atomically consumes the `SHA-256` OTP in `kiosk_qr_tokens`, writes 4-hour (`14400s`) locks into `kiosk_device_locks`, records attendance in `kiosk_attendances`, and promotes the booking to `CHECKED_IN` once 2 group members verify.

### 4.2. Autonomous Lifecycle Engine (`lifecycle.js`), Fair Penalty Service (`penaltyService.js`) & Walk-In Window (`timeUtils.js`)
- **30-Minute Invitation Timeout:** Cancels unconfirmed `PENDING` bookings after 30 minutes (`AUTO_TIMEOUT_CANCELLED`).
- **Fair No-Show Protection:** After `+15 minutes` (`CHECKIN_TOLERANCE_MINUTES`) without 2 verified attendees, the room is released as `NO_SHOW`; verified attendees in `kiosk_attendances` receive **zero penalty**, while absent members receive a `1/3` warning (`3/3` triggers an automatic 30-day ban).
- **Automatic End-Time Completion (`CONFIRMED` & `CHECKED_IN -> COMPLETED`):** Transitions both `CONFIRMED` and `CHECKED_IN` reservations to `COMPLETED` as soon as `nowEpochMins >= endEpochMins` while exempting staff `FORCE_CHECKIN` (`checkedInById`) bookings from penalties.
- **Walk-In Window:** Grants intermediate-minute bookings (`createdAt > startTime`) a dedicated `[createdAt, createdAt + 15 min]` check-in window.

### 4.3. 6-Tab Modular Admin Center, Staff Provisioning & Test Data Purge (`AdminPanel.jsx`, `components/admin/*`, `handlers.js`)
- **Analytics & A4 PDF Report (`AnalyticsTab.jsx`):** Live 1-hour radar, 24-hour density chart, 7x24 heatmap, and print-ready A4 PDF reports.
- **Live Reservations (`ReservationsTab.jsx`):** Manual check-in, early finish, No-Show, cancellation, and `isReservationEnded` real-time past/active separation.
- **User Moderation & Institutional Staff Accounts (`UsersTab.jsx`):** Timed/permanent bans, penalty resets, `@thk.edu.tr` staff account creation, 72-hour temporary password resets with one-time copy dialog, and Active/Passive account switches.
- **Test Data Cleanup (`PURGE_TEST_DATA`):** One-click transactional cleanup of `@demo.local` accounts and associated test records for `SUPER_ADMIN`.

---

## 5. Database Architecture (24-Model Prisma Schema)

`backend/prisma/schema.prisma` defines **24 relational tables**, consolidating all operational, Kiosk, and security state inside PostgreSQL:

| Model Name | Key Fields | Architectural Responsibility |
| :--- | :--- | :--- |
| **`User`** | `role`, `isActive`, `passwordHash`, `mustChangePassword`, `tempPasswordExpiresAt`, `sessionVersion`, `penaltyPoints`, `isBanned`, `banUntil` | Student & staff identity, password hashes, session revocation counter, and disciplinary state |
| **`Room` & `Reservation`** | `reservationDate`, `startTime`, `endTime`, `status`, `checkedInAt`, `checkedInById`, `noShow`, `penaltyApplied` | Study rooms (`R101`–`R104`) and reservation lifecycle state machine |
| **`ReservationParticipant`** | `reservationId`, `userId`, `status` (`PENDING`, `ACCEPTED`, `REJECTED`) | Group member invitation and acceptance tracking |
| **`KioskQrToken`** | `reservationId`, `userId`, `tokenHash` (`SHA-256`), `expiresAt` (`10m`) | Single-use personal Kiosk OTP tokens |
| **`KioskAttendance`** | `reservationId`, `userId`, `verifiedAt` (`@@unique([reservationId, userId])`) | Durable record of group members who verified at the room door |
| **`KioskDeviceLock`** | `reservationId`, `lockType` (`DEVICE`, `HARDWARE`, `IP_UA`), `lockKey`, `ownerUserId`, `expiresAt` (`4h`) | 4-hour anti-proxy & Incognito-proof device/hardware locks |
| **`LoginRateLimit`** | `bucketKey` (`email:...` / `ip:...`), `failures`, `windowStart` (`10m`) | Brute-force protection counters for institutional password sign-in |
| **`PenaltyHistory`, `ReservationRule`, `SystemAgreement`, `Announcement`, `EmailQueue`, `AuditLog`, `AdminAction`** | Warnings, 7 dynamic rules, bilingual agreements/announcements, SMTP queue & 180-day audit logs | Governance, fault-tolerant notifications, and full institutional auditability |

---

## 6. Component-Level Technical Documentation (61 Modules + Deployment Guide)

Every source module across the platform is documented in [`frontend/docs/`](/frontend/docs/README.md) (**23 modules + 1 index = 24 files**), [`backend/docs/`](/backend/docs/README.md) (**37 modules + 1 index = 38 files**), and [`deploy/README.md`](/deploy/README.md). Automated test suites (`npm test --prefix backend`) verify PostgreSQL Kiosk concurrency/atomicity and staff password security across 20 test cases.

---

<div align="center">
  <sub>© 2026 <b>Department of Library & Documentation and IT Directorate</b> • Developer: <b>Bora Avcu</b></sub>
</div>
