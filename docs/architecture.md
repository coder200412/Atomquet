# AtomQuest Goal Portal Architecture

## Overview

AtomQuest Goal Portal is a browser-based goal setting and tracking application with role-specific journeys for Employees, L1 Managers, and Admin / HR. The production demo runs as a single Node.js service that serves the React frontend and Express API, backed by local PostgreSQL through Prisma ORM.

## Architecture Diagram

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

## Technology Choices

- Frontend: React + Vite with Recharts and Lucide icons.
- Backend: Node.js + Express.
- Database: Local PostgreSQL, accessed through Prisma.
- Authentication: JWT email/password demo auth plus Microsoft Entra-style SSO simulation.
- Hosting: Local Node server exposed through a Cloudflare public tunnel for hackathon demo access.

## Cost Optimisation Notes

- Single deployable Node service serves both static UI and API.
- Local PostgreSQL avoids paid database infrastructure for the demo.
- Prisma keeps data access typed and efficient.
- Analytics are computed from existing relational data without external services.
- Email, Teams, Entra, and escalation integrations are represented as demo-ready modules without paid API calls.
