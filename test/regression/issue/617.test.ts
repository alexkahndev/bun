import { describe, expect, test } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";

// Test that `bun create` respects custom registry configuration
// Issue: https://github.com/oven-sh/bun/issues/617

// Stub server that returns 500 for all requests, tracking hits to prove
// bun create actually contacted it.
function stubRegistry() {
  const hits = { count: 0 };
  const server = Bun.serve({
    port: 0,
    fetch: () => {
      hits.count++;
      return new Response("stub registry", { status: 500 });
    },
  });
  return { server, url: `http://127.0.0.1:${server.port}`, hits };
}

describe("bun create respects custom registry", () => {
  test(
    "BUN_CONFIG_REGISTRY environment variable",
    async () => {
      const stub = stubRegistry();
      await using server = stub.server;

      using dir = tempDir("bun-create-registry-env", {});

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app", "--no-install", "--no-git"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          BUN_CONFIG_REGISTRY: stub.url,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      // Stub must have been contacted — proves registry was used.
      const output = (stdout + stderr).toLowerCase();
      expect(stub.hits.count).toBeGreaterThan(0);
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "NPM_CONFIG_REGISTRY environment variable",
    async () => {
      const stub = stubRegistry();
      await using server = stub.server;

      using dir = tempDir("bun-create-npm-registry-env", {});

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app", "--no-install", "--no-git"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          NPM_CONFIG_REGISTRY: stub.url,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      const output = (stdout + stderr).toLowerCase();
      expect(stub.hits.count).toBeGreaterThan(0);
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "npm_config_registry environment variable (lowercase)",
    async () => {
      const stub = stubRegistry();
      await using server = stub.server;

      using dir = tempDir("bun-create-npm-config-registry-lc", {});

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app", "--no-install", "--no-git"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          npm_config_registry: stub.url,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      const output = (stdout + stderr).toLowerCase();
      expect(stub.hits.count).toBeGreaterThan(0);
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "bunfig.toml registry configuration",
    async () => {
      const stub = stubRegistry();
      await using server = stub.server;

      using dir = tempDir("bun-create-bunfig-registry", {
        "bunfig.toml": ["[install]", `registry = "${stub.url}/"`, ""].join("\n"),
      });

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app", "--no-install", "--no-git"],
        cwd: String(dir),
        env: bunEnv,
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      const output = (stdout + stderr).toLowerCase();
      expect(stub.hits.count).toBeGreaterThan(0);
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );

  test(
    "bunfig.toml $ENV_VAR registry expansion",
    async () => {
      const stub = stubRegistry();
      await using server = stub.server;

      using dir = tempDir("bun-create-bunfig-env-expansion", {
        "bunfig.toml": ["[install]", `registry = "$TEST_CUSTOM_REGISTRY"`, ""].join("\n"),
      });

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app", "--no-install", "--no-git"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          TEST_CUSTOM_REGISTRY: stub.url,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      // Should fail because the $ENV_VAR-expanded registry returns 500
      const output = (stdout + stderr).toLowerCase();
      expect(stub.hits.count).toBeGreaterThan(0);
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
      const stub = stubRegistry();
      await using server = stub.server;

      using dir = tempDir("bun-create-env-overrides-bunfig", {
        "bunfig.toml": ["[install]", `registry = "https://registry.npmjs.org/"`, ""].join("\n"),
      });

      await using proc = Bun.spawn({
        cmd: [bunExe(), "create", "elysia", "my-app", "--no-install", "--no-git"],
        cwd: String(dir),
        env: {
          ...bunEnv,
          BUN_CONFIG_REGISTRY: stub.url,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

      // Should fail because env var registry (stub 500) takes priority over bunfig (npmjs.org)
      const output = (stdout + stderr).toLowerCase();
      expect(stub.hits.count).toBeGreaterThan(0);
      expect(output).toContain("error");
      expect(exitCode).not.toBe(0);
    },
    { timeout: 30_000 },
  );
});
