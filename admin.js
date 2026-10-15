
/* HQ BÁ KHÍ — QUẢN TRỊ KEY */

const ADMIN = {
  API_BASE_URL: "https://hq-ba-khi-api.hikhikhakhamunly.workers.dev"
};

const $ = id => document.getElementById(id);
let token = sessionStorage.getItem("hq_admin_token") || "";
let keys = [];

async function api(path, body = {}) {
  const response = await fetch(
    ADMIN.API_BASE_URL.replace(/\/$/, "") + path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {})
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Không thể kết nối máy chủ.");
  }

  return data;
}

function say(message, error = false) {
  const el = $("msg");
  if (el) {
    el.textContent = message;
    el.style.color = error ? "#ff5c75" : "#38e8a5";
  }
}

function getState(key) {
  if (key.status !== "active") return key.status || "unknown";

  if (key.expiresAt && Date.parse(key.expiresAt) < Date.now()) {
    return "expired";
  }

  return "active";
}

const stateNames = {
  active: "ĐANG HOẠT ĐỘNG",
  disabled: "ĐÃ KHÓA",
  revoked: "ĐÃ THU HỒI",
  expired: "ĐÃ HẾT HẠN",
  unknown: "KHÔNG XÁC ĐỊNH"
};

function cell(row, value) {
  const td = document.createElement("td");
  td.textContent = value;
  row.appendChild(td);
  return td;
}

function render() {
  const query = $("search").value.trim().toLowerCase();
  const filter = $("filter").value;

  const shown = keys.filter(key => {
    const state = getState(key);
    const text = `${key.key || ""} ${key.label || ""}`.toLowerCase();

    return (!query || text.includes(query)) &&
      (filter === "all" || state === filter);
  });

  $("total").textContent = keys.length;
  $("active").textContent =
    keys.filter(key => getState(key) === "active").length;
  $("inactive").textContent =
    keys.filter(key => getState(key) !== "active").length;

  const root = $("rows");
  root.replaceChildren();

  if (!shown.length) {
    const row = document.createElement("tr");
    const td = cell(row, "Chưa có key phù hợp.");
    td.colSpan = 6;
    root.appendChild(row);
    return;
  }

  for (const key of shown) {
    const row = document.createElement("tr");
    const state = getState(key);

    const keyCell = cell(row, "");
    const code = document.createElement("code");
    code.textContent = key.key || "Không có mã";
    keyCell.appendChild(code);

    cell(row, key.label || "—");

    const stateCell = cell(row, stateNames[state] || state);
    stateCell.className = "state " + state;

    cell(
      row,
      key.expiresAt
        ? new Date(key.expiresAt).toLocaleString("vi-VN")
        : "Không hết hạn"
    );

    cell(row, key.deviceId || "Chưa kích hoạt");

    const actionCell = cell(row, "");
    const actions = document.createElement("div");
    actions.className = "actions";

    if (state === "active" || state === "disabled") {
      const toggle = document.createElement("button");
      toggle.className = "ghost";
      toggle.textContent = state === "active" ? "KHÓA" : "MỞ KHÓA";

      toggle.onclick = async () => {
        toggle.disabled = true;

        try {
          await api("/api/admin/status", {
            key: key.key,
            status: state === "active" ? "disabled" : "active"
          });
          await loadKeys();
          say("Đã cập nhật trạng thái key.");
        } catch (error) {
          say("Lỗi: " + error.message, true);
          toggle.disabled = false;
        }
      };

      actions.appendChild(toggle);

      const revoke = document.createElement("button");
      revoke.className = "ghost";
      revoke.textContent = "THU HỒI";

      revoke.onclick = async () => {
        if (!confirm("Bạn có chắc muốn thu hồi key này?")) return;

        revoke.disabled = true;

        try {
          await api("/api/admin/status", {
            key: key.key,
            status: "revoked"
          });
          await loadKeys();
          say("Đã thu hồi key.");
        } catch (error) {
          say("Lỗi: " + error.message, true);
          revoke.disabled = false;
        }
      };

      actions.appendChild(revoke);
    } else {
      actions.textContent = "Không có thao tác";
    }

    actionCell.appendChild(actions);
    root.appendChild(row);
  }
}

async function loadKeys() {
  $("apiStatus").textContent = "ĐANG KẾT NỐI API...";
  const data = await api("/api/admin/list");

  keys = Array.isArray(data.keys) ? data.keys : [];
  $("apiStatus").textContent = "API ĐÃ KẾT NỐI";
  render();
}

function showDashboard() {
  $("login").classList.add("hidden");
  $("dash").classList.remove("hidden");
}

function showLogin() {
  $("dash").classList.add("hidden");
  $("login").classList.remove("hidden");
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("loginForm").querySelector("button");
  button.disabled = true;
  say("Đang đăng nhập...");

  try {
    const data = await api("/api/admin/login", {
      password: $("password").value
    });

    if (!data.token) {
      throw new Error("Máy chủ không trả về mã đăng nhập.");
    }

    token = data.token;
    sessionStorage.setItem("hq_admin_token", token);

    await loadKeys();
    showDashboard();
    say("Đăng nhập thành công!");
  } catch (error) {
    token = "";
    sessionStorage.removeItem("hq_admin_token");
    $("apiStatus").textContent = "API CHƯA KẾT NỐI";
    showLogin();
    say("Đăng nhập thất bại: " + error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("create").addEventListener("click", async () => {
  const button = $("create");
  button.disabled = true;
  $("created").classList.add("hidden");

  try {
    const data = await api("/api/admin/create", {
      label: $("label").value.trim(),
      days: Number($("days").value),
      count: Number($("count").value)
    });

    const output = $("created");
    const createdKeys = Array.isArray(data.keys) ? data.keys : [];

    output.textContent = createdKeys.map(item =>
      typeof item === "string" ? item : item.key || JSON.stringify(item)
    ).join("\n") || "Máy chủ không trả về key.";

    output.classList.remove("hidden");

    await loadKeys();
    say("Đã tạo key thành công.");
  } catch (error) {
    say("Tạo key thất bại: " + error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("refresh").addEventListener("click", async () => {
  try {
    await loadKeys();
    say("Đã làm mới danh sách key.");
  } catch (error) {
    say("Không thể tải danh sách: " + error.message, true);
  }
});

$("search").addEventListener("input", render);
$("filter").addEventListener("change", render);

$("logout").addEventListener("click", () => {
  token = "";
  keys = [];
  sessionStorage.removeItem("hq_admin_token");
  $("password").value = "";
  $("rows").replaceChildren();
  $("created").classList.add("hidden");
  $("apiStatus").textContent = "ĐÃ ĐĂNG XUẤT";
  showLogin();
  say("Bạn đã đăng xuất.");
});

if (token) {
  loadKeys()
    .then(() => {
      showDashboard();
      say("Đã khôi phục phiên quản trị.");
    })
    .catch(error => {
      token = "";
      sessionStorage.removeItem("hq_admin_token");
      showLogin();
      $("apiStatus").textContent = "API CHƯA KẾT NỐI";
      say("Không tải được dữ liệu: " + error.message, true);
    });
} else {
  showLogin();
  $("apiStatus").textContent = "SẴN SÀNG ĐĂNG NHẬP";
  say("Nhập mật khẩu quản trị để tiếp tục.");
}
