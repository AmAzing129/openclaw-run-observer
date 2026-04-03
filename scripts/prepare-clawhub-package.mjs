import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const REQUIRED_ROOT_FILES = ["package.json", "openclaw.plugin.json", "README.md", "LICENSE"];

function printUsage() {
  process.stdout.write(
    [
      "Usage: node ./scripts/prepare-clawhub-package.mjs <output-dir>",
      "",
      "Copies the built runtime files and required metadata into a clean folder for ClawHub publishing."
    ].join("\n") + "\n"
  );
}

async function readPackageJson(rootDir) {
  const raw = await readFile(join(rootDir, "package.json"), "utf8");
  return JSON.parse(raw);
}

async function ensurePathExists(absPath, relPath) {
  try {
    await stat(absPath);
  } catch {
    throw new Error(`Required publish path is missing: ${relPath}`);
  }
}

async function copyIntoStage(rootDir, outDir, relPath) {
  const absSource = resolve(rootDir, relPath);
  const absTarget = resolve(outDir, relPath);
  await ensurePathExists(absSource, relPath);
  await mkdir(dirname(absTarget), { recursive: true });
  await cp(absSource, absTarget, { force: true, recursive: true });
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const outputDir = args[0];
  if (!outputDir) {
    printUsage();
    throw new Error("Missing output directory.");
  }

  const rootDir = process.cwd();
  const outDir = resolve(outputDir);
  const packageJson = await readPackageJson(rootDir);
  const files = Array.isArray(packageJson.files) ? packageJson.files : [];
  const relPaths = [...new Set([...REQUIRED_ROOT_FILES, ...files])];

  await rm(outDir, { force: true, recursive: true });
  await mkdir(outDir, { recursive: true });

  for (const relPath of relPaths) {
    await copyIntoStage(rootDir, outDir, relPath);
  }

  process.stdout.write(`Prepared ClawHub package in ${outDir}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
