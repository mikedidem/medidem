// Visitor globe: a small orthographic globe showing approximate visitor locations.
//
// Markup:  <div class="visitor-globe" data-endpoint="https://…workers.dev"></div>
//          (data-sample="1" draws built-in sample points instead of calling the API)
// Needs d3 v7 and topojson-client v3 loaded first.
//
// Layers, bottom to top: ocean, land, country borders, graticule, the real
// day/night terminator for the current time, limb shading, great-circle arcs
// from Carbondale to recent visitors, visitor dots, home marker.
// Colors come from the page's CSS tokens, so it follows the light/dark theme.
(function () {
  const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const HOME = [-89.2, 37.7]; // Carbondale, IL
  const RECENT_DAYS = 7;
  const MAX_ARCS = 40;
  const SPIN_DEG_PER_SEC = 6;
  const SPIN_REDUCED_DEG_PER_SEC = 2; // slow, steady turn when the OS asks for reduced motion; no pulses
  const DEFAULT_TILT = -18;

  const SAMPLE = [
    [41.9, -87.6], [38.6, -90.2], [40.8, -96.7], [47.6, -122.3], [40.7, -74.0],
    [30.3, -97.7], [39.7, -105.0], [51.5, -0.1], [52.5, 13.4], [48.9, 2.4],
    [5.0, 7.9], [6.5, 3.4], [9.1, 7.4], [-1.3, 36.8], [28.6, 77.2],
    [35.7, 139.7], [31.2, 121.5], [-33.9, 151.2], [-23.6, -46.6], [43.7, -79.4], [1.3, 103.8],
  ];

  const today = () => new Date().toISOString().slice(0, 10);
  const daysAgo = (iso) => (Date.parse(today()) - Date.parse(iso)) / 864e5;

  function tokens(el) {
    const s = getComputedStyle(el);
    const v = (name, fallback) => s.getPropertyValue(name).trim() || fallback;
    return {
      ocean: v("--accent-soft", "#e7eef0"),
      land: v("--terrain", "#806344"),
      line: v("--border", "#d2cdc1"),
      ink: v("--text", "#252b2e"),
      rim: v("--text-2", "#485154"),
      dot: v("--accent", "#245f7a"),
      paper: v("--surface", "#fcfaf5"),
      dark: (document.documentElement.dataset.theme === "dark"),
    };
  }

  // Point on Earth where the sun is overhead right now (accurate to well under 1°).
  function subsolarPoint(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const dayOfYear = (date - start) / 864e5;
    // Solar declination, including the eccentricity of Earth's orbit (accurate to ~0.2°).
    const w = 2 * Math.PI / 365.24;
    const decl = (180 / Math.PI) * Math.asin(Math.sin(-23.44 * Math.PI / 180) *
      Math.cos(w * (dayOfYear + 10) + 2 * 0.0167 * Math.sin(w * (dayOfYear - 2))));
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    // Equation of time (minutes): the sun runs up to ~16 min ahead of or behind clock time.
    const B = (2 * Math.PI / 364) * (dayOfYear - 81);
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    return [-15 * (hours - 12 + eot / 60), decl];
  }

  function storage(fn) {
    try { return fn(window.localStorage); } catch (e) { return null; }
  }

  // Count this browser at most once a day; "?vg-optout" in the URL turns
  // counting off for this browser (for the site owner).
  function ping(endpoint) {
    if (/[?&]vg-optout\b/.test(location.search)) storage((s) => s.setItem("vg-optout", "1"));
    if (storage((s) => s.getItem("vg-optout"))) return;
    if (storage((s) => s.getItem("vg-last")) === today()) return;
    fetch(endpoint + "/hit", { method: "POST", keepalive: true })
      .then(() => storage((s) => s.setItem("vg-last", today())))
      .catch(() => {});
  }

  async function loadPoints(el) {
    if (el.dataset.sample) {
      return SAMPLE.map(([lat, lon], i) => ({ lat, lon, last: i < 8 ? today() : "2026-01-01" }));
    }
    const res = await fetch(el.dataset.endpoint + "/points");
    if (!res.ok) throw new Error("points " + res.status);
    return (await res.json()).points;
  }

  // Satellite layer (WebGL2): NASA Blue Marble on the day side, Black Marble
  // city lights on the night side, blended along the real terminator.
  // Returns null when WebGL2 or the images are unavailable, so the vector
  // globe is used instead.
  const FRAG = `#version 300 es
  precision highp float;
  in vec2 v;
  out vec4 o;
  uniform sampler2D day, night;
  uniform float lon0, lat0, px;
  uniform vec3 sun;
  void main() {
    float r2 = dot(v, v);
    vec3 q = vec3(v, sqrt(max(0.0, 1.0 - r2)));
    float c = cos(-lat0), s = sin(-lat0);
    vec3 a = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
    float c2 = cos(lon0), s2 = sin(lon0);
    vec3 p = vec3(a.x * c2 + a.z * s2, a.y, -a.x * s2 + a.z * c2);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float u = atan(p.x, p.z) / 6.2831853 + 0.5;
    vec2 uv = vec2(u, 0.5 - lat / 3.1415927);
    vec2 uvB = vec2(fract(u + 0.5) - 0.5, uv.y);       // seam-free gradients across the antimeridian
    vec2 dx = dFdx(uv), dy = dFdy(uv), dxB = dFdx(uvB), dyB = dFdy(uvB);
    if (abs(dx.x) + abs(dy.x) > abs(dxB.x) + abs(dyB.x)) { dx = dxB; dy = dyB; }
    vec3 d = textureGrad(day, uv, dx, dy).rgb;
    vec3 n = textureGrad(night, uv, dx, dy).rgb;
    float k = dot(p, sun);
    float t = smoothstep(-0.10, 0.10, k);
    vec3 nightCol = n * vec3(1.25, 1.1, 0.85) + d * 0.035;
    vec3 dayCol = pow(d, vec3(0.85)) * (0.82 + 0.33 * clamp(k * 1.6 + 0.2, 0.0, 1.0));
    vec3 col = mix(nightCol, dayCol, t);
    col *= mix(0.8, 1.0, pow(q.z, 0.5));               // limb darkening
    float edge = smoothstep(1.0, 1.0 - px, sqrt(r2));
    o = vec4(col * edge, edge);
  }`;
  const VERT = `#version 300 es
  in vec2 a; out vec2 v;
  void main() { v = a; gl_Position = vec4(a, 0.0, 1.0); }`;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function earthLayer(el) {
    const glCanvas = document.createElement("canvas");
    const gl = glCanvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
    if (!gl) return null;
    const [dayImg, nightImg] = await Promise.all([loadImage(el.dataset.day), loadImage(el.dataset.night)]);

    const shader = (type, src) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    [dayImg, nightImg].forEach((img, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });
    gl.uniform1i(gl.getUniformLocation(prog, "day"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "night"), 1);
    const U = (name) => gl.getUniformLocation(prog, name);
    const uLon = U("lon0"), uLat = U("lat0"), uPx = U("px"), uSun = U("sun");

    return {
      canvas: glCanvas,
      resize(size, dpr, radius) {
        glCanvas.width = size * dpr; glCanvas.height = size * dpr;
        glCanvas.style.width = size + "px"; glCanvas.style.height = size + "px";
        // Draw the sphere into the same radius d3 uses for the overlay.
        const inset = Math.round((size / 2 - radius) * dpr);
        gl.viewport(inset, inset, glCanvas.width - 2 * inset, glCanvas.height - 2 * inset);
        gl.uniform1f(uPx, 1.5 / (radius * dpr));
      },
      render(lonCenter, latCenter, sunLonLat) {
        const rad = Math.PI / 180;
        const [sl, sp] = [sunLonLat[0] * rad, sunLonLat[1] * rad];
        gl.uniform1f(uLon, lonCenter * rad);
        gl.uniform1f(uLat, latCenter * rad);
        gl.uniform3f(uSun, Math.cos(sp) * Math.sin(sl), Math.sin(sp), Math.cos(sp) * Math.cos(sl));
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
  }

  async function mount(el) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Globe showing approximate locations of visitors to this site, with day and night shading for the current time");
    const ctx = canvas.getContext("2d");
    const TILT = el.dataset.tilt ? +el.dataset.tilt : DEFAULT_TILT;
    const earth = el.dataset.day ? await earthLayer(el).catch((e) => { console.warn("visitor-globe: satellite layer unavailable", e); return null; }) : null;
    if (earth) {
      el.style.position = "relative";
      earth.canvas.setAttribute("aria-hidden", "true");
      Object.assign(canvas.style, { position: "absolute", left: "0", top: "0" });
      el.appendChild(earth.canvas);
    }
    el.appendChild(canvas);

    const [world, points, places] = await Promise.all([
      fetch(WORLD_URL).then((r) => r.json()),
      loadPoints(el).catch(() => []),
      // Places the author has been: a separate, labeled layer (data-places="places.json").
      el.dataset.places ? fetch(el.dataset.places).then((r) => r.json()).catch(() => []) : [],
    ]);
    if (el.dataset.endpoint && !el.dataset.sample) ping(el.dataset.endpoint);

    const land = topojson.feature(world, world.objects.land);
    const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
    const graticule = d3.geoGraticule10();
    const sphere = { type: "Sphere" };

    // Arcs from home to the most recent distinct visitor locations (past week only).
    const arcs = points
      .filter((p) => p.last && daysAgo(p.last) <= RECENT_DAYS)
      .filter((p) => d3.geoDistance(HOME, [p.lon, p.lat]) > 0.01)
      .slice(0, MAX_ARCS)
      .map((p) => ({
        type: "LineString",
        coordinates: d3.range(0, 1.0001, 1 / 48).map(d3.geoInterpolate(HOME, [p.lon, p.lat])),
        recent: p.last && daysAgo(p.last) <= RECENT_DAYS,
        seed: Math.abs(p.lat * 7 + p.lon * 3) % 1,
      }));

    const projection = d3.geoOrthographic().clipAngle(90).precision(0.4);
    const path = d3.geoPath(projection, ctx);
    let colors = tokens(el);
    let size = 0;

    function resize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      size = el.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      projection.translate([size / 2, size / 2]).scale(size / 2 - 2);
      if (earth) { el.style.height = size + "px"; earth.resize(size, dpr, size / 2 - 2); }
    }

    let lambda = -HOME[0] - 25;

    let last = performance.now();
    let dragging = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function stroke(geom, color, width, alpha) {
      ctx.beginPath(); path(geom);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha; ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const SAT = { dot: "#f2c14e", paper: "rgba(10,14,18,0.75)", ink: "#ffffff", rim: "rgba(0,0,0,0.35)" };

    function draw(now) {
      projection.rotate([lambda, TILT]);
      const center = [-lambda, -TILT];
      const facing = (lonlat) => d3.geoDistance(lonlat, center) < Math.PI / 2 - 0.02;
      const c = earth ? { ...colors, ...SAT } : colors;
      const R = size / 2 - 2;
      ctx.clearRect(0, 0, size, size);
      // Real sun position, recomputed every frame: day and night match the actual time.
      const sun = subsolarPoint(new Date());

      if (earth) {
        earth.render(-lambda, -TILT, sun);
      } else {
      // Ocean and land.
      ctx.beginPath(); path(sphere); ctx.fillStyle = c.ocean; ctx.fill();
      ctx.beginPath(); path(land);
      ctx.fillStyle = c.land; ctx.globalAlpha = c.dark ? 0.32 : 0.26; ctx.fill(); ctx.globalAlpha = 1;
      stroke(land, c.land, 0.6, 0.8);
      stroke(borders, c.land, 0.35, 0.55);
      stroke(graticule, c.rim, 0.4, 0.14);

      // Night side: everything more than 90° from the subsolar point.
      const night = d3.geoCircle().center([sun[0] + 180, -sun[1]]).radius(90)();
      ctx.beginPath(); path(night);
      ctx.fillStyle = c.dark ? "#000" : c.ink; ctx.globalAlpha = c.dark ? 0.35 : 0.13; ctx.fill(); ctx.globalAlpha = 1;
      const twilight = d3.geoCircle().center([sun[0] + 180, -sun[1]]).radius(96)();
      ctx.beginPath(); path(twilight);
      ctx.fillStyle = c.dark ? "#000" : c.ink; ctx.globalAlpha = c.dark ? 0.12 : 0.05; ctx.fill(); ctx.globalAlpha = 1;

      // Limb shading so the sphere reads as round.
      const cx = size / 2, cy = size / 2;
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, c.dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)");
      g.addColorStop(0.7, "rgba(0,0,0,0)");
      g.addColorStop(1, c.dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.07)");
      ctx.beginPath(); path(sphere); ctx.fillStyle = g; ctx.fill();
      }

      // Great-circle arcs from Carbondale, each with a moving tracer.
      for (const a of arcs) {
        stroke(a, c.dot, 0.8, 0.45);
        if (a.recent && !reduced.matches) {
          const t = ((((now / 3200) + a.seed) % 1) + 1) % 1;
          const k = Math.round(t * (a.coordinates.length - 1));
          const lonlat = a.coordinates[k];
          if (facing(lonlat)) {
            const [x, y] = projection(lonlat);
            ctx.fillStyle = c.dot; ctx.globalAlpha = Math.sin(Math.PI * t);
            ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1;
          }
        }
      }

      // Places I've been, drawn under the visitor dots: open diamonds by default,
      // or plain dots matching the visitors when data-places-style="dots".
      const dsz = Math.min(5, Math.max(2.4, size / 80));
      const asDots = el.dataset.placesStyle === "dots";
      for (const pl of places) {
        const lonlat = [pl.lon, pl.lat];
        if (!facing(lonlat) || d3.geoDistance(lonlat, HOME) < 0.005) continue;
        const [x, y] = projection(lonlat);
        if (asDots) {
          const rr = Math.min(3.6, Math.max(1.8, size / 105));
          ctx.fillStyle = c.paper; ctx.beginPath(); ctx.arc(x, y, rr + 1.1, 0, 2 * Math.PI); ctx.fill();
          ctx.fillStyle = c.dot; ctx.beginPath(); ctx.arc(x, y, rr, 0, 2 * Math.PI); ctx.fill();
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(x, y - dsz); ctx.lineTo(x + dsz, y); ctx.lineTo(x, y + dsz); ctx.lineTo(x - dsz, y); ctx.closePath();
        ctx.fillStyle = earth ? "rgba(10,14,18,0.55)" : c.paper; ctx.fill();
        ctx.strokeStyle = earth ? "#ffffff" : c.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
      }

      // Visitor dots, with a paper-colored halo so they sit cleanly on the map.
      const r = Math.min(3.6, Math.max(1.8, size / 105));
      for (const p of points) {
        const lonlat = [p.lon, p.lat];
        if (!facing(lonlat)) continue;
        const [x, y] = projection(lonlat);
        ctx.fillStyle = c.paper;
        ctx.beginPath(); ctx.arc(x, y, r + 1.1, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = c.dot;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
        if (!reduced.matches && p.last && daysAgo(p.last) <= RECENT_DAYS) {
          const phase = ((((now / 2400) + (p.lat + p.lon) / 97) % 1) + 1) % 1;
          ctx.strokeStyle = c.dot; ctx.globalAlpha = 1 - phase; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, r + phase * r * 3.5, 0, 2 * Math.PI); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // Home marker: Carbondale.
      if (facing(HOME)) {
        const [x, y] = projection(HOME);
        ctx.fillStyle = c.paper;
        ctx.beginPath(); ctx.arc(x, y, r + 2.4, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, r + 1.4, 0, 2 * Math.PI); ctx.stroke();
        ctx.fillStyle = c.ink;
        ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 2 * Math.PI); ctx.fill();
      }

      ctx.beginPath(); path(sphere); ctx.strokeStyle = c.rim; ctx.lineWidth = 0.9; ctx.stroke();
    }

    let visible = true;
    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!dragging) lambda += (reduced.matches ? SPIN_REDUCED_DEG_PER_SEC : SPIN_DEG_PER_SEC) * dt;
      draw(now);
      if (visible) requestAnimationFrame(frame);
    }
    function start() { last = performance.now(); requestAnimationFrame(frame); }

    // Drag to turn the globe (mouse and pen only, so touch swipes still scroll the page).
    d3.select(canvas).call(
      d3.drag()
        .touchable(() => false)
        .on("start", () => { dragging = true; })
        .on("drag", (e) => { lambda += e.dx * (180 / size); })
        .on("end", () => { dragging = false; })
    );

    // Pause when off screen or the tab is hidden.
    new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting && !document.hidden;
      if (visible && !was) start();
    }).observe(el);
    document.addEventListener("visibilitychange", () => {
      const was = visible;
      visible = !document.hidden;
      if (visible && !was) start();
    });

    // Follow theme changes.
    const retheme = () => { colors = tokens(el); draw(performance.now()); };
    new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);
    window.addEventListener("resize", () => { resize(); draw(performance.now()); });

    resize();
    draw(performance.now());
    start();
  }

  function init() {
    document.querySelectorAll(".visitor-globe").forEach((el) => mount(el).catch(() => {}));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
