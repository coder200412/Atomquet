# AtomQuest Hackathon 1.0: In-House Goal Setting & Tracking Portal

This document outlines the architecture, technology stack, database design, and step-by-step implementation plan for the Goal Setting & Tracking Portal to fulfill the hackathon requirements.

## Goal Description
Build a structured, digital Goal Setting & Tracking Portal to manage the full lifecycle of employee goals. The system will eliminate manual tracking methods by providing an intuitive, reliable, and audit-ready platform with distinct roles for Employees, Managers (L1), and Admins/HR.

## User Review Required & Open Questions
> [!IMPORTANT]
> Please review the following architectural and technical choices before we proceed with the execution:

1. **Technology Stack**: I propose using **Vite + React** for the frontend with **Vanilla CSS** (focusing on a highly polished, premium UI as per guidelines). For the backend, **Node.js with Express** and **SQLite** (using Prisma ORM). SQLite is perfect for a hackathon demo as it requires zero setup, but we can easily switch to PostgreSQL if preferred. Is this stack acceptable?
2. **Authentication**: Do you want a standard Email/Password login for the demo, or should we attempt to mock the **Microsoft Entra ID (Azure AD)** SSO bonus feature using a standard OAuth provider like Auth0/NextAuth?
3. **Bonus Features**: To maximize score, I propose we implement the **Analytics Module** (charts/graphs) and the **Escalation Module** (rule-based background jobs using something like `node-cron`). Is there a specific bonus feature you want us to prioritize?

---

## Proposed Architecture & Stack

### Frontend
- **Framework**: React.js initialized via Vite.
- **Styling**: Vanilla CSS with CSS Modules. We will build a premium, glassmorphism-inspired design with dynamic micro-animations.
- **State Management**: React Context API or Zustand.
- **Routing**: React Router DOM.
- **Charts**: Chart.js or Recharts for the Analytics Module.

### Backend
- **Framework**: Node.js with Express.js.
- **Database ORM**: Prisma.
- **Database**: SQLite (local file, easy to manage and submit for hackathon).
- **Authentication**: JWT (JSON Web Tokens).

---

## Database Schema Design (Prisma)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  password     String
  name         String
  role         Role     // EMPLOYEE, MANAGER, ADMIN
  managerId    String?  // Self-referencing relationship for hierarchy
  manager      User?    @relation("ManagerTeam", fields: [managerId], references: [id])
  teamMembers  User[]   @relation("ManagerTeam")
  goalSheets   GoalSheet[]
}

enum Role {
  EMPLOYEE
  MANAGER
  ADMIN
}

model GoalSheet {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  year         Int
  status       SheetStatus // DRAFT, SUBMITTED, APPROVED, REJECTED
  goals        Goal[]
  checkIns     CheckIn[]
}

enum SheetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

model Goal {
  id           String   @id @default(uuid())
  sheetId      String
  sheet        GoalSheet @relation(fields: [sheetId], references: [id])
  title        String
  description  String?
  thrustArea   String
  uom          UoMType  // NUMERIC_MIN, NUMERIC_MAX, TIMELINE, ZERO
  target       Float
  weightage    Int      // Must be >= 10, total per sheet = 100
  isShared     Boolean  @default(false)
  auditLogs    AuditLog[]
}

enum UoMType {
  NUMERIC_MIN
  NUMERIC_MAX
  TIMELINE
  ZERO
}

model CheckIn {
  id           String   @id @default(uuid())
  sheetId      String
  sheet        GoalSheet @relation(fields: [sheetId], references: [id])
  quarter      String   // Q1, Q2, Q3, Q4
  status       ProgressStatus // NOT_STARTED, ON_TRACK, COMPLETED
  actualValue  Float
  managerComment String?
  submittedAt  DateTime @default(now())
}

enum ProgressStatus {
  NOT_STARTED
  ON_TRACK
  COMPLETED
}

model AuditLog {
  id           String   @id @default(uuid())
  goalId       String
  goal         Goal     @relation(fields: [goalId], references: [id])
  changedBy    String   // User ID who made the change
  changeDetail String   // JSON string of before/after
  timestamp    DateTime @default(now())
}
```

---

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure (Backend)
1. Initialize Node.js/Express backend.
2. Set up Prisma with SQLite and apply the initial schema.
3. Seed the database with sample users: 1 Admin, 2 Managers, and 4 Employees to demonstrate hierarchy.
4. Implement JWT Authentication and Role-based middleware.

### Phase 2: Goal Creation & Approval Workflow (Must-Have 1)
1. **Goal Creation API**: Endpoints to create, update, and submit goals.
2. **Validation Logic**: Enforce exactly 100% total weightage, max 8 goals, and min 10% weightage per goal.
3. **Manager Approval API**: Endpoints for L1 Managers to view team goals, edit inline, approve, or reject.
4. **Shared Goals**: Admin API to broadcast a goal to multiple employees.

### Phase 3: Frontend Foundation & Phase 1 UI
1. Initialize Vite React app.
2. Setup CSS tokens, layout components (Sidebar, Topbar), and routing.
3. **Employee Dashboard**: UI for drafting and submitting the Goal Sheet.
4. **Manager Dashboard**: UI to list pending approvals and inline editing.

### Phase 4: Achievement Tracking & Check-ins (Must-Have 2)
1. **Check-in Windows**: Logic to enforce Q1, Q2, Q3, Q4 periods based on current dates (or simulated dates).
2. **Scoring Logic**: Implement the progress score formulas based on UoM Type (Higher is better, Lower is better, etc.).
3. **Check-in UI**: Interfaces for employees to log actuals and managers to add check-in comments.

### Phase 5: Reporting, Governance, & Polish
1. **Audit Logs**: Ensure any edits post-approval write to the `AuditLog` table.
2. **Export API**: Implement CSV export generation for Planned vs. Actual achievement.
3. **Admin Dashboard**: Real-time completion views and audit log display.

### Phase 6: Bonus Features
1. **Analytics Module**: Add charts showing QoQ trends and goal distribution by Thrust Area.
2. **Escalation Module**: Simple scheduled cron job to flag employees who haven't submitted goals.

---

## Verification Plan

### Automated/Backend Verification
- Test all validation rules: submitting 9 goals, submitting <100% weightage, submitting a goal with 5% weightage. All should return 400 errors.
- Test scoring logic mathematically against the formulas provided in the prompt.

### Manual Verification
1. **Employee Journey**: Login -> Draft 3 goals -> Submit -> Wait for approval -> Log Q1 check-in.
2. **Manager Journey**: Login -> See pending submission -> Edit weightage -> Approve -> Add Q1 feedback.
3. **Admin Journey**: Login -> View completion dashboard -> Export CSV -> View Audit Trail.
