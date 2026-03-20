import { describe, expect, test } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";

// Test that `bun create` respects custom registry configuration
// Issue: https://github.com/oven-sh/bun/issues/617

// Stub server that returns 500 for all requests, proving bun create contacted it.
function stubRegistry(): { server: ReturnType<typeof Bun.serve>; url: string } {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response("stub registry", { status: 500 }),
  });
  return { server, url: `http://127.0.0.1:${server.port}` };
}

describe("bun create respects custom registry", () => {
  test(
    "BUN_CONFIG_REGISTRY environment variable",
    async () => {
      await using server = stubRegistry().server;
      const customRegistry = `http://127.0.0.1:${server.port}`;

      using dir = tempDir("bun-create-registry-env", {});

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          BUN_CONFIG_REGISTRY: customRegistry,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      // Should fail because stub registry returns 500.
      // If bun ignored the env var and used npmjs.org, it would succeed.
      const output = (stdout + stderr).toLowerCase();
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "NPM_CONFIG_REGISTRY environment variable",
    async () => {
      await using server = stubRegistry().server;
      const customRegistry = `http://127.0.0.1:${server.port}`;

      using dir = tempDir("bun-create-npm-registry-env", {});

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          NPM_CONFIG_REGISTRY: customRegistry,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      const output = (stdout + stderr).toLowerCase();
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "npm_config_registry environment variable (lowercase)",
    async () => {
      await using server = stubRegistry().server;
      const customRegistry = `http://127.0.0.1:${server.port}`;

      using dir = tempDir("bun-create-npm-config-registry-lc", {});

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          npm_config_registry: customRegistry,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      const output = (stdout + stderr).toLowerCase();
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "bunfig.toml registry configuration",
    async () => {
      await using server = stubRegistry().server;
      const customRegistry = `http://127.0.0.1:${server.port}/`;

      using dir = tempDir("bun-create-bunfig-registry", {
        "bunfig.toml": ["[install]", `registry = "${customRegistry}"`, ""].join("\n"),
      });

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app"],
        cwd: String(dir),
        env: bunEnv,
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      const output = (stdout + stderr).toLowerCase();
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "bunfig.toml $ENV_VAR registry expansion",
    async () => {
      await using server = stubRegistry().server;
      const customRegistry = `http://127.0.0.1:${server.port}`;

      using dir = tempDir("bun-create-bunfig-env-expansion", {
        "bunfig.toml": ["[install]", `registry = "$TEST_CUSTOM_REGISTRY"`, ""].join("\n"),
      });

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          TEST_CUSTOM_REGISTRY: customRegistry,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      // Should fail because the $ENV_VAR-expanded registry returns 500
      const output = (stdout + stderr).toLowerCase();
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "BUN_CONFIG_REGISTRY overrides bunfig.toml registry",
    async () => {
      // env var points to stub registry (500); bunfig points to default registry.
      // If priority is correct (env > bunfig), the command should fail.
      await using server = stubRegistry().server;
      const envRegistry = `http://127.0.0.1:${server.port}`;

      using dir = tempDir("bun-create-env-overrides-bunfig", {
        "bunfig.toml": ["[install]", `registry = "https://registry.npmjs.org/"`, ""].join("\n"),
      });

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          BUN_CONFIG_REGISTRY: envRegistry,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      // Should fail because env var registry (stub 500) takes priority over bunfig (npmjs.org)
      const output = (stdout + stderr).toLowerCase();
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "default registry works when no custom registry is set",
    async () => {
      using dir = tempDir("bun-create-default-registry", {});

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app"],
        cwd: String(dir),
        env: bunEnv,
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      // The command should succeed with the default registry
      const output = (stdout + stderr).toLowerCase();
      expect(output).not.toContain("error");
      expect(exitCode).toBe(0);
    },
    { timeout: 60_000 },
  );
});
