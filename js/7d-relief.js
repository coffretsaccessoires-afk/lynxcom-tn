/**
 * LynxCom 7D Relief Engine
 * High-performance interactive 3D relief visualizer:
 * 1. Three.js Ambient Particle Vortex & Volumetric Halo
 * 2. 6-DoF Parallax Tilt Physics (Mouse & Mobile Gyroscope)
 * 3. Dynamic 3D Extruded Relief Bars with Specular Highlights
 * 4. Reactive Upward Curved Trend Arrow with Neon Dash Animation
 * 5. Multi-dimensional Data Morphing (E-commerce, B2B, Reach, SEO)
 */

(function () {
  'use strict';

  // --- Data Hyper-States ---
  const DATA_PRESETS = {
    roi: {
      name: "ROI E-Commerce",
      kpiNumber: "+148%",
      kpiLabel: "ROI Moyen Client",
      trendPercent: 100,
      brandPercent: 90,
      adtValue: "+49%",
      satKpiValue: "+148%",
      satKpiLabel: "ROI E-commerce",
      audienceReach: "3.2M",
      bars: [
        { height: 42, label: "S1", value: "32 500 TND" },
        { height: 60, label: "S2", value: "58 200 TND" },
        { height: 75, label: "S3", value: "84 000 TND" },
        { height: 88, label: "S4", value: "112 500 TND" },
        { height: 72, label: "S5", value: "98 400 TND" },
        { height: 100, label: "S6", value: "148 000 TND" }
      ],
      arrowPath: "M 20 120 Q 110 90, 180 50 T 260 15",
      arrowHead: "260,15 250,14 256,25"
    },
    leads: {
      name: "Leads B2B Tunis",
      kpiNumber: "+240%",
      kpiLabel: "Leads Qualifiés B2B",
      trendPercent: 98,
      brandPercent: 88,
      adtValue: "+65%",
      satKpiValue: "+240%",
      satKpiLabel: "Pipeline Tunis",
      audienceReach: "1.4M",
      bars: [
        { height: 35, label: "S1", value: "45 Leads" },
        { height: 52, label: "S2", value: "80 Leads" },
        { height: 70, label: "S3", value: "125 Leads" },
        { height: 82, label: "S4", value: "165 Leads" },
        { height: 94, label: "S5", value: "210 Leads" },
        { height: 105, label: "S6", value: "240 Leads" }
      ],
      arrowPath: "M 20 135 Q 100 80, 180 40 T 260 10",
      arrowHead: "260,10 248,11 254,23"
    },
    reach: {
      name: "Portée & Notoriété",
      kpiNumber: "3.2M",
      kpiLabel: "Impressions Ciblées TN",
      trendPercent: 95,
      brandPercent: 96,
      adtValue: "+78%",
      satKpiValue: "3.2M",
      satKpiLabel: "Audience Active",
      audienceReach: "3.2M",
      bars: [
        { height: 48, label: "S1", value: "650K Vues" },
        { height: 65, label: "S2", value: "1.1M Vues" },
        { height: 78, label: "S3", value: "1.8M Vues" },
        { height: 85, label: "S4", value: "2.3M Vues" },
        { height: 92, label: "S5", value: "2.8M Vues" },
        { height: 100, label: "S6", value: "3.2M Vues" }
      ],
      arrowPath: "M 20 115 Q 120 75, 190 35 T 260 12",
      arrowHead: "260,12 250,11 255,22"
    },
    seo: {
      name: "SEO N°1 Google",
      kpiNumber: "+310%",
      kpiLabel: "Trafic Organique Google",
      trendPercent: 100,
      brandPercent: 94,
      adtValue: "+92%",
      satKpiValue: "N°1",
      satKpiLabel: "Positions Clés",
      audienceReach: "4.8M",
      bars: [
        { height: 30, label: "S1", value: "12 Top 3" },
        { height: 48, label: "S2", value: "28 Top 3" },
        { height: 68, label: "S3", value: "54 Top 3" },
        { height: 85, label: "S4", value: "89 Top 3" },
        { height: 98, label: "S5", value: "124 Top 3" },
        { height: 110, label: "S6", value: "160 Top 3" }
      ],
      arrowPath: "M 20 140 Q 95 85, 175 35 T 260 8",
      arrowHead: "260,8 248,9 253,21"
    }
  };

  let currentMode = "roi";
  let isMobileView = window.innerWidth <= 768;
  let defaultRotX = isMobileView ? 8 : 12;
  let defaultRotY = isMobileView ? -8 : -18;
  let targetRotX = defaultRotX;
  let targetRotY = defaultRotY;
  let currentRotX = defaultRotX;
  let currentRotY = defaultRotY;
  let rigScale = 1;
  let isInViewport = true;

  const wrapper = document.querySelector('.stage-7d-wrapper');
  const rig = document.querySelector('.rig-7d');

  if (!wrapper || !rig) return;

  // Compute responsive scale so the full 560x440 3D rig fits any mobile/tablet screen cleanly
  function updateResponsiveScale() {
    isMobileView = window.innerWidth <= 768;
    defaultRotX = isMobileView ? 8 : 12;
    defaultRotY = isMobileView ? -8 : -18;

    const availWidth = wrapper.clientWidth || window.innerWidth - 32;
    if (availWidth < 640) {
      rigScale = Math.max(0.48, Math.min(1, (availWidth - 12) / 620));
      wrapper.style.minHeight = Math.round(460 * rigScale + 36) + 'px';
      wrapper.style.height = Math.round(460 * rigScale + 36) + 'px';
    } else {
      rigScale = 1;
      wrapper.style.minHeight = '';
      wrapper.style.height = '';
    }
  }
  updateResponsiveScale();
  window.addEventListener('resize', updateResponsiveScale, { passive: true });

  // Pause 3D loop when scrolled out of view for 60FPS scroll smoothness on mobile
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isInViewport = entry.isIntersecting;
      });
    }, { threshold: 0.05 });
    io.observe(wrapper);
  }

  // --- Parallax 6-DoF Physics Engine (Mouse & Touch) ---
  function handlePointerMove(clientX, clientY) {
    const rect = wrapper.getBoundingClientRect();
    const relX = clientX - rect.left - rect.width / 2;
    const relY = clientY - rect.top - rect.height / 2;

    const normX = Math.max(-1, Math.min(1, relX / (rect.width / 2)));
    const normY = Math.max(-1, Math.min(1, relY / (rect.height / 2)));

    targetRotY = defaultRotY + normX * (isMobileView ? 12 : 18);
    targetRotX = defaultRotX - normY * (isMobileView ? 10 : 16);

    const lightX = 50 + normX * 40;
    const lightY = 50 + normY * 40;
    rig.style.setProperty('--light-x', `${lightX}%`);
    rig.style.setProperty('--light-y', `${lightY}%`);
  }

  function onMouseMove(e) {
    handlePointerMove(e.clientX, e.clientY);
  }

  function onPointerReset() {
    targetRotX = defaultRotX;
    targetRotY = defaultRotY;
    rig.style.setProperty('--light-x', '70%');
    rig.style.setProperty('--light-y', '30%');
  }

  wrapper.addEventListener('mousemove', onMouseMove, { passive: true });
  wrapper.addEventListener('mouseleave', onPointerReset, { passive: true });

  // Touch drag support on mobile
  wrapper.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length === 1) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  wrapper.addEventListener('touchend', onPointerReset, { passive: true });

  // --- Mobile Gyroscope DeviceOrientation Support ---
  if (window.DeviceOrientationEvent && window.matchMedia('(max-width: 768px)').matches) {
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma !== null && e.beta !== null) {
        const tiltX = Math.min(Math.max(e.gamma, -25), 25);
        const tiltY = Math.min(Math.max(e.beta - 45, -25), 25);
        targetRotY = defaultRotY + (tiltX / 25) * 10;
        targetRotX = defaultRotX + (tiltY / 25) * 8;
      }
    }, { passive: true });
  }

  // --- Smooth Physics Render Loop (Lerp Animation) ---
  function updatePhysics() {
    if (isInViewport) {
      const ease = 0.09;
      currentRotX += (targetRotX - currentRotX) * ease;
      currentRotY += (targetRotY - currentRotY) * ease;
      const rotZ = isMobileView ? 1 : 2;

      rig.style.transform = `scale(${rigScale.toFixed(3)}) rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg) rotateZ(${rotZ}deg)`;
    }
    requestAnimationFrame(updatePhysics);
  }
  requestAnimationFrame(updatePhysics);

  // --- Dynamic Bar Rendering & Mode Switching ---
  function renderBars(presetKey) {
    const preset = DATA_PRESETS[presetKey] || DATA_PRESETS.roi;
    currentMode = presetKey;

    // Update Big KPI values
    const kpiNumber = document.querySelector('.kpi-number');
    const kpiLabel = document.querySelector('.kpi-label');
    const trendFill = document.querySelector('.fill-trend');
    const brandFill = document.querySelector('.fill-brand');
    const trendText = document.querySelector('.trend-value-text');
    const brandText = document.querySelector('.brand-value-text');

    if (kpiNumber) animateCounter(kpiNumber, preset.kpiNumber);
    if (kpiLabel) kpiLabel.textContent = preset.kpiLabel;
    if (trendFill) trendFill.style.width = `${preset.trendPercent}%`;
    if (brandFill) brandFill.style.width = `${preset.brandPercent}%`;
    if (trendText) trendText.textContent = `${preset.trendPercent}%`;
    if (brandText) brandText.textContent = `${preset.brandPercent}%`;

    // Satellite Cards
    const adtBadge = document.querySelector('.adt-badge');
    if (adtBadge) adtBadge.textContent = preset.adtValue;

    const satKpiVal = document.querySelector('.sat-kpi-value');
    const satKpiSub = document.querySelector('.sat-kpi-sub');
    if (satKpiVal) satKpiVal.textContent = preset.satKpiValue;
    if (satKpiSub) satKpiSub.textContent = preset.satKpiLabel;

    // 3D Relief Bars
    const barColumns = document.querySelectorAll('.bar-3d-column');
    barColumns.forEach((col, idx) => {
      const barData = preset.bars[idx];
      if (barData) {
        col.style.setProperty('--bar-height', `${barData.height}%`);
        const tooltip = col.querySelector('.bar-tooltip');
        if (tooltip) {
          tooltip.textContent = `${barData.label}: ${barData.value}`;
        }
      }
    });

    // Update Trend Arrow SVG Path with smooth draw
    const arrowPath = document.querySelector('.trend-arrow-path');
    const arrowHead = document.querySelector('.trend-arrow-head');
    if (arrowPath && preset.arrowPath) {
      arrowPath.setAttribute('d', preset.arrowPath);
      arrowPath.style.animation = 'none';
      void arrowPath.offsetWidth; // trigger reflow
      arrowPath.style.animation = 'drawArrow 1.5s ease-out';
    }
    if (arrowHead && preset.arrowHead) {
      arrowHead.setAttribute('points', preset.arrowHead);
    }
  }

  // --- Smooth Counter Animation ---
  function animateCounter(elem, targetStr) {
    const hasPlus = targetStr.includes('+');
    const hasPercent = targetStr.includes('%');
    const hasM = targetStr.includes('M');
    const numeric = parseFloat(targetStr.replace(/[^\d.]/g, ''));

    if (isNaN(numeric)) {
      elem.textContent = targetStr;
      return;
    }

    let start = 0;
    const duration = 800;
    const startTime = performance.now();

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const easeVal = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (numeric - start) * easeVal);

      let formatted = current.toString();
      if (hasPlus) formatted = '+' + formatted;
      if (hasPercent) formatted = formatted + '%';
      if (hasM) formatted = (current / 10).toFixed(1) + 'M';

      elem.textContent = formatted;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        elem.textContent = targetStr;
      }
    }
    requestAnimationFrame(updateCounter);
  }

  // --- Hook up 7D Mode Switcher Buttons ---
  const modeButtons = document.querySelectorAll('.mode-btn-7d');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      modeButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const mode = this.getAttribute('data-mode');
      if (mode) {
        renderBars(mode);
        triggerParticleBurst();
      }
    });
  });

  // --- Three.js Background Particle Vortex Canvas ---
  function initThreeVortex() {
    const canvas = document.getElementById('ambient-7d-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 240;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    } catch (e) {
      console.warn("WebGL not supported, falling back to CSS glow.", e);
      return;
    }

    // 1. Particle Cloud (Electric Yellow Stars)
    const particleCount = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Golden spiral distribution
      const radius = 60 + Math.random() * 140;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.7;

      positions[i * 3] = radius * Math.cos(theta) * Math.cos(phi);
      positions[i * 3 + 1] = radius * Math.sin(phi) * 0.7;
      positions[i * 3 + 2] = radius * Math.sin(theta) * Math.cos(phi);
      scales[i] = Math.random() * 2.8 + 1.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    // Custom yellow glowing particle material
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xEBF817,
      size: 3.2,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    // 2. Orbital Glowing Rings
    const ringGeo = new THREE.TorusGeometry(120, 1.2, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xF2FF26,
      transparent: true,
      opacity: 0.35,
      wireframe: false
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2.8;
    ring1.rotation.y = -0.3;
    scene.add(ring1);

    // Render loop
    let isVisible = true;
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    });
    observer.observe(wrapper);

    function animateThree(time) {
      if (isVisible) {
        particles.rotation.y = time * 0.0003;
        particles.rotation.x = Math.sin(time * 0.0002) * 0.15;
        ring1.rotation.z = time * 0.0004;

        renderer.render(scene, camera);
      }
      requestAnimationFrame(animateThree);
    }
    requestAnimationFrame(animateThree);

    // Resize handler
    window.addEventListener('resize', () => {
      if (!canvas || !renderer) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width && height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }
    });

    // Particle burst method for data switches
    window.triggerParticleBurst = function () {
      particleMaterial.opacity = 0.95;
      ringMat.opacity = 0.8;
      setTimeout(() => {
        particleMaterial.opacity = 0.65;
        ringMat.opacity = 0.35;
      }, 600);
    };
  }

  // Fallback trigger if Three.js not loaded
  if (!window.triggerParticleBurst) {
    window.triggerParticleBurst = function () {
      const halo = document.querySelector('.energy-halo-orbit');
      if (halo) {
        halo.style.transform += ' scale(1.08)';
        setTimeout(() => {
          halo.style.transform = halo.style.transform.replace(' scale(1.08)', '');
        }, 400);
      }
    };
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      renderBars('roi');
      initThreeVortex();
    });
  } else {
    renderBars('roi');
    initThreeVortex();
  }
})();
