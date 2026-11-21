# Sankofa SMS — Complete School Management System for Private Basic Schools in Ghana

A complete, original, mobile-first full-stack School Management System built with **Next.js 15 (App Router, TypeScript)**, **Tailwind CSS v4**, **Prisma ORM**, and **SQLite** (drop-in ready for **PostgreSQL**), tailored specifically to Ghana's private basic school ecosystem.

## Complete 5-Phase Feature Set

1. **Phase 1 — Architecture, RBAC & Headmaster (Admin) Portal**:
   - Unified login (`/login`) supporting **Email OR Registered Ghana Phone Number** (`+233...` / `0...`) across 4 roles: **Headmaster (Admin)**, **Accountant**, **Teacher**, and **Parent**.
   - Four Ghanaian Academic Departments: **Creche / Daycare**, **Kindergarten (KG 1–2)**, **Primary (Basic 1–6)**, and **Junior High School (JHS 1–3)**.
   - Full DB CRUD for Student Admissions (auto Student ID + guardian phone), Teacher Admissions (auto Staff ID + multi-class & GES subject assignment), Classes, and User RBAC.
2. **Phase 2 — Teacher Portal, Daily Attendance & Creche Care Logs**:
   - Strictly scoped Teacher Dashboard displaying only assigned classes, subjects, student counts, and today's attendance %.
   - Mobile-first Daily Attendance Register (`Present` / `Late` / `Absent`) + searchable **Attendance History** view.
   - Exclusive **Creche Daily Care Logs** (`CrecheCareLog`) recording Feeding (Breakfast/Lunch), Nap Time, Diaper/Potty & Health Checks, and Authorized Pickup Verification (Ghana Card / Pickup Tag), plus Headmaster oversight panels.
3. **Phase 3 — Ghanaian Academic Grading Engine & Printable Terminal Report Cards**:
   - Configurable Academic Year, Term, Next Term Reopening Date, Class/Exam Split (`30/70` or `50/50`), Primary Scale (`A–F` or `1–9`), and Department Subjects / KG Learning Areas.
   - Department-specific grading: **KG Descriptive Mastery Ratings** (`Exceeding Expectation`, `Meeting Expectation`, `Developing`, `Needs Support`), **Primary & JHS Numeric Score Sheets** with auto Subject Position & Class Position, and **JHS BECE 6-Subject Aggregate Calculator** (4 Core + Best 2 Electives).
   - Official A4 Printable Terminal Report Cards (`Print / Save as PDF`) gated by **Headmaster Approval** before publishing to Parents.
4. **Phase 4 — Accountant / Bursar Portal & School Fees (GHS ₵)**:
   - Accountant GHS summary cards: Total Expected Fees, Total Collected, Total Arrears (Owing), and Today's Collections.
   - Itemized Department/Class Fee Structures (Tuition, Feeding, Transport, PTA, Books) auto-billed to students.
   - Quick Payment search & full/partial payment recording (`Cash`, `MTN MoMo`, `Telecel Cash`, `AT Money`, `Bank Transfer`), Printable Official Fee Receipts, Filterable Debtors List, and **Paystack Ghana** payment service (`PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`) with MoMo/Card checkout simulation.
5. **Phase 5 — Multi-Child Parent Portal, Noticeboard & Ghanaian SMS Notifications**:
   - Mobile-first Multi-Child Parent Portal with Child Switcher and department-aware views (Creche Daily Care Report for Creche wards + Attendance, Fee Statement with Paystack Pay button, and Published PDF Report Cards for all wards).
   - Department-targeted School Announcements (`All`, `Teachers Only`, `Parents Only` × `All` / `Creche` / `KG` / `Primary` / `JHS`).
   - Modular **Arkesel / Hubtel** SMS service (`src/lib/smsService.ts`) with Simulation / Outbox Log Mode (`/dashboard/sms`) auto-triggered on Student Absence, Fee Receipt, Report Card Publication, and Headmaster Bulk SMS (All Parents / Debtors / Departments / Teachers).
   - One-click **"Load Sample Ghanaian School Data"** button in Headmaster Settings (`/dashboard/settings`) + CLI `npm run db:seed`.

## Seeded Demo Accounts (Password: `Password123!`)

| Role | Email / Phone Login |
| --- | --- |
| **Headmaster (Admin)** | `headmaster@sankofa.edu.gh` |
| **Accountant** | `bursar@sankofa.edu.gh` |
| **Teacher (Primary/JHS)** | `teacher@sankofa.edu.gh` |
| **Teacher (Creche Care)** | `comfort.adjei@sankofa.edu.gh` |
| **Parent (Multi-Child: Creche, Basic 4, JHS 1 & JHS 2)** | `parent@sankofa.edu.gh` or `+233 24 900 4411` |

## Cloud Deployment (Vercel or Render + PostgreSQL)

This project is pre-configured for **PostgreSQL** via `DATABASE_URL` in `prisma/schema.prisma`.

1. **Create a Cloud PostgreSQL Database** (e.g., Neon, Supabase, or Render PostgreSQL) and copy its `DATABASE_URL`.
2. **Set Environment Variables** on Vercel or Render (see `.env.example`):
   - `DATABASE_URL` — PostgreSQL connection string (`postgresql://...`)
   - `AUTH_SECRET` — strong 32+ character random string
   - `PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (optional; Simulation Mode works if left as placeholders)
   - `SMS_PROVIDER` (`ARKESEL` or `HUBTEL`), `ARKESEL_API_KEY` or `HUBTEL_CLIENT_ID` / `HUBTEL_CLIENT_SECRET`, `SMS_SENDER_ID` (optional; SMS Outbox Log Mode works if blank)
3. **Push Schema to Cloud PostgreSQL** (one-time or in Build Command):
   ```bash
   npx prisma db push
   ```
   - **Vercel Build Command**: `npx prisma db push && npm run build` (or run `npx prisma db push` once against your cloud DB and keep default `npm run build`).
   - **Render Build Command**: `npm install && npx prisma db push && npm run build` and **Start Command**: `npm run start`.
4. **First-Run Automatic Seeding**:
   - On an empty live PostgreSQL database, signing in with `headmaster@sankofa.edu.gh` / `Password123!` automatically bootstraps the default Headmaster account, School Profile, and active Academic Term without crashing.
   - Click **"Load Sample Ghanaian School Data"** on the Headmaster Dashboard (or in Settings) to populate the full 4-department demo dataset immediately.
