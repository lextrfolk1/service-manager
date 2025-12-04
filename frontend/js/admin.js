async function loadConfig() {
  const editor = document.getElementById("config-editor");
  const status = document.getElementById("save-status");
  status.textContent = "Loading...";
  try {
    const data = await apiGet("/services");
    const template = {
      services: {}
    };
    data.services.forEach(svc => {
      template.services[svc.name] = {
        type: svc.type,
        port: svc.port,
        dir: "/path/to/your/service/dir",
        command: "your-start-command-here"
      };
    });
    editor.value = JSON.stringify(template, null, 2);
    status.textContent =
      "Loaded (template based on current services). Edit and Save to overwrite backend config.";
  } catch (err) {
    status.textContent = "Failed to load config: " + err.message;
  }
}

async function saveConfig() {
  const editor = document.getElementById("config-editor");
  const status = document.getElementById("save-status");
  status.textContent = "Saving...";
  let parsed;
  try {
    parsed = JSON.parse(editor.value);
  } catch (err) {
    status.textContent = "Invalid JSON: " + err.message;
    return;
  }
  try {
    await apiPut("/config/services", parsed);
    status.textContent = "Saved successfully. Backend reloaded config.";
  } catch (err) {
    status.textContent = "Failed to save: " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", loadConfig);
