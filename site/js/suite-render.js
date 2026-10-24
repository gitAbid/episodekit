// EpisodeKit shared suite renderer (client). Mirrors engine/index.js renderers.
// Used by app.html. Exposes renderSuite(container, suite) + suiteMarkdown(suite)
// + artifactText(suite, id) + download(name, text).
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
    for (const sec of s.article.sections) {
      ms += `<h3 class="k">${esc(sec.heading)}</h3>` + sec.paragraphs.map((p) => `<p class="txt" style="margin-top:8px">${esc(p)}</p>`).join("");
    }
    parts.push(section("Article (show notes)", ms, "article"));

    const g = s.discussion;
    let gs = `<p class="meta">Opener</p><p class="txt">${esc(g.opener)}</p>` +
      `<p class="meta" style="margin-top:14px">Opening questions</p><ol>${g.open.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` +
      `<p class="meta" style="margin-top:14px">From the episode</p>` +
      g.qs.map((q) => `<blockquote>“${esc(q.quote)}”</blockquote><p style="margin:6px 0 14px">→ ${esc(q.follow)}</p>`).join("") +
      `<p class="meta">Apply it</p><ol>${g.apply.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` +
      `<p class="meta" style="margin-top:14px">Closing</p><p class="txt">${esc(g.closing)}</p>`;
    parts.push(section(esc(g.title), gs, "discussion"));

    let ds = "";
    for (const d of s.series) {
      ds += `<h3 class="k">${esc(d.title)}</h3><blockquote>“${esc(d.anchor)}”</blockquote>` +
        `<p class="txt">${esc(d.reflection)}</p><p class="meta" style="margin-top:10px">Do this</p><p class="txt">${esc(d.action)}</p>` +
        `<p class="meta">Sign-off</p><p class="txt">${esc(d.closing)}</p>`;
    }
    parts.push(section("Email series — 5 days", ds, "series"));

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
      case "article": return s.article.sections.map((sec) => "## " + sec.heading + "\n\n" + sec.paragraphs.join("\n\n")).join("\n\n");
      case "discussion": {
        const g = s.discussion;
        return g.title + "\n\nOpener: " + g.opener + "\n\nOpening:\n" + g.open.map((q, i) => (i + 1) + ". " + q).join("\n") +
          "\n\n" + g.qs.map((q) => "“" + q.quote + "”\n- " + q.follow).join("\n\n") +
          "\n\nApply it:\n" + g.apply.map((q, i) => (i + 1) + ". " + q).join("\n") + "\n\nClosing: " + g.closing;
      }
      case "series": return s.series.map((d) => d.title + "\n\nRe-listen: “" + d.anchor + "”\n\n" + d.reflection + "\n\nDo this: " + d.action + "\n\n" + d.closing).join("\n\n———\n\n");
      case "social": return s.social.pullQuotes.map((q) => "“" + q + "”").join("\n\n") + "\n\n" + s.social.captions.map((c) => c.text).join("\n\n") + "\n\n" + s.social.xPosts.map((c) => c.text).join("\n");
      default: return "";
    }
  }

  function suiteMarkdown(s) {
    const L = [];
    L.push("# " + s.article.title, "", "> Themes: " + s.stats.themes.join(", ") + " · " + s.stats.words + " words · engine: " + s.engine, "");
    L.push("## Titles", ...s.titles.map((t, i) => (i + 1) + ". " + t), "");
    L.push("## Summary", "", s.summary.text, "");
    L.push("## Article (show notes)", "");
    for (const sec of s.article.sections) L.push("### " + sec.heading, "", ...sec.paragraphs.map((p) => p + "\n"));
    L.push(artifactText(s, "discussion"), "", artifactText(s, "series"), "", "## Social pack", "", artifactText(s, "social"), "");
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

  window.EpisodeKitSuite = { renderSuite, suiteMarkdown, artifactText, download };
})();
