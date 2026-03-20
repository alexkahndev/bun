import { test, expect } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";

// https://github.com/oven-sh/bun/issues/28295
// Bun.cron() should accept file:// URLs (e.g. from import.meta.resolve())
test("Bun.cron() accepts file:// URLs for path argument", async () => {
  using dir = tempDir("bun-cron-file-url", {
    "entry.ts": `console.log("ok");`,
    "register.ts": `
      import { cron } from "bun";
      try {
        const resolved = import.meta.resolve("./entry.ts");
        // Verify it's actually a file:// URL
        if (!resolved.startsWith("file://")) {
          process.exit(2);
        }
        await cron(resolved, "0 0 * * *", "bun-cron-file-url-test");
        console.log("registered");
      } catch (e) {
        console.error(e.message);
        process.exit(1);
      }
    `,
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "register.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  // The path resolution should succeed. The cron registration itself may fail
  // (no crontab/launchctl available in CI), but the error should NOT be
  // "Failed to resolve path".
  if (exitCode !== 0) {
    expect(stderr).not.toContain("Failed to resolve path");
  }
});
