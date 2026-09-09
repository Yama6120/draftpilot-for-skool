import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const background = fs.readFileSync(path.join(root, "bg.js"), "utf8");

test("manifest permissions stay at storage plus exactly two approved hosts", () => {
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://www.skool.com/*", "https://api.anthropic.com/*"]);
});

test("content script has no automatic submit click", () => {
  assert.equal(/submit\s*\(\)|\.click\s*\(\)/i.test(content), false);
  assert.match(content, /DRAFTPILOT_GENERATE/);
});

test("Anthropic request includes direct-browser access header", () => {
  assert.match(background, /anthropic-dangerous-direct-browser-access/);
  assert.match(background, /https:\/\/api\.anthropic\.com\/v1\/messages/);
});
