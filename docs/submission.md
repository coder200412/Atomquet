# AtomQuest Goal Portal - Submission

## Working Link
[https://tail-omissions-pension-lot.trycloudflare.com](https://tail-omissions-pension-lot.trycloudflare.com)

## Source Code Repository
[https://github.com/coder200412/Atomquet](https://github.com/coder200412/Atomquet)

## BRD Alignment
[docs/brd_alignment.md](docs/brd_alignment.md)

## Demo Login Credentials
All seeded demo accounts use `password123`.

| Role | Email |
| --- | --- |
| Admin / HR | `admin@atomquest.local` |
| Manager | `maya.manager@atomquest.local` |
| Manager | `karan.manager@atomquest.local` |
| Employee | `neha.employee@atomquest.local` |
| Employee | `arjun.employee@atomquest.local` |
| Employee | `diya.employee@atomquest.local` |

Visitors can also create a new Employee or Manager account from the login screen.

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
