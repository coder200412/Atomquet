# AtomQuest Goal Portal - Submission

## Working Link
[https://3b9b120e655398.lhr.life](https://3b9b120e655398.lhr.life)

## Source Code Repository
[https://github.com/coder200412/Atomquet](https://github.com/coder200412/Atomquet)

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
