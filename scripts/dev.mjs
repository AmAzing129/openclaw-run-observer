import { spawn } from "node:child_process";
import process from "node:process";

const WATCH_ARGS = [
  "exec",
  "tsc",
  "-p",
  "tsconfig.build.json",
  "-w",
  "--preserveWatchOutput",
  "false",
  "--pretty",
  "false"
];

const RESTART_ARGS = ["exec", "openclaw", "gateway", "restart"];

let shuttingDown = false;
let restartProcess = null;
let restartQueued = false;

function printUsage() {
  process.stdout.write(
    [
      "Usage: pnpm run dev",
      "",
      "Runs TypeScript in watch mode and restarts the OpenClaw gateway after each successful build."
    ].join("\n") + "\n"
  );
}

function log(message) {
  process.stdout.write(`[dev] ${message}\n`);
}

function flushPrefixedChunk(prefix, chunk, state) {
  state.buffer += chunk;
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = parts.pop() ?? "";
  for (const part of parts) {
    process.stdout.write(`[${prefix}] ${part}\n`);
  }
}

function flushRemainder(prefix, state) {
  if (!state.buffer) {
    return;
  }
  process.stdout.write(`[${prefix}] ${state.buffer}\n`);
  state.buffer = "";
}

function scheduleRestart() {
  if (shuttingDown) {
    return;
  }
  if (restartProcess) {
    restartQueued = true;
    log("queued one more gateway restart after the current restart finishes.");
    return;
  }
  runRestart();
}

function runRestart() {
  log("build succeeded; restarting the OpenClaw gateway...");
  const stdoutState = { buffer: "" };
  const stderrState = { buffer: "" };
  const child = spawn("pnpm", RESTART_ARGS, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  restartProcess = child;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    flushPrefixedChunk("gateway", chunk, stdoutState);
  });
  child.stderr.on("data", (chunk) => {
    flushPrefixedChunk("gateway", chunk, stderrState);
  });

  child.on("close", (code, signal) => {
    flushRemainder("gateway", stdoutState);
    flushRemainder("gateway", stderrState);
    restartProcess = null;

    if (signal) {
      log(`gateway restart was interrupted by ${signal}.`);
    } else if (code === 0) {
      log("gateway restart finished.");
    } else {
      log("gateway restart failed; make sure the gateway service is installed and running.");
    }

    if (restartQueued && !shuttingDown) {
      restartQueued = false;
      runRestart();
    }
  });
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage();
  process.exit(0);
}

log("starting TypeScript watch mode...");
log("the gateway will restart after each successful build.");

const tscStdoutState = { buffer: "" };
const tscStderrState = { buffer: "" };
const watcher = spawn("pnpm", WATCH_ARGS, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"]
});

watcher.stdout.setEncoding("utf8");
watcher.stderr.setEncoding("utf8");

watcher.stdout.on("data", (chunk) => {
  tscStdoutState.buffer += chunk;
  const parts = tscStdoutState.buffer.split(/\r?\n/);
  tscStdoutState.buffer = parts.pop() ?? "";
  for (const part of parts) {
    process.stdout.write(`[tsc] ${part}\n`);
    const match = part.match(/Found (\d+) errors?\./);
    if (!match) {
      continue;
    }
    const errorCount = Number.parseInt(match[1], 10);
    if (errorCount === 0) {
      scheduleRestart();
    } else {
      log(`build failed with ${errorCount} error(s); skipping gateway restart.`);
    }
  }
});

watcher.stderr.on("data", (chunk) => {
  flushPrefixedChunk("tsc", chunk, tscStderrState);
});

watcher.on("close", (code, signal) => {
  flushRemainder("tsc", tscStdoutState);
  flushRemainder("tsc", tscStderrState);

  if (shuttingDown) {
    process.exitCode = 0;
    return;
  }

  if (signal) {
    log(`TypeScript watch exited due to ${signal}.`);
  } else {
    log(`TypeScript watch exited with code ${code ?? 0}.`);
  }
  process.exit(code ?? 1);
});

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log(`received ${signal}; shutting down dev watcher...`);
  watcher.kill("SIGINT");
  if (restartProcess) {
    restartProcess.kill("SIGINT");
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
