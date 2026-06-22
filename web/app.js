// web/app.js — the truffle cockpit SPA (vanilla JS, zero deps). Read-mostly, for the chairman's eyes [D3].
// Fetches the 4 views from the stdlib server's JSON API; renders brain markdown client-side (no md lib).

"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---------- escape + a tiny, safe markdown renderer (headings/lists/code/quote/hr/table/inline) ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Map a [[Wikilink]] / [[Wikilink|alias]] to a clickable that loads the matching brain file. The brain notes use
// titles like "truffle EXPERTISE-MAP" but files are "EXPERTISE-MAP.md" — so we resolve by suffix match client-side.
let BRAIN_FILES = [];
function resolveWikilink(target) {
  const t = target.trim();
  // exact file?
  let f = BRAIN_FILES.find((x) => x.replace(/\.md$/, "") === t);
  if (f) return f;
  // suffix: "truffle EXPERTISE-MAP" → EXPERTISE-MAP.md
  const last = t.replace(/^truffle\s+/i, "");
  f = BRAIN_FILES.find((x) => x.replace(/\.md$/, "") === last || x.replace(/\.md$/, "").toUpperCase() === last.toUpperCase());
  if (f) return f;
  // contains
  f = BRAIN_FILES.find((x) => x.toUpperCase().includes(last.toUpperCase()));
  return f || null;
}

function inlineMd(text) {
  let s = esc(text);
  // wikilinks first (before other inline) — [[a|b]] or [[a]]
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    const [target, alias] = inner.split("|");
    const file = resolveWikilink(target);
    const label = (alias || target).trim();
    if (file) return `<a class="wikilink" data-file="${esc(file)}">${esc(label)}</a>`;
    return `<span class="wikilink" style="border:none;cursor:default;color:var(--amber-soft)">${esc(label)}</span>`;
  });
  // markdown links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    const safe = /^https?:\/\//.test(u) ? u : "#";
    return `<a class="wikilink" href="${esc(safe)}" target="_blank" rel="noopener">${esc(t)}</a>`;
  });
  // inline code
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // bold + italic
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s;
}

function renderMarkdown(md) {
  const lines = md.split("\n");
  let html = "";
  let i = 0;

  // YAML frontmatter block → a compact mono panel
  if (lines[0] && lines[0].trim() === "---") {
    let fm = "";
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") {
      fm += lines[i] + "\n";
      i++;
    }
    i++; // skip closing ---
    if (fm.trim()) html += `<div class="frontmatter">${esc(fm.trim())}</div>`;
  }

  let inList = false;
  let inCode = false;
  let codeBuf = "";
  let tableBuf = [];

  const flushList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  const flushTable = () => {
    if (tableBuf.length) {
      const rows = tableBuf.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r)); // drop the |---| separator
      html += "<table>";
      rows.forEach((r, idx) => {
        const cells = r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const tag = idx === 0 ? "th" : "td";
        html += "<tr>" + cells.map((c) => `<${tag}>${inlineMd(c)}</${tag}>`).join("") + "</tr>";
      });
      html += "</table>";
      tableBuf = [];
    }
  };

  for (; i < lines.length; i++) {
    const line = lines[i];

    // fenced code
    if (/^```/.test(line)) {
      if (inCode) {
        html += `<pre><code>${esc(codeBuf)}</code></pre>`;
        codeBuf = "";
        inCode = false;
      } else {
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf += line + "\n";
      continue;
    }

    // table rows (pipe-delimited)
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushList();
      tableBuf.push(line);
      continue;
    } else if (tableBuf.length) {
      flushTable();
    }

    if (/^#{1,6}\s/.test(line)) {
      flushList();
      const level = line.match(/^(#{1,6})/)[1].length;
      const content = line.replace(/^#{1,6}\s/, "");
      html += `<h${level}>${inlineMd(content)}</h${level}>`;
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMd(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
    } else if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMd(line.replace(/^\s*\d+\.\s+/, ""))}</li>`;
    } else if (/^>\s?/.test(line)) {
      flushList();
      html += `<blockquote>${inlineMd(line.replace(/^>\s?/, ""))}</blockquote>`;
    } else if (/^---+$/.test(line.trim())) {
      flushList();
      html += "<hr/>";
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      html += `<p>${inlineMd(line)}</p>`;
    }
  }
  flushList();
  flushTable();
  if (inCode && codeBuf) html += `<pre><code>${esc(codeBuf)}</code></pre>`;
  return html;
}

// ---------- tab routing ----------
function showView(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  if (name === "runs") loadRuns();
  if (name === "evals") loadEvals();
}
$$(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));

// ---------- Brain browser ----------
async function loadBrainList() {
  const r = await fetch("/api/brain/list").then((x) => x.json());
  BRAIN_FILES = r.files || [];
  const ul = $("#brain-file-list");
  ul.innerHTML = "";
  BRAIN_FILES.forEach((f) => {
    const li = document.createElement("li");
    li.textContent = f.replace(/\.md$/, "");
    li.dataset.file = f;
    li.addEventListener("click", () => loadBrainDoc(f));
    ul.appendChild(li);
  });
  // open the MOC (or the first file) by default
  const first = BRAIN_FILES.find((f) => f.startsWith("MOC")) || BRAIN_FILES[0];
  if (first) loadBrainDoc(first);
}

async function loadBrainDoc(file) {
  $$("#brain-file-list li").forEach((li) => li.classList.toggle("active", li.dataset.file === file));
  const r = await fetch("/api/brain/doc?file=" + encodeURIComponent(file)).then((x) => x.json());
  const el = $("#brain-doc");
  if (r.error) {
    el.innerHTML = `<p class="muted">Could not load ${esc(file)}: ${esc(r.error)}</p>`;
    return;
  }
  el.innerHTML = renderMarkdown(r.markdown);
  // wire wikilinks
  $$("a.wikilink[data-file]", el).forEach((a) => a.addEventListener("click", () => loadBrainDoc(a.dataset.file)));
  el.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let brainSearchTimer = null;
$("#brain-search-input").addEventListener("input", (e) => {
  const q = e.target.value.trim();
  clearTimeout(brainSearchTimer);
  const box = $("#brain-search-results");
  if (!q) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  brainSearchTimer = setTimeout(async () => {
    const r = await fetch("/api/brain/search?q=" + encodeURIComponent(q)).then((x) => x.json());
    box.hidden = false;
    if (r.note) {
      box.innerHTML = `<div class="brain-search-hit"><span class="hit-excerpt">${esc(r.note)}</span></div>`;
      return;
    }
    if (!r.hits || !r.hits.length) {
      box.innerHTML = `<div class="brain-search-hit"><span class="hit-excerpt">no brain hits for "${esc(q)}"</span></div>`;
      return;
    }
    box.innerHTML = r.hits
      .map(
        (h) =>
          `<div class="brain-search-hit" data-file="${esc(h.file)}"><span class="hit-score">${h.score.toFixed(2)}</span><span class="hit-file">${esc(
            h.file.replace(/\.md$/, "")
          )}</span> <span class="muted">:${h.line}</span><span class="hit-excerpt">${esc(h.excerpt)}</span></div>`
      )
      .join("");
    $$(".brain-search-hit[data-file]", box).forEach((d) =>
      d.addEventListener("click", () => {
        loadBrainDoc(d.dataset.file);
        box.hidden = true;
        $("#brain-search-input").value = "";
      })
    );
  }, 180);
});

// ---------- Run log ----------
async function loadRuns() {
  const host = $("#runs-table");
  host.innerHTML = '<p class="muted">Loading runs…</p>';
  const r = await fetch("/api/runs").then((x) => x.json());
  if (r.note && (!r.runs || !r.runs.length)) {
    host.innerHTML = `<p class="muted">${esc(r.note)}</p>`;
    return;
  }
  const rows = (r.runs || [])
    .map((run) => {
      const verdict =
        run.recall_at_10 !== undefined || run.mrr !== undefined
          ? `<span class="verdict-good">R@10=${fmt(run.recall_at_10)} · MRR=${fmt(run.mrr)} · hit=${fmt(run.hit_rate)}</span>`
          : run.status
          ? `<span class="pill pending">${esc(run.status)}</span>`
          : "—";
      const fusion = run.fusion ? `<span class="pill ${run.fusion === "hybrid" ? "hybrid" : ""}">${esc(run.fusion)}</span>` : "—";
      const engine = run.engine ? esc(run.engine) : "—";
      const when = run.ts || run.time || run.job || "";
      const what = run.step || run.suite || run.tool || run.job || "—";
      const dur = run.duration_ms !== undefined ? run.duration_ms + "ms" : run.duration !== undefined ? esc(String(run.duration)) : "—";
      return `<tr><td class="mono">${esc(String(when)).slice(0, 24)}</td><td>${esc(String(what))}</td><td>${engine}</td><td>${fusion}</td><td>${verdict}</td><td class="mono">${dur}</td><td class="mono">${run.model ? esc(run.model) : "—"}</td></tr>`;
    })
    .join("");
  host.innerHTML = `<table class="data"><thead><tr><th>when</th><th>step / suite</th><th>engine</th><th>fusion</th><th>relevance verdict</th><th>dur</th><th>model</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function fmt(v) {
  return v === undefined || v === null ? "–" : typeof v === "number" ? v.toFixed(2) : esc(String(v));
}

// ---------- Eval scores ----------
async function loadEvals() {
  const grid = $("#eval-grid");
  grid.innerHTML = '<p class="muted">Loading eval grid…</p>';
  const r = await fetch("/api/evals").then((x) => x.json());

  // badges
  const badges = [
    badge("Acceptance (G1)", r.acceptance),
    badge("Version-bump suite", r.versionBump),
    { label: "Golden tasks", status: (r.tasks || []).length + " defined", cls: "" },
    { label: "CI-blocking", status: (r.tasks || []).filter((t) => t.ciBlocking).length + " gate merge", cls: "" },
  ];
  $("#eval-badges").innerHTML = badges
    .map(
      (b) =>
        `<div class="badge ${b.cls}"><div class="badge-label">${esc(b.label)}</div><div class="badge-status">${esc(b.status)}</div>${
          b.note ? `<div class="muted" style="font-size:.72rem;margin-top:.2rem">${esc(b.note)}</div>` : ""
        }</div>`
    )
    .join("");

  // task cards
  grid.innerHTML =
    '<div class="eval-cards">' +
    (r.tasks || [])
      .map((t) => {
        const cls = t.ciBlocking ? "blocking" : "nonblocking";
        const hamelTag = `<span class="tag ${String(t.hamel).includes("L2") ? "l2" : ""}">${esc(t.hamel)}</span>`;
        const gateTag = t.ciBlocking ? `<span class="tag gate">CI gate</span>` : `<span class="tag">nightly</span>`;
        const classTag = `<span class="tag">${esc(t.class)}</span>`;
        return `<div class="eval-card ${cls}"><div class="eval-id">${esc(t.id)}</div><div class="eval-meta">scenario ${esc(
          t.scenario
        )}</div><div style="margin-bottom:.4rem">${hamelTag}${gateTag}${classTag}</div><div class="eval-asserts">${esc(t.asserts)}</div></div>`;
      })
      .join("") +
    "</div>";

  // typo set
  const typoHost = $("#typo-grid");
  const typos = r.typoSet || [];
  if (!typos.length) {
    typoHost.innerHTML = '<p class="muted">typo set: see eval/golden/typo-set.json</p>';
  } else {
    typoHost.innerHTML =
      '<div class="typo-list">' +
      typos
        .map((c) => {
          const from = c.typo || c.from || c.query || c.input || "";
          const to = c.correct || c.to || c.expected || c.target || "";
          return `<div class="typo-chip">${esc(from)} <span class="arrow">→</span> ${esc(to)}</div>`;
        })
        .join("") +
      "</div>";
  }
}
function badge(label, obj) {
  if (!obj) return { label, status: "unknown", cls: "pending" };
  const s = obj.status;
  if (s === "green") return { label, status: "green ✓", cls: "green", note: obj.verdict ? verdictLine(obj.verdict) : "" };
  if (s === "red" || s === "regressed") return { label, status: s, cls: "red", note: obj.verdict ? verdictLine(obj.verdict) : "" };
  return { label, status: s || "pending", cls: "pending", note: obj.note || "" };
}
function verdictLine(v) {
  return `R@10=${fmt(v.recall_at_10)} MRR=${fmt(v.mrr)} on ${v.engine || "?"}/${v.fusion || "?"}`;
}

// ---------- Ask the employee ----------
let askMode = "brain";
const HINTS = {
  brain: "BM25 over the brain — no engine needed. Try: filtered ANN under-return · pet-query trap · ES by default",
  search: "Hybrid search over the fixture corpus — needs `truffle engine up --engine meili`. Try: kuburnetes RTX-4090 0x80070005",
  engine: "Engine select — type a corpus size (e.g. 500000). Deterministic, no engine needed.",
};
$$(".ask-mode").forEach((b) =>
  b.addEventListener("click", () => {
    askMode = b.dataset.mode;
    $$(".ask-mode").forEach((x) => x.classList.toggle("active", x === b));
    $("#ask-hint").textContent = HINTS[askMode];
    $("#ask-input").placeholder =
      askMode === "engine" ? "corpus size, e.g. 500000" : askMode === "search" ? "kuburnetes RTX-4090 0x80070005" : "filtered ANN under-return";
  })
);
$("#ask-hint").textContent = HINTS.brain;

$("#ask-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#ask-input").value.trim();
  if (!q) return;
  const out = $("#ask-result");
  out.innerHTML = '<p class="muted">Asking truffle…</p>';
  const r = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: askMode, query: q }),
  }).then((x) => x.json());
  out.innerHTML = renderAsk(r);
});

function renderAsk(r) {
  if (r.error) return `<p class="verdict-bad">${esc(r.error)}</p>`;

  if (r.mode === "brain") {
    if (!r.hits || !r.hits.length) return `<p class="muted">no brain hits.</p>`;
    return r.hits
      .map(
        (h) =>
          `<div class="hit-card"><div class="hit-head"><span class="hit-id">${esc(h.file.replace(/\.md$/, ""))}:${h.line}</span><span class="hit-score">${h.score.toFixed(
            3
          )}</span></div><div class="hit-body">${esc(h.excerpt)}</div></div>`
      )
      .join("");
  }

  if (r.mode === "engine") {
    if (!r.result) return `<pre><code>${esc(r.raw || "no result")}</code></pre>`;
    const e = r.result;
    return `<div class="hit-card"><div class="hit-head"><span class="hit-id">${esc(e.engine)}</span></div>
      <div class="hit-body"><strong>why:</strong> ${esc(e.reason)}</div>
      <div class="hit-body"><strong>honest cost:</strong> ${esc(e.honestCost)}</div>
      <div class="hit-body"><strong>right-size:</strong> ${esc(e.rightsizeVerdict)}</div>
      ${e.rejected && e.rejected.length ? `<div class="hit-body muted"><strong>rejected:</strong> ${e.rejected.map(esc).join("; ")}</div>` : ""}</div>`;
  }

  // search
  if (r.engineDown || r.note) {
    return `<div class="engine-down">The search path needs a booted engine (brain &amp; engine-select work without one).<br/><br/>${esc(
      r.note || "engine not reachable"
    )}<br/><code>truffle engine up --engine meili &amp;&amp; truffle index ./fixtures/corpus --hybrid</code></div>`;
  }
  if (r.result) {
    const res = r.result;
    let html = "";
    if (res.fusion_mode) html += `<div><span class="pill ${res.fusion_mode === "hybrid" ? "hybrid" : ""}">fusion: ${esc(res.fusion_mode)}</span></div>`;
    if (res.relevance_note) html += `<div class="relevance-note">${esc(res.relevance_note)}</div>`;
    html += (res.hits || [])
      .map(
        (h) =>
          `<div class="hit-card"><div class="hit-head"><span class="hit-id">${esc(h.id)} ${esc(h.title || "")}</span><span class="hit-score">${(
            h.score || 0
          ).toFixed(4)}</span></div>${h.category ? `<div class="hit-body muted">category: ${esc(h.category)}</div>` : ""}</div>`
      )
      .join("");
    if (res.facets) {
      for (const [field, dist] of Object.entries(res.facets)) {
        html += `<div class="facets-line">facet <strong>${esc(field)}</strong>: ${Object.entries(dist)
          .map(([v, c]) => `<span class="fv">${esc(v)}=${c}</span>`)
          .join("")}</div>`;
      }
    }
    return html || `<p class="muted">no hits.</p>`;
  }
  if (r.raw) return `<pre><code>${esc(r.raw)}</code></pre>`;
  return `<p class="muted">no result.</p>`;
}

// ---------- boot ----------
loadBrainList();
