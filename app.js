
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =====================================
   1. FIREBASE CONFIGURATION
===================================== */

const firebaseConfig = {
  apiKey: "AIzaSyB4bpo6md65Us-eKFDZtTQktNTMlosMwfQ",
  authDomain: "easy-earn-platform.firebaseapp.com",
  projectId: "easy-earn-platform",
  storageBucket: "easy-earn-platform.firebasestorage.app",
  messagingSenderId: "547908408028",
  appId: "1:547908408028:web:0078ab9905e36d96ad1a19"
};

/* Firebase Authentication থেকে Admin UID বসাতে হবে */
const ADMIN_UID = "PASTE_ADMIN_USER_UID";

const DEFAULT_SUPPORT = "mailto:support@example.com";

/* =====================================
   2. FIREBASE INITIALIZATION
===================================== */

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let vipSettings = [];
let availableTasks = [];
let selectedMember = null;
let toastTimer = null;

const isAdmin = () =>
  Boolean(
    currentUser &&
    ADMIN_UID !== "PASTE_ADMIN_USER_UID" &&
    currentUser.uid === ADMIN_UID
  );

const money = (value) =>
  "৳" + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function validConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY" &&
    firebaseConfig.projectId !== "PASTE_YOUR_PROJECT_ID"
  );
}

function message(id, text, type = "") {
  const element = $(id);
  if (!element) return;

  element.textContent = text;
  element.className = "form-message" + (type ? " " + type : "");
}

function toast(text) {
  const element = $("toast");

  if (!element) {
    alert(text);
    return;
  }

  element.textContent = text;
  element.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 3200);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }

    return "";
  } catch {
    return "";
  }
}

function formatDate(timestamp) {
  if (!timestamp?.seconds) return "Just now";

  return new Date(timestamp.seconds * 1000)
    .toLocaleString("en-GB");
}

function setHidden(id, hidden) {
  $(id)?.classList.toggle("hidden", hidden);
}

/* =====================================
   3. NAVIGATION
===================================== */

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.authTab;

    document.querySelectorAll("[data-auth-tab]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    setHidden("loginForm", tab !== "login");
    setHidden("registerForm", tab !== "register");
  });
});

$("menuButton")?.addEventListener("click", () => {
  $("topNav")?.classList.toggle("open");
});

document.querySelectorAll("#topNav a").forEach((link) => {
  link.addEventListener("click", () => {
    $("topNav")?.classList.remove("open");
  });
});

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    $(button.dataset.scroll)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

if ($("currentYear")) {
  $("currentYear").textContent = new Date().getFullYear();
}

if (!validConfig()) {
  message(
    "loginMessage",
    "Firebase configuration is incomplete.",
    "error"
  );
}

/* =====================================
   4. USER PROFILE
===================================== */

async function getProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));

  return snapshot.exists() ? snapshot.data() : null;
}

async function createProfile(user, name) {
  const profile = {
    uid: user.uid,
    name: name.trim(),
    email: (user.email || "").toLowerCase(),
    balance: 0,
    vip: 0,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, "users", user.uid), profile);

  return profile;
}

function renderProfile() {
  if (!currentProfile) return;

  if ($("memberName")) {
    $("memberName").textContent =
      currentProfile.name || "Member";
  }

  if ($("balanceValue")) {
    $("balanceValue").textContent =
      money(currentProfile.balance);
  }

  if ($("currentVip")) {
    $("currentVip").textContent =
      "VIP " + Number(currentProfile.vip || 0);
  }

  if ($("accountName")) {
    $("accountName").textContent =
      currentProfile.name || "—";
  }

  if ($("accountEmail")) {
    $("accountEmail").textContent =
      currentUser?.email || "—";
  }
}

async function refreshProfile() {
  if (!currentUser) return;

  currentProfile = await getProfile(currentUser.uid);

  if (currentProfile) {
    renderProfile();
  }
}

/* =====================================
   5. REGISTER
===================================== */

$("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  message("registerMessage", "");

  if (!validConfig()) {
    message(
      "registerMessage",
      "Firebase configuration is incomplete.",
      "error"
    );
    return;
  }

  const name = $("registerName")?.value.trim() || "";
  const email =
    $("registerEmail")?.value.trim().toLowerCase() || "";
  const password = $("registerPassword")?.value || "";
  const confirm = $("confirmPassword")?.value || "";

  if (!name || !email) {
    message(
      "registerMessage",
      "Enter your name and email.",
      "error"
    );
    return;
  }

  if (password.length < 6) {
    message(
      "registerMessage",
      "Password must be at least 6 characters.",
      "error"
    );
    return;
  }

  if (password !== confirm) {
    message(
      "registerMessage",
      "Passwords do not match.",
      "error"
    );
    return;
  }

  try {
    message("registerMessage", "Creating account...");

    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await createProfile(result.user, name);

    message(
      "registerMessage",
      "Account created successfully.",
      "success"
    );
  } catch (error) {
    message(
      "registerMessage",
      friendlyAuthError(error),
      "error"
    );
  }
});

/* =====================================
   6. LOGIN AND PASSWORD RESET
===================================== */

function friendlyAuthError(error) {
  const errors = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/weak-password": "Please use a stronger password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Check your internet connection.",
    "auth/operation-not-allowed": "Enable Email/Password in Firebase Authentication.",
    "auth/unauthorized-domain": "Add your website domain to Firebase authorized domains."
  };

  return errors[error.code] ||
    error.message ||
    "Something went wrong.";
}

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  message("loginMessage", "");

  if (!validConfig()) {
    message(
      "loginMessage",
      "Firebase configuration is incomplete.",
      "error"
    );
    return;
  }

  try {
    message("loginMessage", "Signing in...");

    await signInWithEmailAndPassword(
      auth,
      $("loginEmail").value.trim().toLowerCase(),
      $("loginPassword").value
    );
  } catch (error) {
    message(
      "loginMessage",
      friendlyAuthError(error),
      "error"
    );
  }
});

$("forgotPassword")?.addEventListener("click", async () => {
  const email =
    $("loginEmail")?.value.trim().toLowerCase() || "";

  if (!email) {
    message(
      "loginMessage",
      "Enter your email address first.",
      "error"
    );
    $("loginEmail")?.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    message(
      "loginMessage",
      "If the account exists, a password reset email has been sent.",
      "success"
    );
  } catch (error) {
    message(
      "loginMessage",
      friendlyAuthError(error),
      "error"
    );
  }
});

$("logoutButton")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    toast(friendlyAuthError(error));
  }
});

/* =====================================
   7. AUTH STATE
===================================== */

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  setHidden("authSection", Boolean(user));
  setHidden("appSection", !user);

  if (!user) {
    currentProfile = null;
    selectedMember = null;
    setHidden("adminSection", true);
    return;
  }

  try {
    currentProfile = await getProfile(user.uid);

    if (!currentProfile) {
      await signOut(auth);

      message(
        "loginMessage",
        "Profile not found. Register again or contact support.",
        "error"
      );

      return;
    }

    renderProfile();

    await loadSettings();
    await loadVipSettings();
    await loadTasks();
    await loadHistory();

    setHidden("adminSection", !isAdmin());

    if (isAdmin()) {
      await loadAdminRequests();
      await loadAdminSubmissions();
    }
  } catch (error) {
    console.error(error);
    toast(
      "Could not load data. Check Firebase configuration and Firestore rules."
    );
  }
});

/* =====================================
   8. COMPANY SETTINGS
===================================== */

async function loadSettings() {
  const snapshot = await getDoc(doc(db, "settings", "company"));

  if (!snapshot.exists()) {
    if ($("supportLink")) {
      $("supportLink").href = DEFAULT_SUPPORT;
    }
    return;
  }

  const settings = snapshot.data();

  if ($("aboutText")) {
    $("aboutText").textContent =
      settings.about || "Easy Earn member services portal.";
  }

  if ($("supportLink")) {
    const support = settings.support || DEFAULT_SUPPORT;

    $("supportLink").href =
      safeHttpUrl(support) ||
      (support.startsWith("mailto:") ? support : DEFAULT_SUPPORT);
  }

  const brand = document.querySelector(".brand span:last-child");

  if (brand && settings.companyName) {
    brand.textContent = settings.companyName;
  }

  if (isAdmin()) {
    if ($("adminCompanyName")) {
      $("adminCompanyName").value =
        settings.companyName || "Easy Earn";
    }

    if ($("adminSupportEmail")) {
      $("adminSupportEmail").value = settings.support || "";
    }

    if ($("adminAbout")) {
      $("adminAbout").value = settings.about || "";
    }
  }
}

$("saveSettingsButton")?.addEventListener("click", async () => {
  if (!isAdmin()) return;

  const support =
    $("adminSupportEmail")?.value.trim() || DEFAULT_SUPPORT;

  try {
    await setDoc(
      doc(db, "settings", "company"),
      {
        companyName:
          $("adminCompanyName")?.value.trim() || "Easy Earn",
        support,
        about: $("adminAbout")?.value.trim() || "",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await loadSettings();

    message(
      "settingsMessage",
      "Company settings saved.",
      "success"
    );
  } catch (error) {
    console.error(error);
    message(
      "settingsMessage",
      "Could not save settings. Check admin permissions.",
      "error"
    );
  }
});

/* =====================================
   9. VIP LEVELS 1-10
===================================== */

async function loadVipSettings() {
  const snapshot = await getDocs(collection(db, "vipLevels"));

  vipSettings = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  if (!vipSettings.length) {
    vipSettings = Array.from({ length: 10 }, (_, index) => ({
      id: String(index + 1),
      level: index + 1,
      cost: 0,
      daily: 0
    }));
  }

  vipSettings.sort(
    (a, b) => Number(a.level) - Number(b.level)
  );

  renderVipSettings();

  if (isAdmin() && $("adminVipLevel")) {
    $("adminVipLevel").value = "1";
  }
}

function renderVipSettings() {
  const grid = $("vipGrid");
  if (!grid) return;

  const currentVip = Number(currentProfile?.vip || 0);

  grid.innerHTML = vipSettings.map((vip) => {
    const level = Number(vip.level);
    const isCurrent = level === currentVip;

    return `
      <article class="vip-card ${isCurrent ? "current" : ""}">
        <h3>VIP ${level}</h3>
        <p>Upgrade: <strong>${money(vip.cost)}</strong></p>
        <p>Daily display: <strong>${money(vip.daily)}</strong></p>
        <p>${isCurrent ? "Your current level" : "Membership level"}</p>
        ${
          level > currentVip
            ? `<button class="primary-button" data-vip-request="${level}">
                Request Upgrade
               </button>`
            : ""
        }
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-vip-request]").forEach((button) => {
    button.addEventListener("click", () => {
      $("deposit")?.scrollIntoView({ behavior: "smooth" });

      toast(
        "Submit a deposit request only after checking the official payment details."
      );
    });
  });
}

$("saveVipButton")?.addEventListener("click", async () => {
  if (!isAdmin()) return;

  const level = Number($("adminVipLevel")?.value);
  const cost = Number($("adminVipCost")?.value);
  const daily = Number($("adminVipDaily")?.value);

  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 10 ||
    !Number.isFinite(cost) ||
    !Number.isFinite(daily) ||
    cost < 0 ||
    daily < 0
  ) {
    message(
      "vipMessage",
      "Enter a VIP level from 1 to 10 and valid amounts.",
      "error"
    );
    return;
  }

  try {
    await setDoc(
      doc(db, "vipLevels", String(level)),
      {
        level,
        cost,
        daily,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    message("vipMessage", "VIP level saved.", "success");

    await loadVipSettings();
  } catch (error) {
    console.error(error);
    message(
      "vipMessage",
      "Could not save VIP level. Check admin permissions.",
      "error"
    );
  }
});

/* =====================================
   10. TASKS
===================================== */

async function loadTasks() {
  const snapshot = await getDocs(collection(db, "tasks"));

  availableTasks = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  renderTasks();
}

function renderTasks() {
  const list = $("taskList");
  if (!list) return;

  const userVip = Number(currentProfile?.vip || 0);

  const eligible = availableTasks.filter((task) =>
    Number(task.requiredVip || 0) <= userVip &&
    task.active !== false
  );

  if (!eligible.length) {
    list.innerHTML =
      '<p class="muted">No tasks are available for your VIP level yet.</p>';
    return;
  }

  list.innerHTML = eligible.map((task) => `
    <article class="task-card">
      <div>
        <h3>${escapeHTML(task.title || "Member task")}</h3>
        <p>Required level: VIP ${Number(task.requiredVip || 0)}</p>
        <p>Reward display: ${money(task.reward || 0)}</p>
      </div>

      <div class="task-actions">
        <a
          class="task-open"
          href="${safeHttpUrl(task.url) || "#"}"
          target="_blank"
          rel="noopener noreferrer"
        >Open Task</a>

        <button
          class="task-submit"
          data-submit-task="${escapeHTML(task.id)}"
        >Submit Task</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-submit-task]").forEach((button) => {
    button.addEventListener("click", () => {
      submitTask(button.dataset.submitTask);
    });
  });
}

$("addTaskButton")?.addEventListener("click", async () => {
  if (!isAdmin()) return;

  message("adminTaskMessage", "");

  const title = $("adminTaskTitle")?.value.trim() || "";
  const url = safeHttpUrl(
    $("adminTaskUrl")?.value.trim() || ""
  );
  const reward = Number($("adminTaskReward")?.value || 0);
  const requiredVip = Number($("adminTaskVip")?.value || 0);

  if (
    !title ||
    !url ||
    !Number.isFinite(reward) ||
    reward < 0 ||
    !Number.isInteger(requiredVip) ||
    requiredVip < 0 ||
    requiredVip > 10
  ) {
    message(
      "adminTaskMessage",
      "Enter a title, valid HTTP(S) URL, reward and VIP level 0-10.",
      "error"
    );
    return;
  }

  try {
    await addDoc(collection(db, "tasks"), {
      title,
      url,
      reward,
      requiredVip,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    $("adminTaskTitle").value = "";
    $("adminTaskUrl").value = "";
    $("adminTaskReward").value = "";

    message(
      "adminTaskMessage",
      "Task added successfully.",
      "success"
    );

    await loadTasks();
  } catch (error) {
    console.error(error);
    message(
      "adminTaskMessage",
      "Could not add task. Check admin permissions.",
      "error"
    );
  }
});

async function submitTask(taskId) {
  if (!currentUser || !currentProfile) return;

  const task = availableTasks.find(
    (item) => item.id === taskId
  );

  if (!task || task.active === false) {
    toast("Task is not available.");
    return;
  }

  if (
    Number(task.requiredVip || 0) >
    Number(currentProfile.vip || 0)
  ) {
    toast("Your VIP level is not high enough for this task.");
    return;
  }

  try {
    const existing = await getDocs(query(
      collection(db, "taskSubmissions"),
      where("uid", "==", currentUser.uid),
      where("taskId", "==", taskId),
      where("status", "==", "pending")
    ));

    if (!existing.empty) {
      toast("You already have a pending submission for this task.");
      return;
    }

    await addDoc(collection(db, "taskSubmissions"), {
      uid: currentUser.uid,
      email: currentUser.email,
      taskId,
      taskTitle: task.title || "Member task",
      vip: Number(currentProfile.vip || 0),
      reward: Number(task.reward || 0),
      status: "pending",
      createdAt: serverTimestamp()
    });

    toast("Task submitted for administrator review.");

    await loadHistory();

    if (isAdmin()) {
      await loadAdminSubmissions();
    }
  } catch (error) {
    console.error(error);
    toast("Could not submit task. Check Firestore rules.");
  }
}

/* =====================================
   11. TASK HISTORY
===================================== */

async function loadHistory() {
  if (!currentUser) return;

  const body = $("historyTable");
  if (!body) return;

  const snapshot = await getDocs(query(
    collection(db, "taskSubmissions"),
    where("uid", "==", currentUser.uid)
  ));

  const records = snapshot.docs.map(
    (item) => item.data()
  );

  records.sort((a, b) =>
    (b.createdAt?.seconds || 0) -
    (a.createdAt?.seconds || 0)
  );

  if ($("completedTasks")) {
    $("completedTasks").textContent = records.filter(
      (item) => item.status === "approved"
    ).length;
  }

  if (!records.length) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty-state">No task history available.</td></tr>';
    return;
  }

  body.innerHTML = records.map((item) => `
    <tr>
      <td>${escapeHTML(item.taskTitle || "Task")}</td>
      <td>VIP ${Number(item.vip || 0)}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td><span class="status-badge">${escapeHTML(item.status || "pending")}</span></td>
    </tr>
  `).join("");
}

/* =====================================
   12. DEPOSIT REQUEST
===================================== */

$("depositButton")?.addEventListener("click", async () => {
  if (!currentUser) return;

  message("depositMessage", "");

  const amount = Number($("depositAmount")?.value);
  const method = $("depositMethod")?.value || "";
  const reference =
    $("depositReference")?.value.trim() || "";

  if (!Number.isFinite(amount) || amount <= 0) {
    message(
      "depositMessage",
      "Enter a valid amount.",
      "error"
    );
    return;
  }

  if (!method || !reference) {
    message(
      "depositMessage",
      "Select a payment method and enter the transaction reference.",
      "error"
    );
    return;
  }

  try {
    await addDoc(collection(db, "paymentRequests"), {
      uid: currentUser.uid,
      email: currentUser.email,
      type: "deposit",
      amount,
      method,
      reference,
      status: "pending",
      createdAt: serverTimestamp()
    });

    message(
      "depositMessage",
      "Deposit request submitted for review. Keep your transaction receipt.",
      "success"
    );

    $("depositAmount").value = "";
    $("depositReference").value = "";

    if (isAdmin()) await loadAdminRequests();
  } catch (error) {
    console.error(error);
    message(
      "depositMessage",
      "Request failed. Check Firestore rules.",
      "error"
    );
  }
});

/* =====================================
   13. WITHDRAWAL REQUEST
===================================== */

$("withdrawButton")?.addEventListener("click", async () => {
  if (!currentUser || !currentProfile) return;

  message("withdrawMessage", "");

  const amount = Number($("withdrawAmount")?.value);
  const payoutAccount =
    $("withdrawAccount")?.value.trim() || "";
  const password = $("withdrawPassword")?.value || "";
  const method = $("withdrawMethod")?.value || "";

  if (!Number.isFinite(amount) || amount < 50) {
    message(
      "withdrawMessage",
      "Minimum withdrawal request is ৳50.",
      "error"
    );
    return;
  }

  if (amount > Number(currentProfile.balance || 0)) {
    message(
      "withdrawMessage",
      "Insufficient displayed balance.",
      "error"
    );
    return;
  }

  if (!payoutAccount || !password || !method) {
    message(
      "withdrawMessage",
      "Enter payout method, account details and password.",
      "error"
    );
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(
      currentUser.email,
      password
    );

    await reauthenticateWithCredential(
      currentUser,
      credential
    );

    await addDoc(collection(db, "paymentRequests"), {
      uid: currentUser.uid,
      email: currentUser.email,
      type: "withdrawal",
      amount,
      method,
      payoutAccount,
      status: "pending",
      createdAt: serverTimestamp()
    });

    message(
      "withdrawMessage",
      "Withdrawal request submitted for review.",
      "success"
    );

    $("withdrawAmount").value = "";
    $("withdrawAccount").value = "";
    $("withdrawPassword").value = "";

    if (isAdmin()) await loadAdminRequests();
  } catch (error) {
    console.error(error);
    message(
      "withdrawMessage",
      friendlyAuthError(error),
      "error"
    );
  }
});

/* =====================================
   14. CHANGE PASSWORD
===================================== */

$("changePasswordButton")?.addEventListener("click", async () => {
  if (!currentUser) return;

  message("passwordMessage", "");

  const newPassword = $("newPassword")?.value || "";

  if (newPassword.length < 6) {
    message(
      "passwordMessage",
      "Password must be at least 6 characters.",
      "error"
    );
    return;
  }

  try {
    await updatePassword(currentUser, newPassword);

    $("newPassword").value = "";

    message(
      "passwordMessage",
      "Password updated successfully.",
      "success"
    );
  } catch (error) {
    console.error(error);

    message(
      "passwordMessage",
      "Please log in again and retry changing your password.",
      "error"
    );
  }
});

/* =====================================
   15. ADMIN: FIND MEMBER
===================================== */

$("findMemberButton")?.addEventListener("click", async () => {
  if (!isAdmin()) return;

  message("memberMessage", "");

  const email =
    $("adminMemberEmail")?.value.trim().toLowerCase() || "";

  if (!email) {
    message(
      "memberMessage",
      "Enter the member email.",
      "error"
    );
    return;
  }

  try {
    const snapshot = await getDocs(query(
      collection(db, "users"),
      where("email", "==", email)
    ));

    if (snapshot.empty) {
      selectedMember = null;

      message(
        "memberMessage",
        "Member not found. Check the email address.",
        "error"
      );

      return;
    }

    const memberDoc = snapshot.docs[0];

    selectedMember = {
      id: memberDoc.id,
      ...memberDoc.data()
    };

    $("adminMemberBalance").value =
      Number(selectedMember.balance || 0);

    $("adminMemberVip").value =
      String(Number(selectedMember.vip || 0));

    message(
      "memberMessage",
      "Member loaded.",
      "success"
    );
  } catch (error) {
    console.error(error);
    message(
      "memberMessage",
      "Could not search members.",
      "error"
    );
  }
});

/* =====================================
   16. ADMIN: EDIT MEMBER
===================================== */

$("saveMemberButton")?.addEventListener("click", async () => {
  if (!isAdmin()) return;

  if (!selectedMember) {
    message(
      "memberMessage",
      "Find a member first.",
      "error"
    );
    return;
  }

  const balance = Number($("adminMemberBalance")?.value);
  const vip = Number($("adminMemberVip")?.value);

  if (!Number.isFinite(balance) || balance < 0) {
    message(
      "memberMessage",
      "Balance cannot be negative.",
      "error"
    );
    return;
  }

  if (!Number.isInteger(vip) || vip < 0 || vip > 10) {
    message(
      "memberMessage",
      "VIP must be between 0 and 10.",
      "error"
    );
    return;
  }

  try {
    await updateDoc(
      doc(db, "users", selectedMember.id),
      {
        balance,
        vip,
        updatedAt: serverTimestamp()
      }
    );

    message(
      "memberMessage",
      "Member settings updated.",
      "success"
    );

    if (selectedMember.id === currentUser.uid) {
      await refreshProfile();
      renderVipSettings();
      renderTasks();
    }
  } catch (error) {
    console.error(error);
    message(
      "memberMessage",
      "Could not update member. Check admin rules.",
      "error"
    );
  }
});

/* =====================================
   17. ADMIN: PAYMENT REQUESTS
===================================== */

async function loadAdminRequests() {
  if (!isAdmin()) return;

  const container = $("adminRequestsList");
  if (!container) return;

  const snapshot = await getDocs(
    collection(db, "paymentRequests")
  );

  const requests = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  requests.sort((a, b) =>
    (b.createdAt?.seconds || 0) -
    (a.createdAt?.seconds || 0)
  );

  if (!requests.length) {
    container.innerHTML =
      '<p class="muted">No payment requests yet.</p>';
    return;
  }

  container.innerHTML = requests.map((item) => `
    <div class="request-row">
      <div>
        <strong>
          ${escapeHTML(item.type || "request")} — ${money(item.amount)}
        </strong>
        <p>${escapeHTML(item.email || "")} · ${escapeHTML(item.method || "")}</p>
        <p>Status: ${escapeHTML(item.status || "pending")}</p>
        <p>${escapeHTML(item.reference || item.payoutAccount || "")}</p>
      </div>

      ${
        item.status === "pending"
          ? `<div class="request-actions">
              <button class="approve"
                data-request-action="approve"
                data-request-id="${escapeHTML(item.id)}">Approve</button>
              <button class="reject"
                data-request-action="reject"
                data-request-id="${escapeHTML(item.id)}">Reject</button>
            </div>`
          : ""
      }
    </div>
  `).join("");

  container.querySelectorAll("[data-request-action]").forEach((button) => {
    button.addEventListener("click", () => {
      reviewPaymentRequest(
        button.dataset.requestId,
        button.dataset.requestAction
      );
    });
  });
}

async function reviewPaymentRequest(requestId, action) {
  if (!isAdmin()) return;
  if (!["approve", "reject"].includes(action)) return;

  const requestRef = doc(db, "paymentRequests", requestId);

  try {
    const requestSnapshot = await getDoc(requestRef);

    if (!requestSnapshot.exists()) {
      toast("Request not found.");
      return;
    }

    const request = requestSnapshot.data();

    if (request.status !== "pending") {
      toast("This request has already been reviewed.");
      await loadAdminRequests();
      return;
    }

    if (action === "approve") {
      const memberRef = doc(db, "users", request.uid);
      const memberSnapshot = await getDoc(memberRef);

      if (!memberSnapshot.exists()) {
        throw new Error("Member profile missing.");
      }

      const balance = Number(
        memberSnapshot.data().balance || 0
      );
      const amount = Number(request.amount || 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid request amount.");
      }

      if (request.type === "deposit") {
        await updateDoc(memberRef, {
          balance: balance + amount,
          updatedAt: serverTimestamp()
        });
      } else if (request.type === "withdrawal") {
        if (amount > balance) {
          throw new Error(
            "Insufficient balance for withdrawal approval."
          );
        }

        await updateDoc(memberRef, {
          balance: balance - amount,
          updatedAt: serverTimestamp()
        });
      } else {
        throw new Error("Unknown payment request type.");
      }
    }

    await updateDoc(requestRef, {
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser.uid
    });

    toast("Payment request updated.");

    await loadAdminRequests();

    if (request.uid === currentUser.uid) {
      await refreshProfile();
    }
  } catch (error) {
    console.error(error);
    toast(
      "Review failed. Verify payment and check Firestore rules."
    );
  }
}

/* =====================================
   18. ADMIN: TASK SUBMISSIONS
===================================== */

async function loadAdminSubmissions() {
  if (!isAdmin()) return;

  const container = $("adminSubmissionsList");
  if (!container) return;

  const snapshot = await getDocs(
    collection(db, "taskSubmissions")
  );

  const submissions = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  submissions.sort((a, b) =>
    (b.createdAt?.seconds || 0) -
    (a.createdAt?.seconds || 0)
  );

  if (!submissions.length) {
    container.innerHTML =
      '<p class="muted">No task submissions yet.</p>';
    return;
  }

  container.innerHTML = submissions.map((item) => `
    <div class="request-row">
      <div>
        <strong>${escapeHTML(item.taskTitle || "Task")}</strong>
        <p>${escapeHTML(item.email || "")} · VIP ${Number(item.vip || 0)}</p>
        <p>
          Reward display: ${money(item.reward)} ·
          Status: ${escapeHTML(item.status || "pending")}
        </p>
      </div>

      ${
        item.status === "pending"
          ? `<div class="request-actions">
              <button class="approve"
                data-submission-action="approve"
                data-submission-id="${escapeHTML(item.id)}">Approve</button>
              <button class="reject"
                data-submission-action="reject"
                data-submission-id="${escapeHTML(item.id)}">Reject</button>
            </div>`
          : ""
      }
    </div>
  `).join("");

  container.querySelectorAll("[data-submission-action]").forEach((button) => {
    button.addEventListener("click", () => {
      reviewSubmission(
        button.dataset.submissionId,
        button.dataset.submissionAction
      );
    });
  });
}

async function reviewSubmission(submissionId, action) {
  if (!isAdmin()) return;
  if (!["approve", "reject"].includes(action)) return;

  try {
    const submissionRef = doc(
      db,
      "taskSubmissions",
      submissionId
    );

    const snapshot = await getDoc(submissionRef);

    if (!snapshot.exists()) {
      toast("Submission not found.");
      return;
    }

    const submission = snapshot.data();

    if (submission.status !== "pending") {
      toast("This submission has already been reviewed.");
      await loadAdminSubmissions();
      return;
    }

    if (action === "approve") {
      const taskSnapshot = await getDoc(
        doc(db, "tasks", submission.taskId)
      );

      if (!taskSnapshot.exists()) {
        throw new Error("Task no longer exists.");
      }

      const task = taskSnapshot.data();

      if (task.active === false) {
        throw new Error("This task is inactive.");
      }

      const userRef = doc(db, "users", submission.uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        throw new Error("Member profile missing.");
      }

      const reward = Number(task.reward || 0);

      if (!Number.isFinite(reward) || reward < 0) {
        throw new Error("Invalid task reward.");
      }

      const balance = Number(
        userSnapshot.data().balance || 0
      );

      await updateDoc(userRef, {
        balance: balance + reward,
        updatedAt: serverTimestamp()
      });
    }

    await updateDoc(submissionRef, {
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser.uid
    });

    toast("Task submission reviewed.");

    await loadAdminSubmissions();
    await loadHistory();

    if (submission.uid === currentUser.uid) {
      await refreshProfile();
    }
  } catch (error) {
    console.error(error);
    toast(
      "Could not review submission. Check Firestore permissions."
    );
  }
}
