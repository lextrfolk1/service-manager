import { cloneElement, useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  InputAdornment,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  AccountTree as GitIcon,
  Article as LogsIcon,
  BugReport as TroubleshootIcon,
  Checklist as FeaturesIcon,
  Dashboard as DashboardIcon,
  CloudUpload as CloudUploadIcon,
  DesktopWindows as WindowsIcon,
  ErrorOutline as ErrorIcon,
  Lan as PortIcon,
  MonitorHeart as HealthIcon,
  Save as SaveIcon,
  Timer as TimerIcon,
  Link as LinkIcon,
  PlayArrow as StartIcon,
  Search as SearchIcon,
  Settings as AdminIcon,
  Terminal as TerminalIcon,
  TipsAndUpdates as TipIcon,
  Tune as ConfigIcon,
} from "@mui/icons-material";
import { CODE_FONT, SEARCH_INPUT_SX, TOP_BAR_HEIGHT } from "../theme/tokens";

// Feature catalog: [title, what it does, where to find it].
const FEATURE_GROUPS = [
  {
    title: "Service Control",
    icon: <StartIcon />,
    items: [
      ["Start, stop, restart", "Control a single service. The card shows live progress (queued, starting, stopping) and the result.", "▶ ■ ⟳ buttons at the bottom of each card"],
      ["Bulk actions", "Start or stop every service at once, or tick several cards and act only on those. The checkbox beside the search box ticks everything matching the current search and filters; a selection bar then shows Start / Stop / Restart selected. Start all and Stop all ask to confirm when they affect more than one service.", "Dashboard toolbar: Start all, Stop all, and the checkbox beside the search box"],
      ["Dependency-aware start", "A service won't start while one of its dependencies is stopped — you'll see \"Start <service> first\". If a dependency is still starting, it waits (up to 120s) until it is ready: port open, health command passing and health endpoint OK (whichever are configured). A dependency with no port and no health check never blocks. Start all and presets start dependencies first; each service starts the moment its own dependencies are ready, so a full start takes as little time as possible. If a dependency fails, only the services that need it are marked \"Blocked by dependency failure\". Dependencies are set per service in Depends on.", "Admin › Services › Dependencies"],
      ["Presets", "Start a saved set of services in one click. Built-in presets are layers of the dependency map: Infrastructure only, Infrastructure + shared services, All backend services, and Full stack. Create your own by ticking cards and choosing \"Save as preset\", or edit, rename and delete presets in Admin › Presets.", "Dashboard toolbar: Preset + Run preset"],
      ["Build mode", "When on, each start runs the service's build command first (e.g. mvn clean install). If the build fails the service is not started.", "Dashboard toolbar: View › Build before start"],
      ["Automatic port cleanup", "Before starting a service, Struo stops whatever is still holding its port, so stale processes don't block startup. Stop also clears the port.", "Automatic — needs a port in the service config"],
      ["Startup readiness", "After starting, Struo waits up to 60 seconds for the port to open and runs the health command if one is configured, then marks the service Running or Healthy.", "Automatic — configure port / healthCommand"],
    ],
  },
  {
    title: "Dashboard & Monitoring",
    icon: <DashboardIcon />,
    items: [
      ["Automatic refresh", "Statuses update every 5 seconds and the service list every 30 seconds — no manual refresh needed. Only cards whose data changed are redrawn.", "Always on"],
      ["Status at a glance", "Each card shows Running, Stopped, Waiting or Failed, plus health. The card border turns green when running and red on failure.", "Status chip on each card"],
      ["Search & filters", "Find services by name, or filter by type, group or status — including \"Needs attention\" for failed or unhealthy services.", "Dashboard toolbar: search box and Filters"],
      ["Grouped view", "Show services under their group headings, collapse groups you don't need, and drag a card onto another group to move it (you confirm before the config is changed).", "Dashboard toolbar: View › Group services"],
      ["Live resources", "Show CPU, memory and uptime for each running service, updated every few seconds.", "Dashboard toolbar: View › Live resources"],
      ["Card styles", "Pick how services look: Classic (the default — uppercase name, tags and icon actions), Detailed (full card with live resources and more detail), Accent strip (Detailed with a status-coloured top edge) or Elevated (Detailed as a floating card with a status-ringed avatar). Admin sets the default for everyone; anyone can override it for themselves. Every style has the same actions.", "Admin › Appearance (default) · Dashboard › View › Card style (just you)"],
      ["Themes", "Pick a theme in Dashboard › View or Admin › Appearance: Light, Dark, Graphite (neutral charcoal dark), Warm (paper-like, softer contrast) or Follow system (light or dark like your computer), plus an accent colour for buttons, tabs and highlights. It is your personal choice, remembered in this browser; the log viewer stays dark in every theme.", "Admin › Appearance › Theme"],
      ["Looks", "One click sets a theme and a card style that go well together: Legacy (Light + Classic, the default), Everyday (Light + Detailed), Modern (Light + Elevated), Studio (Graphite + Accent strip), Night (Dark + Detailed) and Long session (Warm + Classic). You can still change theme and card style separately.", "Dashboard › View › Look"],
      ["Clear failure reasons", "Failures are labelled (Build failed, Git pull failed, Startup timed out, Port issue, …) with the error text, a Logs button and a Help button that opens the matching troubleshooting guide.", "Red box at the bottom of a failed card"],
    ],
  },
  {
    title: "Quick Links on Cards",
    icon: <LinkIcon />,
    items: [
      ["Logs", "Open the service's live log in the Logs tab without searching for it.", "Logs chip on each card"],
      ["API docs", "Open Swagger or the service's docs page in a new browser tab.", "Swagger / Docs chip (services with a port)"],
      ["Web UI", "Open a frontend app in the browser.", "Web UI chip (npm / frontend services)"],
      ["Port menu", "All links for the service in one place: app root, API docs and health endpoint.", "Click the :port chip"],
      ["Card menu", "View logs, Git pull, Configure in Admin (opens the service editor) and Clone in Admin (copies it with a free port).", "⋮ button on each card"],
    ],
  },
  {
    title: "Git Integration",
    icon: <GitIcon />,
    items: [
      ["Branch on every card", "See which branch each service is running from.", "Branch row on each card (toggle with Git branches)"],
      ["Switch branches", "Search local and remote branches and check one out. Tick \"restart\" to restart a running service on the new branch.", "Click the branch name"],
      ["Change indicators", "↓ commits behind the remote, ↑ commits ahead, and * uncommitted changes, so you know when to pull or push.", "Next to the branch name"],
      ["Git pull", "Pull the latest commits for the current branch, optionally restarting the service. The button turns blue when there are new commits.", "Download button next to the branch"],
      ["Auto pull on start", "Each start pulls first so you run the latest code. Branches that only exist locally are skipped, and the skip is noted in the log.", "Automatic — turn off with gitAutoPull: false"],
      ["Publish local branches", "Branches not on the remote show a crossed-out cloud icon; Pull is disabled and the highlighted Push button (git push -u) publishes them.", "Push button next to the branch"],
    ],
  },
  {
    title: "Logs",
    icon: <LogsIcon />,
    items: [
      ["Live streaming", "The current log streams live while the service writes to it. The indicator shows Live, Idle or Stream error.", "Logs tab"],
      ["Several services at once", "Open services as tabs and switch between them. The left list shows which services are running (green dot) and lets you pin favourites to the top.", "Logs tab: service list and tabs"],
      ["One log per run", "Every start or restart writes a separate log, so runs never mix. The run picker lists runs by day with start time, how long each ran and its size; the viewer jumps to the current run automatically. How long earlier runs are kept is set in Admin › Logs.", "Run picker in the log toolbar"],
      ["Log retention", "Choose whether earlier runs are archived or deleted when a service restarts, how many days archived runs are kept, and how many per service (defaults: archive, 3 days, 20 runs). See how much space they use and delete them all in one click.", "Admin › Logs"],
      ["Combined logs", "Turn on Combined log view in Admin › Logs (off by default), then use the merge button above the service list. The current runs of several services stream into one view, ordered by the time in each line and tagged with a colored service name. Filter all of them at once, for example by a trace ID: double-click an ID in a line to filter by it. Click a service name to show only that service; Errors & warnings, Pause and Copy work as in the single view.", "Logs tab: merge button next to the service search"],
      ["Search in log", "Search the whole file and step through matches with Previous / Next (or n / Shift+N); the matching line is highlighted. Aa matches case, .* uses a regular expression. Matches outside the loaded part are loaded when you go to them.", "Search box in the log toolbar"],
      ["Filter by level", "Color chips count Error, Warning, Info and Debug entries; when only part of a large log is loaded they show loaded / whole file (e.g. 120 / 3,034). Click a chip to hide or show that level. Stack trace lines stay with the entry they belong to. \"Only matching lines\" hides everything that doesn't match the search. Filters apply to the open service only and reset when Struo reloads.", "Filter bar under the log toolbar"],
      ["Errors, stack traces and colors", "Jump between errors with the arrows (or e / Shift+E) — across the whole file, loading earlier parts as needed. Long stack traces are folded to their first frame; click \"more stack lines\" to open one. ANSI colors from the service are shown as colors.", "Filter bar and log lines"],
      ["Select and copy", "Click a line number to select it, Shift+click another to select a range, then Copy (or Ctrl/⌘ C). The copy menu also copies the lines shown (after filters) or all loaded lines, and downloads the full file.", "Line numbers and the copy menu"],
      ["Go to line", "Type a line number and press Enter (Ctrl/⌘ G focuses the box). Earlier parts of a large log are loaded on demand; Back to latest returns to live output.", "Go to line box in the filter bar"],
      ["Large logs", "Only the lines on screen are drawn, so long logs scroll smoothly. Very large files open at their newest part; search, Go to line and download still cover the whole file.", "Log viewer"],
      ["Viewer tools", "Pause live output (p) to read without it moving, then resume to catch up. Follow new lines, wrap long lines, change text size, toggle level colors and stack folding, clear or reload the file, and Focus mode. Press ? for all keyboard shortcuts.", "Icons in the log toolbar and View options"],
      ["Git & build output", "Output from git pull and the build step is written into the service log, marked [GIT PULL], [BUILD] or [GIT PULL SKIPPED].", "In the service's log"],
    ],
  },
  {
    title: "Configuration (Admin)",
    icon: <AdminIcon />,
    items: [
      ["Base paths", `Shared root folders (e.g. java → ~/codebase/lextr/java). Services reference them as \${basePaths.key}; click a token to copy it and see how many services use it.`, "Admin › Paths"],
      ["Folder picker", "Pick folders with your system's folder dialog instead of typing paths.", "Folder icon next to any path field"],
      ["Service editor", "Edit type, port, group, description, start / build / stop / health commands and docs / health endpoints. Each field is explained in Help › Configuration.", "Admin › Services"],
      ["Path modes", "Use a direct folder, or a base path plus sub-folder. The editor shows the final folder it resolves to.", "Admin › Services › Location"],
      ["Dependencies", "Choose the services that must start first from a searchable list.", "Admin › Services › Dependencies"],
      ["Run configuration", "Add JVM options (Java), arguments and environment variables such as API keys for this machine only. Fields adapt to the service type. Values are kept out of the shared config, never committed, and applied without editing the start command.", "Dashboard: ⋮ › Run configuration… or the teal Run config chip; also Admin › Services"],
      ["Import / Export", "Export downloads or copies the sections you choose; paths and run configuration are off by default, and secret values are written as <hidden> unless you include them. Import loads an exported file or a services.json: pick sections and Merge (add and update) or Replace, check the preview of changes and any new problems, then Apply to editor. Paths from another operating system start unticked. Nothing is written until you Save.", "Admin › Import / Export"],
      ["JSON editor", "Edit services.json or this machine's run-config.json as text, each in its own tab. It is read-only until you choose Unlock to edit; syntax errors show their line and column, and secret values stay <hidden> unless you replace them. Apply to editor loads it into the forms.", "Admin › Import / Export"],
      ["Clone, rename, delete", "Clone copies every setting and picks the next free port. Rename updates every service that depends on it. Delete shows what would break. None of them touch the config file until you Save.", "Service list hover icons and editor header"],
      ["Validation", "Missing start command, duplicate ports, unknown dependencies and dependency cycles are listed in a red banner; click one to jump to it. Save stays blocked until they are fixed.", "Banner under the Admin header"],
      ["Save with confirmation", "Nothing is written to the config file until you click Save and confirm. The confirmation lists every added, removed and changed path and service. An \"Unsaved changes\" chip shows when there is something to save; Reload discards it.", "Admin header"],
    ],
  },
  {
    title: "Platform & Setup",
    icon: <TerminalIcon />,
    items: [
      ["Cross-platform", "Runs on macOS, Linux and Windows.", "—"],
      ["Per-platform config", "Windows reads backend/config/services.windows.json, so start commands can differ per operating system.", "backend/config"],
      ["Launch scripts", "Start the backend and the UI together with one script.", "start-application.sh (macOS/Linux), start-application.bat (Windows)"],
      ["REST API", "Everything in the UI is available over HTTP: services, status, metrics, git, logs and config.", "Backend on http://localhost:4000"],
    ],
  },
];

const GETTING_STARTED = [
  ["Add base paths", "Admin → Paths: add the root folders of your repos (e.g. java, python, npm)."],
  ["Add services", "Admin → Services: set type, port, path and start command, then Save."],
  ["Start services", "Dashboard: pick a preset and click Run preset, or start services one by one."],
];

// Service field reference. Each entry explains what the field is, how Struo uses it, and where to set it in Admin.
const SERVICE_FIELDS = [
  {
    name: "command",
    required: "Yes",
    admin: "Commands › Start Command",
    what: "The shell command Struo runs to start the service.",
    how: `Runs from the service's path folder. Everything it prints goes to the service log in the Logs tab. Base path tokens such as \${basePaths.java} work here too.`,
    examples: [["Java", "mvn spring-boot:run"], ["Python", "uvicorn main:app --port 5002"], ["npm", "npm run dev"], ["Redis", "redis-server --port 6379 --daemonize yes"]],
    tip: "Run the command in a terminal from the service folder first — if it works there, it works in Struo.",
  },
  {
    name: "type",
    required: "Recommended",
    admin: "General › Service Type",
    what: "The kind of service: java, python, npm, redis, neo4j or listener.",
    how: "Sets sensible defaults: the API docs link (Swagger for java, /docs for python), the health link (/actuator/health for java) and how status is checked — listeners have no port.",
    examples: [["Spring Boot", "java"], ["FastAPI / Flask", "python"], ["React / Node", "npm"], ["Background worker", "listener"]],
    tip: "Choose listener for workers that never open a port, and give them a healthCommand.",
  },
  {
    name: "path",
    required: "Recommended",
    admin: "Location",
    what: "The folder the service lives in.",
    how: "Commands run from this folder, and the branch selector, Pull and Push use the git repo here. A leading ~ means your home folder.",
    examples: [["Direct path", "~/codebase/lextr/java/auth-service"], ["From base path", `\${basePaths.java}/auth-service`]],
    tip: "Use a base path token so the same config works on every machine — only the base path differs per person.",
  },
  {
    name: "port",
    required: "No",
    admin: "General › Port",
    what: "The port the service listens on.",
    how: "Struo counts the service as running while this port is open, waits up to 60 seconds for it on start, frees it on stop, and builds the Swagger, Web UI and health links from it.",
    examples: [["Java API", "8080"], ["Frontend", "3000"], ["Redis", "6379"]],
    tip: "Leave it empty for workers and add a healthCommand instead. Every port must be unique — Admin flags duplicates.",
  },
  {
    name: "group",
    required: "No",
    admin: "General › Group",
    what: "A label used to organise services.",
    how: "Dashboard cards are grouped by it, and presets use it: Minimal and Core start the Database group, Core also starts the Core group, Backend Only skips Frontend.",
    examples: [["Databases", "Database"], ["Shared backend", "Core"], ["UI apps", "Frontend"]],
    tip: "You can also drag a card onto another group on the Dashboard to change it.",
  },
  {
    name: "description",
    required: "No",
    admin: "General › Description",
    what: "A one-line summary of the service.",
    how: "Shown under the service name on its Dashboard card, and as a tooltip in the Logs and Admin service lists.",
    examples: [["Example", "Authentication and Authorization Service"]],
  },
  {
    name: "build",
    required: "No",
    admin: "Commands › Build Command",
    what: "The command that compiles or installs the service.",
    how: "Runs before the start command, but only while the Dashboard's Build toggle is on. If the build fails the service is not started; output appears in the log under [BUILD].",
    examples: [["Java", "mvn clean install -DskipTests"], ["npm", "npm install"], ["Python", "pip install -r requirements.txt"]],
    tip: "Keep Build before start off for quick restarts; turn it on after pulling dependency or schema changes.",
  },
  {
    name: "stopCommand",
    required: "No",
    admin: "Commands › Stop Command",
    what: "A command that stops the service gracefully.",
    how: "Used by Stop and Restart. Without it, Struo stops whatever process is holding the service's port.",
    examples: [["Redis", "redis-cli shutdown"], ["Neo4j", "neo4j stop"]],
    tip: "Needed for daemons that keep running outside Struo, such as Neo4j or Redis in daemon mode.",
  },
  {
    name: "healthCommand",
    required: "No",
    admin: "Commands › Health Check Command",
    what: "A command that exits with code 0 when the service is healthy.",
    how: "With a port, it decides Healthy vs Unhealthy. Without a port, it decides whether the service counts as running at all.",
    examples: [["HTTP check", "curl -f http://localhost:8080/actuator/health"], ["Worker (macOS/Linux)", "pgrep -f worker.py"], ["Worker (Windows)", "tasklist | findstr worker"]],
    tip: "Essential for listeners and workers — without it Struo can't tell whether they are running.",
  },
  {
    name: "dependsOn",
    required: "No",
    admin: "Dependencies › Depends on",
    what: "Services that must be running before this one starts.",
    how: "Starting this service starts its dependencies first, in order. If a dependency fails, this service is blocked. Admin rejects unknown names and dependency cycles.",
    examples: [["One dependency", '["config-service"]'], ["Several", '["config-service", "redis"]']],
    tip: "Pick services from the list in Admin — renaming a service updates these references automatically. Leave it empty for services that don't need anything else running.",
  },
  {
    name: "docsPath",
    required: "No",
    admin: "Endpoints › API Docs Path",
    what: "The path of the service's API documentation.",
    how: "Used by the Swagger / Docs chip on the card. When empty: /swagger-ui/index.html for java, /docs for python.",
    examples: [["Spring Boot", "/swagger-ui/index.html"], ["FastAPI", "/docs"], ["Custom", "/api-docs"]],
  },
  {
    name: "healthPath",
    required: "No",
    admin: "Endpoints › Health Check Path",
    what: "The HTTP path of the service's health endpoint.",
    how: "Shown as the Health Endpoint link in the card's port menu. When empty, it is taken from the URL in healthCommand, otherwise /actuator/health for java or /health.",
    examples: [["Spring Boot", "/actuator/health"], ["Others", "/health"]],
  },
  {
    name: "gitAutoPull",
    required: "No",
    defaultValue: "true",
    admin: "Config file only",
    what: "Whether to run git pull before each start.",
    how: "Pulls in the service's path folder. Branches that are not on the remote are skipped automatically. A failed pull stops the start.",
    examples: [["Turn off", "false"]],
    tip: "Set to false for repos where you keep local work in progress and don't want surprise merges.",
  },
  {
    name: "enableGit",
    required: "No",
    defaultValue: "true",
    admin: "Config file only",
    what: "Whether git features are shown for this service.",
    how: "When false, the card hides the branch selector, Pull and Push.",
    examples: [["Turn off", "false"]],
    tip: "Use it for services whose folder is not a git repository.",
  },
  {
    name: "daemon",
    required: "No",
    defaultValue: "false",
    admin: "Config file only",
    what: "Marks services whose start command launches a background process and exits.",
    how: "Struo then tracks the service by its port or health check instead of the process it launched. Neo4j and commands like `neo4j start` or `--daemonize yes` are detected automatically.",
    examples: [["Mark as daemon", "true"]],
  },
];

// Run configuration: per-machine extras, edited in Admin › Services › Run configuration, never committed.
SERVICE_FIELDS.push(
  {
    name: "jvmArgs",
    required: "No",
    admin: "Services › Run configuration (Java only)",
    what: "Extra JVM options for this service on this machine — heap size, system properties, debug agent.",
    how: `Added when the service starts without changing the shared start command: merged into -Dspring-boot.run.jvmArguments for mvn spring-boot:run, placed after java for java commands, or put where the command has \${jvmArgs}.`,
    examples: [["Heap", "-Xmx1g"], ["Profile", "-Dspring.profiles.active=local"], ["Debug", "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005"]],
    tip: "Shown only for Java services. To check what a run actually used, look at the [RUN CONFIG] and [RUN COMMAND] lines at the top of its log.",
  },
  {
    name: "args",
    required: "No",
    admin: "Services › Run configuration",
    what: "Extra arguments passed to the application when it starts.",
    how: `Java: passed via -Dspring-boot.run.arguments. npm: passed after -- to the script. Python and others: added to the end of the start command (or where the command has \${args}). Not available for Docker and database services.`,
    examples: [["Java", "--server.port=9090"], ["Python", "--reload --workers 2"], ["npm", "--port 5174"]],
  },
  {
    name: "env",
    required: "No",
    admin: "Services › Run configuration",
    what: "Environment variables for the service on this machine — API keys, passwords, PYTHONPATH and similar.",
    how: "Passed to the start, build, stop and health commands. Empty values are treated as not set. For Docker services, write -e NAME (without a value) in the start command and Docker takes the value from here.",
    examples: [["Python", "OPENAI_API_KEY"], ["Python", "PYTHONPATH"], ["Docker", "CLICKHOUSE_PASSWORD"]],
    tip: "Keep secrets here rather than in the start command — this file is never committed.",
  }
);

const GLOBAL_FIELDS = [
  {
    name: "config.presets",
    required: "No",
    admin: "Admin › Presets",
    what: "Named sets of services you can start together from the Dashboard.",
    how: "Each preset is a list of service names. When not set, the built-in presets are used: Infrastructure only, Infrastructure + shared services, All backend services and Full stack, computed from the dependency map. Renaming or deleting a service in Admin updates the presets that contain it.",
    examples: [["Example", '{ "My daily set": ["redis", "config-service", "auth-service"] }']],
    tip: "Tick services on the Dashboard and use \"Save as preset\" to create one quickly.",
  },
  {
    name: "config.logs",
    required: "No",
    admin: "Admin › Logs",
    what: "How long logs from earlier runs are kept, and whether the combined log view is available.",
    how: "previousRuns is \"archive\" (keep earlier runs within the limits) or \"delete\" (remove them when a new run starts). retentionDays and maxRuns limit archived runs per service; whichever is reached first applies. The current run is never deleted. combinedView: true adds the Combined logs view to the Logs page (off by default).",
    examples: [["Defaults", '{ "previousRuns": "archive", "retentionDays": 3, "maxRuns": 20 }'], ["Keep only the latest", '{ "previousRuns": "delete" }'], ["Combined log view on", '{ "combinedView": true }']],
    tip: "Settings apply immediately after Save — no backend restart needed.",
  },
  {
    name: "config.basePaths",
    required: "No",
    admin: "Admin › Paths",
    what: "Named root folders shared by many services.",
    how: `Reference one in any service path or command as \${basePaths.key}. Admin › Paths shows how many services use each one and lets you copy its token.`,
    examples: [["Example", '{ "java": "~/codebase/lextr/java" }']],
    tip: "Teammates only need to change their base paths — every service path then resolves correctly.",
  },
  {
    name: "config.enableGit",
    required: "No",
    defaultValue: "true",
    admin: "Config file only",
    what: "Master switch for git features.",
    how: "When false, branch, Pull and Push are turned off for every service.",
    examples: [["Turn off", "false"]],
  },
];

const CONFIG_EXAMPLE = `{
  "config": {
    "basePaths": {
      "java": "~/codebase/lextr/java",
      "npm": "~/codebase/lextr/typescript"
    }
  },
  "services": {
    "auth-service": {
      "type": "java",
      "group": "Core",
      "port": 8057,
      "path": "\${basePaths.java}/auth-service",
      "command": "mvn spring-boot:run",
      "build": "mvn clean install -DskipTests",
      "dependsOn": ["config-service"]
    },
    "frontend-service": {
      "type": "npm",
      "group": "Frontend",
      "port": 3000,
      "path": "\${basePaths.npm}/frontend-service",
      "command": "npm run dev",
      "build": "npm install"
    }
  }
}`;

const TROUBLESHOOTING = [
  {
    title: "Service won't start",
    icon: <ErrorIcon />,
    color: "#dc2626",
    symptom: "The card turns red with \"Command failed\" or \"Operation failed\".",
    steps: [
      "Seeing \"Start <service> first\" instead? See Dependencies not running.",
      "Open the service log (Logs button on the red box) — the real error is usually in the last lines.",
      "Check the service path exists. Admin › Services › Location shows the folder it resolves to.",
      "Run the start command yourself in a terminal from that folder. If it fails there, fix it there first.",
      "Make sure the required tools are installed and on your PATH (Java + Maven, Python, Node.js, …).",
    ],
  },
  {
    title: "Dependencies not running",
    icon: <LinkIcon />,
    color: "#2563eb",
    symptom: "The card turns red with \"Start <service>, <service> first\" and the service doesn't start.",
    steps: [
      "The message lists the services this one depends on that are stopped, e.g. \"Start neo4j, workflow-service first\". Nothing is wrong with this service itself.",
      "Find each listed service on the Dashboard and check its status pill. It must be Running — Stopped or Failed blocks the start.",
      "Start the stopped ones, then start this service again. Or use Start selected / Start all / Run preset, which start dependencies first and in the right order.",
      "If a dependency shows Failed, fix that one first: use its Logs and Help buttons. Starting this service won't work until it runs.",
      "Dependencies that are still Starting are waited for (up to 2 minutes); only stopped ones fail straight away.",
      "To see the full dependency list, hover the \"Needs N\" pill on the card. If the list is wrong, edit Depends on in Admin › Services.",
      "To start without these checks, turn off Dependency check in Admin and save.",
    ],
  },
  {
    title: "Port already in use",
    icon: <PortIcon />,
    color: "#d97706",
    symptom: "The card shows \"Port issue\" or \"Port is already in use\".",
    steps: [
      "Struo frees the port automatically before a normal start — just try Start again.",
      "If two services are configured with the same port, Admin shows a red validation error; give each its own port.",
      "For daemons (Redis, Neo4j) that are already listening, Struo treats them as already running rather than restarting them.",
      "Still stuck? Another app outside Struo may be grabbing the port — stop it, or change the service's port.",
    ],
  },
  {
    title: "Git pull failed on start",
    icon: <GitIcon />,
    color: "#7c3aed",
    symptom: "The card shows \"Git pull failed\" and the service doesn't start.",
    steps: [
      "Open the log and look for [GIT PULL STDERR] to see git's message.",
      "Uncommitted changes that clash with incoming commits: commit or stash them, then start again.",
      "Network or authentication errors: run git pull in that folder from a terminal to sign in or fix access.",
      "Don't want pulls on start for this service? Set gitAutoPull to false in its config.",
    ],
  },
  {
    title: "Startup timed out",
    icon: <TimerIcon />,
    color: "#ea580c",
    symptom: "The card shows \"Startup timed out\" after about a minute.",
    steps: [
      "Struo waited 60 seconds for the service's port to open. Check the log for errors during startup.",
      "Make sure the port in the config is the port the app actually listens on.",
      "Slow first start (e.g. downloading dependencies)? Run the build once with Build before start on, then start again.",
    ],
  },
  {
    title: "Status unavailable or not healthy",
    icon: <HealthIcon />,
    color: "#db2777",
    symptom: "A service you know is running shows Stopped, Unknown or Unhealthy.",
    steps: [
      "Services with a port are checked by whether the port is open — make sure the port in the config is correct.",
      "Workers and listeners without a port need a healthCommand (e.g. pgrep -f worker.py), otherwise Struo can't see them.",
      "Unhealthy with a port open means the healthCommand failed — run it in a terminal to see why.",
    ],
  },
  {
    title: "Logs not streaming",
    icon: <LogsIcon />,
    color: "#0f766e",
    symptom: "The log view stays empty or stops updating.",
    steps: [
      "Check the indicator in the Logs tab: Live means streaming, Idle means nothing is open, Stream error means the connection dropped.",
      "Only the current run streams live; earlier runs are read-only. Pick \"Current run\" (green dot) in the run picker.",
      "Use the reload icon in the log toolbar. The service must be running and writing output.",
    ],
  },
  {
    title: "Can't save configuration",
    icon: <SaveIcon />,
    color: "#2563eb",
    symptom: "The Save button is greyed out or saving shows an error.",
    steps: [
      "Save is only enabled when there are changes — look for the \"Unsaved changes\" chip.",
      "Fix every issue in the red banner; click an issue to jump to the service. Save stays blocked until they're fixed.",
      "If saving errors, make sure the backend is running and can write to backend/config.",
    ],
  },
  {
    title: "Branch shows a crossed-out cloud",
    icon: <CloudUploadIcon />,
    color: "#7c3aed",
    symptom: "A crossed-out cloud icon appears next to the branch name.",
    steps: [
      "The branch exists only on your machine, so git pull is skipped when the service starts (this is expected).",
      "To publish it, click the highlighted Push button next to the branch — it runs git push -u and sets the upstream.",
      "After pushing, the icon disappears and the Pull button is enabled.",
    ],
  },
  {
    title: "Running on Windows",
    icon: <WindowsIcon />,
    color: "#475569",
    symptom: "Commands that work on macOS/Linux fail on Windows.",
    steps: [
      "Windows uses backend/config/services.windows.json — put Windows-specific commands there.",
      "Use Windows equivalents, e.g. tasklist | findstr instead of pgrep for health commands.",
      "Start Struo with start-application.bat.",
    ],
  },
];

const GROUP_COLORS = {
  "Service Control": "#16a34a",
  "Dashboard & Monitoring": "#2563eb",
  "Quick Links on Cards": "#0891b2",
  "Git Integration": "#7c3aed",
  Logs: "#0f766e",
  "Configuration (Admin)": "#d97706",
  "Platform & Setup": "#475569",
};

function IconTile({ icon, color, size = 36 }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        color,
        backgroundColor: `${color}14`,
        border: `1px solid ${color}33`,
      }}
    >
      {cloneElement(icon, { color: "inherit", sx: { fontSize: size * 0.55 } })}
    </Box>
  );
}

function matches(term, ...values) {
  if (!term) return true;
  return values.some((value) => String(value).toLowerCase().includes(term));
}

// Stable ids per topic, used by "Help" links on failed service cards.
const TROUBLESHOOTING_META = {
  "Service won't start": "wont-start",
  "Dependencies not running": "dependencies",
  "Port already in use": "port",
  "Git pull failed on start": "git-pull",
  "Startup timed out": "timeout",
  "Status unavailable or not healthy": "health",
  "Logs not streaming": "logs",
  "Can't save configuration": "save",
  "Branch shows a crossed-out cloud": "local-branch",
  "Running on Windows": "windows",
};

function GettingStarted() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        gap: 1.5,
        px: 2.5,
        py: 1.5,
        flexShrink: 0,
        background: "linear-gradient(135deg, color-mix(in srgb, var(--sm-accent) 8%, transparent) 0%, var(--c-bg-7c3aed-008) 100%)",
        borderBottom: "1px solid var(--c-border-94a3b8-018)",
      }}
    >
      {GETTING_STARTED.map(([title, description], index) => (
        <Box key={title} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
          <NumberBadge value={index + 1} gradient />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{title}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.82rem" }}>{description}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function NumberBadge({ value, color = "#2563eb", gradient = false, size = 28 }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: size > 24 ? "0.85rem" : "0.72rem",
        color: gradient ? "var(--c-text-ffffff)" : color,
        background: gradient ? "linear-gradient(135deg, var(--sm-accent) 0%, var(--c-bg-7c3aed) 100%)" : `${color}14`,
        boxShadow: gradient ? "0 4px 12px var(--c-shadow-4f46e5-03)" : "none",
      }}
    >
      {value}
    </Box>
  );
}

// Shared layout for all Help tabs: a sidebar of sections and a detail panel for the selected one.
// sections: [{ key, title, subtitle, icon, color, count }]
function SectionHeader({ section, size = 44 }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
      <IconTile icon={section.icon} color={section.color} size={size} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, fontSize: size < 44 ? "1.05rem" : undefined }}>
          {section.title}
        </Typography>
        {section.subtitle ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>{section.subtitle}</Typography>
        ) : null}
      </Box>
    </Box>
  );
}

// Shared layout for all Help tabs: a sidebar of sections and a detail panel for the selected one.
// While searching (flat), every matching section is listed in one scrollable column instead.
// sections: [{ key, title, subtitle, icon, color, count }]
function SidebarDetail({ sections, renderDetail, emptyText, selectedKey, onSelect, flat }) {
  if (sections.length === 0) {
    return <Typography variant="body2" sx={{ color: "text.secondary", p: 2.5 }}>{emptyText}</Typography>;
  }

  if (flat) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
        {sections.map((section) => (
          <Box
            key={section.key}
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              borderLeft: `4px solid ${section.color}`,
              backgroundColor: "background.paper",
            }}
          >
            <SectionHeader section={section} size={36} />
            {renderDetail(section)}
          </Box>
        ))}
      </Box>
    );
  }

  // Fall back to the first section when the selected one does not exist.
  const selected = sections.find((section) => section.key === selectedKey) || sections[0];

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: { xs: "auto", md: 0 },
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "240px minmax(0, 1fr)", lg: "280px minmax(0, 1fr)" },
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          p: 1,
          display: "flex",
          flexDirection: { xs: "row", md: "column" },
          gap: 0.5,
          overflow: "auto",
          borderRight: { md: "1px solid var(--c-text-94a3b8-018)" },
          borderBottom: { xs: "1px solid var(--c-text-94a3b8-018)", md: 0 },
          backgroundColor: "var(--c-bg-f8fafc-06)",
        }}
      >
        {sections.map((section) => {
          const active = section.key === selected.key;
          const { color } = section;
          return (
            <Box
              key={section.key}
              component="button"
              type="button"
              onClick={() => onSelect?.(section.key)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                p: 1,
                border: 0,
                borderRadius: 2,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
                flexShrink: 0,
                color: "text.primary",
                backgroundColor: active ? `${color}14` : "transparent",
                boxShadow: active ? `inset 3px 0 0 ${color}` : "none",
                transition: "background-color 0.15s ease",
                "&:hover": { backgroundColor: active ? `${color}1f` : "var(--c-bg-0f172a-005)" },
              }}
            >
              <IconTile icon={section.icon} color={color} size={30} />
              <Typography sx={{ flex: 1, minWidth: 0, fontWeight: active ? 800 : 600, fontSize: "0.85rem", whiteSpace: { xs: "nowrap", md: "normal" }, lineHeight: 1.3 }}>
                {section.title}
              </Typography>
              {section.count != null ? (
                <Chip
                  size="small"
                  label={section.count}
                  sx={{ fontWeight: 700, color: active ? color : "text.secondary", backgroundColor: active ? "var(--c-bg-ffffff)" : "var(--c-bg-94a3b8-016)" }}
                />
              ) : null}
            </Box>
          );
        })}
      </Box>

      <Box sx={{ minHeight: 0, overflow: "auto", p: { xs: 2, md: 3 } }}>
        {/* The sidebar already shows the icon, title and count; only add what it doesn't. */}
        {selected.subtitle ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {selected.subtitle}
          </Typography>
        ) : null}
        {renderDetail(selected)}
      </Box>
    </Box>
  );
}

const itemCardSx = (color) => ({
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  "&:hover": { borderColor: `${color}66`, boxShadow: `0 8px 20px ${color}14` },
});

const codeFont = CODE_FONT;

function FeaturesTab({ term, ...navProps }) {
  const sections = FEATURE_GROUPS
    .map((group) => ({
      ...group,
      items: matches(term, group.title)
        ? group.items
        : group.items.filter((item) => matches(term, ...item)),
    }))
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      key: group.title,
      color: GROUP_COLORS[group.title] || "var(--sm-accent-text)",
      count: group.items.length,
    }));

  return (
    <>
      {!term ? <GettingStarted /> : null}
      <SidebarDetail
        {...navProps}
        sections={sections}
        emptyText={`No features match "${term}".`}
        renderDetail={(section) => (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
            {section.items.map(([title, description, where]) => (
              <Box key={title} sx={{ ...itemCardSx(section.color), display: "flex", gap: 1.25, p: 1.75 }}>
                <Box sx={{ width: 8, height: 8, mt: 0.75, borderRadius: "50%", flexShrink: 0, backgroundColor: section.color }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.35 }}>{title}</Typography>
                  <Typography sx={{ color: "text.secondary", fontSize: "0.84rem", lineHeight: 1.55, mt: 0.25 }}>{description}</Typography>
                  {where && where !== "—" ? (
                    <Typography sx={{ fontSize: "0.75rem", mt: 0.75, color: section.color, fontWeight: 600 }}>
                      Where: <Box component="span" sx={{ color: "text.primary", fontWeight: 500 }}>{where}</Box>
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      />
    </>
  );
}

const CONFIG_SECTIONS = [
  { key: "basics", title: "Basics", icon: <ConfigIcon />, color: "#2563eb", subtitle: "What the service is and where it runs", fields: ["command", "type", "path", "port", "group", "description"] },
  { key: "lifecycle", title: "Build & lifecycle", icon: <StartIcon />, color: "#16a34a", subtitle: "Build, stop and readiness behaviour", fields: ["build", "stopCommand", "healthCommand", "daemon"] },
  { key: "dependencies", title: "Dependencies", icon: <GitIcon />, color: "#0891b2", subtitle: "Start order between services", fields: ["dependsOn"] },
  { key: "endpoints", title: "Endpoints", icon: <LinkIcon />, color: "#d97706", subtitle: "Links shown on the service card", fields: ["docsPath", "healthPath"] },
  { key: "run", title: "Run configuration", icon: <TerminalIcon />, color: "#0d9488", subtitle: "Per-machine extras: JVM options, arguments and secrets — never committed", fields: ["jvmArgs", "args", "env"] },
  { key: "git", title: "Git", icon: <CloudUploadIcon />, color: "#7c3aed", subtitle: "Pull and branch features", fields: ["gitAutoPull", "enableGit"] },
  { key: "global", title: "Global settings", icon: <AdminIcon />, color: "#475569", subtitle: "Settings under config, shared by all services", global: true },
  { key: "example", title: "Full example", icon: <TerminalIcon />, color: "#0f172a", subtitle: "A complete config with base paths and two services", example: true },
];

function FieldCard({ field, color }) {
  const { name, required, defaultValue, admin, what, how, examples = [], tip } = field;
  const labelSx = { fontSize: "0.68rem", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "text.secondary" };
  return (
    <Box sx={{ ...itemCardSx(color), p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
        <Typography sx={{ fontFamily: codeFont, fontWeight: 800, fontSize: "0.95rem", color }}>{name}</Typography>
        <Chip
          size="small"
          label={required === "Yes" ? "Required" : required === "Recommended" ? "Recommended" : "Optional"}
          color={required === "Yes" ? "error" : required === "Recommended" ? "warning" : "default"}
          variant={required === "No" ? "outlined" : "filled"}
          sx={{ fontSize: "0.68rem", fontWeight: 700 }}
        />
        {defaultValue ? (
          <Chip size="small" variant="outlined" label={`Default: ${defaultValue}`} sx={{ fontSize: "0.68rem", fontFamily: codeFont }} />
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
          Set in: <strong>{admin}</strong>
        </Typography>
      </Box>

      <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.5 }}>{what}</Typography>

      <Typography sx={{ ...labelSx, mt: 1.25, mb: 0.25 }}>How Struo uses it</Typography>
      <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", lineHeight: 1.55 }}>{how}</Typography>

      {examples.length ? (
        <>
          <Typography sx={{ ...labelSx, mt: 1.25, mb: 0.5 }}>Examples</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", columnGap: 1.25, rowGap: 0.5, alignItems: "center" }}>
            {examples.map(([label, value]) => (
              <Box key={label} sx={{ display: "contents" }}>
                <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>{label}</Typography>
                <Box
                  component="code"
                  sx={{
                    justifySelf: "start",
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontFamily: codeFont,
                    fontSize: "0.78rem",
                    wordBreak: "break-all",
                    color: "#e2e8f0",
                    backgroundColor: "#0f172a",
                  }}
                >
                  {value}
                </Box>
              </Box>
            ))}
          </Box>
        </>
      ) : null}

      {tip ? (
        <Box
          sx={{
            display: "flex",
            gap: 1,
            mt: 1.5,
            p: 1,
            borderRadius: 1.5,
            backgroundColor: `${color}0d`,
            border: `1px solid ${color}26`,
          }}
        >
          <TipIcon sx={{ fontSize: 16, color, mt: 0.15 }} />
          <Typography sx={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{tip}</Typography>
        </Box>
      ) : null}
    </Box>
  );
}

const fieldText = (field) => [field.name, field.admin, field.what, field.how, field.tip || "", ...field.examples.flat()];

function ConfigurationTab({ term, ...navProps }) {
  const fieldsByName = Object.fromEntries(SERVICE_FIELDS.map((field) => [field.name, field]));
  const sections = CONFIG_SECTIONS
    .map((section) => {
      if (section.example) {
        return matches(term, section.title, CONFIG_EXAMPLE) ? section : null;
      }
      if (section.global) {
        const rows = GLOBAL_FIELDS.filter((field) => matches(term, section.title, ...fieldText(field)));
        return rows.length ? { ...section, rows, count: rows.length } : null;
      }
      const rows = section.fields
        .map((name) => fieldsByName[name])
        .filter((field) => field && matches(term, section.title, ...fieldText(field)));
      return rows.length ? { ...section, rows, count: rows.length } : null;
    })
    .filter(Boolean);

  return (
    <SidebarDetail
      {...navProps}
      sections={sections}
      emptyText={`No configuration matches "${term}".`}
      renderDetail={(section) =>
        section.example ? (
          <Box>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                borderRadius: 2,
                overflow: "auto",
                backgroundColor: "#0f172a",
                color: "#e2e8f0",
                fontFamily: codeFont,
                fontSize: "0.8rem",
                lineHeight: 1.55,
              }}
            >
              {CONFIG_EXAMPLE}
            </Box>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 1.5 }}>
              Edit these values in Admin — it validates ports, dependencies and required commands before saving.
              The config lives in backend/config/services.json (services.windows.json on Windows).
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 1.5, alignItems: "start" }}>
            {section.rows.map((field) => (
              <FieldCard key={field.name} field={field} color={section.color} />
            ))}
          </Box>
        )
      }
    />
  );
}

function TroubleshootingTab({ term, ...navProps }) {
  const sections = TROUBLESHOOTING
    .filter((topic) => matches(term, topic.title, topic.symptom, ...topic.steps))
    .map((topic) => ({
      ...topic,
      key: TROUBLESHOOTING_META[topic.title] || topic.title,
      tips: topic.steps,
      count: topic.steps.length,
      subtitle: `What you see: ${topic.symptom}`,
    }));

  return (
    <SidebarDetail
      {...navProps}
      sections={sections}
      emptyText={`No topics match "${term}".`}
      renderDetail={(section) => (
        <Box>
          {section.tips.map((tip, index) => (
            <Box key={tip} sx={{ display: "flex", gap: 1.5 }}>
              {/* Step rail: number with a connecting line to the next step */}
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <NumberBadge value={index + 1} color={section.color} />
                {index < section.tips.length - 1 ? (
                  <Box sx={{ flex: 1, width: 2, my: 0.5, backgroundColor: `${section.color}33` }} />
                ) : null}
              </Box>
              <Box sx={{ ...itemCardSx(section.color), flex: 1, p: 1.75, mb: index < section.tips.length - 1 ? 1.5 : 0 }}>
                <Typography sx={{ fontSize: "0.9rem", lineHeight: 1.55 }}>{tip}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    />
  );
}

const HELP_TABS = ["features", "configuration", "troubleshooting"];

const Help = ({ target }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState({});
  const term = useMemo(() => search.trim().toLowerCase(), [search]);

  // Open a specific tab/section when another page links into Help (e.g. a failed service card).
  useEffect(() => {
    if (!target) return;
    const tabIndex = HELP_TABS.indexOf(target.tab);
    if (tabIndex >= 0) setCurrentTab(tabIndex);
    if (target.section) setSelection((previous) => ({ ...previous, [target.tab]: target.section }));
    setSearch("");
  }, [target]);

  const navProps = (tab) => ({
    selectedKey: selection[tab],
    onSelect: (key) => setSelection((previous) => ({ ...previous, [tab]: key })),
    flat: Boolean(term),
  });

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Top bar inside the card: tabs on the left, search on the right (same pattern as Logs and Admin) */}
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          columnGap: 1,
          px: 1,
          minHeight: TOP_BAR_HEIGHT,
          borderBottom: "1px solid var(--c-border-94a3b8-016)",
          backgroundColor: "var(--c-bg-f8fafc-088)",
        }}
      >
        <Tabs
          value={currentTab}
          onChange={(_, value) => setCurrentTab(value)}
          sx={{
            minHeight: TOP_BAR_HEIGHT,
            "& .MuiTab-root": { minHeight: TOP_BAR_HEIGHT, textTransform: "none", fontWeight: 700, px: 1.5 },
          }}
        >
          <Tab icon={<FeaturesIcon fontSize="small" />} iconPosition="start" label="Features" />
          <Tab icon={<ConfigIcon fontSize="small" />} iconPosition="start" label="Configuration" />
          <Tab icon={<TroubleshootIcon fontSize="small" />} iconPosition="start" label="Troubleshooting" />
        </Tabs>
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search help"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: "1rem" }} />
              </InputAdornment>
            ),
            sx: { ...SEARCH_INPUT_SX, backgroundColor: "background.paper" },
          }}
          sx={{ width: { xs: "100%", sm: 260 }, py: 0.5, pr: 0.5 }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {currentTab === 0 && <FeaturesTab term={term} {...navProps("features")} />}
        {currentTab === 1 && <ConfigurationTab term={term} {...navProps("configuration")} />}
        {currentTab === 2 && <TroubleshootingTab term={term} {...navProps("troubleshooting")} />}
      </Box>
    </Paper>
  );
};

export default Help;
