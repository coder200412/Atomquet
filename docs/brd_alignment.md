# AtomQuest BRD Alignment

This checklist maps the portal to the AtomQuest Hackathon 1.0 problem statement.

## Must-Have Coverage

| Requirement Area | Implementation |
| --- | --- |
| Employee goal sheet | Employees create, edit, and submit goals from the employee dashboard. |
| Goal fields | Goal title, description, thrust area, UoM, target, and weightage are captured. |
| Validation rules | API and UI enforce minimum 10% weightage, maximum 8 goals, and 100% total weightage before submission. |
| L1 approval workflow | Managers review submitted sheets, edit during review, approve, or return with a note. |
| Lock after approval | Approved sheets are locked for employees and managers; Admin / HR can unlock exceptions. |
| Shared goals | Admins and managers can push shared KPIs to employees. Recipients can adjust weightage only. |
| Quarterly check-ins | Approved goals support Q1-Q4 achievement capture with planned vs. actual values. |
| Check-in windows | The app applies scheduled windows and supports Admin override for demos. |
| Progress scoring | Scores are computed for higher-is-better, lower-is-better, timeline, and zero-based UoM types. |
| Manager comments | Managers can add structured comments to employee check-ins. |
| Three roles | Employee, Manager, and Admin / HR dashboards have separate capabilities. |
| Reporting | Admin export downloads a CSV achievement report. |
| Completion dashboard | Admin analytics show approval and check-in completion status. |
| Audit trail | Goal edits are captured with changed fields, previous values, new values, user id, and timestamp. |

## Bonus Coverage

| Bonus Area | Implementation |
| --- | --- |
| Microsoft Entra ID | Simulated SSO, group-to-role mapping, org hierarchy sync, and directory preview are included. |
| Email and Teams | Notification records are generated for submission, approval, rejection, shared goals, check-ins, and escalations. Teams-style adaptive card payloads include deep links. |
| Escalations | Rule-based escalation checks cover late submission, late approval, and missed check-ins, with Admin-visible logs and resolution. |
| Analytics | QoQ trends, department heatmap, goal distribution, UoM/status breakdowns, and manager effectiveness charts are included. |
| Public hackathon access | Visitors can create Employee or Manager accounts and sign back in with their credentials. |

## Demo Accounts

All seeded demo accounts use `password123`.

| Role | Email |
| --- | --- |
| Admin / HR | `admin@atomquest.local` |
| Manager | `maya.manager@atomquest.local` |
| Manager | `karan.manager@atomquest.local` |
| Employee | `neha.employee@atomquest.local` |
| Employee | `arjun.employee@atomquest.local` |
| Employee | `diya.employee@atomquest.local` |

## Render Commands

```bash
# Build command
npm install && npx prisma generate && npm run build

# Start command
npm run db:deploy && npm run start
```
