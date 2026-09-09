export const SYSTEM_PROMPT = `You draft replies for a Skool community member. Write in the first person as the user.
Match the language of the post. Respond to the specific content of the post; do not add generic praise.
No hashtags. No emojis unless the post uses them. Output only the reply text.
Tone = Friendly: warm, conversational, 2-4 sentences.
Tone = Expert: precise and concrete, may use a short numbered list, 3-6 sentences.
Tone = Short: one or two sentences, direct.`;

export function localDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dailyCounterKey(date = new Date()) {
  return `drafts_${localDateStamp(date)}`;
}

export function buildUserMessage(postText, comments, tone) {
  const cleanComments = (comments || []).slice(-5).filter(Boolean).join("\n");
  return `POST:\n${postText || ""}\n\nRECENT COMMENTS (newest last, up to 5):\n${cleanComments}\n\nDraft a ${tone} reply to the POST.`;
}

export function isLicensePayloadActive(payload) {
  if (!payload || payload.success !== true) return false;
  const purchase = payload.purchase || {};
  return !Boolean(
    purchase.refunded ||
    purchase.subscription_cancelled_at ||
    purchase.subscription_ended_at ||
    purchase.subscription_failed_at
  );
}

export function isLicenseCacheFresh(cache, now = Date.now(), ttlMs = 24 * 60 * 60 * 1000) {
  return Boolean(cache && cache.active === true && Number.isFinite(cache.verifiedAt) && now - cache.verifiedAt >= 0 && now - cache.verifiedAt < ttlMs);
}

export function shouldBlockForQuota(count, isPro, limit = 10) {
  return !isPro && Number(count || 0) >= limit;
}

export function extractAnthropicText(payload) {
  const chunks = Array.isArray(payload?.content) ? payload.content : [];
  return chunks.filter((c) => c?.type === "text" && typeof c.text === "string").map((c) => c.text).join("\n").trim();
}
