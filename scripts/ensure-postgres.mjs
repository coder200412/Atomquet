import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".postgres-data");
const logPath = path.join(root, "postgres.log");
const port = process.env.PGPORT || "55432";
const user = process.env.PGUSER || "atomquest";
const dbName = process.env.PGDATABASE || "atomquest";

function findPgBin() {
  if (process.env.PG_BIN && fs.existsSync(path.join(process.env.PG_BIN, "psql.exe"))) {
    return process.env.PG_BIN;
  }

  const base = "C:\\Program Files\\PostgreSQL";
  if (fs.existsSync(base)) {
    const versions = fs
      .readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => Number(b) - Number(a));

    for (const version of versions) {
      const candidate = path.join(base, version, "bin");
      if (fs.existsSync(path.join(candidate, "psql.exe"))) return candidate;
    }
  }

  throw new Error("PostgreSQL binaries were not found. Install PostgreSQL or set PG_BIN.");
}

function run(bin, args, options = {}) {
  return execFileSync(path.join(pgBin, bin), args, {
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    ...options
  });
}

function canConnect() {
  try {
    run("psql.exe", ["-h", "127.0.0.1", "-p", port, "-U", user, "-d", "postgres", "-tAc", "SELECT 1"], {
      capture: true
    });
    return true;
  } catch {
    return false;
  }
}

const pgBin = findPgBin();

if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
  fs.mkdirSync(dataDir, { recursive: true });
  run("initdb.exe", ["-D", dataDir, "-U", user, "-A", "trust", "-E", "UTF8"]);
}

if (!canConnect()) {
  run("pg_ctl.exe", ["-D", dataDir, "-l", logPath, "-o", `-p ${port} -h 127.0.0.1`, "-w", "start"]);
}

const exists = run(
  "psql.exe",
  ["-h", "127.0.0.1", "-p", port, "-U", user, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${dbName}'`],
  { capture: true }
).trim();

if (exists !== "1") {
  run("createdb.exe", ["-h", "127.0.0.1", "-p", port, "-U", user, dbName]);
}

console.log(`Local PostgreSQL is ready at 127.0.0.1:${port}/${dbName}`);
