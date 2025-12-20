let currentConfig = null;

// Tab management
function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(tabName + '-tab').classList.add('active');
  event.target.classList.add('active');
}

// Load full configuration
async function loadConfig() {
  try {
    const data = await apiGet("/config");
    currentConfig = data;
    
    // Populate base paths form
    populatePathsForm(data.config);
    
    // Populate services form
    populateServicesForm(data.services);
    
    // Populate raw JSON editor
    document.getElementById("config-editor").value = JSON.stringify(data, null, 2);
    
    updateStatus("paths-status", "Configuration loaded successfully");
  } catch (err) {
    updateStatus("paths-status", "Failed to load config: " + err.message, "error");
  }
}

// Populate base paths form
function populatePathsForm(config) {
  document.getElementById("config-server-url").value = config.configServerUrl || "";
  document.getElementById("active-profile").value = config.profiles?.active || "dev";
  
  const basePaths = config.basePaths || {};
  document.getElementById("java-path").value = basePaths.java || "";
  document.getElementById("python-path").value = basePaths.python || "";
  document.getElementById("npm-path").value = basePaths.npm || "";
  document.getElementById("neo4j-path").value = basePaths.neo4j || "";
  document.getElementById("listener-path").value = basePaths.listener || "";
  document.getElementById("default-path").value = basePaths.default || "";
}

// Populate services form
function populateServicesForm(services) {
  const container = document.getElementById("services-list");
  container.innerHTML = "";
  
  Object.entries(services).forEach(([name, service]) => {
    const serviceCard = document.createElement("div");
    serviceCard.className = "service-card";
    serviceCard.innerHTML = `
      <h4>${name}</h4>
      <div class="service-fields">
        <div>
          <label>Type:</label>
          <select data-svc-name="${name}" data-svc-field="type">
            <option value="java" ${service.type === 'java' ? 'selected' : ''}>Java</option>
            <option value="python" ${service.type === 'python' ? 'selected' : ''}>Python</option>
            <option value="npm" ${service.type === 'npm' ? 'selected' : ''}>NPM</option>
            <option value="redis" ${service.type === 'redis' ? 'selected' : ''}>Redis</option>
            <option value="neo4j" ${service.type === 'neo4j' ? 'selected' : ''}>Neo4j</option>
            <option value="listener" ${service.type === 'listener' ? 'selected' : ''}>Listener</option>
          </select>
        </div>
        <div>
          <label>Port:</label>
          <input type="number" data-svc-name="${name}" data-svc-field="port" value="${service.port || ''}" placeholder="8080">
        </div>
        <div style="grid-column: 1 / -1;">
          <label>Path:</label>
          <input type="text" data-svc-name="${name}" data-svc-field="path" value="${service.path || ''}" placeholder="\${basePaths.java}/service-name">
        </div>
        <div style="grid-column: 1 / -1;">
          <label>Command:</label>
          <input type="text" data-svc-name="${name}" data-svc-field="command" value="${service.command || ''}" placeholder="mvn spring-boot:run">
        </div>
        <div style="grid-column: 1 / -1;">
          <label>Stop Command (optional):</label>
          <input type="text" data-svc-name="${name}" data-svc-field="stopCommand" value="${service.stopCommand || ''}" placeholder="redis-cli shutdown">
        </div>
        <div style="grid-column: 1 / -1;">
          <label>Build Command (optional):</label>
          <input type="text" data-svc-name="${name}" data-svc-field="build" value="${service.build || ''}" placeholder="mvn clean install">
        </div>
        <div style="grid-column: 1 / -1;">
          <label>Description:</label>
          <input type="text" data-svc-name="${name}" data-svc-field="description" value="${service.description || ''}" placeholder="Service description">
        </div>
      </div>
    `;
    container.appendChild(serviceCard);
  });
}

// Save base paths
async function savePaths() {
  updateStatus("paths-status", "Saving...");
  
  try {
    const config = {
      configServerUrl: document.getElementById("config-server-url").value,
      profiles: {
        active: document.getElementById("active-profile").value
      },
      basePaths: {
        java: document.getElementById("java-path").value,
        python: document.getElementById("python-path").value,
        npm: document.getElementById("npm-path").value,
        neo4j: document.getElementById("neo4j-path").value,
        listener: document.getElementById("listener-path").value,
        default: document.getElementById("default-path").value
      }
    };
    
    // Update current config and save full config
    currentConfig.config = config;
    await apiPut("/config", currentConfig);
    
    updateStatus("paths-status", "Base paths saved successfully");
  } catch (err) {
    updateStatus("paths-status", "Failed to save: " + err.message, "error");
  }
}

// Save services
async function saveServices() {
  updateStatus("services-status", "Saving...");
  
  try {
    const services = {};
    
    // Collect all service data from form fields
    document.querySelectorAll('[data-svc-name]').forEach(input => {
      const serviceName = input.dataset.svcName;
      const field = input.dataset.svcField;
      
      if (!services[serviceName]) {
        services[serviceName] = {};
      }
      
      let value = input.value;
      if (field === 'port' && value) {
        value = parseInt(value);
      }
      
      if (value) {
        services[serviceName][field] = value;
      }
    });
    
    // Update current config and save
    currentConfig.services = services;
    await apiPut("/config", currentConfig);
    
    updateStatus("services-status", "Services saved successfully");
  } catch (err) {
    updateStatus("services-status", "Failed to save: " + err.message, "error");
  }
}

// Save raw JSON config
async function saveRawConfig() {
  const editor = document.getElementById("config-editor");
  updateStatus("raw-status", "Saving...");
  
  let parsed;
  try {
    parsed = JSON.parse(editor.value);
  } catch (err) {
    updateStatus("raw-status", "Invalid JSON: " + err.message, "error");
    return;
  }
  
  try {
    await apiPut("/config", parsed);
    currentConfig = parsed;
    updateStatus("raw-status", "Configuration saved successfully");
    
    // Refresh other tabs
    populatePathsForm(parsed.config);
    populateServicesForm(parsed.services);
  } catch (err) {
    updateStatus("raw-status", "Failed to save: " + err.message, "error");
  }
}

// Update status message
function updateStatus(elementId, message, type = "success") {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.style.color = type === "error" ? "#dc3545" : "#28a745";
}

// Legacy function for backward compatibility
async function saveConfig() {
  return saveRawConfig();
}

document.addEventListener("DOMContentLoaded", loadConfig);
