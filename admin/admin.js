/**
 * LynxCom Back-Office JavaScript - Executive Edition
 * Enterprise-grade CRM for Tunisia Market
 * Features:
 * - Strict Server-Side 2FA Authentication (No plaintext hints or client leaks)
 * - Dual-mode responsive rendering: Desktop Data-Table + Mobile Touch-Card Deck
 * - Real-time Status Switcher, WhatsApp Direct API, and Client-side CSV export
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  let currentToken = localStorage.getItem('lynx_adm_token') || null;
  let allLeads = [];
  let currentFilter = 'all';

  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const leadsTableBody = document.getElementById('leadsTableBody');
  const leadsMobileCards = document.getElementById('leadsMobileCards');
  const searchInput = document.getElementById('searchInput');
  const filterPills = document.querySelectorAll('.filter-pill');
  const btnLogout = document.getElementById('btnLogout');
  const btnExportCSV = document.getElementById('btnExportCSV');

  // 1. Initial Session Verification (Strict Server-Side)
  if (currentToken) {
    verifySession();
  } else {
    showLogin();
  }

  async function verifySession() {
    try {
      const res = await fetch('/api/auth/check', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.authenticated) {
          showDashboard(data.user);
          return;
        }
      }
    } catch (e) {}

    // Invalid session -> force login
    showLogin();
  }

  function showLogin() {
    localStorage.removeItem('lynx_adm_token');
    currentToken = null;
    allLeads = [];
    loginView.style.display = 'flex';
    dashboardView.classList.remove('active');
  }

  function showDashboard(user) {
    loginView.style.display = 'none';
    dashboardView.classList.add('active');
    if (user && user.name) {
      const nameElem = document.getElementById('sessionUserName');
      if (nameElem) nameElem.textContent = user.name;
    }
    loadLeadsAndStats();
  }

  // 2. Handle Login Form (Username + Password + PIN)
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    loginError.style.display = 'none';
    const btn = document.getElementById('btnAdminLogin');

    const username = document.getElementById('admUsername').value.trim();
    const password = document.getElementById('admPassword').value.trim();
    const securityCode = document.getElementById('admPin').value.trim();

    if (!username || !password || !securityCode) {
      loginError.style.display = 'block';
      loginError.textContent = 'Veuillez remplir tous les champs.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Vérification en cours...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, securityCode })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.token) {
        currentToken = data.token;
        localStorage.setItem('lynx_adm_token', data.token);
        showDashboard(data.user);
      } else {
        loginError.style.display = 'block';
        loginError.textContent = data.error || 'Identifiants ou code de sécurité incorrects.';
      }
    } catch (err) {
      loginError.style.display = 'block';
      loginError.textContent = 'Erreur de connexion au serveur sécurisé.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Connexion Sécurisée';
    }
  });

  // 3. Handle Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async function () {
      if (confirm('Voulez-vous vous déconnecter du Back-Office ?')) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` }
          });
        } catch (e) {}
        showLogin();
      }
    });
  }

  // 4. Fetch Leads and Stats from Server
  async function loadLeadsAndStats() {
    try {
      const [leadsRes, statsRes] = await Promise.all([
        fetch('/api/admin/leads', { headers: { 'Authorization': `Bearer ${currentToken}` } }),
        fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${currentToken}` } })
      ]);

      if (leadsRes.status === 401 || statsRes.status === 401) {
        showLogin();
        return;
      }

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        allLeads = data.leads || [];
        renderLeads();
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        updateStatsUI(stats);
      }
    } catch (e) {
      console.error('Failed to load CRM data:', e);
    }
  }

  function updateStatsUI(stats) {
    const kpiTotal = document.getElementById('kpiTotalLeads');
    const kpiNew = document.getElementById('kpiNewLeads');
    const kpiPipe = document.getElementById('kpiPipeline');
    const kpiConv = document.getElementById('kpiConversion');

    if (kpiTotal) kpiTotal.textContent = stats.totalLeads || 0;
    if (kpiNew) kpiNew.textContent = stats.newLeads || 0;
    if (kpiPipe) kpiPipe.textContent = new Intl.NumberFormat('fr-TN').format(stats.pipelineTND || 0) + ' TND';
    if (kpiConv) kpiConv.textContent = (stats.conversionRate || 0) + '%';
  }

  // 5. Dual-Mode Render (Desktop Table + Mobile Cards)
  function renderLeads() {
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const filtered = allLeads.filter(lead => {
      const matchesFilter = (currentFilter === 'all') || (lead.status === currentFilter);
      const matchesQuery = !query ||
        (lead.name || '').toLowerCase().includes(query) ||
        (lead.company || '').toLowerCase().includes(query) ||
        (lead.phone || '').toLowerCase().includes(query) ||
        (lead.email || '').toLowerCase().includes(query) ||
        (lead.id || '').toLowerCase().includes(query);

      return matchesFilter && matchesQuery;
    });

    // Empty state
    if (filtered.length === 0) {
      const emptyHtml = `<div style="text-align:center; padding:36px 20px; color:#94A3B8; font-size:14px; font-weight:600;">Aucun prospect ne correspond aux critères.</div>`;
      if (leadsTableBody) leadsTableBody.innerHTML = `<tr><td colspan="6">${emptyHtml}</td></tr>`;
      if (leadsMobileCards) leadsMobileCards.innerHTML = emptyHtml;
      return;
    }

    // A. Desktop Table HTML
    if (leadsTableBody) {
      leadsTableBody.innerHTML = filtered.map(lead => {
        const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
        const dateStr = new Date(lead.createdAt || Date.now()).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

        return `
          <tr>
            <td>
              <strong style="color:#0F172A;">${escapeHTML(lead.id)}</strong><br>
              <span style="font-size:11px; color:#94A3B8;">${dateStr}</span>
            </td>
            <td>
              <div style="font-weight:800; color:#0B0F19;">${escapeHTML(lead.name)}</div>
              <div style="font-size:12px; color:#475569;">🏢 ${escapeHTML(lead.company)}</div>
              <div style="font-size:11.5px; color:#64748B;">✉️ ${escapeHTML(lead.email)}</div>
            </td>
            <td>
              <div style="font-weight:700; color:#0B0F19;"><a href="tel:${cleanPhone}" style="color:inherit;">${escapeHTML(lead.phone)}</a></div>
              <span style="font-size:11px; color:#10B981; font-weight:700;">🇹🇳 Tunisie</span>
            </td>
            <td>
              <div style="font-weight:700; color:#1E293B; font-size:13px;">${escapeHTML(lead.objectiveLabel || lead.objective)}</div>
              <span style="display:inline-block; font-size:11px; font-weight:800; background:#FEF9C3; color:#854D0E; padding:2px 8px; border-radius:6px; margin-top:3px;">
                ${escapeHTML(lead.budget)}
              </span>
            </td>
            <td>
              <select class="btn-sm-action" onchange="updateLeadStatus('${lead.id}', this.value)" style="font-weight:700;">
                <option value="nouveau" ${lead.status === 'nouveau' ? 'selected' : ''}>🟡 Nouveau</option>
                <option value="en_cours" ${lead.status === 'en_cours' ? 'selected' : ''}>🔵 En cours</option>
                <option value="converti" ${lead.status === 'converti' ? 'selected' : ''}>🟢 Converti</option>
                <option value="archive" ${lead.status === 'archive' ? 'selected' : ''}>⚪ Archivé</option>
              </select>
            </td>
            <td>
              <div class="action-btns">
                <a href="https://wa.me/${cleanPhone}?text=Bonjour%20${encodeURIComponent(lead.name)},%20LynxCom%20vous%20contacte%20suite%20%C3%A0%20votre%20demande%20d%27audit" target="_blank" class="btn-sm-action btn-sm-whatsapp" title="WhatsApp Direct">
                  💬 WhatsApp
                </a>
                <button onclick="viewLeadDetails('${lead.id}')" class="btn-sm-action" title="Détails">
                  👁️
                </button>
                <button onclick="deleteLead('${lead.id}')" class="btn-sm-action" style="color:#EF4444;" title="Supprimer">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // B. Mobile Touch-Cards HTML (100% Mobile Friendly)
    if (leadsMobileCards) {
      leadsMobileCards.innerHTML = filtered.map(lead => {
        const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
        const dateStr = new Date(lead.createdAt || Date.now()).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        return `
          <article class="mobile-lead-card">
            <div class="lead-card-header">
              <span class="lead-ref-pill">${escapeHTML(lead.id)}</span>
              <span class="lead-date-text">${dateStr}</span>
              <span class="status-badge status-${lead.status}">${lead.status === 'nouveau' ? 'Nouveau' : lead.status === 'en_cours' ? 'En cours' : lead.status === 'converti' ? 'Converti' : 'Archivé'}</span>
            </div>
            
            <div class="lead-card-body">
              <h3 class="lead-name-title">${escapeHTML(lead.name)}</h3>
              <div class="lead-meta-row">🏢 ${escapeHTML(lead.company)}</div>
              <div class="lead-meta-row">
                📞 <a href="tel:${cleanPhone}" style="color:#0B0F19; font-weight:700;">${escapeHTML(lead.phone)}</a>
              </div>
              <div class="lead-meta-row" style="font-size:12px; color:#64748B;">✉️ ${escapeHTML(lead.email)}</div>

              <div class="lead-pills-row">
                <span class="pill-badge pill-obj">${escapeHTML(lead.objectiveLabel || lead.objective)}</span>
                <span class="pill-badge pill-budget">${escapeHTML(lead.budget)}</span>
              </div>
            </div>

            <div class="lead-card-actions">
              <select class="btn-sm-action select-status-mobile" onchange="updateLeadStatus('${lead.id}', this.value)">
                <option value="nouveau" ${lead.status === 'nouveau' ? 'selected' : ''}>🟡 Nouveau</option>
                <option value="en_cours" ${lead.status === 'en_cours' ? 'selected' : ''}>🔵 En cours</option>
                <option value="converti" ${lead.status === 'converti' ? 'selected' : ''}>🟢 Converti</option>
                <option value="archive" ${lead.status === 'archive' ? 'selected' : ''}>⚪ Archivé</option>
              </select>
              <a href="https://wa.me/${cleanPhone}?text=Bonjour%20${encodeURIComponent(lead.name)},%20LynxCom%20vous%20contacte%20suite%20%C3%A0%20votre%20demande%20d%27audit" target="_blank" class="btn-sm-action btn-sm-whatsapp mobile-wa-btn">
                💬 WhatsApp
              </a>
              <button onclick="viewLeadDetails('${lead.id}')" class="btn-sm-action">
                👁️ Détails
              </button>
              <button onclick="deleteLead('${lead.id}')" class="btn-sm-action" style="color:#EF4444;">
                🗑️
              </button>
            </div>
          </article>
        `;
      }).join('');
    }
  }

  // 6. Filter Pills Handlers
  filterPills.forEach(pill => {
    pill.addEventListener('click', function () {
      filterPills.forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.getAttribute('data-filter') || 'all';
      renderLeads();
    });
  });

  // 7. Search Input Handler
  if (searchInput) {
    searchInput.addEventListener('input', renderLeads);
  }

  // 8. Update Lead Status Global Function
  window.updateLeadStatus = async function (id, newStatus) {
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const lead = allLeads.find(l => l.id === id);
        if (lead) lead.status = newStatus;
        renderLeads();
        loadLeadsAndStats();
      } else {
        alert('Erreur lors de la mise à jour du statut.');
      }
    } catch (e) {
      alert('Erreur de connexion au serveur.');
    }
  };

  // 9. Delete Lead Global Function
  window.deleteLead = async function (id) {
    if (confirm(`Confirmez-vous la suppression sécurisée du prospect #${id} ?`)) {
      try {
        const res = await fetch(`/api/admin/leads/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (res.ok) {
          allLeads = allLeads.filter(l => l.id !== id);
          renderLeads();
          loadLeadsAndStats();
        } else {
          alert('Erreur lors de la suppression.');
        }
      } catch (e) {
        alert('Erreur de connexion.');
      }
    }
  };

  // 10. View Lead Details Modal
  window.viewLeadDetails = function (id) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;

    alert(
      `--- FICHE PROSPECT LYNXCOM [${lead.id}] ---\n\n` +
      `Nom : ${lead.name}\n` +
      `Entreprise : ${lead.company}\n` +
      `Téléphone : ${lead.phone}\n` +
      `Email : ${lead.email}\n` +
      `Objectif : ${lead.objectiveLabel || lead.objective}\n` +
      `Budget estimé : ${lead.budget}\n` +
      `Date de réception : ${new Date(lead.createdAt).toLocaleString('fr-TN')}\n\n` +
      `MESSAGE / PROJET :\n"${lead.message || 'Aucun message particulier spécifié.'}"\n\n` +
      `Statut actuel : ${lead.status}`
    );
  };

  // 11. Export to CSV Handler
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', function () {
      let csv = '\uFEFF';
      csv += 'ID,Date,Nom,Entreprise,Téléphone,Email,Objectif,Budget,Statut,Message\n';
      allLeads.forEach(l => {
        const row = [
          `"${l.id || ''}"`,
          `"${new Date(l.createdAt || Date.now()).toLocaleDateString('fr-TN')}"`,
          `"${(l.name || '').replace(/"/g, '""')}"`,
          `"${(l.company || '').replace(/"/g, '""')}"`,
          `"${(l.phone || '').replace(/"/g, '""')}"`,
          `"${(l.email || '').replace(/"/g, '""')}"`,
          `"${(l.objectiveLabel || l.objective || '').replace(/"/g, '""')}"`,
          `"${(l.budget || '').replace(/"/g, '""')}"`,
          `"${l.status || ''}"`,
          `"${(l.message || '').replace(/"/g, '""')}"`
        ];
        csv += row.join(',') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-lynxcom-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  // ==============================================================================
  // 9. OUTBOUND LEAD GENERATOR & AUTOMATED 100/DAY COLD OUTREACH ENGINE
  // ==============================================================================
  const tabInbound = document.getElementById('tabInbound');
  const tabOutbound = document.getElementById('tabOutbound');
  const inboundSection = document.getElementById('inboundSection');
  const outboundSection = document.getElementById('outboundSection');

  let allOutboundLeads = [];
  let outboundSectorFilter = 'all';
  let activePreviewLeadId = null;

  // Tab Switcher
  if (tabInbound && tabOutbound) {
    tabInbound.addEventListener('click', function (e) {
      e.preventDefault();
      tabInbound.classList.add('active');
      tabOutbound.classList.remove('active');
      if (inboundSection) inboundSection.style.display = 'block';
      if (outboundSection) outboundSection.style.display = 'none';
    });

    tabOutbound.addEventListener('click', function (e) {
      e.preventDefault();
      tabOutbound.classList.add('active');
      tabInbound.classList.remove('active');
      if (inboundSection) inboundSection.style.display = 'none';
      if (outboundSection) outboundSection.style.display = 'block';
      loadOutboundLeads();
    });
  }

  // Load Outbound Leads
  async function loadOutboundLeads() {
    try {
      const res = await fetch('/api/admin/outbound/leads', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.status === 401) {
        showLogin();
        return;
      }
      const data = await res.json();
      if (data && data.leads) {
        allOutboundLeads = data.leads;
        updateOutboundKPIs(data);
        renderOutboundLeads();
      }
    } catch (e) {
      console.error('Erreur chargement leads outbound:', e);
    }
  }

  function updateOutboundKPIs(data) {
    const totalElem = document.getElementById('kpiOutboundTotal');
    const pendingElem = document.getElementById('kpiOutboundPending');
    const sentElem = document.getElementById('kpiOutboundSent');
    const countBadge = document.getElementById('batchPendingCount');
    const autoBadge = document.getElementById('autoStatusBadge');

    const total = allOutboundLeads.length;
    const pending = allOutboundLeads.filter(l => l.status === 'prete').length;
    const sent = allOutboundLeads.filter(l => l.status === 'envoye').length;

    if (totalElem) totalElem.textContent = total;
    if (pendingElem) pendingElem.textContent = pending;
    if (sentElem) sentElem.textContent = sent;
    if (countBadge) countBadge.textContent = pending;

    if (autoBadge && data.config) {
      if (data.config.autoDaily !== false) {
        autoBadge.textContent = 'Actif 🟢';
        autoBadge.style.color = '#10B981';
      } else {
        autoBadge.textContent = 'Pause ⚪';
        autoBadge.style.color = '#94A3B8';
      }
    }
  }

  function renderOutboundLeads() {
    const tableBody = document.getElementById('outboundTableBody');
    const mobileContainer = document.getElementById('outboundMobileCards');
    const searchVal = (document.getElementById('searchOutboundInput')?.value || '').toLowerCase().trim();

    if (!tableBody && !mobileContainer) return;

    let filtered = allOutboundLeads.filter(lead => {
      // Sector filter
      if (outboundSectorFilter !== 'all' && lead.sector !== outboundSectorFilter) {
        return false;
      }
      // Search query
      if (searchVal) {
        const hay = `${lead.company} ${lead.contactName} ${lead.city} ${lead.email} ${lead.identifiedGap || ''}`.toLowerCase();
        if (!hay.includes(searchVal)) return false;
      }
      return true;
    });

    // 1. Desktop Table
    if (tableBody) {
      if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:#64748B;">Aucun prospect correspondant aux critères.</td></tr>`;
      } else {
        tableBody.innerHTML = filtered.map(lead => {
          const isSent = lead.status === 'envoye';
          const statusBadge = isSent 
            ? `<span style="background:rgba(16,185,129,0.12); color:#059669; padding:4px 10px; border-radius:20px; font-weight:800; font-size:12px;">Envoyé ✉️</span>`
            : `<span style="background:rgba(245,158,11,0.12); color:#D97706; padding:4px 10px; border-radius:20px; font-weight:800; font-size:12px;">Prêt à envoyer</span>`;

          return `
            <tr>
              <td style="font-size:12.5px; color:#64748B;">
                <strong>${lead.city || 'Tunisie'}</strong><br>
                <span>Score: <strong style="color:#059669;">${lead.opportunityScore || 90}%</strong></span>
              </td>
              <td>
                <div style="font-weight:800; color:#0B0F19; font-size:14px;">${escapeHTML(lead.company)}</div>
                <div style="font-size:11.5px; color:#64748B;">${escapeHTML(lead.sector || '')}</div>
                ${lead.website ? `<a href="https://${lead.website}" target="_blank" style="font-size:11px; color:#2563EB;">${lead.website}</a>` : ''}
              </td>
              <td>
                <div style="font-weight:700; color:#0B0F19; font-size:13px;">${escapeHTML(lead.contactName)}</div>
                <div style="font-size:11px; color:#64748B;">${escapeHTML(lead.contactRole || 'Direction')}</div>
                <div style="font-size:11.5px; color:#475569;">${escapeHTML(lead.email)}</div>
              </td>
              <td style="max-width:240px; font-size:12px; color:#475569; line-height:1.4;">
                ${escapeHTML(lead.identifiedGap || 'Optimisation ROI publicitaire')}
              </td>
              <td>
                ${statusBadge}
                ${lead.sentAt ? `<div style="font-size:10.5px; color:#94A3B8; margin-top:3px;">${new Date(lead.sentAt).toLocaleTimeString('fr-TN', {hour:'2-digit', minute:'2-digit'})}</div>` : ''}
              </td>
              <td>
                <div style="display:flex; gap:6px;">
                  <button class="btn-action-preview" data-id="${lead.id}" style="padding:6px 10px; border-radius:8px; border:1px solid #CBD5E1; background:#FFF; font-size:12px; font-weight:700; cursor:pointer;" title="Aperçu de l'email">
                    👁️ Aperçu
                  </button>
                  ${!isSent ? `
                    <button class="btn-action-sendone" data-id="${lead.id}" style="padding:6px 10px; border-radius:8px; border:none; background:#EBF817; color:#0B0F19; font-size:12px; font-weight:800; cursor:pointer;" title="Envoyer immédiatement">
                      ✉️ Envoyer
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 2. Mobile Cards
    if (mobileContainer) {
      if (filtered.length === 0) {
        mobileContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#64748B;">Aucun prospect trouvé.</div>`;
      } else {
        mobileContainer.innerHTML = filtered.map(lead => {
          const isSent = lead.status === 'envoye';
          return `
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; padding:16px; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <div>
                  <div style="font-weight:900; font-size:15px; color:#0B0F19;">${escapeHTML(lead.company)}</div>
                  <div style="font-size:11.5px; color:#64748B;">${escapeHTML(lead.city || 'Tunisie')} • ${escapeHTML(lead.sector || '')}</div>
                </div>
                <span style="font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px; ${isSent ? 'background:#DCFCE7; color:#15803D;' : 'background:#FEF3C7; color:#B45309;'}">
                  ${isSent ? 'Envoyé ✉️' : 'Prêt'}
                </span>
              </div>
              <div style="font-size:13px; color:#334155; margin-bottom:6px;">
                <strong>Contact :</strong> ${escapeHTML(lead.contactName)} (${escapeHTML(lead.contactRole || 'Direction')})
              </div>
              <div style="font-size:12.5px; color:#475569; margin-bottom:8px;">
                <strong>Email :</strong> ${escapeHTML(lead.email)}
              </div>
              <div style="background:#F8FAFC; border-radius:10px; padding:10px; font-size:12px; color:#475569; margin-bottom:12px;">
                <strong>Besoin :</strong> ${escapeHTML(lead.identifiedGap || 'Optimisation ROI publicitaire')}
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn-action-preview" data-id="${lead.id}" style="flex:1; padding:9px; border-radius:8px; border:1px solid #CBD5E1; background:#FFF; font-weight:700; font-size:12.5px; cursor:pointer;">
                  👁️ Aperçu Email
                </button>
                ${!isSent ? `
                  <button class="btn-action-sendone" data-id="${lead.id}" style="flex:1; padding:9px; border-radius:8px; border:none; background:#EBF817; color:#0B0F19; font-weight:800; font-size:12.5px; cursor:pointer;">
                    ✉️ Envoyer
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Attach Listeners for Preview and Single Send buttons
    document.querySelectorAll('.btn-action-preview').forEach(btn => {
      btn.addEventListener('click', () => previewEmail(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('.btn-action-sendone').forEach(btn => {
      btn.addEventListener('click', () => sendOneEmail(btn.getAttribute('data-id'), btn));
    });
  }

  // Generate 100 Leads Action
  const btnGen100 = document.getElementById('btnGenerate100');
  if (btnGen100) {
    btnGen100.addEventListener('click', async function () {
      btnGen100.disabled = true;
      btnGen100.textContent = '⏳ Génération de 100 leads en cours...';
      try {
        const res = await fetch('/api/admin/outbound/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({ count: 100, autoSend: false })
        });
        const data = await res.json();
        if (data && data.success) {
          alert(`✅ Succès ! ${data.addedCount || 100} nouveaux prospects tunisiens qualifiés ont été générés.`);
          loadOutboundLeads();
        } else {
          alert(data.error || 'Erreur lors de la génération.');
        }
      } catch (e) {
        alert('Erreur réseau lors de la génération des leads.');
      } finally {
        btnGen100.disabled = false;
        btnGen100.textContent = '⚡ Générer 100 Nouveaux Leads';
      }
    });
  }

  // Batch Send Emails Action
  const btnBatch = document.getElementById('btnSendBatch');
  const batchBanner = document.getElementById('batchProgressBanner');
  const batchPercent = document.getElementById('batchProgressPercent');

  if (btnBatch) {
    btnBatch.addEventListener('click', async function () {
      const pendingCount = allOutboundLeads.filter(l => l.status === 'prete').length;
      if (pendingCount === 0) {
        alert('Tous les prospects de la liste ont déjà reçu leur email.');
        return;
      }

      if (!confirm(`Confirmez-vous l'envoi immédiat de ${pendingCount} emails de prospection personnalisés ?`)) {
        return;
      }

      btnBatch.disabled = true;
      if (batchBanner) {
        batchBanner.style.display = 'flex';
        batchPercent.textContent = '0%';
      }

      let progress = 0;
      const interval = setInterval(() => {
        if (progress < 90) {
          progress += 10;
          if (batchPercent) batchPercent.textContent = progress + '%';
        }
      }, 200);

      try {
        const res = await fetch('/api/admin/outbound/send-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({ limit: 100 })
        });
        clearInterval(interval);
        if (batchPercent) batchPercent.textContent = '100%';

        const data = await res.json();
        if (data && data.success) {
          setTimeout(() => {
            if (batchBanner) batchBanner.style.display = 'none';
            alert(`🎉 Campagne Outbound réussie ! ${data.sentCount} emails professionnels ont été envoyés avec succès.`);
            loadOutboundLeads();
          }, 500);
        } else {
          alert(data.error || 'Erreur lors de l’envoi groupé.');
          if (batchBanner) batchBanner.style.display = 'none';
        }
      } catch (e) {
        clearInterval(interval);
        if (batchBanner) batchBanner.style.display = 'none';
        alert('Erreur lors de l’envoi des emails.');
      } finally {
        btnBatch.disabled = false;
      }
    });
  }

  // Toggle Auto-Pilot
  const btnToggleAuto = document.getElementById('btnToggleAuto');
  if (btnToggleAuto) {
    btnToggleAuto.addEventListener('click', async function () {
      try {
        const res = await fetch('/api/admin/outbound/toggle-auto', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await res.json();
        if (data && data.success) {
          const autoBadge = document.getElementById('autoStatusBadge');
          if (autoBadge) {
            if (data.autoDaily) {
              autoBadge.textContent = 'Actif 🟢';
              autoBadge.style.color = '#10B981';
            } else {
              autoBadge.textContent = 'Pause ⚪';
              autoBadge.style.color = '#94A3B8';
            }
          }
          alert(`Auto-Pilote quotidien 100 leads/jour : ${data.autoDaily ? 'ACTIVÉ 🟢' : 'MIS EN PAUSE ⚪'}`);
        }
      } catch (e) {
        alert('Erreur lors du changement de statut de l’auto-pilote.');
      }
    });
  }

  // Preview Email Modal
  const modal = document.getElementById('modalEmailPreview');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCloseModalBtn = document.getElementById('btnCloseModalBtn');
  const btnSendFromModal = document.getElementById('btnSendFromModal');

  async function previewEmail(leadId) {
    activePreviewLeadId = leadId;
    try {
      const res = await fetch(`/api/admin/outbound/preview/${leadId}`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (data && data.email) {
        document.getElementById('modalSubject').textContent = data.email.subject;
        document.getElementById('modalRecipient').textContent = `À: ${data.lead.contactName} <${data.lead.email}> (${data.lead.company})`;
        document.getElementById('modalEmailBody').innerHTML = data.email.htmlBody;
        if (modal) modal.style.display = 'flex';
      }
    } catch (e) {
      alert('Impossible de générer l’aperçu de cet email.');
    }
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', () => modal.style.display = 'none');
  if (btnCloseModalBtn) btnCloseModalBtn.addEventListener('click', () => modal.style.display = 'none');

  if (btnSendFromModal) {
    btnSendFromModal.addEventListener('click', async function () {
      if (!activePreviewLeadId) return;
      btnSendFromModal.disabled = true;
      btnSendFromModal.textContent = 'Envoi en cours...';
      try {
        const res = await fetch(`/api/admin/outbound/send-one/${activePreviewLeadId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await res.json();
        if (data && data.success) {
          alert('Email envoyé avec succès au dirigeant !');
          modal.style.display = 'none';
          loadOutboundLeads();
        } else {
          alert(data.error || 'Erreur lors de l’envoi.');
        }
      } catch (e) {
        alert('Erreur réseau lors de l’envoi de l’email.');
      } finally {
        btnSendFromModal.disabled = false;
        btnSendFromModal.textContent = '🚀 Envoyer cet Email Immédiatement';
      }
    });
  }

  async function sendOneEmail(leadId, btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '...';
    }
    try {
      const res = await fetch(`/api/admin/outbound/send-one/${leadId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (data && data.success) {
        loadOutboundLeads();
      } else {
        alert(data.error || 'Erreur lors de l’envoi.');
        if (btn) {
          btn.disabled = false;
          btn.textContent = '✉️ Envoyer';
        }
      }
    } catch (e) {
      alert('Erreur réseau.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✉️ Envoyer';
      }
    }
  }

  // Filter Pills for Outbound Sectors
  const sectorPills = document.querySelectorAll('#outboundSectorFilters .filter-pill');
  sectorPills.forEach(pill => {
    pill.addEventListener('click', function () {
      sectorPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      outboundSectorFilter = pill.getAttribute('data-sector') || 'all';
      renderOutboundLeads();
    });
  });

  const searchOutbound = document.getElementById('searchOutboundInput');
  if (searchOutbound) {
    searchOutbound.addEventListener('input', renderOutboundLeads);
  }

  // Utility: Escape HTML
  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

});
