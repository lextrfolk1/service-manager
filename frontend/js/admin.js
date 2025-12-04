async function loadConfig() {
  const editor = document.getElementById("config-editor");
  const status = document.getElementById("save-status");

  status.textContent = "Loading...";

  try {
    const data = await apiGet("/config/services");
    editor.value = JSON.stringify(data, null, 2);
    status.textContent = "Loaded actual services.json. Edit and Save to apply.";
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
