export const DEFAULT_GROUPS = [
  "Core",
  "Frontend",
  "Data",
  "AI",
  "Background",
  "Database",
  "Other",
];

// Dashboard group: the service's configured group, or a fallback based only on its type.
export function inferGroup(service) {
  if (service.group && String(service.group).trim()) return service.group;

  const type = (service.type || "").toLowerCase();
  if (["redis", "neo4j", "database", "postgres", "postgresql", "mysql", "mongodb"].includes(type)) return "Database";
  if (type === "listener") return "Background";
  if (type === "npm") return "Frontend";
  if (type === "python") return "Data";
  if (type === "java") return "Core";
  return "Other";
}

// Services that must be running before this one starts, from its dependsOn in the configuration.
export function getStartupDependencies(service) {
  if (Array.isArray(service.dependsOn)) return service.dependsOn.filter(Boolean);
  if (typeof service.dependsOn === "string") {
    return service.dependsOn.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeService(service) {
  return {
    ...service,
    dependsOn: getStartupDependencies(service),
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

// Built-in presets are layers of the dependency map, each adding to the previous one. They are computed from
// the current services, so they stay correct when services are added or changed.
const INFRASTRUCTURE_TYPES = ["redis", "neo4j", "database", "docker", "postgres", "postgresql", "mysql", "mongodb", "kafka"];
const isClone = (name) => /-clone(-\d+)?$/.test(name);
const isInfrastructure = (service) => INFRASTRUCTURE_TYPES.includes(String(service.type || "").toLowerCase());
const isFrontend = (service) => String(service.type || "").toLowerCase() === "npm";

const BUILT_IN_PRESETS = {
  // Databases and containers everything else builds on.
  "Infrastructure only": (services) => services.filter(isInfrastructure),
  // Plus every service that other services need running before they can start (e.g. config-service).
  "Infrastructure + shared services": (services) => {
    const neededByOthers = new Set(services.flatMap((service) => getStartupDependencies(service)));
    return services.filter((service) => isInfrastructure(service) || (neededByOthers.has(service.name) && !isFrontend(service)));
  },
  // Everything except the web frontends.
  "All backend services": (services) => services.filter((service) => !isFrontend(service)),
  // Everything.
  "Full stack": (services) => services,
};
export const DEFAULT_PRESET_NAMES = Object.keys(BUILT_IN_PRESETS);

// Presets from config.presets ({ name: [serviceNames] }), or the built-in presets when none are configured.
// services: array of { name, ... } (normalized or raw).
export function getEffectivePresets(services, configuredPresets) {
  if (configuredPresets && typeof configuredPresets === "object" && Object.keys(configuredPresets).length) {
    return Object.fromEntries(
      Object.entries(configuredPresets).map(([name, list]) => [name, Array.isArray(list) ? list : []])
    );
  }
  return Object.fromEntries(DEFAULT_PRESET_NAMES.map((name) => [name, getPresetServices(services, name)]));
}

// Built-in presets (used when config.presets is not set). Cloned services are left out.
export function getPresetServices(services, presetName) {
  const build = BUILT_IN_PRESETS[presetName];
  if (!build) return [];
  return build(services.filter((service) => !isClone(service.name))).map((service) => service.name);
}

export function categorizeFailure(error) {
  const code = error?.code || "";
  const phase = error?.phase || "";
  const message = error?.message || error?.error || "";

  if (code === "dependency_not_running") return "Dependency not running";
  if (code === "dependency_not_ready") return "Dependency not ready";
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

// Maps a card failure (reason from categorizeFailure + error text) to a Help troubleshooting topic id.
export function getHelpTopicForFailure(reason = "", errorText = "") {
  const text = `${reason} ${errorText}`;
  if (/^start .+ first$/i.test(String(errorText).trim()) || /depends on .+ not running/i.test(text)) return "dependencies";
  if (/git pull/i.test(text)) return "git-pull";
  if (/timed out|timeout/i.test(text)) return "timeout";
  if (/port|EADDRINUSE/i.test(text)) return "port";
  if (/health/i.test(text)) return "health";
  return "wont-start";
}

export function getServiceLinks(service) {
  if (!service || !service.port) return [];

  const port = service.port;
  const baseUrl = `http://localhost:${port}`;
  const links = [];

  // Determine non-HTTP services
  const isNonHttp = ["redis", "listener", "neo4j"].includes(service.type);
  if (isNonHttp) {
    return [
      {
        id: "connection",
        label: `${{ redis: "Redis", neo4j: "Neo4j", listener: "Listener" }[service.type] || "Service"} connection`,
        url: service.type === "neo4j" ? `bolt://localhost:${port}` : `localhost:${port}`,
        path: `:${port}`,
        isCopyOnly: true,
      },
    ];
  }

  // 1. Web UI / Root Link
  const isFrontend =
    service.type === "npm" ||
    (service.name || "").includes("frontend") ||
    (service.name || "").includes("ui");

  links.push({
    id: "root",
    label: isFrontend ? "Web Application" : "Root / Base API",
    url: `${baseUrl}/`,
    path: "/",
    isRoot: true,
    isExternal: true,
  });

  // 2. API Documentation (Swagger / OpenAPI / ReDoc)
  if (service.docsPath) {
    const cleanDocs = service.docsPath.startsWith("/") ? service.docsPath : `/${service.docsPath}`;
    const label =
      cleanDocs.toLowerCase().includes("swagger") || service.type === "java"
        ? "Swagger UI"
        : service.type === "python"
        ? "FastAPI Docs"
        : "API Documentation";
    links.push({
      id: "docs",
      label,
      url: `${baseUrl}${cleanDocs}`,
      path: cleanDocs,
      isDocs: true,
      isExternal: true,
    });
    if (service.type === "java" && cleanDocs !== "/v3/api-docs") {
      links.push({
        id: "openapi-spec",
        label: "OpenAPI Spec (JSON)",
        url: `${baseUrl}/v3/api-docs`,
        path: "/v3/api-docs",
        isSpec: true,
        isExternal: true,
      });
    }
  } else if (service.type === "java") {
    links.push({
      id: "docs",
      label: "Swagger UI",
      url: `${baseUrl}/swagger-ui/index.html`,
      path: "/swagger-ui/index.html",
      isDocs: true,
      isExternal: true,
    });
    links.push({
      id: "openapi-spec",
      label: "OpenAPI Spec (JSON)",
      url: `${baseUrl}/v3/api-docs`,
      path: "/v3/api-docs",
      isSpec: true,
      isExternal: true,
    });
  } else if (service.type === "python") {
    links.push({
      id: "docs",
      label: "FastAPI Swagger Docs",
      url: `${baseUrl}/docs`,
      path: "/docs",
      isDocs: true,
      isExternal: true,
    });
    links.push({
      id: "redoc",
      label: "ReDoc",
      url: `${baseUrl}/redoc`,
      path: "/redoc",
      isSpec: true,
      isExternal: true,
    });
  } else if (!isFrontend) {
    links.push({
      id: "docs",
      label: "API Documentation",
      url: `${baseUrl}/swagger-ui/index.html`,
      path: "/swagger-ui/index.html",
      isDocs: true,
      isExternal: true,
    });
  }

  // 3. Health Endpoint
  let healthPath = service.healthPath;
  if (!healthPath && service.healthCommand) {
    const match = service.healthCommand.match(/https?:\/\/[^/\s]+(\/[^\s"']+)/);
    if (match) {
      healthPath = match[1];
    }
  }

  if (!healthPath) {
    if (service.type === "java") {
      healthPath = "/actuator/health";
    } else {
      healthPath = "/health";
    }
  }

  const cleanHealthPath = healthPath.startsWith("/") ? healthPath : `/${healthPath}`;
  links.push({
    id: "health",
    label: "Health Endpoint",
    url: `${baseUrl}${cleanHealthPath}`,
    path: cleanHealthPath,
    isHealth: true,
    isExternal: true,
  });

  return links;
}

export function getDocsLabel(service) {
  if (!service) return "Docs";
  const docsPath = (service.docsPath || "").toLowerCase();
  if (docsPath.includes("swagger")) return "Swagger";
  if (service.type === "java") return "Swagger";
  return "Docs";
}

export function isFrontendService(service) {
  if (!service) return false;
  const name = (service.name || "").toLowerCase();
  const type = (service.type || "").toLowerCase();
  return type === "npm" || name.includes("frontend") || name.includes("ui");
}

