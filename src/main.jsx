import React from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Target,
  Trash2,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import "./styles.css";

const ACCOUNTS = [
  ["Admin", "admin@atomquest.local"],
  ["Manager", "maya.manager@atomquest.local"],
  ["Manager", "karan.manager@atomquest.local"],
  ["Employee", "neha.employee@atomquest.local"],
  ["Employee", "arjun.employee@atomquest.local"]
];

const UOM_LABELS = {
  NUMERIC_MIN: "Min / Higher wins",
  NUMERIC_MAX: "Max / Lower wins",
  TIMELINE: "Timeline",
  ZERO: "Zero target"
};

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  NOT_STARTED: "Not started",
  ON_TRACK: "On track",
  COMPLETED: "Completed"
};

const CHART_COLORS = ["#0f766e", "#4f46e5", "#d97706", "#dc2626", "#2563eb", "#7c3aed", "#16a34a"];

function App() {
  const [auth, setAuth] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("atomquest.auth")) || null;
    } catch {
      return null;
    }
  });
  const [dashboard, setDashboard] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");

  const api = React.useCallback(
    async (url, options = {}) => {
      const response = await fetch(`/api${url}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
          ...options.headers
        }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Request failed.");
      }

      if (response.status === 204) return null;
      const type = response.headers.get("content-type") || "";
      return type.includes("application/json") ? response.json() : response.text();
    },
    [auth?.token]
  );

  const refresh = React.useCallback(async () => {
    if (!auth?.token) return;
    const next = await api("/dashboard");
    setDashboard(next);
  }, [api, auth?.token]);

  React.useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  async function login(email, password) {
    setBusy(true);
    setError("");
    try {
      const next = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || "Login failed.");
        }
        return response.json();
      });
      setAuth(next);
      localStorage.setItem("atomquest.auth", JSON.stringify(next));
      setNotice(`Signed in as ${next.user.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signup(account) {
    setBusy(true);
    setError("");
    try {
      const next = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account)
      }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || "Signup failed.");
        }
        return response.json();
      });
      setAuth(next);
      localStorage.setItem("atomquest.auth", JSON.stringify(next));
      setNotice(`Account created for ${next.user.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function entraLogin(email) {
    setBusy(true);
    setError("");
    try {
      const next = await fetch("/api/auth/entra-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || "SSO failed.");
        }
        return response.json();
      });
      setAuth(next);
      localStorage.setItem("atomquest.auth", JSON.stringify(next));
      setNotice(`Signed in with ${next.provider}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function action(work, success) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await refresh();
      if (success) setNotice(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setAuth(null);
    setDashboard(null);
    localStorage.removeItem("atomquest.auth");
  }

  if (!auth) {
    return <LoginScreen onLogin={login} onSignup={signup} onEntraLogin={entraLogin} busy={busy} error={error} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AQ</div>
          <div>
            <strong>AtomQuest</strong>
            <span>Goal Portal</span>
          </div>
        </div>

        <nav className="nav-stack">
          <button className="nav-item active" type="button">
            {auth.user.role === "ADMIN" ? <ShieldCheck size={18} /> : auth.user.role === "MANAGER" ? <Users size={18} /> : <Target size={18} />}
            {titleCase(auth.user.role)}
          </button>
          <button className="nav-item" type="button" onClick={refresh}>
            <RefreshCw size={18} />
            Sync
          </button>
        </nav>

        <button className="logout" type="button" onClick={logout}>
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{dashboard?.kind || auth.user.role}</p>
            <h1>{auth.user.name}</h1>
          </div>
          <div className="topbar-meta">
            <span>{auth.user.email}</span>
            <span>{new Date().getFullYear()}</span>
          </div>
        </header>

        {(notice || error || busy) && (
          <div className={`toast ${error ? "error" : ""}`}>
            {busy ? "Working..." : error || notice}
          </div>
        )}

        {!dashboard ? (
          <div className="empty-state">Loading dashboard</div>
        ) : dashboard.kind === "EMPLOYEE" ? (
          <EmployeeDashboard api={api} action={action} sheet={dashboard.sheet} notifications={dashboard.notifications || []} busy={busy} />
        ) : dashboard.kind === "MANAGER" ? (
          <ManagerDashboard api={api} action={action} team={dashboard.team} notifications={dashboard.notifications || []} busy={busy} />
        ) : (
          <AdminDashboard api={api} action={action} analytics={dashboard.analytics} notifications={dashboard.notifications || []} busy={busy} />
        )}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, onSignup, onEntraLogin, busy, error }) {
  const [mode, setMode] = React.useState("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(ACCOUNTS[0][1]);
  const [password, setPassword] = React.useState("password123");
  const [role, setRole] = React.useState("EMPLOYEE");
  const [department, setDepartment] = React.useState("Product");
  const isSignup = mode === "signup";

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">AQ</div>
          <div>
            <strong>AtomQuest</strong>
            <span>Goal Portal</span>
          </div>
        </div>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (isSignup) {
              onSignup({ name, email, password, role, department });
            } else {
              onLogin(email, password);
            }
          }}
        >
          {isSignup && (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {isSignup && (
            <div className="form-row">
              <label>
                Role
                <select value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </label>
              <label>
                Department
                <select value={department} onChange={(event) => setDepartment(event.target.value)}>
                  <option value="Product">Product</option>
                  <option value="Platform">Platform</option>
                  <option value="Operations">Operations</option>
                  <option value="HR">HR</option>
                </select>
              </label>
            </div>
          )}
          <button className="primary-action" type="submit" disabled={busy}>
            {isSignup ? <UserPlus size={18} /> : <Send size={18} />}
            {isSignup ? "Create account" : "Sign in"}
          </button>
          <button
            className="ghost-action"
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              if (!isSignup) {
                setEmail("");
                setPassword("");
              }
            }}
          >
            {isSignup ? <Send size={18} /> : <UserPlus size={18} />}
            {isSignup ? "Use existing account" : "Create account"}
          </button>
          <button className="ghost-action" type="button" disabled={busy} onClick={() => onEntraLogin(email)}>
            <ShieldCheck size={18} />
            Microsoft Entra SSO
          </button>
          <p className="login-hint">Hackathon visitors can create an account. Demo accounts use password123.</p>
        </form>

        <div className="account-grid">
          {ACCOUNTS.map(([role, account]) => (
            <button
              key={account}
              type="button"
              onClick={() => {
                setMode("signin");
                setEmail(account);
                setPassword("password123");
              }}
            >
              <span>{role}</span>
              <strong>{account}</strong>
            </button>
          ))}
        </div>

        {error && <div className="toast error">{error}</div>}
      </section>
    </main>
  );
}

function EmployeeDashboard({ api, action, sheet, notifications, busy }) {
  const [editing, setEditing] = React.useState(null);
  const canEdit = ["DRAFT", "REJECTED"].includes(sheet.status);
  const readyToSubmit = sheet.totalWeightage === 100 && sheet.goals.length > 0;

  return (
    <div className="stack">
      <section className="metric-grid">
        <Metric label="Sheet status" value={STATUS_LABELS[sheet.status]} icon={<ClipboardCheck />} tone={sheet.status.toLowerCase()} />
        <Metric label="Total weightage" value={`${sheet.totalWeightage}%`} icon={<Target />} tone={sheet.totalWeightage === 100 ? "approved" : "draft"} />
        <Metric label="Progress score" value={`${sheet.weightedScore}%`} icon={<BarChart3 />} tone="score" />
      </section>

      {sheet.managerNote && <div className="notice-band">{sheet.managerNote}</div>}

      <NotificationsPanel notifications={notifications} />

      <section className="panel">
        <PanelHeader
          title="Goals"
          meta={`${sheet.goals.length}/8 goals`}
          action={
            canEdit && (
              <button className="icon-button label-button" type="button" onClick={() => setEditing({})}>
                <Plus size={17} />
                Goal
              </button>
            )
          }
        />
        <GoalTable
          goals={sheet.goals}
          canEdit={canEdit}
          onEdit={setEditing}
          onDelete={(goal) =>
            action(
              () => api(`/goals/${goal.id}`, { method: "DELETE" }),
              "Goal removed."
            )
          }
        />
        <div className="panel-footer">
          <span className={readyToSubmit ? "good" : "muted"}>{readyToSubmit ? "Ready for L1 review" : "Weightage must total 100%"}</span>
          {canEdit && (
            <button
              className="primary-action"
              type="button"
              disabled={!readyToSubmit || busy}
              onClick={() =>
                action(
                  () => api(`/sheets/${sheet.id}/submit`, { method: "POST" }),
                  "Submitted to manager."
                )
              }
            >
              <Send size={17} />
              Submit
            </button>
          )}
        </div>
      </section>

      {editing && (
        <GoalEditor
          sheetId={sheet.id}
          goal={editing.id ? editing : null}
          api={api}
          action={action}
          onClose={() => setEditing(null)}
        />
      )}

      <CheckInPanel sheet={sheet} api={api} action={action} />
    </div>
  );
}

function ManagerDashboard({ api, action, team, notifications, busy }) {
  const [selectedId, setSelectedId] = React.useState(team[0]?.id || "");
  const [editing, setEditing] = React.useState(null);
  const [note, setNote] = React.useState("");
  const selected = team.find((member) => member.id === selectedId) || team[0];
  const sheet = selected?.sheet;

  React.useEffect(() => {
    if (!selectedId && team[0]?.id) setSelectedId(team[0].id);
  }, [selectedId, team]);

  const pending = team.filter((member) => member.sheet?.status === "SUBMITTED").length;
  const approved = team.filter((member) => member.sheet?.status === "APPROVED").length;

  return (
    <div className="manager-grid">
      <section className="metric-grid manager-metrics">
        <Metric label="Team members" value={team.length} icon={<Users />} tone="score" />
        <Metric label="Pending review" value={pending} icon={<ClipboardCheck />} tone={pending ? "submitted" : "approved"} />
        <Metric label="Approved sheets" value={approved} icon={<CheckCircle2 />} tone="approved" />
      </section>

      <NotificationsPanel notifications={notifications} compact />

      <section className="panel team-panel">
        <PanelHeader title="Team" meta="L1 queue" />
        <div className="team-list">
          {team.map((member) => (
            <button key={member.id} className={member.id === selected?.id ? "active" : ""} type="button" onClick={() => setSelectedId(member.id)}>
              <strong>{member.name}</strong>
              <span className={`status-pill ${member.sheet?.status?.toLowerCase()}`}>{STATUS_LABELS[member.sheet?.status] || "No sheet"}</span>
            </button>
          ))}
        </div>
      </section>

      <SharedGoalForm
        busy={busy}
        compact
        onSubmit={(payload) =>
          action(
            () => api("/shared-goal", { method: "POST", body: JSON.stringify(payload) }),
            "Shared goal pushed to your team."
          )
        }
      />

      <section className="panel review-panel">
        {sheet ? (
          <>
            <PanelHeader title={selected.name} meta={`${sheet.totalWeightage}% weightage`} />
            <GoalTable goals={sheet.goals} canEdit onEdit={setEditing} />
            <div className="approval-row">
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Manager note" />
              <button
                className="primary-action"
                type="button"
                disabled={busy}
                onClick={() =>
                  action(
                    () => api(`/sheets/${sheet.id}/approve`, { method: "POST", body: JSON.stringify({ managerNote: note }) }),
                    "Sheet approved."
                  )
                }
              >
                <CheckCircle2 size={17} />
                Approve
              </button>
              <button
                className="danger-action"
                type="button"
                disabled={busy || !note.trim()}
                onClick={() =>
                  action(
                    () => api(`/sheets/${sheet.id}/reject`, { method: "POST", body: JSON.stringify({ managerNote: note }) }),
                    "Sheet returned."
                  )
                }
              >
                <XCircle size={17} />
                Reject
              </button>
            </div>
            <ManagerComments goals={sheet.goals} api={api} action={action} />
          </>
        ) : (
          <div className="empty-state">No goal sheet for this employee</div>
        )}
      </section>

      {editing && (
        <GoalEditor
          sheetId={sheet.id}
          goal={editing}
          api={api}
          action={action}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AdminDashboard({ api, action, analytics, notifications, busy }) {
  const statusRows = Object.entries(analytics.byStatus).map(([name, value]) => ({ name: STATUS_LABELS[name], value }));
  const totalEmployees = analytics.roleCounts.EMPLOYEE || 0;
  const approved = analytics.byStatus.APPROVED || 0;

  async function downloadCsv() {
    const csv = await api("/admin/export.csv");
    const blob = new Blob([csv], { type: "text/csv" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "atomquest-goals-2026.csv";
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="stack">
      <section className="metric-grid">
        <Metric label="Employees" value={totalEmployees} icon={<Users />} tone="score" />
        <Metric label="Approved" value={approved} icon={<ShieldCheck />} tone="approved" />
        <Metric label="Check-ins" value={`${analytics.checkInCompletion.completed}/${analytics.checkInCompletion.total}`} icon={<MessageSquare />} tone="submitted" />
      </section>

      <section className="analytics-grid">
        <div className="panel chart-panel">
          <PanelHeader title="Completion" meta="By status" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <PanelHeader title="Thrust Areas" meta="Weighted mix" />
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={analytics.byThrustArea} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
                {analytics.byThrustArea.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <PanelHeader title="QoQ Score" meta="Average achievement" />
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={analytics.trends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="quarter" />
              <YAxis domain={[0, 120]} />
              <Tooltip />
              <Line dataKey="score" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="module-grid">
        <EntraModule
          analytics={analytics}
          busy={busy}
          onSync={() =>
            action(
              () => api("/admin/entra-sync", { method: "POST" }),
              "Microsoft Entra directory sync completed."
            )
          }
        />
        <NotificationModule notifications={analytics.notifications?.length ? analytics.notifications : notifications} />
        <EscalationModule
          analytics={analytics}
          busy={busy}
          onRun={() =>
            action(
              () => api("/admin/escalations/run", { method: "POST" }),
              "Escalation scan completed."
            )
          }
          onToggleRule={(rule) =>
            action(
              () =>
                api(`/admin/escalation-rules/${rule.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ active: !rule.active, thresholdDays: rule.thresholdDays })
                }),
              `${rule.name} ${rule.active ? "paused" : "activated"}.`
            )
          }
          onResolve={(log) =>
            action(
              () => api(`/admin/escalations/${log.id}/resolve`, { method: "PATCH" }),
              "Escalation resolved."
            )
          }
        />
      </section>

      <BonusAnalytics analytics={analytics} />

      <section className="admin-grid">
        <SharedGoalForm
          busy={busy}
          onSubmit={(payload) =>
            action(
              () => api("/shared-goal", { method: "POST", body: JSON.stringify(payload) }),
              "Shared goal broadcast completed."
            )
          }
        />

        <div className="panel">
          <PanelHeader
            title="Exports"
            meta="Planned vs actual"
            action={
              <button
                className="icon-button label-button"
                type="button"
                onClick={() => action(downloadCsv, "CSV downloaded.")}
              >
                <Download size={17} />
                CSV
              </button>
            }
          />
          <div className="escalation-list">
            <CycleControls
              cycle={analytics.cycle}
              busy={busy}
              onChange={(quarter) =>
                action(
                  () => api("/admin/cycle", { method: "POST", body: JSON.stringify({ quarter }) }),
                  quarter ? `${quarter} check-in window opened.` : "Cycle returned to schedule."
                )
              }
            />
            {analytics.escalations.map((item) => (
              <div key={item.id}>
                <strong>{item.name}</strong>
                <span>{STATUS_LABELS[item.status]} | {item.totalWeightage}%</span>
              </div>
            ))}
            {!analytics.escalations.length && <div className="empty-state compact">All employee sheets are approved</div>}
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Exception Handling" meta="Admin unlock" />
        <div className="sheet-action-list">
          {analytics.sheets.map((sheet) => (
            <div key={sheet.id}>
              <div>
                <strong>{sheet.user.name}</strong>
                <span>{STATUS_LABELS[sheet.status]} | {sheet.totalWeightage}% weightage</span>
              </div>
              <button
                className="icon-button label-button"
                type="button"
                disabled={busy || sheet.status !== "APPROVED"}
                onClick={() =>
                  action(
                    () => api(`/sheets/${sheet.id}/unlock`, { method: "POST" }),
                    `${sheet.user.name}'s sheet unlocked.`
                  )
                }
              >
                <RefreshCw size={16} />
                Unlock
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Audit Trail" meta="Recent goal edits" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Goal</th>
                <th>Changed</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {analytics.audits.map((audit) => (
                <tr key={audit.id}>
                  <td>{audit.employee}</td>
                  <td>{audit.goalTitle}</td>
                  <td>{audit.changeDetail.changed?.join(", ") || "Goal updated"}</td>
                  <td>{formatDate(audit.timestamp)}</td>
                </tr>
              ))}
              {!analytics.audits.length && (
                <tr>
                  <td colSpan="4">No audit entries yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function GoalTable({ goals, canEdit, onEdit, onDelete }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Goal</th>
            <th>Thrust area</th>
            <th>UoM</th>
            <th>Target</th>
            <th>Weight</th>
            <th>Progress</th>
            {canEdit && <th className="actions-col">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {goals.map((goal) => (
            <tr key={goal.id}>
              <td>
                <strong>{goal.title}</strong>
                <span className="row-note">
                  {goal.isShared ? "Shared KPI | " : ""}
                  {goal.description}
                </span>
              </td>
              <td>{goal.thrustArea}</td>
              <td>{UOM_LABELS[goal.uom]}</td>
              <td>{goal.target}</td>
              <td>{goal.weightage}%</td>
              <td>
                <span className={`score-pill ${goal.score >= 90 ? "high" : goal.score >= 60 ? "mid" : ""}`}>{goal.score}%</span>
              </td>
              {canEdit && (
                <td className="row-actions">
                  <button className="icon-button" type="button" onClick={() => onEdit(goal)} title="Edit goal">
                    <Save size={16} />
                  </button>
                  {onDelete && (
                    <button className="icon-button danger" type="button" onClick={() => onDelete(goal)} title="Delete goal">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {!goals.length && (
            <tr>
              <td colSpan={canEdit ? 7 : 6}>No goals added yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GoalEditor({ sheetId, goal, api, action, onClose }) {
  const [form, setForm] = React.useState(() => ({
    title: goal?.title || "",
    description: goal?.description || "",
    thrustArea: goal?.thrustArea || "Operational Excellence",
    uom: goal?.uom || "NUMERIC_MAX",
    target: goal?.target || 100,
    weightage: goal?.weightage || 10
  }));

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="panel editor-panel">
      <PanelHeader title={goal ? "Edit Goal" : "New Goal"} meta={goal ? "Audit-ready update" : "Draft goal"} />
      <form
        className="goal-form"
        onSubmit={(event) => {
          event.preventDefault();
          const payload = goal?.isShared ? { weightage: Number(form.weightage) } : { ...form, target: Number(form.target), weightage: Number(form.weightage) };
          action(
            () =>
              goal
                ? api(`/goals/${goal.id}`, { method: "PATCH", body: JSON.stringify(payload) })
                : api("/goals", { method: "POST", body: JSON.stringify({ ...payload, sheetId }) }),
            goal ? "Goal updated." : "Goal added."
          ).then(onClose);
        }}
      >
        <label>
          Title
          <input disabled={goal?.isShared} value={form.title} onChange={(event) => update("title", event.target.value)} />
        </label>
        <label className="span-2">
          Description
          <textarea disabled={goal?.isShared} value={form.description} onChange={(event) => update("description", event.target.value)} />
        </label>
        <label>
          Thrust area
          <input disabled={goal?.isShared} value={form.thrustArea} onChange={(event) => update("thrustArea", event.target.value)} />
        </label>
        <label>
          UoM
          <select disabled={goal?.isShared} value={form.uom} onChange={(event) => update("uom", event.target.value)}>
            {Object.entries(UOM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target
          <input disabled={goal?.isShared} type="number" min="0" step="1" value={form.target} onChange={(event) => update("target", event.target.value)} />
        </label>
        <label>
          Weightage
          <input type="number" min="10" max="100" step="5" value={form.weightage} onChange={(event) => update("weightage", event.target.value)} />
        </label>
        <div className="form-actions span-2">
          <button type="button" className="ghost-action" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-action">
            <Save size={17} />
            Save
          </button>
        </div>
      </form>
    </section>
  );
}

function CheckInPanel({ sheet, api, action }) {
  const window = sheet.checkInWindow || { active: false, quarter: null, label: "Cycle Closed" };
  const [form, setForm] = React.useState({
    goalId: sheet.goals[0]?.id || "",
    quarter: window.quarter || sheet.currentQuarter || "Q1",
    status: "ON_TRACK",
    actualValue: ""
  });

  React.useEffect(() => {
    setForm((current) => ({ ...current, goalId: sheet.goals[0]?.id || "", quarter: window.quarter || current.quarter }));
  }, [sheet.goals, window.quarter]);

  const checkInsOpen = sheet.status === "APPROVED" && window.active;

  return (
    <section className="panel">
      <PanelHeader title="Check-ins" meta={sheet.status === "APPROVED" ? `${window.label}${window.active ? " open" : " closed"}` : "Available after approval"} />
      <form
        className="checkin-form"
        onSubmit={(event) => {
          event.preventDefault();
          action(
            () =>
              api(`/goals/${form.goalId}/check-ins`, {
                method: "POST",
                body: JSON.stringify({ ...form, actualValue: Number(form.actualValue) })
              }),
            "Check-in saved."
          );
        }}
      >
        <select disabled={!checkInsOpen} value={form.goalId} onChange={(event) => setForm({ ...form, goalId: event.target.value })}>
          {sheet.goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        <select disabled={!checkInsOpen} value={form.quarter} onChange={(event) => setForm({ ...form, quarter: event.target.value })}>
          {["Q1", "Q2", "Q3", "Q4"].map((quarter) => (
            <option key={quarter}>{quarter}</option>
          ))}
        </select>
        <select disabled={!checkInsOpen} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          {["NOT_STARTED", "ON_TRACK", "COMPLETED"].map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <input
          disabled={!checkInsOpen}
          type="number"
          min="0"
          placeholder="Actual"
          value={form.actualValue}
          onChange={(event) => setForm({ ...form, actualValue: event.target.value })}
        />
        <button className="primary-action" type="submit" disabled={!checkInsOpen || !form.goalId}>
          <Save size={17} />
          Save
        </button>
      </form>
    </section>
  );
}

function ManagerComments({ goals, api, action }) {
  const [comments, setComments] = React.useState({});
  const items = goals.filter((goal) => goal.latestCheckIn);

  if (!items.length) return null;

  return (
    <div className="comment-list">
      {items.map((goal) => (
        <div key={goal.id} className="comment-row">
          <div>
            <strong>{goal.title}</strong>
            <span>
              {goal.latestCheckIn.quarter} | {STATUS_LABELS[goal.latestCheckIn.status]} | {goal.latestCheckIn.actualValue}
            </span>
          </div>
          <input
            value={comments[goal.latestCheckIn.id] ?? goal.latestCheckIn.managerComment ?? ""}
            onChange={(event) => setComments({ ...comments, [goal.latestCheckIn.id]: event.target.value })}
            placeholder="Feedback"
          />
          <button
            className="icon-button label-button"
            type="button"
            onClick={() =>
              action(
                () =>
                  api(`/check-ins/${goal.latestCheckIn.id}/comment`, {
                    method: "PATCH",
                    body: JSON.stringify({ managerComment: comments[goal.latestCheckIn.id] ?? goal.latestCheckIn.managerComment ?? "" })
                  }),
                "Feedback saved."
              )
            }
          >
            <MessageSquare size={16} />
            Save
          </button>
        </div>
      ))}
    </div>
  );
}

function SharedGoalForm({ onSubmit, busy, compact = false }) {
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    thrustArea: "Governance",
    uom: "ZERO",
    target: 0,
    weightage: 10
  });

  return (
    <section className={`panel ${compact ? "shared-goal-panel" : ""}`}>
      <PanelHeader title="Shared Goal" meta={compact ? "Push to team" : "Broadcast"} />
      <form
        className="goal-form single"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ ...form, target: Number(form.target), weightage: Number(form.weightage) });
        }}
      >
        <label>
          Title
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label>
          Thrust area
          <input value={form.thrustArea} onChange={(event) => setForm({ ...form, thrustArea: event.target.value })} />
        </label>
        <label>
          UoM
          <select value={form.uom} onChange={(event) => setForm({ ...form, uom: event.target.value })}>
            {Object.entries(UOM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target
          <input type="number" min="0" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} />
        </label>
        <label>
          Weightage
          <input type="number" min="10" max="100" value={form.weightage} onChange={(event) => setForm({ ...form, weightage: event.target.value })} />
        </label>
        <button className="primary-action" type="submit" disabled={busy}>
          <Send size={17} />
          Broadcast
        </button>
      </form>
    </section>
  );
}

function CycleControls({ cycle, onChange, busy }) {
  return (
    <div className="cycle-controls">
      <div>
        <strong>{cycle?.label || "Cycle"}</strong>
        <span>{cycle?.source === "admin" ? "Admin override active" : "Scheduled window"}</span>
      </div>
      <div>
        {["Q1", "Q2", "Q3", "Q4"].map((quarter) => (
          <button key={quarter} className={cycle?.quarter === quarter ? "active" : ""} type="button" disabled={busy} onClick={() => onChange(quarter)}>
            {quarter}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => onChange(null)}>
          Auto
        </button>
      </div>
    </div>
  );
}

function NotificationsPanel({ notifications = [], compact = false }) {
  if (!notifications.length) return null;

  return (
    <section className={`panel ${compact ? "shared-goal-panel" : ""}`}>
      <PanelHeader title="Notifications" meta="Email and Teams events" />
      <div className="notification-list">
        {notifications.slice(0, 4).map((item) => (
          <div key={item.id}>
            <span className={`channel-pill ${item.channel?.toLowerCase()}`}>{item.channel}</span>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            {item.deepLink && <span>{item.deepLink}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function EntraModule({ analytics, onSync, busy }) {
  return (
    <section className="panel">
      <PanelHeader
        title="Microsoft Entra ID"
        meta={`${analytics.entra.syncedUsers} synced users`}
        action={
          <button className="icon-button label-button" type="button" disabled={busy} onClick={onSync}>
            <RefreshCw size={16} />
            Sync
          </button>
        }
      />
      <div className="module-body">
        <div className="kv-grid">
          <div>
            <span>SSO provider</span>
            <strong>Microsoft Entra ID</strong>
          </div>
          <div>
            <span>Role mapping</span>
            <strong>Group membership</strong>
          </div>
          <div>
            <span>Hierarchy</span>
            <strong>Manager attribute</strong>
          </div>
        </div>
        <div className="chip-row">
          {analytics.entra.groups.map((group) => (
            <span key={group}>{group}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function NotificationModule({ notifications = [] }) {
  return (
    <section className="panel">
      <PanelHeader title="Email & Teams" meta={`${notifications.length} delivery events`} />
      <div className="notification-list">
        {notifications.slice(0, 5).map((item) => (
          <div key={item.id}>
            <span className={`channel-pill ${item.channel?.toLowerCase()}`}>{item.channel}</span>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            {item.recipient && <span>{item.recipient.name}</span>}
            {item.channel === "TEAMS" && item.adaptiveCard && (
              <div className="adaptive-card-preview">
                <strong>{item.adaptiveCard.body?.[0]?.text || "Adaptive card"}</strong>
                <span>{item.adaptiveCard.actions?.[0]?.title || "Open Goal Sheet"}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EscalationModule({ analytics, onRun, onToggleRule, onResolve, busy }) {
  const openLogs = analytics.escalationLogs.filter((log) => log.status === "OPEN");

  return (
    <section className="panel">
      <PanelHeader
        title="Escalation Rules"
        meta={`${openLogs.length} open logs`}
        action={
          <button className="icon-button label-button" type="button" disabled={busy} onClick={onRun}>
            <RefreshCw size={16} />
            Scan
          </button>
        }
      />
      <div className="module-body">
        <div className="rule-list">
          {analytics.escalationRules.map((rule) => (
            <div key={rule.id}>
              <div>
                <strong>{rule.name}</strong>
                <span>{rule.condition.replaceAll("_", " ")} | {rule.thresholdDays}d | {rule.level1} to {rule.level2} to {rule.level3}</span>
              </div>
              <button className="ghost-action" type="button" disabled={busy} onClick={() => onToggleRule(rule)}>
                {rule.active ? "Pause" : "Activate"}
              </button>
            </div>
          ))}
        </div>
        <div className="escalation-log-list">
          {analytics.escalationLogs.slice(0, 5).map((log) => (
            <div key={log.id}>
              <div>
                <strong>{log.ruleName}</strong>
                <span>{log.user?.name || "Org"} | {log.level} | {log.status}</span>
                <p>{log.message}</p>
              </div>
              {log.status === "OPEN" && (
                <button className="icon-button label-button" type="button" disabled={busy} onClick={() => onResolve(log)}>
                  <CheckCircle2 size={16} />
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BonusAnalytics({ analytics }) {
  return (
    <section className="panel">
      <PanelHeader title="Advanced Analytics" meta="QoQ trends, heatmaps, distributions, manager effectiveness" />
      <div className="bonus-analytics">
        <div>
          <h3>UoM Mix</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.byUom}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3>Goal Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.goalStatus}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#d97706" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3>Department QoQ</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={analytics.departmentTrends}>
              <XAxis dataKey="department" />
              <YAxis domain={[0, 120]} />
              <Tooltip />
              <Line dataKey="Q1" stroke="#0f766e" strokeWidth={2} />
              <Line dataKey="Q2" stroke="#4f46e5" strokeWidth={2} />
              <Line dataKey="Q3" stroke="#d97706" strokeWidth={2} />
              <Line dataKey="Q4" stroke="#dc2626" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="heatmap-grid">
        {analytics.heatmap.map((row) => (
          <div key={row.manager}>
            <strong>{row.manager}</strong>
            {["Q1", "Q2", "Q3", "Q4"].map((quarter) => (
              <span key={quarter} className={row[quarter] >= 80 ? "hot high" : row[quarter] >= 40 ? "hot mid" : "hot"}>
                {quarter} {row[quarter]}%
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="manager-effectiveness">
        {analytics.managerEffectiveness.map((manager) => (
          <div key={manager.name}>
            <strong>{manager.name}</strong>
            <span>{manager.department} | team {manager.teamSize}</span>
            <div>
              <span>Approval {manager.approvalRate}%</span>
              <span>Check-in {manager.checkInRate}%</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, icon, tone }) {
  return (
    <div className={`metric ${tone || ""}`}>
      <div className="metric-icon">{React.cloneElement(icon, { size: 20 })}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelHeader({ title, meta, action }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        {meta && <span>{meta}</span>}
      </div>
      {action}
    </div>
  );
}

function titleCase(text) {
  return text.toLowerCase().replace(/^\w/, (match) => match.toUpperCase());
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

createRoot(document.getElementById("root")).render(<App />);
