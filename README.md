# AtomQuest Goal Portal

AtomQuest Goal Portal is a robust, web-based goal setting and tracking application designed with role-specific journeys for Employees, L1 Managers, and Admin / HR. It provides a seamless experience for creating, approving, and tracking professional goals throughout their lifecycle.

## Links
* **Live Demo:** [https://tail-omissions-pension-lot.trycloudflare.com](https://tail-omissions-pension-lot.trycloudflare.com)
* **Source Code:** [https://github.com/coder200412/Atomquet](https://github.com/coder200412/Atomquet)

## Features
* **Role-based Workflows:** Distinct views and permissions for Employees, Managers, and Admins.
* **Goal Lifecycle Management:** Support for drafting, submitting, reviewing, approving, and completing goals.
* **Simulated SSO:** Microsoft Entra-style SSO and directory sync simulation.
* **Extensible Notification & Escalation:** Built-in module for email and Teams notifications along with a rule-based escalation engine.
* **Analytics Dashboard:** Visualise data including QoQ trends, heatmaps, goal mix, and manager effectiveness.

## Architecture

The project operates as a single Node.js service that serves both the built React frontend and the Express API, backed by a local PostgreSQL database using Prisma ORM.

```mermaid
flowchart LR
  Browser["Web Browser / Public Demo URL"] --> Tunnel["Cloudflare Quick Tunnel"]
  Tunnel --> Express["Node.js + Express API"]
  Express --> React["Built React UI served from /dist"]
  Express --> Prisma["Prisma ORM"]
  Prisma --> Postgres["Local PostgreSQL database"]

  Express --> Auth["JWT Auth + Demo Microsoft Entra SSO"]
  Auth --> Directory["Entra-style directory sync: groups, roles, manager mapping"]

  Express --> Workflow["Goal lifecycle APIs"]
  Workflow --> Employee["Employee: draft, submit, check-ins"]
  Workflow --> Manager["Manager: review, edit, approve, comments"]
  Workflow --> Admin["Admin / HR: cycles, unlock, audit, exports"]

  Express --> Notifications["Email and Teams notification log"]
  Notifications --> Cards["Teams adaptive card payloads + deep links"]

  Express --> Escalations["Rule-based escalation engine"]
  Escalations --> Logs["Escalation rules and logs"]

  Express --> Analytics["Analytics module"]
  Analytics --> Charts["QoQ trends, heatmaps, goal mix, manager effectiveness"]
```

## Tech Stack
* **Frontend:** React + Vite, Recharts, Lucide Icons
* **Backend:** Node.js + Express
* **Database:** PostgreSQL (Local)
* **ORM:** Prisma
* **Authentication:** JWT with simulated SSO

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize Database:**
   Ensure PostgreSQL is running, then set up the schema and seed data:
   ```bash
   npm run db:reset
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```

4. **Build for Production:**
   ```bash
   npm run build
   ```

5. **Start Production Server:**
   ```bash
   npm run start
   ```
