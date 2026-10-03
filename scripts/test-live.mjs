import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiPort = process.env.INTEGRATION_API_PORT || "4101";
const webPort = process.env.INTEGRATION_WEB_PORT || "3011";
const children = [];
const preserve = ["apps/web/next-env.d.ts", "apps/web/tsconfig.json"];
const snapshots = await Promise.all(
  preserve.map((p) => readFile(path.join(root, p))),
);
let created = false;
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`${command} exited with ${code}`)),
    );
  });
}
function server(command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (b) => {
      logs = (logs + b.toString()).slice(-12000);
    });
  children.push(child);
  return { child, logs: () => logs };
}
function free(port) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", () =>
      reject(
        Error(`Port ${port} is occupied. Choose another INTEGRATION_*_PORT.`),
      ),
    );
    s.listen(Number(port), "127.0.0.1", () => s.close(resolve));
  });
}
async function ready(url, process) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (process.child.exitCode !== null)
      throw Error(`Test server exited:\n${process.logs()}`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Error(`Test server did not become ready: ${url}\n${process.logs()}`);
}
async function stop(child) {
  if (child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null)
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
}
try {
  await Promise.all([free(apiPort), free(webPort)]);
  await run("pnpm", ["--filter", "@velora/api", "build"]);
  await run(process.execPath, [
    "--env-file=apps/api/.env",
    "apps/api/scripts/integration-fixture.cjs",
  ]);
  created = true;
  const api = server("pnpm", ["--filter", "@velora/api", "start:prod"], {
    PORT: apiPort,
  });
  await ready(
    `http://127.0.0.1:${apiPort}/api/v1/tenants/public/velora-integration-test`,
    api,
  );
  const web = server(
    "pnpm",
    ["--filter", "@velora/web", "dev", "--port", webPort],
    {
      API_UPSTREAM_URL: `http://127.0.0.1:${apiPort}`,
      NEXT_PUBLIC_SALON_SLUG: "velora-integration-test",
      NEXT_PUBLIC_DATA_MODE: "live",
      NEXT_DIST_DIR: ".next-e2e",
      WEB_ORIGIN: `http://localhost:${webPort}`,
    },
  );
  await ready(
    `http://localhost:${webPort}/api/v1/tenants/public/velora-integration-test`,
    web,
  );
  await run(
    "pnpm",
    [
      "--filter",
      "@velora/web",
      "exec",
      "playwright",
      "test",
      "--config",
      "playwright.live.config.ts",
      ...process.argv.slice(2),
    ],
    {
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: `http://localhost:${webPort}`,
      },
    },
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await Promise.all(children.map(stop));
  if (created)
    await run(process.execPath, [
      "--env-file=apps/api/.env",
      "apps/api/scripts/integration-fixture.cjs",
      "--cleanup",
    ]).catch(() => {
      console.error(
        "Fixture cleanup failed. Run the documented cleanup command.",
      );
      process.exitCode = 1;
    });
  await Promise.all(
    preserve.map((p, i) => writeFile(path.join(root, p), snapshots[i])),
  );
}
