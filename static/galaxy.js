/* QuakeAware cinematic 3D engine (Three.js r128).
   Phase 1: realistic solar system, click Earth to begin.
   Phase 2: photoreal rotating globe that spins to the searched location. */
(function () {
  const canvas = document.getElementById("bg");
  if (!window.THREE || !canvas) return;

  const IMG = "https://unpkg.com/three-globe@2.31.0/example/img/";
  const EARTH_R = 26;
  const D2R = Math.PI / 180;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 8000);
  camera.position.set(0, 210, 780);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";
  const srgb = (t) => { t.encoding = THREE.sRGBEncoding; return t; };

  // ---- Lighting ----
  scene.add(new THREE.AmbientLight(0x2a3550, 0.6));
  const sunLight = new THREE.PointLight(0xfff2d6, 3.2, 0, 1.4);
  scene.add(sunLight);
  const globeLight = new THREE.DirectionalLight(0xffffff, 0);
  globeLight.position.set(1, 0.5, 1);
  scene.add(globeLight);

  // ---- Background star sphere ----
  const bg = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 48, 48),
    new THREE.MeshBasicMaterial({ map: srgb(loader.load(IMG + "night-sky.png")), side: THREE.BackSide })
  );
  scene.add(bg);

  // ---- Sun ----
  const fadeables = [];
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(55, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xffcf6b })
  );
  scene.add(sun);
  fadeables.push(sun.material);

  function glowSprite(color, size) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d").createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(0.4, color.replace("1)", "0.5)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    const ctx = c.getContext("2d"); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false,
    }));
    s.scale.set(size, size, 1);
    return s;
  }
  const sunGlow = glowSprite("rgba(255,190,90,1)", 320);
  sun.add(sunGlow);
  fadeables.push(sunGlow.material);

  // ---- Planets (stylised but ordered/coloured realistically) ----
  const planetDefs = [
    { r: 5, orbit: 110, speed: 0.90, color: 0x9a938c, name: "mercury" },
    { r: 9, orbit: 165, speed: 0.62, color: 0xd9a066, name: "venus" },
    { r: EARTH_R, orbit: 255, speed: 0.42, name: "earth" },
    { r: 7, orbit: 320, speed: 0.34, color: 0xc1440e, name: "mars" },
    { r: 33, orbit: 450, speed: 0.18, color: 0xd8b58a, name: "jupiter" },
    { r: 27, orbit: 585, speed: 0.12, color: 0xe3d3a2, name: "saturn", ring: true },
  ];
  const planets = [];
  let earthGroup, tiltGroup, spinGroup, earthHit;

  planetDefs.forEach((d) => {
    // faint orbit line
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * d.orbit, 0, Math.sin(a) * d.orbit));
    }
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x5b8cff, transparent: true, opacity: 0.16 })
    );
    scene.add(line); fadeables.push(line.material);

    if (d.name === "earth") {
      earthGroup = new THREE.Group();
      earthGroup.rotation.z = 23.5 * D2R;
      tiltGroup = new THREE.Group();
      spinGroup = new THREE.Group();
      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R, 96, 96),
        new THREE.MeshPhongMaterial({
          map: srgb(loader.load(IMG + "earth-blue-marble.jpg")),
          bumpMap: loader.load(IMG + "earth-topology.png"), bumpScale: 0.7,
          specularMap: loader.load(IMG + "earth-water.png"),
          specular: new THREE.Color(0x334455), shininess: 14,
        })
      );
      spinGroup.add(earth);
      // atmosphere rim glow
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R * 1.04, 64, 64),
        new THREE.MeshBasicMaterial({ color: 0x5b9bff, transparent: true, opacity: 0.18,
          side: THREE.BackSide, blending: THREE.AdditiveBlending })
      );
      // easy-click invisible hit sphere
      earthHit = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_R * 1.4, 16, 16),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      tiltGroup.add(spinGroup);
      earthGroup.add(tiltGroup, atmo, earthHit);
      scene.add(earthGroup);
      planets.push({ def: d, group: earthGroup, angle: Math.random() * 6 });
    } else {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(d.r, 48, 48),
        new THREE.MeshPhongMaterial({ color: d.color, shininess: 6 })
      );
      if (d.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(d.r * 1.4, d.r * 2.2, 64),
          new THREE.MeshBasicMaterial({ color: 0xcdb98a, side: THREE.DoubleSide,
            transparent: true, opacity: 0.7 })
        );
        ring.rotation.x = Math.PI / 2.3; mesh.add(ring);
        fadeables.push(ring.material);
      }
      scene.add(mesh);
      fadeables.push(mesh.material);
      planets.push({ def: d, group: mesh, angle: Math.random() * 6 });
    }
  });

  // ---- Marker ----
  let markerGroup = null, pulses = [];
  function addMarker(m) {
    if (markerGroup) spinGroup.remove(markerGroup);
    markerGroup = new THREE.Group();
    const normal = m.clone().normalize();
    markerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    markerGroup.position.copy(m);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x7dffea })
    );
    markerGroup.add(dot);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 6, 8),
      new THREE.MeshBasicMaterial({ color: 0x7dffea, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending })
    );
    beam.rotation.x = Math.PI / 2; beam.position.z = 3;
    markerGroup.add(beam);
    pulses = [];
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.1, 1.5, 40),
        new THREE.MeshBasicMaterial({ color: 0x7dffea, side: THREE.DoubleSide,
          transparent: true, blending: THREE.AdditiveBlending })
      );
      markerGroup.add(ring); pulses.push({ ring, off: i * 0.5 });
    }
    spinGroup.add(markerGroup);
  }

  // ---- State machine ----
  let state = "solar";     // solar | entering | globe | located
  let autoSpin = true;
  let orbitA = 0;
  const camPos = new THREE.Vector3().copy(camera.position);
  const camPosT = new THREE.Vector3().copy(camera.position);
  const look = new THREE.Vector3(0, 0, 0);
  const lookT = new THREE.Vector3(0, 0, 0);
  let fadeT = 1, tiltZT = 23.5 * D2R, lightT = 0;
  let spinT = 0, tiltXT = 0;
  let mx = 0, my = 0;

  function startFocus() {
    if (state !== "solar") return;
    state = "entering";
    document.body.dataset.state = "entering";
    const p = earthGroup.position;
    camPosT.set(p.x, p.y + EARTH_R * 0.3, p.z + EARTH_R * 3.4);
    lookT.copy(p);
    fadeT = 0; lightT = 1.5;
    globeLight.position.set(p.x + 60, p.y + 40, p.z + 90);
    setTimeout(() => { state = "globe"; document.body.dataset.state = "globe"; }, 1500);
  }

  function focusOn(lat, lon) {
    if (state === "solar" || state === "entering") return;
    state = "located"; document.body.dataset.state = "located";
    autoSpin = false;
    const phi = (90 - lat) * D2R, theta = (lon + 180) * D2R;
    const m = new THREE.Vector3(
      -(EARTH_R * Math.sin(phi) * Math.cos(theta)),
      EARTH_R * Math.cos(phi),
      EARTH_R * Math.sin(phi) * Math.sin(theta)
    );
    addMarker(m);
    const h = Math.hypot(m.x, m.z);
    tiltXT = Math.atan2(m.y, h);
    // shortest-path spin target
    let cur = spinGroup.rotation.y, tgt = -Math.atan2(m.x, m.z);
    let diff = ((tgt - cur + Math.PI) % (2 * Math.PI)) - Math.PI;
    spinT = cur + diff;
    tiltZT = 0;
    const p = earthGroup.position;
    camPosT.set(p.x, p.y, p.z + EARTH_R * 2.7);
    lookT.copy(p);
  }

  window.QA = { focusOn, enter: startFocus };

  // ---- Interaction ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "solar") return;
    ndc.x = (e.clientX / innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(earthHit, true).length) startFocus();
  });
  addEventListener("mousemove", (e) => {
    mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5;
  });
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---- Loop ----
  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    bg.rotation.y = t * 0.003;

    if (state === "solar") {
      orbitA += 0.0011;
      planets.forEach((p) => {
        p.angle += p.def.speed * 0.004;
        p.group.position.set(Math.cos(p.angle) * p.def.orbit, 0, Math.sin(p.angle) * p.def.orbit);
      });
      if (spinGroup) spinGroup.rotation.y += 0.004;
      const R = 780;
      camera.position.set(
        Math.sin(orbitA) * R + mx * 120, 210 - my * 80, Math.cos(orbitA) * R
      );
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.lerp(camPosT, 0.045);
      const p = earthGroup.position;
      lookT.copy(p);
      look.lerp(lookT, 0.06);
      // subtle parallax around the globe once settled
      camera.position.x += (mx * 30) * 0.02;
      camera.position.y += (-my * 20) * 0.02;
      camera.lookAt(look);

      fadeables.forEach((m) => {
        m.opacity += (fadeT - (m.opacity === undefined ? 1 : m.opacity)) * 0.06;
        m.transparent = true;
        if (fadeT === 0 && m.opacity < 0.02) m.opacity = 0;
      });
      globeLight.intensity += (lightT - globeLight.intensity) * 0.05;
      sunLight.intensity += (0.4 - sunLight.intensity) * 0.05;
      earthGroup.rotation.z += (tiltZT - earthGroup.rotation.z) * 0.05;

      if (autoSpin) spinGroup.rotation.y += 0.0016;
      else {
        spinGroup.rotation.y += (spinT - spinGroup.rotation.y) * 0.045;
        tiltGroup.rotation.x += (tiltXT - tiltGroup.rotation.x) * 0.045;
      }
      pulses.forEach((pu) => {
        const s = ((t + pu.off) % 1.5) / 1.5;
        pu.ring.scale.setScalar(1 + s * 4);
        pu.ring.material.opacity = 0.8 * (1 - s);
      });
    }
    renderer.render(scene, camera);
  })();
})();
