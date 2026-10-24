// SermonKit shared suite renderer (client). Mirrors engine/index.js suiteToHtml /
// suiteToMarkdown structure. Used by app.html. Exposes renderSuite(container,
// suite) + suiteMarkdown(suite) + download(name, text).
(function () {
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function section(title, bodyHtml, id) {
    return `<div class="card"><div class="copyrow"><button class="ghost small" data-copy="${id}">Copy</button></div>` +
      `<h2 class="cardtitle">${title}</h2>${bodyHtml}</div>`;
  }

  function renderSuite(el, s) {
    const parts = [];
    parts.push(`<div class="meta">engine: ${esc(s.engine)} · ${s.stats.words} words in · themes: ${s.stats.themes.map(esc).join(", ")}</div>`);

    parts.push(section("Titles", `<div class="taglist">${s.titles.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`, "titles"));

    parts.push(section("Summary", `<p class="txt">${esc(s.summary.text)}</p>`, "summary"));

    let ms = "";
    for (const sec of s.manuscript.sections) {
      ms += `<h3 class="k">${esc(sec.heading)}</h3>` + sec.paragraphs.map((p) => `<p class="txt" style="margin-top:8px">${esc(p)}</p>`).join("");
    }
    parts.push(section("Edited manuscript", ms, "manuscript"));

    const g = s.discussionGuide;
    let gs = `<p class="meta">Icebreaker</p><p class="txt">${esc(g.icebreaker)}</p>` +
      `<p class="meta" style="margin-top:14px">Opening questions</p><ol>${g.open.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` +
      `<p class="meta" style="margin-top:14px">In the sermon</p>` +
      g.qs.map((q) => `<blockquote>“${esc(q.quote)}”</blockquote><p style="margin:6px 0 14px">→ ${esc(q.follow)}</p>`).join("") +
      `<p class="meta">Living it out</p><ol>${g.living.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` +
      `<p class="meta" style="margin-top:14px">Closing prayer</p><p class="txt">${esc(g.prayer)}</p>`;
    parts.push(section(esc(g.title), gs, "guide"));

    let ds = "";
    for (const d of s.devotionals) {
      ds += `<h3 class="k">${esc(d.title)}</h3><blockquote>“${esc(d.anchor)}”</blockquote>` +
        `<p class="txt">${esc(d.reflection)}</p><p class="meta" style="margin-top:10px">Live it</p><p class="txt">${esc(d.action)}</p>` +
        `<p class="meta">Pray</p><p class="txt">${esc(d.prayer)}</p>`;
    }
    parts.push(section("Devotional series — 5 days", ds, "devotionals"));

    const soc = `<p class="meta">Pull quotes</p>${s.social.pullQuotes.map((q) => `<blockquote>“${esc(q)}”</blockquote>`).join("")}` +
      `<p class="meta" style="margin-top:14px">Captions</p>${s.social.captions.map((c) => `<p class="txt" style="margin:8px 0">${esc(c.text).replace(/\n/g, "<br>")}</p>`).join("")}` +
      `<p class="meta" style="margin-top:14px">X posts</p>${s.social.xPosts.map((c) => `<p class="txt" style="margin:8px 0">${esc(c.text)}</p>`).join("")}`;
    parts.push(section("Social pack", soc, "social"));

    el.innerHTML = parts.join("");

    el.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = artifactText(s, btn.dataset.copy);
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = "Copied ✓";
          setTimeout(() => (btn.textContent = "Copy"), 1500);
        });
      });
    });
  }

  function artifactText(s, id) {
    switch (id) {
      case "titles": return s.titles.map((t, i) => (i + 1) + ". " + t).join("\n");
      case "summary": return s.summary.text;
      case "manuscript": return s.manuscript.sections.map((sec) => "## " + sec.heading + "\n\n" + sec.paragraphs.join("\n\n")).join("\n\n");
      case "guide": {
        const g = s.discussionGuide;
        return g.title + "\n\nIcebreaker: " + g.icebreaker + "\n\nOpening:\n" + g.open.map((q, i) => (i + 1) + ". " + q).join("\n") +
          "\n\n" + g.qs.map((q) => "“" + q.quote + "”\n- " + q.follow).join("\n\n") +
          "\n\nLiving it out:\n" + g.living.map((q, i) => (i + 1) + ". " + q).join("\n") + "\n\nPrayer: " + g.prayer;
      }
      case "devotionals": return s.devotionals.map((d) => d.title + "\n\nRe-read: “" + d.anchor + "”\n\n" + d.reflection + "\n\nLive it: " + d.action + "\n\nPray: " + d.prayer).join("\n\n———\n\n");
      case "social": return s.social.pullQuotes.map((q) => "“" + q + "”").join("\n\n") + "\n\n" + s.social.captions.map((c) => c.text).join("\n\n") + "\n\n" + s.social.xPosts.map((c) => c.text).join("\n");
      default: return "";
    }
  }

  function suiteMarkdown(s) {
    const L = [];
    L.push("# " + s.manuscript.title, "", "> Themes: " + s.stats.themes.join(", ") + " · " + s.stats.words + " words · engine: " + s.engine, "");
    L.push("## Titles", ...s.titles.map((t, i) => (i + 1) + ". " + t), "");
    L.push("## Summary", "", s.summary.text, "");
    L.push("## Edited manuscript", "");
    for (const sec of s.manuscript.sections) L.push("### " + sec.heading, "", ...sec.paragraphs.map((p) => p + "\n"));
    L.push(artifactText(s, "guide"), "", artifactText(s, "devotionals"), "", "## Social pack", "", artifactText(s, "social"), "");
    return L.join("\n");
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type: type || "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  window.SermonKitSuite = { renderSuite, suiteMarkdown, artifactText, download };
})();
