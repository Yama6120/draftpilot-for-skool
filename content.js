(() => {
  const ROOT_ATTR = "data-draftpilot-root";
  const tones = ["Friendly", "Expert", "Short"];
  let scanTimer = null;

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  }

  function editorCandidates() {
    return [...document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]')]
      .filter((el) => !el.closest(`[${ROOT_ATTR}]`))
      .filter(isVisible)
      .filter((el) => {
        const aria = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""}`.toLowerCase();
        if (/search|message members|filter/.test(aria)) return false;
        const near = el.closest("form, article, section, [role=dialog], main, div");
        const context = (near?.innerText || "").slice(-900).toLowerCase();
        return /comment|reply|write|respond|add a comment|post/.test(`${aria} ${context}`) || el.isContentEditable;
      });
  }

  function anchorFor(editor) {
    return editor.closest("form") || editor.parentElement || editor;
  }

  function findThreadRoot(editor) {
    return editor.closest("article") || editor.closest("[role=article]") || editor.closest("main") || editor.parentElement?.parentElement || document.body;
  }

  function collectContext(editor) {
    const thread = findThreadRoot(editor);
    const textBlocks = [...thread.querySelectorAll("p, [data-testid*=post], [data-testid*=comment], [role=article]")]
      .map((el) => (el.innerText || "").trim())
      .filter((text) => text.length >= 2 && text.length <= 5000);
    const unique = [...new Set(textBlocks)];
    let postText = unique[0] || (thread.innerText || "").trim().slice(0, 5000);
    let comments = unique.slice(1, -1).slice(-5);
    if (!postText) postText = (document.querySelector("main")?.innerText || "").trim().slice(0, 5000);
    return { postText, comments };
  }

  function dispatchText(editor, text) {
    editor.focus();
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      const proto = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(editor, text); else editor.value = text;
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, text);
      if ((editor.innerText || "").trim() !== text.trim()) editor.innerText = text;
    }
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function showInlineMessage(root, text, actions = []) {
    let node = root.querySelector(".draftpilot-message");
    if (!node) {
      node = document.createElement("div");
      node.className = "draftpilot-message";
      root.appendChild(node);
    }
    node.replaceChildren();
    const copy = document.createElement("span");
    copy.textContent = text;
    node.appendChild(copy);
    for (const action of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.addEventListener("click", action.onClick);
      node.appendChild(btn);
    }
  }

  async function requestDraft(editor, root, tone) {
    const draftButton = root.querySelector(".draftpilot-draft");
    draftButton.disabled = true;
    draftButton.textContent = "Drafting…";
    root.querySelector(".draftpilot-message")?.remove();
    const context = collectContext(editor);
    const result = await chrome.runtime.sendMessage({
      type: "DRAFTPILOT_GENERATE",
      payload: { ...context, tone }
    });
    draftButton.disabled = false;
    draftButton.textContent = "✨ Draft reply";

    if (result?.ok) {
      dispatchText(editor, result.draft);
      return;
    }
    if (result?.code === "NO_KEY") {
      showInlineMessage(root, "Add your Anthropic API key in Options to start drafting.", [
        { label: "Open Options", onClick: () => chrome.runtime.openOptionsPage() }
      ]);
      return;
    }
    if (result?.code === "QUOTA") {
      showInlineMessage(root, "You've used today's 10 free drafts. Pro gives you unlimited drafts for $7/month.", [
        { label: "Get Pro", onClick: () => window.open("https://gumroad.com/l/draftpilot-pro", "_blank", "noopener") },
        { label: "Not now", onClick: () => root.querySelector(".draftpilot-message")?.remove() }
      ]);
      return;
    }
    showInlineMessage(root, "Anthropic returned an error. Check your key and try again.");
  }

  function mount(editor) {
    if (editor.dataset.draftpilotMounted === "1") return;
    editor.dataset.draftpilotMounted = "1";
    const anchor = anchorFor(editor);
    const root = document.createElement("div");
    root.setAttribute(ROOT_ATTR, "1");
    root.className = "draftpilot-toolbar";

    const draftButton = document.createElement("button");
    draftButton.type = "button";
    draftButton.className = "draftpilot-draft";
    draftButton.textContent = "✨ Draft reply";

    const toneGroup = document.createElement("div");
    toneGroup.className = "draftpilot-tones";
    let selectedTone = "Friendly";
    for (const tone of tones) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "draftpilot-tone";
      chip.textContent = tone;
      chip.dataset.active = tone === selectedTone ? "1" : "0";
      chip.addEventListener("click", () => {
        selectedTone = tone;
        toneGroup.querySelectorAll(".draftpilot-tone").forEach((n) => n.dataset.active = n === chip ? "1" : "0");
      });
      toneGroup.appendChild(chip);
    }
    draftButton.addEventListener("click", () => requestDraft(editor, root, selectedTone));
    root.append(draftButton, toneGroup);
    anchor.insertAdjacentElement("afterend", root);
  }

  function scan() {
    editorCandidates().forEach(mount);
  }

  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 120);
  });
  observer.observe(document.documentElement, { subtree: true, childList: true });
  scan();
})();
