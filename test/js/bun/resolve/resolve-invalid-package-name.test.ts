import { describe, expect, test } from "bun:test";
import { bunEnv, bunExe } from "harness";

describe.each([
  '<a name="undefined">38391</a>',
  "<script>alert(1)</script>",
  "foo bar",
  "pkg'name",
  'pkg"name',
  "pkg!name",
  "pkg#name",
  "pkg$name",
  "pkg&name",
  "pkg(name)",
  "pkg{name}",
  "pkg[name]",
  "pkg|name",
  "pkg`name",
])("require(%json)", name => {
  test.concurrent("does not crash", async () => {
    await using proc = Bun.spawn({
      cmd: [bunExe(), "--no-install", "-e", `try { require(${JSON.stringify(name)}); } catch (e) {}`],
      env: bunEnv,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
  });
});
