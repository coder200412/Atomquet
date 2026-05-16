import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const year = Number(process.env.APP_YEAR || 2026);
const jwtSecret = process.env.JWT_SECRET || "atomquest-demo";
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const quarters = ["Q1", "Q2", "Q3", "Q4"];
const publicSignupRoles = new Set(["EMPLOYEE", "MANAGER"]);
let cycleOverride = quarters.includes(process.env.ACTIVE_QUARTER) ? process.env.ACTIVE_QUARTER : null;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const sheetInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      entraObjectId: true,
      entraGroups: true,
      managerId: true
    }
  },
  goals: {
    orderBy: { createdAt: "asc" },
    include: {
      checkIns: {
        orderBy: { submittedAt: "desc" }
      },
      auditLogs: {
        orderBy: { timestamp: "desc" },
        take: 6
      }
    }
  }
};

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    entraObjectId: user.entraObjectId,
    entraGroups: user.entraGroups,
    managerId: user.managerId
  };
}

function signUser(user) {
  return jwt.sign(publicUser(user), jwtSecret, { expiresIn: "12h" });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function inferRole(email) {
  const local = email.split("@")[0].toLowerCase();
  if (local.includes("admin") || local.includes("hr")) return "ADMIN";
  if (local.includes("manager") || local.includes("lead")) return "MANAGER";
  return "EMPLOYEE";
}

function groupsForRole(role, department = "Product") {
  if (role === "ADMIN") return ["AQ-HR-Admins", "AQ-Employees"];
  if (role === "MANAGER") return ["AQ-Managers", `AQ-${department}`];
  return ["AQ-Employees", `AQ-${department}`];
}

function departmentFromEmail(email) {
  const local = email.split("@")[0].toLowerCase();
  if (local.includes("ops") || local.includes("operation")) return "Operations";
  if (local.includes("platform") || local.includes("engineer")) return "Platform";
  if (local.includes("hr") || local.includes("admin")) return "HR";
  return "Product";
}

function nameFromEmail(email) {
  const local = email.split("@")[0];
  const name = local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

  return name || "Demo User";
}

function safeDepartment(value, email) {
  const department = String(value || "").trim();
  return department || departmentFromEmail(email);
}

async function createDemoUser(email, password, options = {}) {
  const role = options.role || inferRole(email);
  const department = safeDepartment(options.department, email);
  const manager =
    role === "EMPLOYEE"
      ? await prisma.user.findFirst({
          where: { role: "MANAGER", department },
          orderBy: { name: "asc" }
        }) ||
        (await prisma.user.findFirst({
          where: { role: "MANAGER" },
          orderBy: { name: "asc" }
        }))
      : null;

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      name: String(options.name || "").trim() || nameFromEmail(email),
      role,
      department,
      entraObjectId: `demo-${email}`,
      entraGroups: groupsForRole(role, department),
      managerId: role === "EMPLOYEE" ? manager?.id || null : null
    }
  });

  if (role === "EMPLOYEE") {
    await prisma.goalSheet.create({
      data: {
        userId: user.id,
        year,
        status: "DRAFT"
      }
    });
  }

  return user;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token." });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ message: "User no longer exists." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this action." });
    }

    next();
  };
}

function scheduledCheckInWindow(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month === 7) return { active: true, quarter: "Q1", label: "Q1 Check-in", source: "schedule" };
  if (month === 10) return { active: true, quarter: "Q2", label: "Q2 Check-in", source: "schedule" };
  if (month === 1) return { active: true, quarter: "Q3", label: "Q3 Check-in", source: "schedule" };
  if (month === 3 || month === 4) return { active: true, quarter: "Q4", label: "Q4 / Annual", source: "schedule" };
  if (month === 5) return { active: false, quarter: null, label: "Goal Setting", source: "schedule" };
  return { active: false, quarter: null, label: "Cycle Closed", source: "schedule" };
}

function activeCheckInWindow() {
  if (cycleOverride) {
    return { active: true, quarter: cycleOverride, label: `${cycleOverride} Check-in`, source: "admin" };
  }

  return scheduledCheckInWindow();
}

function currentQuarter() {
  return activeCheckInWindow().quarter || "Q1";
}

function scoreFor(goal, checkIn) {
  if (!checkIn) return 0;
  const actual = Number(checkIn.actualValue);
  const target = Number(goal.target);

  if (goal.uom === "ZERO") return actual === 0 ? 100 : 0;
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return 0;
  if (goal.uom === "NUMERIC_MIN") return Math.min(120, (actual / target) * 100);
  if (goal.uom === "NUMERIC_MAX") return actual <= target ? 100 : Math.max(0, (target / actual) * 100);
  if (goal.uom === "TIMELINE") return actual <= target ? 100 : Math.max(0, 100 - (actual - target) * 2);

  return 0;
}

function latestCheckIn(goal) {
  return goal.checkIns?.[0] || null;
}

function serializeGoal(goal) {
  const latest = latestCheckIn(goal);
  return {
    ...goal,
    score: Math.round(scoreFor(goal, latest)),
    latestCheckIn: latest
  };
}

function serializeSheet(sheet) {
  const goals = sheet.goals.map(serializeGoal);
  const totalWeightage = goals.reduce((sum, goal) => sum + goal.weightage, 0);
  const weightedScore = goals.reduce((sum, goal) => sum + (goal.score * goal.weightage) / 100, 0);

  return {
    ...sheet,
    goals,
    totalWeightage,
    weightedScore: Math.round(weightedScore),
    currentQuarter: currentQuarter(),
    checkInWindow: activeCheckInWindow()
  };
}

async function ensureSheet(userId) {
  const sheet = await prisma.goalSheet.upsert({
    where: { userId_year: { userId, year } },
    update: {},
    create: { userId, year, status: "DRAFT" },
    include: sheetInclude
  });

  return serializeSheet(sheet);
}

async function getSheetOrThrow(sheetId) {
  const sheet = await prisma.goalSheet.findUnique({
    where: { id: sheetId },
    include: sheetInclude
  });

  if (!sheet) {
    const error = new Error("Goal sheet was not found.");
    error.status = 404;
    throw error;
  }

  return sheet;
}

async function assertSheetAccess(user, sheet, mode = "read") {
  if (user.role === "ADMIN") return;
  if (sheet.userId === user.id) return;
  if (user.role === "MANAGER" && sheet.user.managerId === user.id) return;

  const error = new Error(mode === "write" ? "You cannot modify this goal sheet." : "You cannot view this goal sheet.");
  error.status = 403;
  throw error;
}

function validateGoalPayload(body, partial = false) {
  const errors = [];
  const next = {};

  if (!partial || body.title !== undefined) {
    if (!String(body.title || "").trim()) errors.push("Goal title is required.");
    next.title = String(body.title || "").trim();
  }

  if (!partial || body.thrustArea !== undefined) {
    if (!String(body.thrustArea || "").trim()) errors.push("Thrust area is required.");
    next.thrustArea = String(body.thrustArea || "").trim();
  }

  if (!partial || body.uom !== undefined) {
    const allowed = ["NUMERIC_MIN", "NUMERIC_MAX", "TIMELINE", "ZERO"];
    if (!allowed.includes(body.uom)) errors.push("UoM is invalid.");
    next.uom = body.uom;
  }

  if (!partial || body.target !== undefined) {
    const target = Number(body.target);
    if (!Number.isFinite(target) || target < 0) errors.push("Target must be a positive number.");
    next.target = target;
  }

  if (!partial || body.weightage !== undefined) {
    const weightage = Number(body.weightage);
    if (!Number.isInteger(weightage) || weightage < 10) errors.push("Each goal must have at least 10% weightage.");
    next.weightage = weightage;
  }

  if (body.description !== undefined) next.description = String(body.description || "").trim();
  if (body.isShared !== undefined) next.isShared = Boolean(body.isShared);

  if (errors.length) {
    const error = new Error(errors.join(" "));
    error.status = 400;
    throw error;
  }

  return next;
}

function validateSheetForSubmit(sheet) {
  if (sheet.goals.length === 0) return "Add at least one goal before submitting.";
  if (sheet.goals.length > 8) return "A sheet cannot contain more than 8 goals.";
  if (sheet.goals.some((goal) => goal.weightage < 10)) return "Each goal must have at least 10% weightage.";

  const total = sheet.goals.reduce((sum, goal) => sum + goal.weightage, 0);
  if (total !== 100) return "Goal weightage must total exactly 100%.";

  return null;
}

async function maybeAudit(goal, changedBy, before, after) {
  const changed = Object.keys(after).filter((key) => before[key] !== after[key]);
  if (!changed.length) return;

  await prisma.auditLog.create({
    data: {
      goalId: goal.id,
      changedBy,
      changeDetail: {
        changed,
        before: Object.fromEntries(changed.map((key) => [key, before[key]])),
        after: Object.fromEntries(changed.map((key) => [key, after[key]]))
      }
    }
  });
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function makeAdaptiveCard(title, message, deepLink) {
  return {
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      { type: "TextBlock", text: title, weight: "Bolder", size: "Medium" },
      { type: "TextBlock", text: message, wrap: true }
    ],
    actions: [{ type: "Action.OpenUrl", title: "Open in AtomQuest", url: deepLink || "/" }]
  };
}

async function notifyUser(recipientId, eventType, title, message, deepLink) {
  if (!recipientId) return;
  await prisma.notification.createMany({
    data: [
      {
        recipientId,
        channel: "EMAIL",
        eventType,
        title,
        message,
        deepLink
      },
      {
        recipientId,
        channel: "TEAMS",
        eventType,
        title,
        message,
        deepLink,
        adaptiveCard: makeAdaptiveCard(title, message, deepLink)
      }
    ]
  });
}

async function notificationsFor(user) {
  const personal = await prisma.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12
  });

  if (user.role !== "ADMIN") return personal;

  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { recipient: { select: { name: true, email: true, role: true } } }
  });
}

function roleFromGroups(groups = []) {
  const joined = groups.join(" ").toLowerCase();
  if (joined.includes("admin") || joined.includes("hr")) return "ADMIN";
  if (joined.includes("manager") || joined.includes("lead")) return "MANAGER";
  return "EMPLOYEE";
}

const demoDirectory = [
  {
    email: "sana.manager@atomquest.local",
    name: "Sana Kapoor",
    department: "Customer Success",
    entraObjectId: "entra-sana",
    groups: ["AQ-Managers", "AQ-Customer-Success"]
  },
  {
    email: "vivek.employee@atomquest.local",
    name: "Vivek Menon",
    department: "Customer Success",
    managerEmail: "sana.manager@atomquest.local",
    entraObjectId: "entra-vivek",
    groups: ["AQ-Employees", "AQ-Customer-Success"]
  },
  {
    email: "hr.admin@atomquest.local",
    name: "HR Admin",
    department: "HR",
    entraObjectId: "entra-hr-admin",
    groups: ["AQ-HR-Admins"]
  }
];

async function syncDirectory(entries = demoDirectory) {
  const hashedPassword = await bcrypt.hash("password123", 10);
  const synced = [];

  for (const entry of entries.filter((item) => roleFromGroups(item.groups) !== "EMPLOYEE")) {
    const role = roleFromGroups(entry.groups);
    const user = await prisma.user.upsert({
      where: { email: entry.email.toLowerCase() },
      update: {
        name: entry.name,
        role,
        department: entry.department,
        entraObjectId: entry.entraObjectId,
        entraGroups: entry.groups
      },
      create: {
        email: entry.email.toLowerCase(),
        password: hashedPassword,
        name: entry.name,
        role,
        department: entry.department,
        entraObjectId: entry.entraObjectId,
        entraGroups: entry.groups
      }
    });
    synced.push(user);
  }

  for (const entry of entries.filter((item) => roleFromGroups(item.groups) === "EMPLOYEE")) {
    const manager = entry.managerEmail
      ? await prisma.user.findUnique({ where: { email: entry.managerEmail.toLowerCase() } })
      : await prisma.user.findFirst({ where: { role: "MANAGER", department: entry.department } });
    const user = await prisma.user.upsert({
      where: { email: entry.email.toLowerCase() },
      update: {
        name: entry.name,
        role: "EMPLOYEE",
        department: entry.department,
        managerId: manager?.id || null,
        entraObjectId: entry.entraObjectId,
        entraGroups: entry.groups
      },
      create: {
        email: entry.email.toLowerCase(),
        password: hashedPassword,
        name: entry.name,
        role: "EMPLOYEE",
        department: entry.department,
        managerId: manager?.id || null,
        entraObjectId: entry.entraObjectId,
        entraGroups: entry.groups
      }
    });
    await ensureSheet(user.id);
    synced.push(user);
  }

  return synced;
}

function daysSince(date) {
  if (!date) return 999;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

async function createEscalation(rule, user, level, targetRole, message) {
  const existing = await prisma.escalationLog.findFirst({
    where: {
      ruleName: rule.name,
      userId: user?.id || null,
      status: "OPEN",
      level
    }
  });

  if (existing) return existing;

  const log = await prisma.escalationLog.create({
    data: {
      ruleId: rule.id,
      ruleName: rule.name,
      userId: user?.id || null,
      targetRole,
      message,
      level
    }
  });

  if (user?.id) {
    await notifyUser(user.id, "ESCALATION", rule.name, message, `/admin?escalation=${log.id}`);
  }

  return log;
}

async function runEscalationScan() {
  const rules = await prisma.escalationRule.findMany({ where: { active: true } });
  const sheets = await prisma.goalSheet.findMany({
    where: { year, user: { role: "EMPLOYEE" } },
    include: sheetInclude
  });
  const cycle = activeCheckInWindow();
  const created = [];

  for (const rule of rules) {
    if (rule.condition === "GOALS_NOT_SUBMITTED") {
      const targets = sheets.filter((sheet) => ["DRAFT", "REJECTED"].includes(sheet.status) && daysSince(sheet.updatedAt) >= rule.thresholdDays);
      for (const sheet of targets) {
        created.push(
          await createEscalation(
            rule,
            sheet.user,
            "EMPLOYEE",
            rule.level1,
            `${sheet.user.name} has not submitted goals within ${rule.thresholdDays} day(s) of the cycle opening.`
          )
        );
      }
    }

    if (rule.condition === "MANAGER_APPROVAL_PENDING") {
      const targets = sheets.filter((sheet) => sheet.status === "SUBMITTED" && daysSince(sheet.submittedAt) >= rule.thresholdDays);
      for (const sheet of targets) {
        const manager = sheet.user.managerId ? await prisma.user.findUnique({ where: { id: sheet.user.managerId } }) : null;
        created.push(
          await createEscalation(
            rule,
            manager || sheet.user,
            "MANAGER",
            rule.level2,
            `${sheet.user.name}'s goal sheet is waiting for L1 approval beyond ${rule.thresholdDays} day(s).`
          )
        );
      }
    }

    if (rule.condition === "CHECKIN_NOT_COMPLETED" && cycle.active && cycle.quarter) {
      const targets = sheets.filter(
        (sheet) =>
          sheet.status === "APPROVED" &&
          sheet.goals.length > 0 &&
          sheet.goals.some((goal) => !goal.checkIns.some((checkIn) => checkIn.quarter === cycle.quarter))
      );
      for (const sheet of targets) {
        created.push(
          await createEscalation(
            rule,
            sheet.user,
            "EMPLOYEE",
            rule.level1,
            `${sheet.user.name} has not completed ${cycle.quarter} achievement capture for all approved goals.`
          )
        );
      }
    }
  }

  return created;
}

async function buildAnalytics() {
  const [users, sheets, audits, escalationRules, escalationLogs, notifications] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        managerId: true,
        entraObjectId: true,
        entraGroups: true
      },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    }),
    prisma.goalSheet.findMany({
      where: { year },
      include: sheetInclude,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 20,
      include: { goal: { include: { sheet: { include: { user: true } } } } }
    }),
    prisma.escalationRule.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.escalationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true, email: true, role: true, department: true } } }
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { recipient: { select: { name: true, email: true, role: true } } }
    })
  ]);

  const employeeSheets = sheets.filter((sheet) => sheet.user.role === "EMPLOYEE").map(serializeSheet);
  const managers = users.filter((user) => user.role === "MANAGER");
  const roleCounts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  const byStatus = employeeSheets.reduce((acc, sheet) => {
    acc[sheet.status] = (acc[sheet.status] || 0) + 1;
    return acc;
  }, {});

  const byThrustArea = {};
  const byUom = {};
  const goalStatus = {};
  const trends = { Q1: [], Q2: [], Q3: [], Q4: [] };
  const individualTrendMap = {};
  const departmentTrendMap = {};

  for (const sheet of employeeSheets) {
    individualTrendMap[sheet.user.name] = { name: sheet.user.name, Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    for (const goal of sheet.goals) {
      byThrustArea[goal.thrustArea] = (byThrustArea[goal.thrustArea] || 0) + goal.weightage;
      byUom[goal.uom] = (byUom[goal.uom] || 0) + 1;
      goalStatus[goal.latestCheckIn?.status || "NOT_STARTED"] = (goalStatus[goal.latestCheckIn?.status || "NOT_STARTED"] || 0) + 1;
      for (const checkIn of goal.checkIns) {
        const score = scoreFor(goal, checkIn);
        trends[checkIn.quarter].push(score);
        individualTrendMap[sheet.user.name][checkIn.quarter] ||= [];
        if (!Array.isArray(individualTrendMap[sheet.user.name][checkIn.quarter])) {
          individualTrendMap[sheet.user.name][checkIn.quarter] = [];
        }
        individualTrendMap[sheet.user.name][checkIn.quarter].push(score);

        const department = sheet.user.department || "Product";
        departmentTrendMap[department] ||= { department, Q1: [], Q2: [], Q3: [], Q4: [] };
        departmentTrendMap[department][checkIn.quarter].push(score);
      }
    }
  }

  const average = (values) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);
  const trendRows = Object.entries(trends).map(([quarter, values]) => ({
    quarter,
    score: average(values)
  }));
  const individualTrends = Object.values(individualTrendMap).map((row) => ({
    name: row.name,
    Q1: Array.isArray(row.Q1) ? average(row.Q1) : row.Q1,
    Q2: Array.isArray(row.Q2) ? average(row.Q2) : row.Q2,
    Q3: Array.isArray(row.Q3) ? average(row.Q3) : row.Q3,
    Q4: Array.isArray(row.Q4) ? average(row.Q4) : row.Q4
  }));
  const departmentTrends = Object.values(departmentTrendMap).map((row) => ({
    department: row.department,
    Q1: average(row.Q1),
    Q2: average(row.Q2),
    Q3: average(row.Q3),
    Q4: average(row.Q4)
  }));

  const escalations = employeeSheets
    .filter((sheet) => sheet.status !== "APPROVED")
    .map((sheet) => ({
      id: sheet.id,
      name: sheet.user.name,
      status: sheet.status,
      totalWeightage: sheet.totalWeightage,
      managerNote: sheet.managerNote
    }));
  const cycle = activeCheckInWindow();
  const approvedSheets = employeeSheets.filter((sheet) => sheet.status === "APPROVED");
  const completedCheckIns =
    cycle.active && cycle.quarter
      ? approvedSheets.filter(
          (sheet) => sheet.goals.length > 0 && sheet.goals.every((goal) => goal.checkIns.some((checkIn) => checkIn.quarter === cycle.quarter))
        ).length
      : 0;
  const managerEffectiveness = managers.map((manager) => {
    const teamSheets = employeeSheets.filter((sheet) => sheet.user.managerId === manager.id);
    const approved = teamSheets.filter((sheet) => sheet.status === "APPROVED").length;
    const submitted = teamSheets.filter((sheet) => ["SUBMITTED", "APPROVED"].includes(sheet.status)).length;
    const checkInDone =
      cycle.active && cycle.quarter
        ? teamSheets.filter(
            (sheet) =>
              sheet.status === "APPROVED" &&
              sheet.goals.length > 0 &&
              sheet.goals.every((goal) => goal.checkIns.some((checkIn) => checkIn.quarter === cycle.quarter))
          ).length
        : 0;

    return {
      name: manager.name,
      department: manager.department,
      teamSize: teamSheets.length,
      submitted,
      approved,
      checkInDone,
      approvalRate: teamSheets.length ? Math.round((approved / teamSheets.length) * 100) : 0,
      checkInRate: approved ? Math.round((checkInDone / approved) * 100) : 0
    };
  });
  const heatmap = managers.map((manager) => {
    const teamSheets = employeeSheets.filter((sheet) => sheet.user.managerId === manager.id);
    const row = { manager: manager.name };
    for (const quarter of quarters) {
      const approvedTeam = teamSheets.filter((sheet) => sheet.status === "APPROVED");
      const done = approvedTeam.filter(
        (sheet) =>
          sheet.goals.length > 0 &&
          sheet.goals.every((goal) => goal.checkIns.some((checkIn) => checkIn.quarter === quarter))
      ).length;
      row[quarter] = approvedTeam.length ? Math.round((done / approvedTeam.length) * 100) : 0;
    }
    return row;
  });

  return {
    cycle,
    roleCounts,
    byStatus,
    byThrustArea: Object.entries(byThrustArea).map(([name, value]) => ({ name, value })),
    byUom: Object.entries(byUom).map(([name, value]) => ({ name, value })),
    goalStatus: Object.entries(goalStatus).map(([name, value]) => ({ name, value })),
    trends: trendRows,
    individualTrends,
    departmentTrends,
    heatmap,
    managerEffectiveness,
    escalations,
    escalationRules,
    escalationLogs,
    notifications,
    entra: {
      syncedUsers: users.filter((user) => user.entraObjectId).length,
      groups: Array.from(new Set(users.flatMap((user) => (Array.isArray(user.entraGroups) ? user.entraGroups : [])))).sort(),
      directoryPreview: demoDirectory
    },
    checkInCompletion: {
      quarter: cycle.quarter,
      completed: completedCheckIns,
      total: approvedSheets.length
    },
    audits: audits.map((audit) => ({
      id: audit.id,
      timestamp: audit.timestamp,
      changedBy: audit.changedBy,
      employee: audit.goal.sheet.user.name,
      goalTitle: audit.goal.title,
      changeDetail: audit.changeDetail
    })),
    sheets: employeeSheets,
    users
  };
}

async function dashboardFor(user) {
  if (user.role === "EMPLOYEE") {
    return {
      kind: "EMPLOYEE",
      sheet: await ensureSheet(user.id),
      notifications: await notificationsFor(user)
    };
  }

  if (user.role === "MANAGER") {
    const team = await prisma.user.findMany({
      where: { managerId: user.id },
      orderBy: { name: "asc" },
      include: {
        goalSheets: {
          where: { year },
          include: sheetInclude
        }
      }
    });

    return {
      kind: "MANAGER",
      notifications: await notificationsFor(user),
      team: team.map((member) => ({
        ...publicUser(member),
        sheet: member.goalSheets[0] ? serializeSheet(member.goalSheets[0]) : null
      }))
    };
  }

  return {
    kind: "ADMIN",
    notifications: await notificationsFor(user),
    analytics: await buildAnalytics()
  };
}

app.post(
  "/api/auth/signup",
  asyncRoute(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const requestedRole = String(req.body.role || "EMPLOYEE").trim().toUpperCase();
    const role = publicSignupRoles.has(requestedRole) ? requestedRole : "EMPLOYEE";
    const department = safeDepartment(req.body.department, email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({ message: "Use a password with at least 6 characters." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "An account already exists for this email. Sign in instead." });
    }

    const user = await createDemoUser(email, password, {
      name: req.body.name,
      role,
      department
    });

    res.status(201).json({
      token: signUser(user),
      user: publicUser(user)
    });
  })
);

app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    let user = await prisma.user.findUnique({ where: { email } });

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (!password.trim()) {
      return res.status(400).json({ message: "Enter a password for this demo account." });
    }

    if (!user) {
      return res.status(404).json({ message: "Account not found. Create an account first or use a demo account." });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    res.json({
      token: signUser(user),
      user: publicUser(user)
    });
  })
);

app.post(
  "/api/auth/entra-login",
  asyncRoute(async (req, res) => {
    const email = String(req.body.email || "arjun.employee@atomquest.local").trim().toLowerCase();
    const directoryUser = demoDirectory.find((entry) => entry.email.toLowerCase() === email);

    if (directoryUser) {
      await syncDirectory([directoryUser]);
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await createDemoUser(email, "password123");
    }

    res.json({
      token: signUser(user),
      user: publicUser(user),
      provider: "Microsoft Entra ID",
      claims: {
        oid: user.entraObjectId,
        groups: user.entraGroups,
        department: user.department,
        managerId: user.managerId
      }
    });
  })
);

app.get(
  "/api/session",
  auth,
  asyncRoute(async (req, res) => {
    res.json({
      user: publicUser(req.user),
      dashboard: await dashboardFor(req.user)
    });
  })
);

app.get(
  "/api/dashboard",
  auth,
  asyncRoute(async (req, res) => {
    res.json(await dashboardFor(req.user));
  })
);

app.patch(
  "/api/notifications/:id/read",
  auth,
  asyncRoute(async (req, res) => {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return res.status(404).json({ message: "Notification was not found." });
    if (notification.recipientId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "You cannot update this notification." });
    }

    res.json(await prisma.notification.update({ where: { id: notification.id }, data: { status: "READ" } }));
  })
);

app.post(
  "/api/goals",
  auth,
  asyncRoute(async (req, res) => {
    const sheet = await getSheetOrThrow(String(req.body.sheetId || ""));
    await assertSheetAccess(req.user, sheet, "write");

    if (req.user.role === "EMPLOYEE" && !["DRAFT", "REJECTED"].includes(sheet.status)) {
      return res.status(400).json({ message: "Only draft or rejected sheets can be edited by employees." });
    }

    if (sheet.goals.length >= 8) {
      return res.status(400).json({ message: "A sheet cannot contain more than 8 goals." });
    }

    const payload = validateGoalPayload(req.body);
    const goal = await prisma.goal.create({
      data: {
        ...payload,
        sheetId: sheet.id
      },
      include: { checkIns: true, auditLogs: true }
    });

    res.status(201).json(serializeGoal(goal));
  })
);

app.patch(
  "/api/goals/:id",
  auth,
  asyncRoute(async (req, res) => {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
      include: { sheet: { include: { user: true } } }
    });

    if (!goal) return res.status(404).json({ message: "Goal was not found." });
    await assertSheetAccess(req.user, goal.sheet, "write");

    if (req.user.role === "EMPLOYEE" && !["DRAFT", "REJECTED"].includes(goal.sheet.status)) {
      return res.status(400).json({ message: "Employees can only edit draft or rejected sheets." });
    }

    const payload = validateGoalPayload(req.body, true);
    await maybeAudit(goal, req.user.id, goal, payload);
    if (goal.isShared && req.user.role === "EMPLOYEE") {
      const restricted = ["title", "description", "thrustArea", "uom", "target", "isShared"];
      const changedRestricted = restricted.some((key) => req.body[key] !== undefined && String(req.body[key]) !== String(goal[key] ?? ""));
      if (changedRestricted) {
        return res.status(400).json({ message: "Shared goals allow recipients to adjust weightage only." });
      }
      for (const key of restricted) delete payload[key];
    }

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: payload,
      include: { checkIns: { orderBy: { submittedAt: "desc" } }, auditLogs: { orderBy: { timestamp: "desc" } } }
    });

    res.json(serializeGoal(updated));
  })
);

app.delete(
  "/api/goals/:id",
  auth,
  asyncRoute(async (req, res) => {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
      include: { sheet: { include: { user: true } } }
    });

    if (!goal) return res.status(404).json({ message: "Goal was not found." });
    await assertSheetAccess(req.user, goal.sheet, "write");

    if (goal.isShared && req.user.role === "EMPLOYEE") {
      return res.status(400).json({ message: "Shared goals cannot be deleted by recipients." });
    }

    if (req.user.role === "EMPLOYEE" && !["DRAFT", "REJECTED"].includes(goal.sheet.status)) {
      return res.status(400).json({ message: "Employees can only delete goals from draft or rejected sheets." });
    }

    await prisma.goal.delete({ where: { id: goal.id } });
    res.status(204).end();
  })
);

app.post(
  "/api/sheets/:id/submit",
  auth,
  requireRole("EMPLOYEE", "ADMIN"),
  asyncRoute(async (req, res) => {
    const sheet = await getSheetOrThrow(req.params.id);
    await assertSheetAccess(req.user, sheet, "write");
    const validation = validateSheetForSubmit(sheet);

    if (validation) return res.status(400).json({ message: validation });
    if (req.user.role === "EMPLOYEE" && !["DRAFT", "REJECTED"].includes(sheet.status)) {
      return res.status(400).json({ message: "This sheet has already been submitted." });
    }

    const updated = await prisma.goalSheet.update({
      where: { id: sheet.id },
      data: { status: "SUBMITTED", submittedAt: new Date(), managerNote: null },
      include: sheetInclude
    });
    await notifyUser(
      sheet.user.managerId,
      "GOAL_SUBMITTED",
      `${sheet.user.name} submitted goals`,
      `${sheet.user.name}'s goal sheet is ready for L1 review.`,
      `/manager?employee=${encodeURIComponent(sheet.user.email)}`
    );

    res.json(serializeSheet(updated));
  })
);

app.post(
  "/api/sheets/:id/approve",
  auth,
  requireRole("MANAGER", "ADMIN"),
  asyncRoute(async (req, res) => {
    const sheet = await getSheetOrThrow(req.params.id);
    await assertSheetAccess(req.user, sheet, "write");
    const validation = validateSheetForSubmit(sheet);

    if (validation) return res.status(400).json({ message: validation });

    const updated = await prisma.goalSheet.update({
      where: { id: sheet.id },
      data: { status: "APPROVED", approvedAt: new Date(), managerNote: String(req.body.managerNote || "").trim() || null },
      include: sheetInclude
    });
    await notifyUser(
      sheet.userId,
      "GOAL_APPROVED",
      "Goal sheet approved",
      `${sheet.user.name}'s goals are locked and ready for quarterly check-ins.`,
      `/employee?sheet=${sheet.id}`
    );

    res.json(serializeSheet(updated));
  })
);

app.post(
  "/api/sheets/:id/reject",
  auth,
  requireRole("MANAGER", "ADMIN"),
  asyncRoute(async (req, res) => {
    const sheet = await getSheetOrThrow(req.params.id);
    await assertSheetAccess(req.user, sheet, "write");
    const note = String(req.body.managerNote || "").trim();

    if (!note) return res.status(400).json({ message: "A rejection note is required." });

    const updated = await prisma.goalSheet.update({
      where: { id: sheet.id },
      data: { status: "REJECTED", managerNote: note },
      include: sheetInclude
    });
    await notifyUser(
      sheet.userId,
      "GOAL_REJECTED",
      "Goal sheet returned",
      `L1 returned the goal sheet for rework: ${note}`,
      `/employee?sheet=${sheet.id}`
    );

    res.json(serializeSheet(updated));
  })
);

app.post(
  "/api/sheets/:id/unlock",
  auth,
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const sheet = await getSheetOrThrow(req.params.id);
    const updated = await prisma.goalSheet.update({
      where: { id: sheet.id },
      data: {
        status: "DRAFT",
        approvedAt: null,
        managerNote: String(req.body.managerNote || "Unlocked by Admin / HR for exception handling.").trim()
      },
      include: sheetInclude
    });

    res.json(serializeSheet(updated));
  })
);

app.post(
  "/api/goals/:id/check-ins",
  auth,
  asyncRoute(async (req, res) => {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
      include: { sheet: { include: { user: true } } }
    });

    if (!goal) return res.status(404).json({ message: "Goal was not found." });
    await assertSheetAccess(req.user, goal.sheet, "write");

    if (goal.sheet.status !== "APPROVED") {
      return res.status(400).json({ message: "Check-ins open after the goal sheet is approved." });
    }

    const window = activeCheckInWindow();
    if (!window.active || !window.quarter) {
      return res.status(400).json({ message: `${window.label} is active. Achievement capture is not open right now.` });
    }
    const quarter = req.body.quarter || window.quarter;
    if (!quarters.includes(quarter)) {
      return res.status(400).json({ message: "Quarter is invalid." });
    }
    if (!window.active || quarter !== window.quarter) {
      return res.status(400).json({ message: `${window.label} is active. Achievement capture is not open for ${quarter}.` });
    }

    const status = req.body.status || "ON_TRACK";
    if (!["NOT_STARTED", "ON_TRACK", "COMPLETED"].includes(status)) {
      return res.status(400).json({ message: "Progress status is invalid." });
    }

    const actualValue = Number(req.body.actualValue);
    if (!Number.isFinite(actualValue) || actualValue < 0) {
      return res.status(400).json({ message: "Actual value must be a positive number." });
    }

    const checkIn = await prisma.checkIn.upsert({
      where: { goalId_quarter: { goalId: goal.id, quarter } },
      update: {
        status,
        actualValue,
        managerComment: req.body.managerComment ? String(req.body.managerComment).trim() : undefined,
        submittedAt: new Date()
      },
      create: {
        goalId: goal.id,
        quarter,
        status,
        actualValue,
        managerComment: req.body.managerComment ? String(req.body.managerComment).trim() : null
      }
    });

    if (goal.isShared) {
      const linkedGoals = await prisma.goal.findMany({
        where: {
          isShared: true,
          id: { not: goal.id },
          title: goal.title,
          thrustArea: goal.thrustArea,
          uom: goal.uom,
          target: goal.target
        }
      });

      await Promise.all(
        linkedGoals.map((linkedGoal) =>
          prisma.checkIn.upsert({
            where: { goalId_quarter: { goalId: linkedGoal.id, quarter } },
            update: {
              status,
              actualValue,
              managerComment: req.body.managerComment ? String(req.body.managerComment).trim() : undefined,
              submittedAt: new Date()
            },
            create: {
              goalId: linkedGoal.id,
              quarter,
              status,
              actualValue,
              managerComment: req.body.managerComment ? String(req.body.managerComment).trim() : null
            }
          })
        )
      );
    }
    await notifyUser(
      goal.sheet.user.managerId,
      "CHECKIN_UPDATED",
      `${goal.sheet.user.name} updated ${quarter}`,
      `${goal.sheet.user.name} logged actual achievement for "${goal.title}".`,
      `/manager?employee=${encodeURIComponent(goal.sheet.user.email)}&quarter=${quarter}`
    );

    res.json(checkIn);
  })
);

app.patch(
  "/api/check-ins/:id/comment",
  auth,
  requireRole("MANAGER", "ADMIN"),
  asyncRoute(async (req, res) => {
    const checkIn = await prisma.checkIn.findUnique({
      where: { id: req.params.id },
      include: { goal: { include: { sheet: { include: { user: true } } } } }
    });

    if (!checkIn) return res.status(404).json({ message: "Check-in was not found." });
    await assertSheetAccess(req.user, checkIn.goal.sheet, "write");

    const updated = await prisma.checkIn.update({
      where: { id: checkIn.id },
      data: { managerComment: String(req.body.managerComment || "").trim() || null }
    });

    res.json(updated);
  })
);

async function sharedGoalHandler(req, res) {
  const payload = validateGoalPayload({ ...req.body, isShared: true });
  const employeeIds = Array.isArray(req.body.employeeIds) ? req.body.employeeIds : [];
  const userWhere =
    req.user.role === "MANAGER"
      ? { role: "EMPLOYEE", managerId: req.user.id, ...(employeeIds.length ? { id: { in: employeeIds } } : {}) }
      : { role: "EMPLOYEE", ...(employeeIds.length ? { id: { in: employeeIds } } : {}) };

  const users = await prisma.user.findMany({
    where: userWhere,
    include: { goalSheets: { where: { year }, include: { goals: true } } }
  });

  let created = 0;
  for (const user of users) {
    const existing = user.goalSheets[0];
    const sheet =
      existing ||
      (await prisma.goalSheet.create({
        data: { userId: user.id, year, status: "DRAFT" },
        include: { goals: true }
      }));

    const total = sheet.goals.reduce((sum, goal) => sum + goal.weightage, 0);
    if (sheet.goals.length < 8 && total + payload.weightage <= 100) {
      await prisma.goal.create({ data: { ...payload, sheetId: sheet.id, isShared: true } });
      await notifyUser(
        user.id,
        "SHARED_GOAL_ASSIGNED",
        "Shared KPI assigned",
        `${req.user.name} assigned shared goal "${payload.title}". You may adjust weightage only.`,
        `/employee?sheet=${sheet.id}`
      );
      created += 1;
    }
  }

  res.json({ created });
}

app.post(
  "/api/shared-goal",
  auth,
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(sharedGoalHandler)
);

app.post(
  "/api/admin/shared-goal",
  auth,
  requireRole("ADMIN"),
  asyncRoute(sharedGoalHandler)
);

app.post(
  "/api/admin/cycle",
  auth,
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    cycleOverride = quarters.includes(req.body.quarter) ? req.body.quarter : null;
    res.json(activeCheckInWindow());
  })
);

app.post(
  "/api/admin/entra-sync",
  auth,
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const synced = await syncDirectory();
    await notifyUser(
      req.user.id,
      "ENTRA_SYNC",
      "Microsoft Entra sync completed",
      `${synced.length} directory users synced with role and manager mapping.`,
      "/admin?module=entra"
    );
    res.json({ synced: synced.map(publicUser) });
  })
);

app.patch(
  "/api/admin/escalation-rules/:id",
  auth,
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const thresholdDays = Number(req.body.thresholdDays);
    const data = {
      active: Boolean(req.body.active),
      ...(Number.isInteger(thresholdDays) && thresholdDays >= 0 ? { thresholdDays } : {})
    };
    const rule = await prisma.escalationRule.update({ where: { id: req.params.id }, data });
    res.json(rule);
  })
);

app.post(
  "/api/admin/escalations/run",
  auth,
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const logs = await runEscalationScan();
    res.json({ created: logs.length, logs });
  })
);

app.patch(
  "/api/admin/escalations/:id/resolve",
  auth,
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const log = await prisma.escalationLog.update({
      where: { id: req.params.id },
      data: { status: "RESOLVED", resolvedAt: new Date() }
    });
    res.json(log);
  })
);

app.get(
  "/api/admin/export.csv",
  auth,
  requireRole("ADMIN"),
  asyncRoute(async (req, res) => {
    const sheets = await prisma.goalSheet.findMany({
      where: { year, user: { role: "EMPLOYEE" } },
      include: sheetInclude,
      orderBy: { user: { name: "asc" } }
    });

    const rows = [
      ["Employee", "Status", "Goal", "Thrust Area", "UoM", "Target", "Weightage", "Latest Quarter", "Actual", "Score"]
    ];

    for (const sheet of sheets) {
      for (const goal of sheet.goals) {
        const latest = latestCheckIn(goal);
        rows.push([
          sheet.user.name,
          sheet.status,
          goal.title,
          goal.thrustArea,
          goal.uom,
          goal.target,
          goal.weightage,
          latest?.quarter || "",
          latest?.actualValue ?? "",
          Math.round(scoreFor(goal, latest))
        ]);
      }
    }

    res
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", `attachment; filename="atomquest-goals-${year}.csv"`)
      .send(rows.map((row) => row.map(escapeCsv).join(",")).join("\n"));
  })
);

cron.schedule("0 9 * * 1", async () => {
  const logs = await runEscalationScan();
  if (logs.length) {
    console.log(`Weekly escalation scan: ${logs.length} escalation item(s) open.`);
  }
});

app.use(express.static(distDir));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Unexpected server error." });
});

app.listen(port, host, () => {
  console.log(`AtomQuest portal is running at http://${host}:${port}`);
});
