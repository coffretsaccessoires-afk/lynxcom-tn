/**
 * LynxCom Digital Marketing Agency - Main JavaScript
 * Handles Navigation, Mobile Drawer, Interactive ROI Simulator,
 * FAQ Accordion, and Lead Generation Form.
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // --- 1. Sticky Header Scroll Shadow ---
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });

  // --- 2. Universal Mobile Drawer Navigation (Auto-Provisioned Across All Pages) ---
  const headerActions = document.querySelector('.header-actions');
  let mobileToggle = document.querySelector('.mobile-toggle');
  let mobileDrawer = document.querySelector('.mobile-drawer');

  if (header && headerActions && !mobileToggle) {
    mobileToggle = document.createElement('button');
    mobileToggle.className = 'mobile-toggle';
    mobileToggle.setAttribute('aria-label', 'Ouvrir le menu de navigation');
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    headerActions.appendChild(mobileToggle);
  }

  if (header && !mobileDrawer) {
    mobileDrawer = document.createElement('div');
    mobileDrawer.className = 'mobile-drawer';
    mobileDrawer.setAttribute('role', 'dialog');
    mobileDrawer.setAttribute('aria-label', 'Menu mobile');
    mobileDrawer.innerHTML = `
      <div class="mobile-menu-links">
        <a href="./">Accueil <span>→</span></a>
        <a href="expertise">Notre Expertise <span>→</span></a>
        <a href="etudes-de-cas">Études de Cas (Tunisie) <span>→</span></a>
        <a href="technologie">Technologie & IA <span>→</span></a>
        <a href="ressources">Ressources & Simulateur ROI <span>→</span></a>
        <a href="a-propos">À propos de LynxCom (Sfax) <span>→</span></a>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <a href="contact" class="btn-pill-yellow" style="width: 100%; text-align: center; padding: 14px;">Nous Contacter</a>
        <a href="https://wa.me/21653484809?text=Bonjour%20LynxCom,%20je%20souhaite%20un%20audit%20gratuit" target="_blank" rel="noopener noreferrer" class="whatsapp-direct-btn" style="width: 100%; justify-content: center; padding: 12px;">💬 WhatsApp : +216 53 484 809</a>
      </div>
    `;
    header.appendChild(mobileDrawer);
  }

  const hamburgerSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
  const closeSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  if (mobileToggle && mobileDrawer) {
    const drawerLinks = mobileDrawer.querySelectorAll('a');

    function closeDrawer() {
      mobileDrawer.classList.remove('open');
      mobileToggle.setAttribute('aria-expanded', 'false');
      mobileToggle.innerHTML = hamburgerSVG;
    }

    mobileToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = mobileDrawer.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', String(isOpen));
      mobileToggle.innerHTML = isOpen ? closeSVG : hamburgerSVG;
    });

    drawerLinks.forEach(link => {
      link.addEventListener('click', closeDrawer);
    });

    document.addEventListener('click', function (e) {
      if (mobileDrawer.classList.contains('open') && !mobileDrawer.contains(e.target) && !mobileToggle.contains(e.target)) {
        closeDrawer();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileDrawer.classList.contains('open')) {
        closeDrawer();
      }
    });
  }

  // --- 3. Interactive ROI & Growth Calculator (Tunisia Market) ---
  const budgetSlider = document.getElementById('budgetSlider');
  const budgetDisplay = document.getElementById('budgetDisplay');
  const sectorBtns = document.querySelectorAll('.calc-chip-btn');
  const calcRevenue = document.getElementById('calcRevenue');
  const calcRoi = document.getElementById('calcRoi');
  const calcLeads = document.getElementById('calcLeads');

  let currentMultiplier = 4.2; // Default for E-commerce
  let currentRoiPercent = 320;

  const sectorMultipliers = {
    ecommerce: { mult: 4.8, roi: 380, label: "Ventes / Clients" },
    b2b: { mult: 3.6, roi: 260, label: "Leads Qualifiés B2B" },
    retail: { mult: 3.2, roi: 220, label: "Visites Magasin" },
    tech: { mult: 5.1, roi: 410, label: "Démos & Souscriptions" }
  };

  function updateCalculator() {
    if (!budgetSlider) return;
    const budgetTND = parseInt(budgetSlider.value, 10);

    // Format budget display
    if (budgetDisplay) {
      budgetDisplay.textContent = new Intl.NumberFormat('fr-TN').format(budgetTND) + ' TND';
    }

    // Calculations
    const projectedRev = Math.round(budgetTND * currentMultiplier);
    const leadsEstimate = Math.round((budgetTND / 35) * (currentMultiplier / 2.5));

    if (calcRevenue) {
      calcRevenue.textContent = new Intl.NumberFormat('fr-TN').format(projectedRev) + ' TND';
    }
    if (calcRoi) {
      calcRoi.textContent = '+' + currentRoiPercent + '%';
    }
    if (calcLeads) {
      calcLeads.textContent = new Intl.NumberFormat('fr-TN').format(leadsEstimate);
    }
  }

  if (budgetSlider) {
    budgetSlider.addEventListener('input', updateCalculator);
  }

  sectorBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      sectorBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const sectorKey = this.getAttribute('data-sector');
      if (sectorMultipliers[sectorKey]) {
        currentMultiplier = sectorMultipliers[sectorKey].mult;
        currentRoiPercent = sectorMultipliers[sectorKey].roi;
        updateCalculator();
      }
    });
  });

  // Run once on load
  updateCalculator();

  // --- 4. FAQ Accordion (Schema.org / SEO Rich Snippets) ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', function () {
        const isActive = item.classList.contains('active');

        // Close other items
        faqItems.forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove('active');
            const otherBtn = otherItem.querySelector('.faq-question');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          }
        });

        // Toggle clicked
        if (isActive) {
          item.classList.remove('active');
          questionBtn.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('active');
          questionBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }
  });

  // --- 5. Contact & Audit Form Submission ---
  const contactForm = document.getElementById('auditContactForm');
  const formAlert = document.getElementById('formStatusAlert');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('.form-submit-btn');
      const originalText = submitBtn.innerHTML;

      submitBtn.innerHTML = `
        <svg style="display:inline-block; vertical-align:middle; width:18px; height:18px; animation:spin 1s linear infinite; margin-right:8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg> Analyse de votre demande...
      `;
      submitBtn.disabled = true;

      setTimeout(function () {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        contactForm.reset();

        if (formAlert) {
          formAlert.classList.add('success');
          formAlert.innerHTML = `
            <strong>Félicitations !</strong> Votre demande d'audit gratuit pour le marché tunisien a été reçue avec succès. 
            Notre Lead Data Strategist à Tunis vous contactera sous <strong>2 heures</strong>.
          `;
          formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 1200);
    });
  }

  // --- 6. Smooth Scroll for Anchor Links ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault();
          const headerOffset = 80;
          const elementPosition = targetElem.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });

});
