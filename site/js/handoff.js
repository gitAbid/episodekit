// EpisodeKit tool→app handoff: stash the user's transcript in sessionStorage
// (same tab only — never leaves the browser), then link to the app, which
// pre-fills it. Exposed as window.EKHandoff.offer(container, text).
(function () {
  window.EKHandoff = {
    offer(el, text) {
      if (!el) return;
      el.innerHTML = `<div class="notice" style="border-color:rgba(232,176,75,.45);background:rgba(232,176,75,.06)">
        Want all six artifacts at once — article notes, discussion kit, email series, social pack, summary, titles?<br>
        <a href="/app" id="ek-handoff-go" style="color:var(--accent);font-weight:700">Generate the full package with this transcript →</a>
      </div>`;
      document.getElementById("ek-handoff-go").addEventListener("click", () => {
        try { sessionStorage.setItem("ek_handoff", text.slice(0, 60000)); } catch (e) {}
      });
    },
  };
})();
