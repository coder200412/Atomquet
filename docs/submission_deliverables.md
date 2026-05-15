# AtomQuest Hackathon Submission Deliverables

## 1. Live Demo URL

Use the current public tunnel URL provided by Codex after launch.

## 2. Source Code Repository

The source code is in:

`D:\hackathon`

Recommended next step before submission:

```powershell
git init
git add .
git commit -m "Build AtomQuest goal tracking portal"
```

Then push to GitHub, GitLab, or Bitbucket and submit the remote repository link.

## 3. Architecture Diagram

Architecture notes and Mermaid diagram:

`D:\hackathon\docs\architecture.md`

## 4. Login Credentials

All seeded demo users use:

`password123`

Seeded accounts:

- Admin / HR: `admin@atomquest.local`
- Manager: `maya.manager@atomquest.local`
- Manager: `karan.manager@atomquest.local`
- Employee: `neha.employee@atomquest.local`
- Employee: `arjun.employee@atomquest.local`
- Employee: `diya.employee@atomquest.local`

Flexible demo login is also enabled:

- Emails containing `admin` or `hr` open Admin / HR view.
- Emails containing `manager` or `lead` open Manager view.
- Other valid emails open Employee view.

Microsoft Entra SSO simulation:

- Click `Microsoft Entra SSO` on the login page.
- Directory sync maps Entra-style groups to roles and manager reporting lines.

## Implemented Modules

- Employee goal sheet creation, validation, submit workflow.
- Manager L1 review, inline edit, approve, reject, check-in comments.
- Admin / HR cycle control, org hierarchy, unlock, audit trail, CSV export.
- Shared goals with weightage-only recipient edits.
- Quarterly check-in window enforcement.
- Progress scoring by UoM.
- Microsoft Entra ID SSO simulation and org sync.
- Email and Teams notification log with adaptive card payloads and deep links.
- Rule-based escalation rules, scan, log, and resolution.
- Analytics: QoQ trends, heatmaps, goal distribution, UoM/status breakdown, manager effectiveness.
