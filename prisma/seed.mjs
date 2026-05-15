import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const year = Number(process.env.APP_YEAR || 2026);
const password = await bcrypt.hash("password123", 10);

async function createUser(data) {
  return prisma.user.create({
    data: {
      ...data,
      password
    }
  });
}

async function createSheet(userId, status, goals, extra = {}) {
  return prisma.goalSheet.create({
    data: {
      userId,
      year,
      status,
      ...extra,
      goals: {
        create: goals
      }
    },
    include: {
      goals: true
    }
  });
}

await prisma.escalationLog.deleteMany();
await prisma.escalationRule.deleteMany();
await prisma.notification.deleteMany();
await prisma.auditLog.deleteMany();
await prisma.checkIn.deleteMany();
await prisma.goal.deleteMany();
await prisma.goalSheet.deleteMany();
await prisma.user.deleteMany();

const admin = await createUser({
  email: "admin@atomquest.local",
  name: "Asha Mehta",
  role: "ADMIN",
  department: "HR",
  entraObjectId: "entra-asha",
  entraGroups: ["AQ-HR-Admins"]
});

const maya = await createUser({
  email: "maya.manager@atomquest.local",
  name: "Maya Singh",
  role: "MANAGER",
  department: "Platform",
  entraObjectId: "entra-maya",
  entraGroups: ["AQ-Managers", "AQ-Platform"]
});

const karan = await createUser({
  email: "karan.manager@atomquest.local",
  name: "Karan Patel",
  role: "MANAGER",
  department: "Operations",
  entraObjectId: "entra-karan",
  entraGroups: ["AQ-Managers", "AQ-Operations"]
});

const neha = await createUser({
  email: "neha.employee@atomquest.local",
  name: "Neha Rao",
  role: "EMPLOYEE",
  department: "Platform",
  entraObjectId: "entra-neha",
  entraGroups: ["AQ-Employees", "AQ-Platform"],
  managerId: maya.id
});

const arjun = await createUser({
  email: "arjun.employee@atomquest.local",
  name: "Arjun Verma",
  role: "EMPLOYEE",
  department: "Platform",
  entraObjectId: "entra-arjun",
  entraGroups: ["AQ-Employees", "AQ-Platform"],
  managerId: maya.id
});

const diya = await createUser({
  email: "diya.employee@atomquest.local",
  name: "Diya Shah",
  role: "EMPLOYEE",
  department: "Operations",
  entraObjectId: "entra-diya",
  entraGroups: ["AQ-Employees", "AQ-Operations"],
  managerId: karan.id
});

const rohan = await createUser({
  email: "rohan.employee@atomquest.local",
  name: "Rohan Iyer",
  role: "EMPLOYEE",
  department: "Operations",
  entraObjectId: "entra-rohan",
  entraGroups: ["AQ-Employees", "AQ-Operations"],
  managerId: karan.id
});

await prisma.goalSheet.createMany({
  data: [
    { userId: admin.id, year, status: "APPROVED", approvedAt: new Date() },
    { userId: maya.id, year, status: "APPROVED", approvedAt: new Date() },
    { userId: karan.id, year, status: "APPROVED", approvedAt: new Date() }
  ]
});

await createSheet(
  neha.id,
  "SUBMITTED",
  [
    {
      title: "Automate onboarding tracker",
      description: "Move the team onboarding checklist from manual mailers to a single monitored workflow.",
      thrustArea: "Operational Excellence",
      uom: "TIMELINE",
      target: 45,
      weightage: 35
    },
    {
      title: "Improve sprint predictability",
      description: "Raise planned-to-delivered story completion through tighter mid-sprint reviews.",
      thrustArea: "Delivery Reliability",
      uom: "NUMERIC_MIN",
      target: 92,
      weightage: 35
    },
    {
      title: "Reduce escaped defects",
      description: "Use peer review and test evidence to reduce escaped production issues.",
      thrustArea: "Quality",
      uom: "NUMERIC_MAX",
      target: 3,
      weightage: 30
    }
  ],
  { submittedAt: new Date() }
);

const arjunSheet = await createSheet(
  arjun.id,
  "APPROVED",
  [
    {
      title: "Launch analytics cockpit",
      description: "Publish a weekly leadership cockpit covering adoption, throughput, and blockers.",
      thrustArea: "Analytics",
      uom: "TIMELINE",
      target: 60,
      weightage: 25
    },
    {
      title: "Improve API response time",
      description: "Optimize the main employee search API for peak-hour usage.",
      thrustArea: "Customer Experience",
      uom: "NUMERIC_MAX",
      target: 450,
      weightage: 25
    },
    {
      title: "Raise self-service adoption",
      description: "Increase usage of the knowledge base for recurring HR workflows.",
      thrustArea: "Adoption",
      uom: "NUMERIC_MIN",
      target: 70,
      weightage: 25
    },
    {
      title: "Zero critical compliance misses",
      description: "Keep quarterly governance evidence complete before audits.",
      thrustArea: "Governance",
      uom: "ZERO",
      target: 0,
      weightage: 25
    }
  ],
  { submittedAt: new Date("2026-04-05T09:15:00Z"), approvedAt: new Date("2026-04-07T11:30:00Z") }
);

for (const goal of arjunSheet.goals) {
  const actualByType = {
    TIMELINE: 54,
    NUMERIC_MAX: 430,
    NUMERIC_MIN: 52,
    ZERO: 0
  };

  await prisma.checkIn.create({
    data: {
      goalId: goal.id,
      quarter: "Q1",
      status: goal.uom === "NUMERIC_MIN" ? "ON_TRACK" : "COMPLETED",
      actualValue: actualByType[goal.uom],
      managerComment: "Strong evidence submitted for Q1."
    }
  });
}

await createSheet(diya.id, "DRAFT", [
  {
    title: "Publish release readiness scorecard",
    description: "Create a scorecard for release risk across engineering, support, and business readiness.",
    thrustArea: "Governance",
    uom: "TIMELINE",
    target: 35,
    weightage: 40
  },
  {
    title: "Increase first-contact resolution",
    description: "Improve support resolution by strengthening diagnostics and runbooks.",
    thrustArea: "Customer Experience",
    uom: "NUMERIC_MIN",
    target: 78,
    weightage: 30
  }
]);

await createSheet(
  rohan.id,
  "REJECTED",
  [
    {
      title: "Reduce cloud waste",
      description: "Cut unused runtime spend through scheduled shutdowns and owner reviews.",
      thrustArea: "Cost Discipline",
      uom: "NUMERIC_MAX",
      target: 8,
      weightage: 40
    },
    {
      title: "Increase automation coverage",
      description: "Automate repeat checks for monthly operational reports.",
      thrustArea: "Automation",
      uom: "NUMERIC_MIN",
      target: 65,
      weightage: 35
    },
    {
      title: "Zero severity-one repeats",
      description: "Close permanent fixes for known recurring incidents.",
      thrustArea: "Reliability",
      uom: "ZERO",
      target: 0,
      weightage: 25
    }
  ],
  { managerNote: "Please make the automation goal more outcome based before resubmission." }
);

await prisma.escalationRule.createMany({
  data: [
    {
      name: "Goal submission delay",
      condition: "GOALS_NOT_SUBMITTED",
      thresholdDays: 3,
      level1: "Employee",
      level2: "Manager",
      level3: "HR"
    },
    {
      name: "Manager approval delay",
      condition: "MANAGER_APPROVAL_PENDING",
      thresholdDays: 2,
      level1: "Manager",
      level2: "Skip-level",
      level3: "HR"
    },
    {
      name: "Quarterly check-in missing",
      condition: "CHECKIN_NOT_COMPLETED",
      thresholdDays: 5,
      level1: "Employee",
      level2: "Manager",
      level3: "HR"
    }
  ]
});

await prisma.notification.createMany({
  data: [
    {
      recipientId: maya.id,
      channel: "EMAIL",
      eventType: "GOAL_SUBMITTED",
      title: "Neha submitted goals",
      message: "Neha Rao submitted a goal sheet for L1 review.",
      deepLink: "/manager?employee=neha.employee@atomquest.local"
    },
    {
      recipientId: maya.id,
      channel: "TEAMS",
      eventType: "GOAL_SUBMITTED",
      title: "Review goal sheet",
      message: "Adaptive card routed from Teams to Neha's goal sheet.",
      deepLink: "/manager?employee=neha.employee@atomquest.local",
      adaptiveCard: {
        type: "AdaptiveCard",
        version: "1.5",
        body: [{ type: "TextBlock", text: "Neha Rao submitted goals", weight: "Bolder" }],
        actions: [{ type: "Action.OpenUrl", title: "Open Goal Sheet", url: "/manager?employee=neha.employee@atomquest.local" }]
      }
    },
    {
      recipientId: arjun.id,
      channel: "EMAIL",
      eventType: "CHECKIN_REMINDER",
      title: "Q1 check-in reminder",
      message: "Please update Q1 achievement against approved goals.",
      deepLink: "/employee?quarter=Q1"
    }
  ]
});

await prisma.escalationLog.createMany({
  data: [
    {
      ruleName: "Goal submission delay",
      userId: diya.id,
      targetRole: "Employee",
      message: "Diya has a draft sheet and has not submitted within the configured window.",
      level: "EMPLOYEE"
    },
    {
      ruleName: "Manager approval delay",
      userId: neha.id,
      targetRole: "Manager",
      message: "Neha's submitted sheet is waiting for L1 approval.",
      level: "MANAGER"
    }
  ]
});

console.log("Seeded AtomQuest demo users.");
console.table([
  ["Admin", "admin@atomquest.local", "password123"],
  ["Manager", "maya.manager@atomquest.local", "password123"],
  ["Manager", "karan.manager@atomquest.local", "password123"],
  ["Employee", "neha.employee@atomquest.local", "password123"],
  ["Employee", "arjun.employee@atomquest.local", "password123"],
  ["Employee", "diya.employee@atomquest.local", "password123"]
]);

await prisma.$disconnect();
