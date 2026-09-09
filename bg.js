import {
  DEFAULT_MODEL,
  SETUP_URL,
  FREE_DAILY_LIMIT,
  LICENSE_CACHE_MS
} from "./config.js";
import {
  SYSTEM_PROMPT,
  dailyCounterKey,
  buildUserMessage,
  isLicenseCacheFresh,
  shouldBlockForQuota,
  extractAnthropicText
} from "./core.js";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: SETUP_URL });
  }
});

async function getStored(keys) {
  return await chrome.storage.local.get(keys);
}

async function generateDraft({ postText, comments, tone }) {
  const counterKey = dailyCounterKey();
  const state = await getStored(["apiKey", "model", "licenseCache", counterKey]);
  const apiKey = String(state.apiKey || "").trim();
  if (!apiKey) return { ok: false, code: "NO_KEY" };

  const isPro = isLicenseCacheFresh(state.licenseCache, Date.now(), LICENSE_CACHE_MS);
  const used = Number(state[counterKey] || 0);
  if (shouldBlockForQuota(used, isPro, FREE_DAILY_LIMIT)) {
    return { ok: false, code: "QUOTA", used };
  }

  const model = String(state.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(postText, comments, tone) }]
      })
    });
  } catch (error) {
    return { ok: false, code: "ANTHROPIC_ERROR", detail: String(error?.message || error) };
  }

  if (!response.ok) {
    return { ok: false, code: "ANTHROPIC_ERROR", status: response.status };
  }

  const payload = await response.json();
  const draft = extractAnthropicText(payload);
  if (!draft) return { ok: false, code: "ANTHROPIC_ERROR" };

  if (!isPro) {
    await chrome.storage.local.set({ [counterKey]: used + 1 });
  }
  return { ok: true, draft, used: isPro ? used : used + 1, isPro };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "DRAFTPILOT_GENERATE") return false;
  generateDraft(message.payload || {}).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, code: "ANTHROPIC_ERROR", detail: String(error?.message || error) });
  });
  return true;
});
