import { expect, test } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";

// https://github.com/oven-sh/bun/issues/28295
// Bun.cron() should accept file:// URLs (e.g. from import.meta.resolve())
test("Bun.cron() accepts file:// URLs for path argument", async () => {
  const title = `bun-cron-file-url-test-${Math.random().toString(36).slice(2)}`;
  using dir = tempDir("bun-cron-file-url", {
    "entry.ts": `console.log("ok");`,
    "register.ts": `
      import { cron } from "bun";
      const title = process.argv[2];
      const resolved = import.meta.resolve("./entry.ts");
      // Verify it's actually a file:// URL
      if (!resolved.startsWith("file://")) {
        console.error("import.meta.resolve did not return a file:// URL");
        process.exit(2);
      }
      try {
        await cron(resolved, "0 0 * * *", title);
        console.log("registered");
      } finally {
        // Best-effort cleanup of registered cron job
        try { await cron.remove(title); } catch {}
      }
    `,
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "register.ts", title],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stderr).not.toContain("Failed to resolve path");
  // Registration may fail in CI if no cron backend is available (no crontab,
  // launchctl, or schtasks), but path resolution must always succeed.
  if (exitCode !== 0) {
    expect(stderr).not.toContain("TypeError");
  }
});
