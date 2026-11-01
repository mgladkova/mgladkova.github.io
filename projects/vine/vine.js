// Builds the video comparison grids on the VINE project page.
// Videos are only fetched once their row nears the viewport, and all videos in a row restart together so the orbits stay in sync.

const OBJECT_METHODS = [
  { key: "trellis", label: "TRELLIS" },
  { key: "reconviagen", label: "ReconViaGen" },
  { key: "amodal3r", label: "Amodal3R" },
  { key: "sam3d", label: "SAM3D" },
  { key: "mvsam3d", label: "MV-SAM3D" },
  { key: "ours", label: "VINE (ours)", ours: true },
];

const COMPARISONS = {
  toys4k: {
    base: "media/toys4k",
    examples: ["obj7", "obj6", "obj1", "obj10", "obj8"],
    methods: OBJECT_METHODS,
    perView: true,
    light: true,
  },
  replica: {
    base: "media/replica",
    examples: [
      { id: "ex3", inputs: 2 },
      { id: "ex2", inputs: 5 },
      { id: "ex4", inputs: 3 },
    ],
    methods: [
      { key: "trellis_m", label: "TRELLIS-M" },
      { key: "reconviagen", label: "ReconViaGen" },
      { key: "mvsam3d", label: "MV-SAM3D" },
      { key: "vine", label: "VINE (ours)", ours: true },
    ],
    light: true,
  },
  scannetpp: {
    base: "media/scannetpp",
    examples: ["ex1", "ex2", "ex4"],
    methods: [
      { key: "trellis_m", label: "TRELLIS-M" },
      { key: "trellis_s", label: "TRELLIS-S" },
      { key: "reconviagen", label: "ReconViaGen" },
      { key: "sam3dm", label: "SAM3D" },
      { key: "ours", label: "VINE (ours)", ours: true },
    ],
    light: true,
  },
};

const VIEW_COUNTS = [1, 2, 4, 8];
const DEFAULT_VIEWS = 4;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function makeVideo(src) {
  const video = el("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "none";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  if (reducedMotion) video.controls = true;
  video.dataset.src = src;
  return video;
}

function waitForData(video) {
  if (video.readyState >= 3) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("canplay", resolve, { once: true });
    video.addEventListener("error", resolve, { once: true });
  });
}

// Row state: the row's videos plus whether they are loaded and on screen.
function loadRow(row) {
  row.loaded = true;
  const token = (row.token = (row.token || 0) + 1);
  row.videos.forEach((video) => {
    if (video.getAttribute("src") !== video.dataset.src) {
      video.preload = "auto";
      video.src = video.dataset.src;
      video.load();
    }
  });
  Promise.all(row.videos.map(waitForData)).then(() => {
    if (token !== row.token) return;
    row.videos.forEach((video) => (video.currentTime = 0));
    if (row.visible && !reducedMotion) playRow(row);
  });
}

function playRow(row) {
  row.videos.forEach((video) => video.play().catch(() => {}));
}

function pauseRow(row) {
  row.videos.forEach((video) => video.pause());
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const row = entry.target.row;
      row.visible = entry.isIntersecting;
      if (!row.visible) return pauseRow(row);
      if (!row.loaded) loadRow(row);
      else if (!reducedMotion) playRow(row);
    });
  },
  { rootMargin: "300px 0px" }
);

function buildComparison(container, config) {
  const columns = config.methods.length + 2; // inputs + methods + GT
  const wrap = el("div", "compare" + (config.light ? " compare--light" : ""));
  const grid = el("div", "compare__grid");
  grid.style.setProperty("--cols", columns);

  grid.append(el("div", "compare__head", "Input views"));
  config.methods.forEach((m) => grid.append(el("div", "compare__head" + (m.ours ? " compare__head--ours" : ""), m.label)));
  grid.append(el("div", "compare__head", "Ground truth"));

  const rows = [];
  config.examples.forEach((example) => {
    const id = typeof example === "string" ? example : example.id;
    const dir = `${config.base}/${id}`;
    const row = { videos: [], images: [], dir };

    const inputCell = el("div");
    if (config.perView) {
      const img = el("img");
      img.alt = "Posed input views";
      img.loading = "lazy";
      row.images.push(img);
      inputCell.append(img);
    } else if (example.inputs) {
      const thumbs = el("div", "compare__inputs");
      thumbs.style.gridTemplateColumns = `repeat(${Math.ceil(Math.sqrt(example.inputs))}, 1fr)`;
      for (let i = 0; i < example.inputs; i++) {
        const img = el("img");
        img.alt = `Input view ${i + 1}`;
        img.loading = "lazy";
        img.src = `${dir}/in_${i}.jpg`;
        thumbs.append(img);
      }
      inputCell.append(thumbs);
    } else {
      const img = el("img");
      img.alt = "Posed input views";
      img.loading = "lazy";
      img.src = `${dir}/cond.jpg`;
      inputCell.append(img);
    }
    grid.append(inputCell);

    config.methods.forEach((m) => {
      const cell = el("div", m.ours ? "is-ours" : "");
      const video = makeVideo(`${dir}/${m.key}.mp4`);
      video.dataset.method = m.key;
      video.setAttribute("aria-label", `${m.label} reconstruction`);
      row.videos.push(video);
      cell.append(video);
      grid.append(cell);
    });

    const gtCell = el("div");
    const gt = makeVideo(`${dir}/gt.mp4`);
    gt.setAttribute("aria-label", "Ground-truth object");
    row.videos.push(gt);
    gtCell.append(gt);
    grid.append(gtCell);

    // Observe the whole row via its input cell (all cells of a row share one grid line).
    inputCell.row = row;
    observer.observe(inputCell);
    rows.push(row);
  });

  function setViews(n) {
    rows.forEach((row) => {
      row.images.forEach((img) => (img.src = `${row.dir}/cond_N${n}.jpg`));
      row.videos.forEach((video) => {
        if (video.dataset.method) video.dataset.src = `${row.dir}/${video.dataset.method}_N${n}.mp4`;
      });
      if (row.loaded) loadRow(row);
    });
  }

  if (config.perView) {
    const toggle = el("div", "view-toggle");
    toggle.append(el("span", "", "Number of input views N:"));
    const buttons = VIEW_COUNTS.map((n) => {
      const button = el("button", "", String(n));
      button.type = "button";
      button.setAttribute("aria-pressed", String(n === DEFAULT_VIEWS));
      button.addEventListener("click", () => {
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        setViews(n);
      });
      return button;
    });
    toggle.append(...buttons);
    container.append(toggle);
    setViews(DEFAULT_VIEWS);
  }

  wrap.append(grid);
  container.append(wrap);
  container.append(el("p", "compare__hint", "Scroll sideways to see all methods →"));
}

document.querySelectorAll("[data-compare]").forEach((container) => {
  buildComparison(container, COMPARISONS[container.dataset.compare]);
});
