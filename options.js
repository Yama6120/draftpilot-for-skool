import {
  DEFAULT_MODEL,
  GUMROAD_PRODUCT_ID,
  GUMROAD_VERIFY_URL,
  LICENSE_CACHE_MS
} from "./config.js";
import { dailyCounterKey, isLicensePayloadActive, isLicenseCacheFresh } from "./core.js";

const $ = (id) => document.getElementById(id);

async function refresh() {
  const counterKey = dailyCounterKey();
  const state = await chrome.storage.local.get(["apiKey", "defaultTone", "model", "proLicenseKey", "licenseCache", counterKey]);
  $("apiKey").value = state.apiKey || "";
  $("defaultTone").value = state.defaultTone || "Friendly";
  $("model").value = state.model || DEFAULT_MODEL;
  $("licenseKey").value = state.proLicenseKey || "";
  $("usage").textContent = `Free plan: ${Number(state[counterKey] || 0)}/10 drafts used today`;
  if (isLicenseCacheFresh(state.licenseCache, Date.now(), LICENSE_CACHE_MS)) {
    $("licenseStatus").textContent = "Pro active.";
  }
}

$("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: $("apiKey").value.trim(),
    defaultTone: $("defaultTone").value,
    model: $("model").value.trim() || DEFAULT_MODEL
  });
  $("saveStatus").textContent = "Saved.";
  setTimeout(() => $("saveStatus").textContent = "", 1600);
});

$("activate").addEventListener("click", async () => {
  const licenseKey = $("licenseKey").value.trim();
  if (!licenseKey) {
    $("licenseStatus").textContent = "Enter your license key.";
    return;
  }
  if (!GUMROAD_PRODUCT_ID) {
    $("licenseStatus").textContent = "Activation becomes available after the Pro product ID is assigned.";
    return;
  }
  $("activate").disabled = true;
  $("licenseStatus").textContent = "Checking…";
  try {
    const body = new URLSearchParams({
      product_id: GUMROAD_PRODUCT_ID,
      license_key: licenseKey,
      increment_uses_count: "false"
    });
    const response = await fetch(GUMROAD_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
    const payload = await response.json();
    const active = response.ok && isLicensePayloadActive(payload);
    const cache = { active, verifiedAt: Date.now(), productId: GUMROAD_PRODUCT_ID };
    await chrome.storage.local.set({ proLicenseKey: licenseKey, licenseCache: cache });
    $("licenseStatus").textContent = active ? "Pro active." : "License is not active.";
  } catch (_error) {
    $("licenseStatus").textContent = "License verification failed. Try again.";
  } finally {
    $("activate").disabled = false;
  }
});

refresh();
