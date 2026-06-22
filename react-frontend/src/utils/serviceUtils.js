export const DEFAULT_GROUPS = [
  "Core",
  "Frontend",
  "Data",
  "AI",
  "Background",
  "Database",
  "Other",
];

export function inferGroup(service) {
  if (service.group) return service.group;

  const name = (service.name || "").toLowerCase();
  const type = (service.type || "").toLowerCase();

  if (type === "redis" || type === "neo4j") return "Database";
  if (type === "listener") return "Background";
  if (name.includes("front")) return "Frontend";
  if (name.includes("ai") || name.includes("semantic") || name.includes("lexie")) return "AI";
  if (name.includes("data") || name.includes("analytics")) return "Data";
  if (
    name.includes("config") ||
    name.includes("gateway") ||
    name.includes("auth") ||
    name.includes("workflow") ||
    name.includes("rules") ||
    name.includes("generic") ||
    name.includes("workbench")
  ) {
    return "Core";
  }

  if (type === "npm") return "Frontend";
  if (type === "python") return "Data";
  if (type === "java") return "Core";

  return "Other";
}

export function normalizeService(service) {
  return {
    ...service,
    dependsOn: Array.isArray(service.dependsOn) ? service.dependsOn : [],
    group: inferGroup(service),
  };
}

export function buildDependencyMap(services) {
  return services.reduce((accumulator, service) => {
    accumulator[service.name] = service.dependsOn || [];
    return accumulator;
  }, {});
}

export function buildReverseDependencyMap(services) {
  const reverse = services.reduce((accumulator, service) => {
    accumulator[service.name] = [];
    return accumulator;
  }, {});

  services.forEach((service) => {
    (service.dependsOn || []).forEach((dependency) => {
      if (!reverse[dependency]) reverse[dependency] = [];
      reverse[dependency].push(service.name);
    });
  });

  return reverse;
}

export function topoSortServices(services) {
  const serviceMap = new Map(services.map((service) => [service.name, service]));
  const visited = new Set();
  const visiting = new Set();
  const order = [];

  function visit(name) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Dependency cycle detected at ${name}`);
    }

    visiting.add(name);
    const service = serviceMap.get(name);
    if (service) {
      (service.dependsOn || []).forEach((dependency) => visit(dependency));
      order.push(service);
    }
    visiting.delete(name);
    visited.add(name);
  }

  services.forEach((service) => visit(service.name));
  return order.filter(Boolean);
}

export function getPresetServices(services, presetName) {
  const normalized = services.map(normalizeService);
  const byGroup = (groupName) => normalized.filter((service) => service.group === groupName).map((service) => service.name);

  const presets = {
    Minimal: [
      ...byGroup("Database"),
      ...normalized
        .filter((service) => ["config-service", "gateway-service", "frontend-service"].includes(service.name))
        .map((service) => service.name),
    ],
    Core: [
      ...byGroup("Database"),
      ...byGroup("Core"),
      ...normalized.filter((service) => service.group === "Frontend").slice(0, 1).map((service) => service.name),
    ],
    "Backend Only": normalized
      .filter((service) => service.group !== "Frontend")
      .map((service) => service.name),
    "Full Stack": normalized.map((service) => service.name),
  };

  return [...new Set(presets[presetName] || [])];
}

export function categorizeFailure(error) {
  const code = error?.code || "";
  const phase = error?.phase || "";
  const message = error?.message || error?.error || "";

  if (code === "build_failed" || phase === "build") return "Build failed";
  if (code === "git_pull_failed") return "Git pull failed";
  if (code === "startup_timeout") return "Startup timed out";
  if (code === "command_failed") return "Command failed";
  if (code === "stop_command_failed") return "Stop failed";
  if (code === "invalid_config") return "Invalid configuration";
  if (phase === "health_check") return "Health check failed";
  if (/dependency/i.test(message)) return "Dependency blocked";
  if (/port/i.test(message)) return "Port issue";
  return "Operation failed";
}
