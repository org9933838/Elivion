
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
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
  IMPORTANT:
  Replace the values below with your Firebase Web App configuration.
  Firebase Console > Project settings > Your apps > SDK setup.
*/
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// After creating your admin account, paste its Firebase Authentication UID here.
const ADMIN_UID = "PASTE_ADMIN_USER_UID";

// Add your actual support email or official support URL.
const DEFAULT_SUPPORT = "mailto:support@example.com";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let vipSettings = [];
let availableTasks = [];
let selectedMember = null;
let toastTimer;

const money = (value) =>
  "৳" + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function message(id, text, type = "") {
  const element = $(id);
  if (!element) return;
  element.textContent = text;
  element.className = "form-message" + (type ? " " + type : "");
}

function toast(text) {
  const element = $("toast");
  if (!element) return;
  element.textContent = text;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
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

function validConfig() {
  return firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY" &&
    firebaseConfig.projectId !== "PASTE_YOUR_PROJECT_ID" &&
    ADMIN_UID !== "PASTE_ADMIN_USER_UID";
}

function showAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === tab);
  });
  $("loginForm")?.classList.toggle("hidden", tab !== "login");
  $("registerForm")?.classList.toggle("hidden", tab !== "register");
}

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => showAuthTab(button.dataset.authTab));
});

$("menuButton")?.addEventListener("click", () => {
  $("topNav")?.classList.toggle("open");
});

document.querySelectorAll("#topNav a").forEach((link) => {
  link.addEventListener("click", () => $("topNav")?.classList.remove("open"));
});

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    const section = $(button.dataset.scroll);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

$("currentYear").textContent = new Date().getFullYear();

if (!validConfig()) {
  message(
    "loginMessage",
    "Setup required: add your Firebase configuration and admin UID in app.js before using the site.",
    "error"
  );
}

async function getProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

async function createProfile(user, name) {
  const profile = {
    uid: user.uid,
    name: name.trim(),
    email: user.email,
    balance: 0,
    vip: 0,
    createdAt: serverTimestamp()
  };
  await setDoc(doc(db, "users", user.uid), profile);
  return profile;
}

$("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  message("registerMessage", "");

  if (!validConfig()) {
    message("registerMessage", "Please complete Firebase setup first.", "error");
    return;
  }

  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;
  const confirm = $("confirmPassword").value;

  if (password !== confirm) {
    message("registerMessage", "Passwords do not match.", "error");
    return;
  }

  try {
    message("registerMessage", "Creating your account...");
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createProfile(result.user, name);
    message("registerMessage", "Account created successfully.", "success");
  } catch (error) {
    message("registerMessage", error.message, "error");
  }
});

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  message("loginMessage", "");

  if (!validConfig()) {
    message("loginMessage", "Please complete Firebase setup first.", "error");
    return;
  }

  try {
    message("loginMessage", "Signing in...");
    await signInWithEmailAndPassword(
      auth,
      $("loginEmail").value.trim(),
      $("loginPassword").value
    );
    message("loginMessage", "Login successful.", "success");
  } catch (error) {
    message("loginMessage", friendlyAuthError(error), "error");
  }
});

function friendlyAuthError(error) {
  const errors = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/weak-password": "Please use a stronger password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please try again later."
  };
  return errors[error.code] || error.message || "Something went wrong.";
}

$("forgotPassword")?.addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  if (!email) {
    message("loginMessage", "Enter your email address first.", "error");
    $("loginEmail").focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    message("loginMessage", "If the account exists, a password reset email has been sent.", "success");
  } catch (error) {
    message("loginMessage", friendlyAuthError(error), "error");
  }
});

$("logoutButton")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    toast(error.message);
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  $("authSection").classList.toggle("hidden", Boolean(user));
  $("appSection").classList.toggle("hidden", !user);

  if (!user) {
    currentProfile = null;
    selectedMember = null;
    return;
  }

  try {
    currentProfile = await getProfile(user.uid);

    if (!currentProfile) {
      await signOut(auth);
      message("loginMessage", "Account profile not found. Please register again or contact support.", "error");
      return;
    }

    renderProfile();
    await loadSettings();
    await loadVipSettings();
    await loadTasks();
    await loadHistory();

    const isAdmin = user.uid === ADMIN_UID;
    $("adminSection").classList.toggle("hidden", !isAdmin);

    if (isAdmin) {
      await loadAdminRequests();
      await loadAdminSubmissions();
    }
  } catch (error) {
    console.error(error);
    toast("Could not load account data. Check Firebase setup and Firestore rules.");
  }
});

function renderProfile() {
  if (!currentProfile) return;
  $("memberName").textContent = currentProfile.name || "Member";
  $("balanceValue").textContent = money(currentProfile.balance);
  $("currentVip").textContent = "VIP " + Number(currentProfile.vip || 0);
  $("accountName").textContent = currentProfile.name || "—";
  $("accountEmail").textContent = currentUser?.email || "—";
}

async function loadSettings() {
  const snapshot = await getDoc(doc(db, "settings", "company"));
  if (!snapshot.exists()) {
    $("supportLink").href = DEFAULT_SUPPORT;
    return;
  }

  const settings = snapshot.data();
  $("aboutText").textContent = settings.about || "Easy Earn member services portal.";
  $("supportLink").href = settings.support || DEFAULT_SUPPORT;
  const brand = document.querySelector(".brand span:last-child");
  if (brand && settings.companyName) {
    brand.innerHTML = escapeHTML(settings.companyName);
  }
}

async function loadVipSettings() {
  const snapshot = await getDocs(collection(db, "vipLevels"));
  vipSettings = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  if (!vipSettings.length) {
    vipSettings = Array.from({ length: 10 }, (_, index) => ({
      id: String(index + 1),
      level: index + 1,
      cost: 0,
      daily: 0
    }));
  }

  renderVipSettings();
}

function renderVipSettings() {
  const grid = $("vipGrid");
  const currentVip = Number(currentProfile?.vip || 0);

  grid.innerHTML = vipSettings
    .sort((a, b) => Number(a.level) - Number(b.level))
    .map((vip) => {
      const level = Number(vip.level);
      const isCurrent = level === currentVip;
      return `
        <article class="vip-card ${isCurrent ? "current" : ""}">
          <h3>VIP ${level}</h3>
          <p>Upgrade: <strong>${money(vip.cost)}</strong></p>
          <p>Daily display: <strong>${money(vip.daily)}</strong></p>
          <p>${isCurrent ? "Your current level" : level < currentVip ? "Previous level" : "Membership level"}</p>
          ${level > currentVip ? `<button class="primary-button" data-vip-request="${level}">Request Upgrade</button>` : ""}
        </article>`;
    }).join("");

  grid.querySelectorAll("[data-vip-request]").forEach((button) => {
    button.addEventListener("click", () => {
      $("deposit").scrollIntoView({ behavior: "smooth" });
      toast("Contact customer service and request verification before any VIP upgrade payment.");
    });
  });
}

async function loadTasks() {
  const snapshot = await getDocs(collection(db, "tasks"));
  availableTasks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderTasks();
}

function renderTasks() {
  const list = $("taskList");
  const userVip = Number(currentProfile?.vip || 0);
  const eligible = availableTasks.filter((task) =>
    Number(task.requiredVip || 0) <= userVip && task.active !== false
  );

  if (!eligible.length) {
    list.innerHTML = '<p class="muted">No tasks are available for your VIP level yet.</p>';
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
        <a class="task-open" href="${safeHttpUrl(task.url) || "#"}" target="_blank" rel="noopener noreferrer">Open Task</a>
        <button class="task-submit" data-submit-task="${escapeHTML(task.id)}">Submit Task</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-submit-task]").forEach((button) => {
    button.addEventListener("click", () => submitTask(button.dataset.submitTask));
  });
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

async function submitTask(taskId) {
  if (!currentUser) return;

  const task = availableTasks.find((item) => item.id === taskId);
  if (!task) return;

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
    if (currentUser.uid === ADMIN_UID) await loadAdminSubmissions();
  } catch (error) {
    console.error(error);
    toast("Could not submit task. Check Firestore permissions.");
  }
}

async function loadHistory() {
  const body = $("historyTable");
  const snapshot = await getDocs(query(
    collection(db, "taskSubmissions"),
    where("uid", "==", currentUser.uid)
  ));

  const records = snapshot.docs.map((item) => item.data());
  records.sort((a, b) => {
    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;
    return timeB - timeA;
  });

  $("completedTasks").textContent = records.filter((item) => item.status === "approved").length;

  if (!records.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty-state">No task history available.</td></tr>';
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

function formatDate(timestamp) {
  if (!timestamp?.seconds) return "Just now";
  return new Date(timestamp.seconds * 1000).toLocaleDateString("en-GB");
}

$("depositButton")?.addEventListener("click", async () => {
  message("depositMessage", "");

  const amount = Number($("depositAmount").value);
  if (!Number.isFinite(amount) || amount <= 0) {
    message("depositMessage", "Enter a valid deposit amount.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "paymentRequests"), {
      uid: currentUser.uid,
      email: currentUser.email,
      type: "deposit",
      amount,
      method: $("depositMethod").value,
      reference: $("depositReference").value.trim(),
      status: "pending",
      createdAt: serverTimestamp()
    });

    message("depositMessage", "Request submitted. Contact customer service and keep your transaction receipt.", "success");
    $("depositAmount").value = "";
    $("depositReference").value = "";
    if (currentUser.uid === ADMIN_UID) await loadAdminRequests();
  } catch (error) {
    message("depositMessage", "Request failed. Check Firestore permissions.", "error");
  }
});

$("withdrawButton")?.addEventListener("click", async () => {
  message("withdrawMessage", "");

  const amount = Number($("withdrawAmount").value);
  const payoutAccount = $("withdrawAccount").value.trim();
  const password = $("withdrawPassword").value;

  if (!Number.isFinite(amount) || amount < 50) {
    message("withdrawMessage", "Minimum withdrawal request is 50 BDT.", "error");
    return;
  }

  if (!payoutAccount || !password) {
    message("withdrawMessage", "Enter payout details and your password.", "error");
    return;
  }

  if (amount > Number(currentProfile?.balance || 0)) {
    message("withdrawMessage", "Insufficient available balance.", "error");
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    await addDoc(collection(db, "paymentRequests"), {
      uid: currentUser.uid,
      email: currentUser.email,
      type: "withdrawal",
      amount,
      method: $("withdrawMethod").value,
      payoutAccount,
      status: "pending",
      createdAt: serverTimestamp()
    });

    message("withdrawMessage", "Withdrawal request submitted for review.", "success");
    $("withdrawAmount").value = "";
    $("withdrawAccount").value = "";
    $("withdrawPassword").value = "";
  } catch (error) {
    message("withdrawMessage", friendlyAuthError(error), "error");
  }
});

$("changePasswordButton")?.addEventListener("click", async () => {
  message("passwordMessage", "");
  const newPassword = $("newPassword").value;

  if (newPassword.length < 6) {
    message("passwordMessage", "Password must be at least 6 characters.", "error");
    return;
  }

  try {
    await updatePassword(currentUser, newPassword);
    $("newPassword").value = "";
    message("passwordMessage", "Password updated successfully.", "success");
  } catch (error) {
    message("passwordMessage", "For security, log in again and retry changing your password.", "error");
  }
});

$("addTaskButton")?.addEventListener("click", async () => {
  message("adminTaskMessage", "");

  const title = $("adminTaskTitle").value.trim();
  const url = safeHttpUrl($("adminTaskUrl").value);
  const reward = Number($("adminTaskReward").value || 0);
  const requiredVip = Number($("adminTaskVip").value);

  if (!title || !url || !Number.isFinite(reward) || reward < 0) {
    message("adminTaskMessage", "Enter a task title, valid HTTP(S) URL and valid reward display.", "error");
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
    message("adminTaskMessage", "Task added successfully.", "success");
    await loadTasks();
  } catch (error) {
    message("adminTaskMessage", "Could not add task. Verify admin UID and Firestore rules.", "error");
  }
});

$("saveSettingsButton")?.addEventListener("click", async () => {
  try {
    await setDoc(doc(db, "settings", "company"), {
      companyName: $("adminCompanyName").value.trim() || "Easy Earn",
      support: $("adminSupportEmail").value.trim() || DEFAULT_SUPPORT,
      about: $("adminAbout").value.trim(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await loadSettings();
    message("settingsMessage", "Company settings saved.", "success");
  } catch (error) {
    message("settingsMessage", "Could not save settings. Check admin permissions.", "error");
  }
});

$("saveVipButton")?.addEventListener("click", async () => {
  const level = Number($("adminVipLevel").value);
  const cost = Number($("adminVipCost").value);
  const daily = Number($("adminVipDaily").value);

  if (cost < 0 || daily < 0 || !Number.isFinite(cost) || !Number.isFinite(daily)) {
    message("vipMessage", "Enter valid non-negative amounts.", "error");
    return;
  }

  try {
    await setDoc(doc(db, "vipLevels", String(level)), {
      level,
      cost,
      daily,
      updatedAt: serverTimestamp()
    }, { merge: true });

    message("vipMessage", "VIP level saved.", "success");
    await loadVipSettings();
  } catch (error) {
    message("vipMessage", "Could not save VIP level. Check admin permissions.", "error");
  }
});

$("findMemberButton")?.addEventListener("click", async () => {
  message("memberMessage", "");
  const email = $("adminMemberEmail").value.trim().toLowerCase();

  if (!email) {
    message("memberMessage", "Enter the member email.", "error");
    return;
  }

  try {
    const snapshot = await getDocs(query(
      collection(db, "users"),
      where("email", "==", email)
    ));

    if (snapshot.empty) {
      selectedMember = null;
      message("memberMessage", "Member not found. Email matching is case-sensitive in stored records.", "error");
      return;
    }

    const memberDoc = snapshot.docs[0];
    selectedMember = { id: memberDoc.id, ...memberDoc.data() };
    $("adminMemberBalance").value = Number(selectedMember.balance || 0);
    $("adminMemberVip").value = String(Number(selectedMember.vip || 0));
    message("memberMessage", "Member loaded. Verify the email before saving changes.", "success");
  } catch (error) {
    message("memberMessage", "Could not search members. Check permissions.", "error");
  }
});

$("saveMemberButton")?.addEventListener("click", async () => {
  if (!selectedMember) {
    message("memberMessage", "Find a member first.", "error");
    return;
  }

  const balance = Number($("adminMemberBalance").value);
  const vip = Number($("adminMemberVip").value);

  if (!Number.isFinite(balance) || balance < 0) {
    message("memberMessage", "Balance cannot be negative.", "error");
    return;
  }

  try {
    await updateDoc(doc(db, "users", selectedMember.id), {
      balance,
      vip,
      updatedAt: serverTimestamp()
    });

    message("memberMessage", "Member settings updated.", "success");
    if (selectedMember.id === currentUser.uid) {
      currentProfile = await getProfile(currentUser.uid);
      renderProfile();
      renderVipSettings();
      renderTasks();
    }
  } catch (error) {
    message("memberMessage", "Could not update member. Check administrator permissions.", "error");
  }
});

async function loadAdminRequests() {
  const container = $("adminRequestsList");
  const snapshot = await getDocs(query(collection(db, "paymentRequests")));
  const requests = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  if (!requests.length) {
    container.innerHTML = '<p class="muted">No payment requests yet.</p>';
    return;
  }

  container.innerHTML = requests.map((item) => `
    <div class="request-row">
      <div>
        <strong>${escapeHTML(item.type || "request")} — ${money(item.amount)}</strong>
        <p>${escapeHTML(item.email || "")} · ${escapeHTML(item.method || "")}</p>
        <p>Status: ${escapeHTML(item.status || "pending")}</p>
        <p>${escapeHTML(item.reference || item.payoutAccount || "")}</p>
      </div>
      ${item.status === "pending" ? `
        <div class="request-actions">
          <button class="approve" data-request-action="approve" data-request-id="${item.id}">Approve</button>
          <button class="reject" data-request-action="reject" data-request-id="${item.id}">Reject</button>
        </div>` : ""}
    </div>
  `).join("");

  container.querySelectorAll("[data-request-action]").forEach((button) => {
    button.addEventListener("click", () =>
      reviewPaymentRequest(button.dataset.requestId, button.dataset.requestAction)
    );
  });
}

async function reviewPaymentRequest(requestId, action) {
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

    if (action === "approve" && request.type === "deposit") {
      const memberRef = doc(db, "users", request.uid);
      const memberSnapshot = await getDoc(memberRef);
      if (!memberSnapshot.exists()) throw new Error("Member profile missing.");

      await updateDoc(memberRef, {
        balance: Number(memberSnapshot.data().balance || 0) + Number(request.amount || 0),
        updatedAt: serverTimestamp()
      });
    }

    if (action === "approve" && request.type === "withdrawal") {
      const memberRef = doc(db, "users", request.uid);
      const memberSnapshot = await getDoc(memberRef);
      if (!memberSnapshot.exists()) throw new Error("Member profile missing.");

      const balance = Number(memberSnapshot.data().balance || 0);
      const amount = Number(request.amount || 0);
      if (amount > balance) throw new Error("Insufficient balance for withdrawal approval.");

      await updateDoc(memberRef, {
        balance: balance - amount,
        updatedAt: serverTimestamp()
      });
    }

    await updateDoc(requestRef, {
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser.uid
    });

    toast("Payment request updated.");
    await loadAdminRequests();

    if (request.uid === currentUser.uid) {
      currentProfile = await getProfile(currentUser.uid);
      renderProfile();
    }
  } catch (error) {
    console.error(error);
    toast("Review failed. Verify payment first and check Firestore permissions.");
  }
}

async function loadAdminSubmissions() {
  const container = $("adminSubmissionsList");
  const snapshot = await getDocs(collection(db, "taskSubmissions"));
  const submissions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  if (!submissions.length) {
    container.innerHTML = '<p class="muted">No task submissions yet.</p>';
    return;
  }

  container.innerHTML = submissions.map((item) => `
    <div class="request-row">
      <div>
        <strong>${escapeHTML(item.taskTitle || "Task")}</strong>
        <p>${escapeHTML(item.email || "")} · VIP ${Number(item.vip || 0)}</p>
        <p>Reward display: ${money(item.reward)} · Status: ${escapeHTML(item.status || "pending")}</p>
      </div>
      ${item.status === "pending" ? `
        <div class="request-actions">
          <button class="approve" data-submission-action="approve" data-submission-id="${item.id}">Approve</button>
          <button class="reject" data-submission-action="reject" data-submission-id="${item.id}">Reject</button>
        </div>` : ""}
    </div>
  `).join("");

  container.querySelectorAll("[data-submission-action]").forEach((button) => {
    button.addEventListener("click", () =>
      reviewSubmission(button.dataset.submissionId, button.dataset.submissionAction)
    );
  });
}

async function reviewSubmission(submissionId, action) {
  try {
    const submissionRef = doc(db, "taskSubmissions", submissionId);
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
      const userRef = doc(db, "users", submission.uid);
      const userSnapshot = await getDoc(userRef);
      if (!userSnapshot.exists()) throw new Error("Member profile missing.");

      const balance = Number(userSnapshot.data().balance || 0);
      const reward = Number(submission.reward || 0);

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
      currentProfile = await getProfile(currentUser.uid);
      renderProfile();
    }
  } catch (error) {
    console.error(error);
    toast("Could not review submission. Check Firestore permissions.");
  }
}
