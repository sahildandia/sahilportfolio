/* Interactive orbital sculpture. Three.js 0.180.0 is vendored locally (MIT).
 * The scene is decorative: portfolio content stays usable before it loads. */
const host = document.querySelector('#hero-scene');
const canvas = document.querySelector('#hero-canvas');
const status = document.querySelector('#scene-status');
const motionButton = document.querySelector('#scene-motion');

if (host && canvas) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let manuallyPaused = false;
  let visible = true;
  let started = false;
  let disposed = false;
  let ready = false;
  let renderer;
  let scene;
  let camera;
  let sculpture;
  let satelliteGroup;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let lastInteractionTime = 0;
  let renderedFrames = 0;
  let resizeObserver;
  const pointer = { x: 0, y: 0 };
  const easedPointer = { x: 0, y: 0 };
  const smallScreen = matchMedia('(max-width: 700px)');

  host.dataset.sceneState = 'idle';
  canvas.setAttribute('aria-hidden', 'true');
  // Read-only diagnostics make animation/lifecycle checks possible without
  // depending on pixel snapshots or adding controls to the visual design.
  Object.defineProperty(host, 'sceneDiagnostics', {
    get: () => ({
      frameCount: renderedFrames,
      pointerTarget: { ...pointer },
      rotation: sculpture ? { x: sculpture.rotation.x, y: sculpture.rotation.y, z: sculpture.rotation.z } : null,
      visible, reducedMotion: reducedMotion.matches, manuallyPaused, ready,
      running: Boolean(frame),
    }),
  });

  function motionAllowed() {
    return !manuallyPaused && !reducedMotion.matches;
  }

  function updateControls() {
    if (motionButton) {
      const paused = manuallyPaused || reducedMotion.matches;
      motionButton.setAttribute('aria-pressed', String(paused));
      motionButton.textContent = paused ? 'Resume motion' : 'Pause motion';
      // System preference has priority; avoid promising motion it prohibits.
      motionButton.disabled = reducedMotion.matches || !ready;
      motionButton.setAttribute('aria-label', reducedMotion.matches
        ? 'Motion disabled by your reduced-motion preference'
        : `${paused ? 'Resume' : 'Pause'} the decorative 3D animation`);
    }
    if (status && ready) {
      status.textContent = reducedMotion.matches ? '3D sculpture · Reduced motion'
        : manuallyPaused ? '3D sculpture · Motion paused'
          : smallScreen.matches ? 'Live 3D · Orbital sculpture'
            : 'Interactive 3D · Move your pointer';
    }
  }

  function stopLoop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }

  function fallback() {
    disposed = true;
    ready = false;
    stopLoop();
    resizeObserver?.disconnect();
    renderer?.dispose();
    host.dataset.sceneState = 'fallback';
    if (status) status.textContent = 'Orbital study · Static artwork';
    if (motionButton) {
      motionButton.disabled = true;
      motionButton.hidden = true;
    }
  }

  function renderStill() {
    if (ready && !disposed && visible && !document.hidden) {
      renderer.render(scene, camera);
      renderedFrames++;
    }
  }

  function animate(now) {
    frame = 0;
    if (!ready || disposed || !visible || document.hidden) return;
    if (smallScreen.matches && motionAllowed() && lastTime && now - lastTime < 1000 / 30) {
      frame = requestAnimationFrame(animate);
      return;
    }
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    if (motionAllowed()) {
      elapsed += delta;
      easedPointer.x += (pointer.x - easedPointer.x) * 0.05;
      easedPointer.y += (pointer.y - easedPointer.y) * 0.05;
      sculpture.rotation.y = elapsed * 0.105 + easedPointer.x * 0.18;
      sculpture.rotation.x = Math.sin(elapsed * 0.22) * 0.045 + easedPointer.y * 0.12;
      sculpture.position.y = Math.sin(elapsed * 0.7) * 0.055;
      satelliteGroup.rotation.y = -elapsed * 0.075;
      satelliteGroup.rotation.z = Math.sin(elapsed * 0.17) * 0.065;
    }
    renderer.render(scene, camera);
    renderedFrames++;
    if (motionAllowed()) frame = requestAnimationFrame(animate);
  }

  function resumeLoop() {
    if (!ready || disposed || !visible || document.hidden) return;
    if (!frame) frame = requestAnimationFrame(animate);
  }

  function onVisibilityChange() {
    if (document.hidden) stopLoop();
    else resumeLoop();
  }

  motionButton?.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    updateControls();
    stopLoop();
    resumeLoop();
  });

  reducedMotion.addEventListener('change', () => {
    pointer.x = pointer.y = easedPointer.x = easedPointer.y = 0;
    updateControls();
    stopLoop();
    resumeLoop();
  });

  host.addEventListener('pointermove', (event) => {
    // Touch gestures keep their native page-scrolling behavior.
    if (event.pointerType === 'touch' || !motionAllowed()) return;
    const now = performance.now();
    if (now - lastInteractionTime < 30) return;
    lastInteractionTime = now;
    const rect = host.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    pointer.y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
  }, { passive: true });
  host.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fallback();
  });
  document.addEventListener('visibilitychange', onVisibilityChange);

  async function start() {
    if (started || disposed) return;
    started = true;
    host.dataset.sceneState = 'loading';
    if (status) status.textContent = 'Preparing the orbital sculpture';
    updateControls();
    try {
      // Check support before transferring the library. No remote CDN is used.
      const context = canvas.getContext('webgl2', {
        alpha: true, antialias: true,
        powerPreference: 'low-power', failIfMajorPerformanceCaveat: true,
      });
      if (!context) { fallback(); return; }
      const THREE = await import('./vendor/three.module.min.js');
      if (disposed) return;
      renderer = new THREE.WebGLRenderer({
        canvas, context, alpha: true, antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, smallScreen.matches ? 1.3 : 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
      camera.position.set(0, 0.35, 8.8);
      camera.lookAt(0, 0, 0);

      // Soft environment lights reveal the metal without expensive shadows.
      scene.add(new THREE.HemisphereLight(0xe3e5ff, 0x16142a, 2.5));
      const key = new THREE.DirectionalLight(0xe9eeff, 5);
      key.position.set(3, 5, 4);
      scene.add(key);
      const violet = new THREE.PointLight(0x9b72ff, 35, 15, 2);
      violet.position.set(-3, 1.6, 2);
      scene.add(violet);
      const cyan = new THREE.PointLight(0x66e1ec, 30, 15, 2);
      cyan.position.set(3, -1.1, 2.4);
      scene.add(cyan);
      const rim = new THREE.DirectionalLight(0xb8a1ff, 4);
      rim.position.set(-2, -1, -3);
      scene.add(rim);

      // Painted reflection bands are generated locally, with no image download.
      const reflectionFaces = [];
      for (let face = 0; face < 6; face++) {
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = faceCanvas.height = 128;
        const ctx = faceCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 128, 128);
        gradient.addColorStop(0, face % 2 ? '#141523' : '#202334');
        gradient.addColorStop(0.28, '#33324f');
        gradient.addColorStop(0.44, '#d5d5e8');
        gradient.addColorStop(0.5, '#f1edff');
        gradient.addColorStop(0.56, '#373949');
        gradient.addColorStop(0.76, face % 2 ? '#7162a1' : '#3e727a');
        gradient.addColorStop(1, '#131721');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        reflectionFaces.push(faceCanvas);
      }
      const reflection = new THREE.CubeTexture(reflectionFaces);
      reflection.colorSpace = THREE.SRGBColorSpace;
      reflection.needsUpdate = true;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = pmrem.fromCubemap(reflection);
      scene.environment = environment.texture;
      reflection.dispose();
      pmrem.dispose();

      sculpture = new THREE.Group();
      sculpture.rotation.z = -0.09;
      scene.add(sculpture);
      const silver = new THREE.MeshStandardMaterial({ color: 0xb6afdc, metalness: 0.86, roughness: 0.24, envMapIntensity: 1.25 });
      const violetMetal = new THREE.MeshStandardMaterial({ color: 0x8670d4, metalness: 0.78, roughness: 0.28, envMapIntensity: 1.5 });
      const cyanMetal = new THREE.MeshStandardMaterial({ color: 0x55b5c6, metalness: 0.72, roughness: 0.3, envMapIntensity: 1.4 });
      const darkMetal = new THREE.MeshStandardMaterial({ color: 0x28263f, metalness: 0.72, roughness: 0.28, envMapIntensity: 1.1, flatShading: true });
      const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xc1b5ff });
      const coreGeometry = new THREE.IcosahedronGeometry(0.91, 0);
      const core = new THREE.Mesh(coreGeometry, darkMetal);
      core.rotation.set(0.25, 0.45, 0.12);
      sculpture.add(core);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(coreGeometry),
        new THREE.LineBasicMaterial({ color: 0xc6b2ff, transparent: true, opacity: 0.78 }),
      );
      edges.rotation.copy(core.rotation);
      edges.scale.setScalar(1.003);
      sculpture.add(edges);

      // The exposed faceted shell has lit vertex accents, like a small astrolabe.
      const coreVertices = coreGeometry.getAttribute('position');
      const uniqueVertices = new Set();
      const vertexGeometry = new THREE.SphereGeometry(0.028, 8, 6);
      for (let i = 0; i < coreVertices.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(coreVertices, i);
        const key = `${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`;
        if (uniqueVertices.has(key)) continue;
        uniqueVertices.add(key);
        const node = new THREE.Mesh(vertexGeometry, glowMaterial);
        node.position.copy(point.applyEuler(core.rotation));
        sculpture.add(node);
      }

      const tubularSegments = smallScreen.matches ? 80 : 128;
      const radialSegments = smallScreen.matches ? 8 : 12;
      const ringSpecs = [
        { radius: 1.45, tube: 0.065, material: silver, angles: [1.05, 0.4, 0.24] },
        { radius: 1.71, tube: 0.045, material: violetMetal, angles: [0.4, 1.1, -0.35] },
        { radius: 1.99, tube: 0.025, material: cyanMetal, angles: [1.24, -0.45, 0.4] },
      ];
      for (const spec of ringSpecs) {
        const ringGroup = new THREE.Group();
        ringGroup.rotation.set(...spec.angles);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(spec.radius, spec.tube, radialSegments, tubularSegments), spec.material);
        ringGroup.add(ring);
        const bead = new THREE.Mesh(new THREE.SphereGeometry(spec.tube * 2.5, 16, 12), spec.material);
        bead.position.set(spec.radius * Math.cos(0.8), spec.radius * Math.sin(0.8), 0);
        ringGroup.add(bead);
        sculpture.add(ringGroup);
      }

      // Two segmented arc markings add precision without cluttering the hero.
      const instrumentRing = new THREE.Group();
      instrumentRing.rotation.set(1.3, 0.2, 0.14);
      for (let i = 0; i < 12; i++) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(2.18, 0.009, 4, 8, Math.PI / 12),
          new THREE.MeshBasicMaterial({ color: i % 3 ? 0x66617b : 0x8bdded, transparent: true, opacity: 0.72 }),
        );
        arc.rotation.z = i * Math.PI / 6;
        instrumentRing.add(arc);
      }
      sculpture.add(instrumentRing);

      satelliteGroup = new THREE.Group();
      scene.add(satelliteGroup);
      const satelliteSpecs = [
        [-1.95, 1.45, 0.2, 0.13, violetMetal],
        [1.78, -1.6, 0.2, 0.15, cyanMetal],
        [2.18, 1.12, -0.7, 0.06, silver],
        [-1.3, -1.87, -0.3, 0.065, silver],
      ];
      for (const [x, y, z, radius, material] of satelliteSpecs) {
        const satellite = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), material);
        satellite.position.set(x, y, z);
        satelliteGroup.add(satellite);
      }

      // A quiet cloud of points provides depth; coordinates are deterministic.
      const pointCount = smallScreen.matches ? 28 : 56;
      const positions = new Float32Array(pointCount * 3);
      for (let i = 0; i < pointCount; i++) {
        const angle = i * 2.399963;
        const radius = 2.35 + ((i * 7) % 13) / 13;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = Math.sin(angle) * radius * 0.86;
        positions[i * 3 + 2] = -1 - ((i * 11) % 17) / 8;
      }
      const particles = new THREE.BufferGeometry();
      particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      scene.add(new THREE.Points(particles, new THREE.PointsMaterial({ color: 0xa0a4c9, size: 0.017, transparent: true, opacity: 0.55, depthWrite: false })));

      function resize() {
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height || disposed) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, smallScreen.matches ? 1.3 : 1.75));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = camera.aspect < 0.9 ? 9.8 : 8.8;
        camera.updateProjectionMatrix();
        renderStill();
      }
      ready = true;
      host.dataset.sceneState = 'ready';
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();
      updateControls();
      resumeLoop();
    } catch {
      // Failed imports, unsupported GPU drivers, and allocation failures all
      // leave the CSS artwork visible while navigation and content work.
      fallback();
    }
  }

  if ('IntersectionObserver' in window) {
    const lazyObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        start();
        lazyObserver.disconnect();
      }
    }, { rootMargin: '200px' });
    lazyObserver.observe(host);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) resumeLoop();
      else stopLoop();
    });
    visibilityObserver.observe(host);
  } else {
    start();
  }
}
