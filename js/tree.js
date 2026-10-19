/**
 * Autumn Trees – plain JavaScript port of the tree from ncammarata/personal.
 * No React, no Pts.js, no other libraries needed.
 *
 * Left-margin mode (size/position are controlled by your CSS):
 *   <div id="autumn-trees"></div>
 *   <script src="js/tree.js"></script>
 *   <script>AutumnTrees.mount("#autumn-trees", { side: "left" });</script>
 *
 * Fill-a-box mode (the box needs a height):
 *   <div id="box" style="height:500px"></div>
 *   <script>AutumnTrees.mount("#box");</script>
 */

(() => {
  "use strict";

  // Settings copied from the original `config` object.
  // (The original listed `seed` twice: 310 and then 31. The last one
  //  wins in JavaScript, so 31 is what the real site used.)
  const BASE = {
    seed: 31,
    scale: 100,            // trunk length basis (times each tree's scale)
    lineWidth: 44,         // trunk thickness at depth 1
    lineWidthFalloff: 1.6, // each level is this many times thinner
    lengthVar: 2.3,        // how random branch lengths are
    branchiness: 0.034,    // chance of a side twig per segment
    curveAmount: 0.15,     // base bend of branches
    upAmount: 0.0085,      // pull on branches (makes them droop)
    spread: 0.4            // angle between a branch's two children (radians)
  };

  const DEFAULTS = {
    background: null,            // null = transparent. Or e.g. "#ffffff"
    trunkColor: "rgb(83,53,10)",
    leafHue: 130,                 // 28 = orange. Try 10 (red) or 45 (yellow)
    sway: 1,                     // 0 = still, 1 = original, 2 = windier
    speed: 1,                    // animation speed
    animate: true,

    side: null,                  // "left", "right", or null (fill the box)

    // On small screens the tree is drawn one level simpler and at a lower
    // resolution, so it is light on phone batteries.
    lightQuery: "(max-width: 899px)",

    // x = trunk position as a fraction of the frame's width
    // scale / maxDepth = tree size / how many times it branches
    trees: null
  };

  // The original drew on a canvas 1000 units tall. All sizes are in those
  // units and are scaled to fit whatever box is used.
  const FILL_VIEW = { w: null, h: 1000 };
  const SIDE_VIEW = { w: 860, h: 780 }; // snug frame around the two trees

  const FILL_TREES = [
    { x: 0.55, scale: 0.9, maxDepth: 11 },
    { x: 0.2, scale: 0.4, maxDepth: 8, lineWidth: 55 }
  ];

  const SIDE_TREES = [
    { x: 0.465, scale: 0.9, maxDepth: 11 },
    { x: 0.174, scale: 0.4, maxDepth: 8, lineWidth: 55 }
  ];

  const FRAME_MS = 1000 / 60;

  // Same seeded random generator as the original, so the tree shape
  // is the same every frame (only the wind changes).
  function makeRandom(seed) {
    let s = seed;

    const random = () => {
      const x = Math.sin(s) * 10000;
      s++;
      return x - Math.floor(x);
    };

    const unif = (a, b) => random() * (b - a) + a;

    const gaussian = (mean, std) => {
      let r = 0;
      for (let i = 0; i < 6; i++) r += random();
      return ((r - 3) / 6) * std + mean;
    };

    return { unif, gaussian };
  }

  // Draws one branch, then (recursively) everything that grows from it.
  // The order of random numbers is identical to the original.
  function growBranch(ctx, x, y, angle, depth, rnd, cfg, style) {
    if (depth >= cfg.maxDepth) return;

    const length = (cfg.scale / depth) * rnd.gaussian(1, cfg.lengthVar);
    const segments = length / 10;
    const width = cfg.lineWidth / Math.pow(cfg.lineWidthFalloff, depth);

    let curve = -cfg.curveAmount;
    if (depth === 1) curve *= 0.25;

    // Collect the points of this branch and stroke them in one go.
    let pts = [x, y];

    const flush = () => {
      if (pts.length >= 4) {
        ctx.lineWidth = width;
        ctx.strokeStyle = style.trunkColor;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.stroke();
      }
      pts = [x, y];
    };

    for (let i = 0; i < segments; i++) {
      const up = Math.PI / 2 - angle;

      const nx = x + 20 * Math.cos(angle);
      const ny = y + 20 * Math.sin(angle);
      const nextAngle = angle + curve + up * cfg.upAmount * depth;

      x = nx;
      y = ny;
      angle = nextAngle;
      pts.push(x, y);

      // Occasionally grow a small side branch.
      if (rnd.unif(0, 1) < cfg.branchiness) {
        const dir = rnd.unif(0, 1) < 0.5 ? -1 : 1;
        flush();
        growBranch(
          ctx, x, y,
          angle + (cfg.spread / 2) * dir,
          depth + 1, rnd, cfg, style
        );
      }
    }

    flush();

    // At the end of the branch, split in two.
    const dir = rnd.unif(0, 1) < 0.5 ? -1 : 1;
    growBranch(ctx, x, y, angle + cfg.spread * dir, depth + 1, rnd, cfg, style);
    growBranch(ctx, x, y, angle + cfg.spread * -dir, depth + 1, rnd, cfg, style);

    // The last two levels of branches get a leaf blob at their tip.
    if (depth >= cfg.maxDepth - 2) {
      const h = rnd.gaussian(style.leafHue, 30);
      const s = rnd.unif(42, 58);
      const l = rnd.unif(34, 44);
      const r = Math.max(5, rnd.gaussian(10, 35));

      ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${style.leafAlpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function mount(target, options = {}) {
    const host = typeof target === "string"
      ? document.querySelector(target)
      : target;

    if (!host) {
      throw new Error("AutumnTrees: target element not found.");
    }

    const opts = { ...DEFAULTS, ...options };
    const sideMode = opts.side === "left" || opts.side === "right";
    const view = sideMode ? SIDE_VIEW : FILL_VIEW;
    const treeList = opts.trees || (sideMode ? SIDE_TREES : FILL_TREES);

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");

    Object.assign(canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
      position: "absolute",
      inset: "0",
      pointerEvents: "none"
    });

    if (getComputedStyle(host).position === "static") {
      if (sideMode) {
        // Fallback if your CSS has no rule for this element.
        Object.assign(host.style, {
          position: "fixed",
          bottom: "0",
          [opts.side]: "0",
          width: "min(30vw, 420px)",
          aspectRatio: `${view.w} / ${view.h}`,
          zIndex: "-1",
          pointerEvents: "none"
        });
      } else {
        host.style.position = "relative";
      }
    }

    host.style.overflow = "hidden";
    host.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const lightMq = window.matchMedia(opts.lightQuery);

    let width = 1;
    let height = 1;
    let dpr = 1;
    let unit = 1;     // CSS pixels per drawing unit
    let offsetX = 0;  // where the frame starts inside the box (CSS px)
    let visible = false;
    let raf = 0;
    let startTime = performance.now();
    let disposed = false;

    function render(frame) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      if (opts.background) {
        ctx.fillStyle = opts.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      ctx.setTransform(dpr * unit, 0, 0, dpr * unit, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const style = {
        trunkColor: opts.trunkColor,
        leafHue: opts.leafHue,
        // All leaves gently pulse together, like the original.
        leafAlpha: 0.8 + 0.2 * Math.sin(frame / 50)
      };

      const drop = lightMq.matches ? 1 : 0;

      for (const t of treeList) {
        const rnd = makeRandom(t.seed ?? BASE.seed);
        const merged = { ...BASE, ...t };

        // The "wind": spread and curve wobble slowly over time.
        // This is what makes the tips sway more than the trunk.
        const delta = Math.max(
          0.0001,
          Math.sin(frame / 140) * 0.02 * opts.sway + merged.curveAmount
        );

        const cfg = {
          ...merged,
          spread: merged.spread +
            0.02 * opts.sway * Math.sin(frame / 30),
          curveAmount: -0.15 + Math.pow(delta, 0.8),
          scale: BASE.scale * (t.scale ?? 1),
          maxDepth: Math.max(4, (t.maxDepth ?? 10) - drop)
        };

        const startAngle = -Math.PI / 2 + rnd.gaussian(0, 0.5);

        let baseX, baseY;
        if (sideMode) {
          // Trunks stand on the bottom edge of the box.
          baseX = offsetX / unit + (t.x ?? 0.5) * view.w;
          baseY = height / unit;
        } else {
          baseX = (t.x ?? 0.5) * (width / unit);
          baseY = view.h;
        }

        growBranch(ctx, baseX, baseY, startAngle, 1, rnd, cfg, style);
      }
    }

    function currentFrame(now) {
      if (!opts.animate || reducedMotion.matches) return 0;
      return ((now - startTime) / FRAME_MS) * opts.speed;
    }

    function schedule() {
      if (raf || disposed || !visible) return;
      if (!opts.animate || reducedMotion.matches) return;
      raf = requestAnimationFrame(loop);
    }

    function loop(now) {
      raf = 0;
      if (disposed || !visible) return;
      render(currentFrame(now));
      schedule();
    }

    // Runs whenever the box changes size (rotate phone, resize window,
    // CSS media query hides/shows it). A hidden box costs nothing.
    function resize() {
      if (disposed) return;

      const rect = host.getBoundingClientRect();
      visible = rect.width > 2 && rect.height > 2;

      if (!visible) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }

      width = rect.width;
      height = rect.height;

      if (sideMode) {
        // Fit the whole frame inside the box, glued to the chosen edge.
        unit = Math.min(height / view.h, width / view.w);
        offsetX = opts.side === "left" ? 0 : width - view.w * unit;
      } else {
        unit = height / view.h;
        offsetX = 0;
      }

      dpr = Math.min(window.devicePixelRatio || 1, lightMq.matches ? 1.5 : 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      render(currentFrame(performance.now()));
      schedule();
    }

    function restart() {
      cancelAnimationFrame(raf);
      raf = 0;
      startTime = performance.now();
      resize();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    reducedMotion.addEventListener?.("change", restart);
    lightMq.addEventListener?.("change", resize);

    resize();

    return {
      canvas,

      destroy() {
        disposed = true;
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        reducedMotion.removeEventListener?.("change", restart);
        lightMq.removeEventListener?.("change", resize);
        canvas.remove();
      },

      redraw() {
        resize();
      }
    };
  }

  window.AutumnTrees = { mount };
})();