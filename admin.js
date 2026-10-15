/* HQ BÁ KHÍ ADMIN CONTROL V2 */

const CONFIG = {
  API_BASE_URL: "https://hq-ba-khi-api.hikhikhakhamunly.workers.dev"
};

const $ = id => document.getElementById(id);
let adminToken = sessionStorage.getItem("hq_admin_token") || "";
let keys = [];

async function api(path, payload = {}) {
  const response = await fetch(
    CONFIG.API_BASE_URL.replace(/\/$/, "") + path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminToken ? { Authorization: "Bearer " + adminToken } : {})
      },
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    if (response.status === 401 && path !== "/api/admin/login") {
      adminToken = "";
      sessionStorage.removeItem("hq_admin_token");
    }
    throw new Error(data.error || "Lỗi kết nối máy chủ.");
  }

  return data;
}

function showMessage(text, error = false) {
  const el = $("message") || $("adminMessage") || $("statusMessage");
  if (el) {
    el.textContent = text;
    el.style.color = error ? "#ff5c75" : "#38e8a5";
  } else {
    alert(text);
  }
}

function showPanel(loggedIn) {
  const login = $("loginPanel") || $("loginForm");
  const panel = $("adminPanel") || $("dashboard");

  if (login) login.classList.toggle("hidden", loggedIn);
  if (panel) panel.classList.toggle("hidden", !loggedIn);
}

async function login(password) {
  const result = await api("/api/admin/login", { password });
  adminToken = result.token;
  sessionStorage.setItem("hq_admin_token", adminToken);
  showPanel(true);
  await loadKeys();
}

const loginForm = $("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const password =
      $("adminPassword")?.value ||
      $("password")?.value ||
      $("passwordInput")?.value ||
      "";

    if (!password) {
      showMessage("Vui lòng nhập mật khẩu admin.", true);
      return;
    }

    try {
      showMessage("Đang đăng nhập...");
      await login(password);
      showMessage("Đăng nhập thành công.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}

const createForm = $("createForm");
if (createForm) {
  createForm.addEventListener("submit", async event => {
    event.preventDefault();

    try {
      const count = Number($("keyCount")?.value || 1);
      const days = Number($("keyDays")?.value || 0);
      const label = $("keyLabel")?.value || "";

      const result = await api("/api/admin/create", {
        count,
        days,
        label
      });

      showMessage("Đã tạo " + result.keys.length + " KEY.");
      const output = $("createdKeys") || $("keyOutput");

      if (output) output.textContent = result.keys.join("\n");
      await loadKeys();
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}

async function loadKeys() {
  const result = await api("/api/admin/list");
  keys = result.keys || [];
  renderKeys();
}

function renderKeys() {
  const root = $("keysList") || $("keyList") || $("keysTableBody");
  if (!root) return;

  root.replaceChildren();

  if (!keys.length) {
    const row = document.createElement("div");
    row.textContent = "Chưa có KEY nào.";
    root.append(row);
    return;
  }

  for (const key of keys) {
    const row = document.createElement("div");
    row.className = "key-row";

    const info = document.createElement("span");
    info.textContent =
      key.key + " | " + key.status +
      " | " + (key.expiresAt || "Không hết hạn") +
      " | " + (key.deviceId || "Chưa gắn thiết bị");

    const copy = document.createElement("button");
    copy.textContent = "Sao chép";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(key.key);
        showMessage("Đã sao chép KEY.");
      } catch {
        showMessage("Không sao chép được KEY.", true);
      }
    });

    const toggle = document.createElement("button");
    toggle.textContent = key.status === "active" ? "Khóa KEY" : "Mở KEY";
    toggle.addEventListener("click", async () => {
      try {
        const status = key.status === "active" ? "disabled" : "active";
        await api("/api/admin/status", { key: key.key, status });
        showMessage("Đã cập nhật trạng thái KEY.");
        await loadKeys();
      } catch (error) {
        showMessage(error.message, true);
      }
    });

    row.append(info, copy, toggle);
    root.append(row);
  }
}

const refreshButton = $("refreshKeys") || $("reloadKeys");
if (refreshButton) {
  refreshButton.addEventListener("click", async () => {
    try {
      await loadKeys();
      showMessage("Đã tải danh sách KEY.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}

const logoutButton = $("logoutBtn") || $("logoutButton");
if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    adminToken = "";
    sessionStorage.removeItem("hq_admin_token");
    showPanel(false);
    showMessage("Đã đăng xuất.");
  });
}

if (adminToken) {
  api("/api/admin/list")
    .then(result => {
      keys = result.keys || [];
      showPanel(true);
      renderKeys();
    })
    .catch(() => {
      adminToken = "";
      sessionStorage.removeItem("hq_admin_token");
      showPanel(false);
    });
}
