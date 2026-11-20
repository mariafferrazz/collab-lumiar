import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path, { delimiter } from "node:path";

export function resolveDockerExecutable() {
  const lookupCommand = process.platform === "win32" ? "where.exe" : "which";
  const lookup = spawnSync(lookupCommand, ["docker"], {
    encoding: "utf8",
    stdio: "pipe",
  });
  const discovered = lookup.stdout?.split(/\r?\n/u).find(Boolean);

  if (lookup.status === 0 && discovered) {
    return discovered.trim();
  }

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const perUserDocker = path.join(
      process.env.LOCALAPPDATA,
      "Programs",
      "DockerDesktop",
      "resources",
      "bin",
      "docker.exe",
    );

    if (existsSync(perUserDocker)) {
      return perUserDocker;
    }
  }

  return "docker";
}

export function withDockerBinaryPath(environment, dockerExecutable) {
  const existingPath = environment.PATH ?? environment.Path ?? "";

  return {
    ...environment,
    PATH: `${path.dirname(dockerExecutable)}${delimiter}${existingPath}`,
  };
}
