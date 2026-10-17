
/* =====================================
   12. DEPOSIT CUSTOMER SERVICE
===================================== */

const TELEGRAM_SUPPORT_URL = "https://t.me/easy_earn10";

$("depositButton")?.addEventListener("click", () => {
  window.open(
    TELEGRAM_SUPPORT_URL,
    "_blank",
    "noopener,noreferrer"
  );
});

document.querySelectorAll('[data-scroll="deposit"]').forEach((button) => {
  button.addEventListener("click", () => {
    $("deposit")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

/* =====================================
   13. INTERNATIONAL WITHDRAWALS
===================================== */

$("withdrawMethod")?.addEventListener("change", () => {
  const method = $("withdrawMethod").value;
  const label = $("withdrawAccountLabel");
  const input = $("withdrawAccount");

  if (method === "USDT") {
    label.textContent = "USDT Wallet Address";
    input.placeholder = "Enter your USDT wallet address";
  } else {
    label.textContent = "Visa Card Payout Details";
    input.placeholder = "Enter details requested by the approved payout provider";
  }
});

$("withdrawButton")?.addEventListener("click", async () => {
  if (!currentUser || !currentProfile) return;

  message("withdrawMessage", "");

  const amount = Number($("withdrawAmount")?.value);
  const payoutAccount = $("withdrawAccount")?.value.trim() || "";
  const password = $("withdrawPassword")?.value || "";
  const method = $("withdrawMethod")?.value || "";

  if (!["USDT", "Visa Card"].includes(method)) {
    message("withdrawMessage", "Select USDT or Visa Card.", "error");
    return;
  }

  if (!Number.isFinite(amount) || amount < 50) {
    message("withdrawMessage", "Minimum withdrawal request is 50 BDT.", "error");
    return;
  }

  if (amount > Number(currentProfile.balance || 0)) {
    message("withdrawMessage", "Insufficient displayed balance.", "error");
    return;
  }

  if (!payoutAccount || !password) {
    message("withdrawMessage", "Complete all required fields.", "error");
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(
      currentUser.email,
      password
    );

    await reauthenticateWithCredential(currentUser, credential);

    await addDoc(collection(db, "paymentRequests"), {
      uid: currentUser.uid,
      email: currentUser.email,
      type: "withdrawal",
      amount,
      currency: "BDT",
      method,
      payoutAccount,
      status: "pending",
      createdAt: serverTimestamp()
    });

    message(
      "withdrawMessage",
      "Your withdrawal request has been submitted for review.",
      "success"
    );

    $("withdrawAmount").value = "";
    $("withdrawAccount").value = "";
    $("withdrawPassword").value = "";

    if (isAdmin()) await loadAdminRequests();
  } catch (error) {
    console.error(error);
    message("withdrawMessage", friendlyAuthError(error), "error");
  }
});
