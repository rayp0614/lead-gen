const townSelect = document.getElementById("townSelect");
const providersEl = document.getElementById("providers");
const statusEl = document.getElementById("status");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const downloadBtn = document.getElementById("downloadBtn");

let providers = [];

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

async function loadTowns() {
  setStatus("Loading towns...");
  const resp = await fetch("/api/towns");
  if (!resp.ok) {
    setStatus("Failed to load towns.", "error");
    return;
  }
  const data = await resp.json();
  townSelect.innerHTML = "<option value=''>Select a town</option>";
  for (const town of data.towns) {
    const option = document.createElement("option");
    option.value = town.name;
    option.textContent = town.name;
    townSelect.appendChild(option);
  }
  setStatus("Ready.", "success");
}

function renderProviders() {
  providersEl.innerHTML = "";
  if (!providers.length) {
    providersEl.innerHTML = "<div class='empty'>No providers found.</div>";
    return;
  }
  for (const provider of providers) {
    const row = document.createElement("label");
    row.className = "provider-row";
    row.innerHTML = `
      <input type="checkbox" data-url="${provider.url}" data-name="${provider.name}" />
      <span>${provider.name}</span>
    `;
    providersEl.appendChild(row);
  }
}

async function loadProviders() {
  const town = townSelect.value;
  providers = [];
  renderProviders();
  if (!town) {
    setStatus("Select a town to see providers.", "info");
    return;
  }

  setStatus(`Loading providers for ${town}...`);
  const resp = await fetch(`/api/providers?town=${encodeURIComponent(town)}`);
  if (!resp.ok) {
    setStatus("Failed to load providers for that town.", "error");
    return;
  }
  const data = await resp.json();
  providers = data.providers || [];
  renderProviders();
  setStatus(`Loaded ${providers.length} providers.`, "success");
}

function setAllCheckboxes(checked) {
  providersEl.querySelectorAll("input[type=checkbox]").forEach((box) => {
    box.checked = checked;
  });
}

async function downloadSelected() {
  const selected = Array.from(
    providersEl.querySelectorAll("input[type=checkbox]:checked")
  ).map((box) => ({
    name: box.dataset.name,
    url: box.dataset.url,
  }));

  if (!selected.length) {
    setStatus("Select at least one provider.", "error");
    return;
  }

  downloadBtn.disabled = true;
  setStatus(`Downloading ${selected.length} PDF(s)...`);

  for (const item of selected) {
    const resp = await fetch(
      `/api/fetch-pdf?url=${encodeURIComponent(item.url)}&name=${encodeURIComponent(
        item.name
      )}`
    );
    if (!resp.ok) {
      setStatus(`Failed to download ${item.name}.`, "error");
      continue;
    }
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${item.name}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  downloadBtn.disabled = false;
  setStatus("Download complete.", "success");
}

townSelect.addEventListener("change", loadProviders);
selectAllBtn.addEventListener("click", () => setAllCheckboxes(true));
clearAllBtn.addEventListener("click", () => setAllCheckboxes(false));
downloadBtn.addEventListener("click", downloadSelected);

loadTowns().catch(() => setStatus("Failed to initialize.", "error"));
