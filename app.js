/*
 * HQ BÁ KHÍ LIVE CONTROL V2
 * Cloudflare Worker API + public LIVE directory
 */

const CONFIG = {
  API_BASE_URL: "https://hq-ba-khi-api.hikhikhakhamunly.workers.dev",
  LIVE_API_URL: "",
  REFRESH_MS: 15000
};

const $ = id => document.getElementById(id);

let accessKey = sessionStorage.getItem("hq_access_key") || "";
let deviceId = sessionStorage.getItem("hq_device_id") || "";
let liveItems = [];

function makeDeviceId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "HQD-" + Array.from(bytes, x =>
    x.toString(16).padStart(2, "0")
  ).join("").toUpperCase();
}

if (!deviceId) {
  deviceId = makeDeviceId();
  sessionStorage.setItem("hq_device_id", deviceId);
}

if ($("deviceInput")) $("deviceInput").value = deviceId;

function message(text, type = "") {
  if (!$("gateMessage")) return;
  $("gateMessage").textContent = text;
  $("gateMessage").className = "message " + type;
}

function apiConfigured() {
  return /^https:\/\/.+/.test(CONFIG.API_BASE_URL) &&
    !CONFIG.API_BASE_URL.includes("YOUR-WORKER");
}

async function api(path, payload) {
  if (!apiConfigured()) {
    throw Error("API_BASE_URL chưa được cấu hình.");
  }

  const response = await fetch(
    CONFIG.API_BASE_URL.replace(/\/$/, "") + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw Error(data.error || `Máy chủ trả về lỗi HTTP ${response.status}.`);
  }

  return data;
}

async function activate(key) {
  return api("/api/activate", { key, deviceId });
}

function showDashboard() {
  $("gate")?.classList.add("hidden");
  $("dashboard")?.classList.remove("hidden");
  $("logoutBtn")?.classList.remove("hidden");
  loadLives();
}

if ($("keyForm")) {
  $("keyForm").addEventListener("submit", async event => {
    event.preventDefault();

    const button = $("activateBtn");
    if (button) button.disabled = true;

    message("Đang kiểm tra KEY với máy chủ…");

    try {
      const key = $("keyInput").value.trim();

      if (!key) throw Error("Vui lòng nhập KEY.");

      await activate(key);

      accessKey = key;
      sessionStorage.setItem("hq_access_key", key);

      message("KEY hợp lệ. Đang mở dashboard…", "ok");
      showDashboard();
    } catch (error) {
      message(error.message || "Không thể kết nối máy chủ.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  });
}

if ($("copyDevice")) {
  $("copyDevice").onclick = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      $("copyDevice").textContent = "ĐÃ COPY";
      setTimeout(() => $("copyDevice").textContent = "COPY", 1200);
    } catch {
      message("Không thể sao chép Device ID tự động.");
    }
  };
}

if ($("logoutBtn")) {
  $("logoutBtn").onclick = () => {
    sessionStorage.removeItem("hq_access_key");
    accessKey = "";
    location.reload();
  };
}

if ($("refreshBtn")) {
  $("refreshBtn").onclick = () => loadLives(true);
}

if ($("searchInput")) {
  $("searchInput").oninput = renderLives;
}

if ($("sourceSelect")) {
  $("sourceSelect").onchange = renderLives;
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function finiteOrNull(value) {
  return value !== null && value !== "" &&
    Number.isFinite(Number(value))
    ? Number(value)
    : null;
}

async function loadLives(showToast = false) {
  if (!$("refreshState")) return;

  $("refreshState").textContent = "Đang tải…";

  try {
    const source = CONFIG.LIVE_API_URL || "live-links.json";
    const separator = source.includes("?") ? "&" : "?";

    const response = await fetch(
      source + separator + "t=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw Error("Nguồn LIVE trả về lỗi HTTP " + response.status);
    }

    const data = await response.json();

    liveItems = Array.isArray(data)
      ? data
      : Array.isArray(data.items) ? data.items : [];

    liveItems = liveItems
      .filter(item =>
        item &&
        typeof item.url === "string" &&
        validHttpUrl(item.url)
      )
      .map((item, index) => ({
        id: String(item.id || index),
        name: String(item.name || "LIVE " + (index + 1)),
        url: item.url,
        source: String(item.source || "Nguồn công khai"),
        status: String(item.status || "Link được cung cấp"),
        chest: finiteOrNull(item.chest),
        bag: finiteOrNull(item.bag),
        updatedAt: item.updatedAt || null
      }));

    if ($("connectionLabel")) {
      $("connectionLabel").textContent = "DỮ LIỆU ĐÃ TẢI";
      $("connectionLabel").style.color = "var(--green)";
    }

    if ($("updatedAt")) {
      $("updatedAt").textContent = new Date().toLocaleTimeString(
        "vi-VN",
        { hour: "2-digit", minute: "2-digit", second: "2-digit" }
      );
    }

    $("refreshState").textContent = showToast
      ? "Đã làm mới"
      : "Tải thành công";

    const count = liveItems.filter(
      item => item.chest !== null || item.bag !== null
    ).length;

    if ($("lootCount")) $("lootCount").textContent = count || "—";

    if ($("lootHint")) {
      $("lootHint").textContent = count
        ? "LIVE có số liệu rương/túi"
        : "Nguồn chưa cung cấp số liệu rương/túi";
    }
  } catch (error) {
    liveItems = [];

    if ($("connectionLabel")) {
      $("connectionLabel").textContent = "CHƯA CÓ NGUỒN LIVE";
      $("connectionLabel").style.color = "var(--orange)";
    }

    if ($("updatedAt")) $("updatedAt").textContent = "—";
    $("refreshState").textContent = "Chưa tải được dữ liệu";

    if ($("lootCount")) $("lootCount").textContent = "—";
    if ($("lootHint")) {
      $("lootHint").textContent = "Nguồn chưa cung cấp số liệu";
    }
  }

  if ($("linkCount")) $("linkCount").textContent = liveItems.length;
  renderLives();
}

function renderLives() {
  if (!$("liveList")) return;

  const query = ($("searchInput")?.value || "").trim().toLowerCase();

  const list = liveItems.filter(item =>
    !query ||
    (item.name + " " + item.url + " " + item.source)
      .toLowerCase().includes(query)
  );

  if ($("visibleCount")) $("visibleCount").textContent = list.length;

  const root = $("liveList");
  root.replaceChildren();

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty panel";
    empty.textContent = liveItems.length
      ? "Không tìm thấy LIVE phù hợp."
      : "Chưa có nguồn LIVE. Hãy thêm link vào live-links.json.";
    root.append(empty);
    return;
  }

  for (const item of list) {
    const card = document.createElement("article");
    card.className = "live-card";

    const top = document.createElement("div");
    top.className = "live-card-top";

    const name = document.createElement("div");
    name.className = "live-name";
    name.textContent = item.name;

    const status = document.createElement("span");
    status.className = "live-state";
    status.textContent = item.status;

    top.append(name, status);
    card.append(top);

    const url = document.createElement("div");
    url.className = "live-url";
    url.textContent = item.url;
    card.append(url);

    const meta = document.createElement("div");
    meta.className = "card-meta";

    for (const [label, value] of [
      ["RƯƠNG", item.chest === null ? "Chưa có dữ liệu" : item.chest],
      ["TÚI", item.bag === null ? "Chưa có dữ liệu" : item.bag]
    ]) {
      const box = document.createElement("div");
      box.className = "meta-box";

      const small = document.createElement("small");
      small.textContent = label;

      const bold = document.createElement("b");
      bold.textContent = String(value);

      box.append(small, bold);
      meta.append(box);
    }

    card.append(meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const link = document.createElement("a");
    link.className = "open-live";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "MỞ LIVE ↗";

    const copy = document.createElement("button");
    copy.className = "copy-link";
    copy.textContent = "SAO CHÉP LINK";

    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(item.url);
        copy.textContent = "ĐÃ COPY";
        setTimeout(() => {
          copy.textContent = "SAO CHÉP LINK";
        }, 1200);
      } catch {
        copy.textContent = "KHÔNG COPY ĐƯỢC";
      }
    };

    actions.append(link, copy);
    card.append(actions);
    root.append(card);
  }
}

setInterval(() => {
  if ($("dashboard") &&
      !$("dashboard").classList.contains("hidden")) {
    loadLives();
  }
}, CONFIG.REFRESH_MS);

// Revalidate saved KEY with the server; never bypass the KEY gate.
if (accessKey && apiConfigured()) {
  activate(accessKey)
    .then(() => showDashboard())
    .catch(() => {
      sessionStorage.removeItem("hq_access_key");
      accessKey = "";
      message("Phiên KEY hết hạn hoặc không hợp lệ. Vui lòng nhập lại.");
    });
}
