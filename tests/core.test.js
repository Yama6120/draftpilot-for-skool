import test from "node:test";
import assert from "node:assert/strict";
import {
  localDateStamp,
  dailyCounterKey,
  buildUserMessage,
  isLicensePayloadActive,
  isLicenseCacheFresh,
  shouldBlockForQuota,
  extractAnthropicText
} from "../core.js";

test("daily counter uses local calendar date and resets by key", () => {
  const before = new Date(2026, 8, 9, 23, 59, 59);
  const after = new Date(2026, 8, 10, 0, 0, 1);
  assert.equal(localDateStamp(before), "2026-09-09");
  assert.equal(dailyCounterKey(before), "drafts_2026-09-09");
  assert.equal(dailyCounterKey(after), "drafts_2026-09-10");
  assert.notEqual(dailyCounterKey(before), dailyCounterKey(after));
});

test("quota blocks the 11th free draft but never blocks fresh Pro cache", () => {
  assert.equal(shouldBlockForQuota(9, false), false);
  assert.equal(shouldBlockForQuota(10, false), true);
  assert.equal(shouldBlockForQuota(99, true), false);
});

test("license active condition accepts success with no invalidating purchase state", () => {
  assert.equal(isLicensePayloadActive({ success: true, purchase: {} }), true);
});

test("license invalidation condition: refunded", () => {
  assert.equal(isLicensePayloadActive({ success: true, purchase: { refunded: true } }), false);
});

test("license invalidation condition: subscription_cancelled_at", () => {
  assert.equal(isLicensePayloadActive({ success: true, purchase: { subscription_cancelled_at: "2026-09-09T00:00:00Z" } }), false);
});

test("license invalidation condition: subscription_ended_at", () => {
  assert.equal(isLicensePayloadActive({ success: true, purchase: { subscription_ended_at: "2026-09-09T00:00:00Z" } }), false);
});

test("license invalidation condition: subscription_failed_at", () => {
  assert.equal(isLicensePayloadActive({ success: true, purchase: { subscription_failed_at: "2026-09-09T00:00:00Z" } }), false);
});

test("license cache expires at 24 hours", () => {
  const now = Date.now();
  assert.equal(isLicenseCacheFresh({ active: true, verifiedAt: now - 23 * 60 * 60 * 1000 }, now), true);
  assert.equal(isLicenseCacheFresh({ active: true, verifiedAt: now - 24 * 60 * 60 * 1000 }, now), false);
});

test("user message caps comments to newest five", () => {
  const text = buildUserMessage("Post", ["1", "2", "3", "4", "5", "6"], "Expert");
  assert.equal(text.includes("\n1\n"), false);
  for (const n of ["2", "3", "4", "5", "6"]) assert.equal(text.includes(`\n${n}`), true);
  assert.match(text, /Draft a Expert reply/);
});

test("Anthropic text extraction joins text blocks only", () => {
  assert.equal(extractAnthropicText({ content: [{ type: "text", text: "A" }, { type: "tool", value: 1 }, { type: "text", text: "B" }] }), "A\nB");
});
