import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";

if (!process.env.BETTER_AUTH_SECRET) {
  console.error("BETTER_AUTH_SECRET must be set before starting the production server.");
  process.exit(1);
}

const tunnelEnabled = process.env.CLOUDFLARE_TUNNEL_ENABLED === "true";

if (tunnelEnabled && !process.env.TUNNEL_TOKEN) {
  console.error("TUNNEL_TOKEN must be set when CLOUDFLARE_TUNNEL_ENABLED=true.");
  process.exit(1);
}

const migration = spawnSync("pnpm", ["db:migrate"], { stdio: "inherit", env: process.env });
if (migration.status !== 0) process.exit(migration.status ?? 1);

const children = new Map();
let shuttingDown = false;
let finalExitCode = 0;

function finishIfStopped() {
  if (children.size > 0 && [...children.values()].every(({ stopped }) => stopped)) {
    process.exit(finalExitCode);
  }
}

function stopAll(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  finalExitCode = exitCode;

  for (const { child, stopped } of children.values()) {
    if (!stopped) child.kill("SIGTERM");
  }

  finishIfStopped();
}

function start(name, command, args) {
  const child = spawn(command, args, { stdio: "inherit", env: process.env });
  const state = { child, stopped: false };
  children.set(name, state);

  child.once("error", (error) => {
    state.stopped = true;
    console.error(`${name} failed to start:`, error);
    stopAll(1);
    finishIfStopped();
  });

  child.once("exit", (code, signal) => {
    state.stopped = true;

    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
      console.error(`${name} stopped unexpectedly (${reason}).`);
      stopAll(code && code > 0 ? code : 1);
    }

    finishIfStopped();
  });
}

for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.once(signal, () => stopAll(exitCode));
}

start("Next.js", "pnpm", ["exec", "next", "start", "--keepAliveTimeout", "70000"]);

if (tunnelEnabled) {
  start("cloudflared", "cloudflared", ["tunnel", "--no-autoupdate", "run"]);
}
