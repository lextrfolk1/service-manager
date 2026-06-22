function parseDependsOn(service) {
  if (Array.isArray(service.dependsOn)) return service.dependsOn.filter(Boolean);
  if (typeof service.dependsOn === "string") {
    return service.dependsOn
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function validateConfiguration(config) {
  const issues = [];
  const services = config?.services || {};
  const serviceEntries = Object.entries(services);
  const nameSet = new Set(serviceEntries.map(([name]) => name));
  const ports = new Map();

  serviceEntries.forEach(([name, service]) => {
    if (!service.command) {
      issues.push({ severity: "error", scope: name, fieldName: "command", message: "Start command is required" });
    }

    if (!service.path && !["redis", "neo4j"].includes((service.type || "").toLowerCase())) {
      issues.push({ severity: "warning", scope: name, fieldName: "path", message: "Path is empty or missing" });
    }

    if (service.port) {
      if (ports.has(service.port)) {
        issues.push({
          severity: "error",
          scope: name,
          fieldName: "port",
          message: `Port ${service.port} is already used by ${ports.get(service.port)}`
        });
      } else {
        ports.set(service.port, name);
      }
    }

    parseDependsOn(service).forEach((dependency) => {
      if (!nameSet.has(dependency)) {
        issues.push({
          severity: "error",
          scope: name,
          fieldName: "dependsOn",
          message: `Depends on unknown service "${dependency}"`
        });
      }
    });
  });

  const visiting = new Set();
  const visited = new Set();

  function visit(name, trail = []) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      issues.push({
        severity: "error",
        scope: name,
        fieldName: "dependsOn",
        message: `Dependency cycle detected: ${[...trail, name].join(" → ")}`
      });
      return;
    }

    visiting.add(name);
    parseDependsOn(services[name] || {}).forEach((dependency) => visit(dependency, [...trail, name]));
    visiting.delete(name);
    visited.add(name);
  }

  serviceEntries.forEach(([name]) => visit(name));

  return {
    issues,
    hasErrors: issues.some((issue) => issue.severity === "error"),
  };
}
