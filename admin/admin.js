/**
 * LynxCom Back-Office JavaScript
 * Handles Double-Auth Login, Live CRM Leads Management,
 * Status Updates, WhatsApp Integration, and CSV Export.
 * Supports Hybrid Node.js REST API + Cloud Static Fallback Persistence.
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  let currentToken = localStorage.getItem('lynx_token') || null;
  let allLeads = [];
  let currentFilter = 'all';

  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const leadsTableBody = document.getElementById('leadsTableBody');
  const searchInput = document.getElementById('searchInput');
  const filterPills = document.querySelectorAll('.filter-pill');
  const btnLogout = document.getElementById('btnLogout');
  const btnExportCSV = document.getElementById('btnExportCSV');

  // Helper: Load fallback leads from localStorage or seed from db.json
  async function getFallbackLeads() {
    const cached = localStorage.getItem('lynx_leads_db');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    const pathsToTry = ['../data/db.json', 'data/db.json', '/data/db.json'];
    for (const p of pathsToTry) {
      try {
        const r = await fetch(p);
        if (r.ok) {
          const db = await r.json();
          if (db && Array.isArray(db.leads)) {
            localStorage.setItem('lynx_leads_db', JSON.stringify(db.leads));
            return db.leads;
          }
        }
      } catch (e) {}
    }
    return [];
  }

  function saveFallbackLeads(leads) {
    localStorage.setItem('lynx_leads_db', JSON.stringify(leads));
  }

  function computeStatsFromLeads(leads) {
    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.status === 'nouveau').length;
    const converted = leads.filter(l => l.status === 'converti').length;
    let pipelineTND = 0;
    leads.forEach(l => {
      const match = (l.budget || '').match(/(\d[\d\s]*)/);
      if (match) {
        pipelineTND += parseInt(match[0].replace(/\s/g, ''), 10) || 5000;
      } else {
        pipelineTND += 5000;
      }
    });
    const conversionRate = totalLeads ? Math.round((converted / totalLeads) * 100) : 0;
    return { totalLeads, newLeads, pipelineTND, conversionRate };
  }

  // 1. Initial Session Check
  if (currentToken) {
    checkSession();
  } else {
    showLogin();
  }

  async function checkSession() {
    try {
      const res = await fetch('/api/auth/check', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          showDashboard(data.user);
          return;
        }
      }
    } catch (e) {}

    // Fallback check for cloud static mirror
    if (currentToken && currentToken.startsWith('lynx_cloud_')) {
      showDashboard({ name: 'Direction LynxCom (Sfax)' });
    } else {
      showLogin();
    }
  }

  function showLogin() {
    localStorage.removeItem('lynx_token');
    currentToken = null;
    loginView.style.display = 'flex';
    dashboardView.classList.remove('active');
  }

  function showDashboard(user) {
    loginView.style.display = 'none';
    dashboardView.classList.add('active');
    if (user && user.name) {
      document.getElementById('sessionUserName').textContent = user.name;
    }
    loadLeadsAndStats();
  }

  // 2. Handle Login Form (Password + Security Code / PIN)
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    loginError.style.display = 'none';
    const btn = document.getElementById('btnAdminLogin');

    const username = document.getElementById('admUsername').value.trim();
    const password = document.getElementById('admPassword').value.trim();
    const securityCode = document.getElementById('admPin').value.trim();

    btn.disabled = true;
    btn.textContent = 'Vérification en cours...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, securityCode })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          currentToken = data.token;
          localStorage.setItem('lynx_token', data.token);
          showDashboard(data.user);
          return;
        }
      } else if (res.status === 401 || res.status === 403 || res.status === 400) {
        const data = await res.json().catch(() => ({}));
        loginError.style.display = 'block';
        loginError.textContent = data.error || 'Identifiants ou code PIN incorrects.';
        return;
      }
    } catch (err) {
      // Fallback to client-side verification when hosted on static mirror
    } finally {
      btn.disabled = false;
      btn.textContent = 'Déverrouiller le Back-Office';
    }

    // Cloud Static Mirror Auth Verification
    const validUser = (
      username.toLowerCase() === 'admin' ||
      username.toLowerCase() === 'admin@lynxcom.tn' ||
      username.toLowerCase() === 'touskiecom@gmail.com'
    );
    if (validUser && password === 'LynxCom2026!' && securityCode === '784219') {
      currentToken = 'lynx_cloud_' + Date.now();
      localStorage.setItem('lynx_token', currentToken);
      showDashboard({ name: 'Direction LynxCom (Sfax)' });
    } else {
      loginError.style.display = 'block';
      loginError.textContent = 'Identifiants ou code PIN incorrects.';
    }
  });

  // 3. Handle Logout
  btnLogout.addEventListener('click', async function () {
    if (confirm('Voulez-vous vraiment vous déconnecter du Back-Office ?')) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
      } catch (e) {}
      showLogin();
    }
  });

  // 4 & 5. Load Leads & Stats
  async function loadLeadsAndStats() {
    let loadedFromApi = false;
    try {
      const res = await fetch('/api/admin/leads', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.leads) {
          allLeads = data.leads;
          loadedFromApi = true;
        }
      }
    } catch (e) {}

    if (!loadedFromApi) {
      allLeads = await getFallbackLeads();
    }

    renderLeadsTable();
    updateStatsUI(computeStatsFromLeads(allLeads));
  }

  function updateStatsUI(stats) {
    document.getElementById('kpiTotalLeads').textContent = stats.totalLeads;
    document.getElementById('kpiNewLeads').textContent = stats.newLeads;
    document.getElementById('kpiPipeline').textContent = new Intl.NumberFormat('fr-TN').format(stats.pipelineTND) + ' TND';
    document.getElementById('kpiConversion').textContent = stats.conversionRate + '%';
  }

  // 6. Render Leads Table with Search & Filters
  function renderLeadsTable() {
    const query = searchInput.value.toLowerCase().trim();

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

    if (filtered.length === 0) {
      leadsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#94A3B8;">Aucun prospect ne correspond à votre recherche.</td></tr>`;
      return;
    }

    leadsTableBody.innerHTML = filtered.map(lead => {
      const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
      const dateStr = new Date(lead.createdAt).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      
      return `
        <tr>
          <td>
            <strong>${escapeHTML(lead.id)}</strong><br>
            <span style="font-size:11px; color:#94A3B8;">${dateStr}</span>
          </td>
          <td>
            <div style="font-weight:800; color:#0B0F19;">${escapeHTML(lead.name)}</div>
            <div style="font-size:12.5px; color:#475569;">🏢 ${escapeHTML(lead.company)}</div>
            <div style="font-size:11.5px; color:#64748B;">✉️ ${escapeHTML(lead.email)}</div>
          </td>
          <td>
            <div style="font-weight:700; color:#0B0F19;">${escapeHTML(lead.phone)}</div>
            <span style="font-size:11px; color:#10B981;">🇹🇳 Tunisie</span>
          </td>
          <td>
            <div style="font-weight:700; color:#1E293B;">${escapeHTML(lead.objectiveLabel || lead.objective)}</div>
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
              <button onclick="viewLeadDetails('${lead.id}')" class="btn-sm-action" title="Voir le message complet">
                👁️ Détails
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

  // 7. Filter Pill Click Handlers
  filterPills.forEach(pill => {
    pill.addEventListener('click', function () {
      filterPills.forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.getAttribute('data-filter');
      renderLeadsTable();
    });
  });

  // 8. Search Input Handler
  searchInput.addEventListener('input', renderLeadsTable);

  // 9. Update Lead Status Global Function
  window.updateLeadStatus = async function (id, newStatus) {
    try {
      await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {}

    const lead = allLeads.find(l => l.id === id);
    if (lead) {
      lead.status = newStatus;
      saveFallbackLeads(allLeads);
      updateStatsUI(computeStatsFromLeads(allLeads));
    }
  };

  // 10. Delete Lead Global Function
  window.deleteLead = async function (id) {
    if (confirm(`Confirmez-vous la suppression du prospect ${id} ?`)) {
      try {
        await fetch(`/api/admin/leads/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
      } catch (e) {}

      allLeads = allLeads.filter(l => l.id !== id);
      saveFallbackLeads(allLeads);
      renderLeadsTable();
      updateStatsUI(computeStatsFromLeads(allLeads));
    }
  };

  // 11. View Lead Details Modal
  window.viewLeadDetails = function (id) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;

    alert(
      `--- DÉTAILS DU PROSPECT ${lead.id} ---\n\n` +
      `Nom : ${lead.name}\n` +
      `Entreprise : ${lead.company}\n` +
      `Téléphone : ${lead.phone}\n` +
      `Email : ${lead.email}\n` +
      `Objectif : ${lead.objectiveLabel || lead.objective}\n` +
      `Budget estimé : ${lead.budget}\n` +
      `Date de réception : ${new Date(lead.createdAt).toLocaleString('fr-TN')}\n\n` +
      `MESSAGE / PROJET :\n"${lead.message || 'Aucun message particulier spécifié.'}"\n\n` +
      `Notes Internes : ${lead.notes || 'Aucune note.'}`
    );
  };

  // 12. Export to CSV Handler (Direct client-side CSV generation for universal compatibility)
  btnExportCSV.addEventListener('click', function () {
    let csv = '\uFEFF';
    csv += 'ID,Date,Nom,Entreprise,Téléphone,Email,Objectif,Budget,Statut,Notes\n';
    allLeads.forEach(l => {
      const row = [
        `"${l.id || ''}"`,
        `"${new Date(l.createdAt).toLocaleDateString('fr-TN')}"`,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.company || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.objectiveLabel || l.objective || '').replace(/"/g, '""')}"`,
        `"${(l.budget || '').replace(/"/g, '""')}"`,
        `"${l.status || ''}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-lynxcom-sfax.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

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
