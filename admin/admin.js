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
