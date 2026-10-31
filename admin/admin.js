/**
 * LynxCom Back-Office JavaScript
 * Handles Double-Auth Login, Live CRM Leads Management,
 * Status Updates, WhatsApp Integration, and CSV Export.
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
      const data = await res.json();
      if (res.ok && data.authenticated) {
        showDashboard(data.user);
      } else {
        showLogin();
      }
    } catch (e) {
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
    loadStats();
    loadLeads();
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
      const data = await res.json();

      if (res.ok && data.success) {
        currentToken = data.token;
        localStorage.setItem('lynx_token', data.token);
        showDashboard(data.user);
      } else {
        loginError.style.display = 'block';
        loginError.textContent = data.error || 'Identifiants ou code PIN incorrects.';
      }
    } catch (err) {
      loginError.style.display = 'block';
      loginError.textContent = 'Erreur de connexion au serveur.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Déverrouiller le Back-Office';
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

  // 4. Load Stats
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        document.getElementById('kpiTotalLeads').textContent = data.totalLeads;
        document.getElementById('kpiNewLeads').textContent = data.newLeads;
        document.getElementById('kpiPipeline').textContent = new Intl.NumberFormat('fr-TN').format(data.pipelineTND) + ' TND';
        document.getElementById('kpiConversion').textContent = data.conversionRate + '%';
      }
    } catch (e) {
      console.error('Stats error:', e);
    }
  }

  // 5. Load Leads
  async function loadLeads() {
    try {
      const res = await fetch('/api/admin/leads', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (res.ok && data.leads) {
        allLeads = data.leads;
        renderLeadsTable();
      }
    } catch (e) {
      console.error('Leads error:', e);
      leadsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#EF4444; padding:20px;">Erreur de chargement.</td></tr>`;
    }
  }

  // 6. Render Leads Table with Search & Filters
  function renderLeadsTable() {
    const query = searchInput.value.toLowerCase().trim();

    const filtered = allLeads.filter(lead => {
      const matchesFilter = (currentFilter === 'all') || (lead.status === currentFilter);
      const matchesQuery = !query ||
        lead.name.toLowerCase().includes(query) ||
        lead.company.toLowerCase().includes(query) ||
        lead.phone.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        lead.id.toLowerCase().includes(query);

      return matchesFilter && matchesQuery;
    });

    if (filtered.length === 0) {
      leadsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#94A3B8;">Aucun prospect ne correspond à votre recherche.</td></tr>`;
      return;
    }

    leadsTableBody.innerHTML = filtered.map(lead => {
      const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
      const dateStr = new Date(lead.createdAt).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      
      return `
        <tr>
          <td>
            <strong>${lead.id}</strong><br>
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
        loadStats();
      }
    } catch (e) {
      alert('Erreur lors de la mise à jour du statut.');
    }
  };

  // 10. Delete Lead Global Function
  window.deleteLead = async function (id) {
    if (confirm(`Confirmez-vous la suppression du prospect ${id} ?`)) {
      try {
        const res = await fetch(`/api/admin/leads/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (res.ok) {
          allLeads = allLeads.filter(l => l.id !== id);
          renderLeadsTable();
          loadStats();
        }
      } catch (e) {
        alert('Erreur lors de la suppression.');
      }
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
      `Objectif : ${lead.objectiveLabel}\n` +
      `Budget estimé : ${lead.budget}\n` +
      `Date de réception : ${new Date(lead.createdAt).toLocaleString('fr-TN')}\n` +
      `Adresse IP : ${lead.ip}\n\n` +
      `MESSAGE / PROJET :\n"${lead.message || 'Aucun message particulier spécifié.'}"\n\n` +
      `Notes Internes : ${lead.notes || 'Aucune note.'}`
    );
  };

  // 12. Export to CSV Handler
  btnExportCSV.addEventListener('click', function () {
    window.location.href = `/api/admin/export?token=${currentToken}`;
  });

  // Utility: Escape HTML
  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

});

