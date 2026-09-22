/* ============================================
   ENAN Dashboard Core JavaScript
   OpenWrt 24.10 LuCI Theme
   ============================================ */

(function() {
  'use strict';

  const STORAGE_KEY = 'enan-theme';

  function getSavedTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
  }

  function applyTheme(theme) {
    const selected = theme === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    root.setAttribute('data-theme', selected);
    root.setAttribute('data-enan-theme', selected);
    if (document.body) document.body.setAttribute('data-theme', selected);
    root.classList.toggle('enan-light', selected === 'light');

    const btn = document.getElementById('enan-theme-btn');
    if (btn) {
      btn.textContent = selected === 'dark' ? '🌙' : '☀️';
      btn.setAttribute('aria-label', selected === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  function setTheme(theme) {
    const selected = theme === 'light' ? 'light' : 'dark';
    applyTheme(selected);
    localStorage.setItem(STORAGE_KEY, selected);
  }

  function toggleTheme() {
    setTheme(getSavedTheme() === 'dark' ? 'light' : 'dark');
  }

  function getLogoutUrl() {
    return (typeof L !== 'undefined' && typeof L.url === 'function') ? L.url('admin/logout') : '/cgi-bin/luci/admin/logout';
  }

  function markNestedFormRows(root) {
    if (!root || !root.querySelectorAll) return;
    const rows = [];
    if (root.matches && root.matches('.cbi-value')) rows.push(root);
    root.querySelectorAll('.cbi-value').forEach(function(row) { rows.push(row); });

    rows.forEach(function(row) {
      const field = Array.from(row.children).find(function(child) {
        return child.classList && child.classList.contains('cbi-value-field');
      });
      const nestedSection = field && field.firstElementChild;
      if (nestedSection && nestedSection.classList && nestedSection.classList.contains('cbi-section'))
        row.classList.add('enan-section-value');
    });
  }

  function markCancelButtons(root) {
    if (!root || !root.querySelectorAll) return;
    const buttons = [];
    if (root.matches && root.matches('button, input[type="button"], input[type="submit"], a.btn')) buttons.push(root);
    root.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn').forEach(function(button) { buttons.push(button); });
    buttons.forEach(function(button) {
      const value = button.value || button.textContent || '';
      const label = String(value).replace(/\s+/g, ' ').trim().toLowerCase();
      if (/^(cancel|close|dismiss|إلغاء|إغلاق)$/.test(label)) button.classList.add('enan-cancel-button');
    });
  }

  function syncModalState() {
    const overlay = document.getElementById('modal_overlay');
    if (!overlay || !document.body) return;
    const active = !!(document.body.classList && typeof document.body.classList.contains === 'function' && document.body.classList.contains('modal-overlay-active'));
    // LuCI owns modal contents and handlers; this only prevents a stale,
    // closed overlay from intercepting clicks after Save/Cancel.
    overlay.style.pointerEvents = active ? 'auto' : 'none';
    overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function scheduleModalStateSync() {
    const timer = (window && typeof window.setTimeout === 'function') ? window.setTimeout.bind(window) : setTimeout;
    [0, 40, 180, 500].forEach(function(delay) {
      timer(syncModalState, delay);
    });
  }

  function markStatusSections(root) {
  
    if (!root || !root.querySelectorAll) return;
    const sections = [];
    if (root.matches && root.matches('.cbi-section')) sections.push(root);
    root.querySelectorAll('.cbi-section').forEach(function(section) { sections.push(section); });

    sections.forEach(function(section) {
      const hasTitle = Array.from(section.children).some(function(child) {
        return child.classList && child.classList.contains('cbi-title');
      });
      if (hasTitle) section.classList.add('enan-status-section');
    });
  }

  function findStatusSection(title) {
    return Array.from(document.querySelectorAll('.cbi-section')).find(function(section) {
      const heading = section.querySelector(':scope > .cbi-title h3');
      if (!heading) return false;
      const directText = Array.from(heading.childNodes)
        .filter(function(node) { return node.nodeType === 3; })
        .map(function(node) { return node.textContent; }).join(' ').trim();
      const value = directText || heading.textContent.replace(/Hide|Show/g, '').trim();
      return value === title;
    }) || null;
  }

  function statusSectionHasContent(title) {
    const section = findStatusSection(title);
    return !!(section && section.querySelector('.cbi-progressbar'));
  }

  function statusTitleExists(title) {
    return Array.from(document.querySelectorAll('.cbi-section .cbi-title h3')).some(function(heading) {
      const textNodes = Array.from(heading.childNodes).filter(function(node) { return node.nodeType === 3; });
      const directText = textNodes.map(function(node) { return node.textContent; }).join(' ').trim();
      const value = directText || heading.textContent.replace(/Hide|Show/g, '').trim();
      return value === title;
    });
  }

  function statusBytes(bytes) {
    const mb = Math.max(0, Number(bytes) || 0) / (1024 * 1024);
    if (mb <= 0) return '0 MB';
    return (mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)) + ' MB';
  }

  function createStatusPanel(title, rows) {
    const section = document.createElement('div');
    section.className = 'cbi-section enan-status-section';

    const titleBox = document.createElement('div');
    titleBox.className = 'cbi-title';
    const heading = document.createElement('h3');
    const titleText = document.createElement('span');
    titleText.textContent = title;
    const hideText = document.createElement('span');
    hideText.className = 'label';
    hideText.textContent = 'Hide';
    heading.appendChild(titleText);
    heading.appendChild(hideText);
    titleBox.appendChild(heading);
    section.appendChild(titleBox);

    const table = document.createElement('table');
    table.className = 'table';
    const tbody = document.createElement('tbody');
    rows.forEach(function(row) {
      const tr = document.createElement('tr');
      tr.className = 'tr';
      const name = document.createElement('td');
      name.className = 'td left';
      name.setAttribute('width', '33%');
      name.textContent = row.name;
      const value = document.createElement('td');
      value.className = 'td left';
      if (row.total > 0) {
        const bar = document.createElement('div');
        const percent = Math.max(0, Math.min(100, (row.used / row.total) * 100));
        bar.className = 'cbi-progressbar';
        bar.title = statusBytes(row.used) + ' / ' + statusBytes(row.total) + ' (' + Math.round(percent) + '%)';
        const fill = document.createElement('div');
        fill.style.width = percent.toFixed(2) + '%';
        bar.appendChild(fill);
        value.appendChild(bar);
      } else {
        value.textContent = 'N/A';
      }
      tr.appendChild(name);
      tr.appendChild(value);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    section.appendChild(table);
    return section;
  }

  function ensureStatusFallback() {
    if (!document.body || !/node-admin-status|admin[\\/-]status/.test(document.body.className + ' ' + (document.body.dataset.page || '')))
      return;
    if (document.body.dataset.enanStatusFallbackRequested === '1') return;
    if (statusSectionHasContent('Memory') && statusSectionHasContent('Storage')) return;
    if (typeof L === 'undefined' || !L.rpc || typeof L.rpc.declare !== 'function') return;

    document.body.dataset.enanStatusFallbackRequested = '1';
    const infoCall = L.rpc.declare({ object: 'system', method: 'info', expect: { '': {} } });
    const mountsCall = L.rpc.declare({ object: 'luci', method: 'getMountPoints', expect: { result: [] } });
    const resolve = function(promise, fallback) {
      return (L.resolveDefault ? L.resolveDefault(promise, fallback) : Promise.resolve(promise).catch(function() { return fallback; }));
    };

    Promise.all([resolve(infoCall(), {}), resolve(mountsCall(), [])]).then(function(data) {
      const info = data[0] && typeof data[0] === 'object' ? data[0] : {};
      const memory = info.memory && typeof info.memory === 'object' ? info.memory : {};
      const root = info.root && typeof info.root === 'object' ? info.root : {};
      const tmp = info.tmp && typeof info.tmp === 'object' ? info.tmp : {};
      const host = document.querySelector('#view .includes') || document.querySelector('#view .cbi-map') || document.querySelector('#view') || document.getElementById('maincontent');
      if (!host) return;

      if (!statusSectionHasContent('Memory')) {
        const total = Number(memory.total) || 0;
        const free = memory.available != null ? Number(memory.available) : ((Number(memory.free) || 0) + (Number(memory.buffered) || 0));
        const used = Math.max(0, total - (Number(memory.free) || 0));
        const rows = [
          { name: 'Total Available', used: free, total: total },
          { name: 'Used', used: used, total: total }
        ];
        if (Number(memory.buffered) > 0) rows.push({ name: 'Buffered', used: Number(memory.buffered), total: total });
        if (Number(memory.cached) > 0) rows.push({ name: 'Cached', used: Number(memory.cached), total: total });
        const existingMemory = findStatusSection('Memory');
        if (existingMemory) existingMemory.appendChild(createStatusPanel('', rows).querySelector('.table'));
        else host.appendChild(createStatusPanel('Memory', rows));
      }

      if (!statusSectionHasContent('Storage')) {
        const rows = [
          { name: 'Disk space', used: (Number(root.used) || 0) * 1024, total: (Number(root.total) || 0) * 1024 },
          { name: 'Temp space', used: (Number(tmp.used) || 0) * 1024, total: (Number(tmp.total) || 0) * 1024 }
        ];
        const mounts = Array.isArray(data[1]) ? data[1] : [];
        mounts.forEach(function(entry) {
          if (!entry || ['/rom', '/tmp', '/dev', '/overlay', '/'].indexOf(entry.mount) >= 0) return;
          rows.push({ name: (entry.device || 'mount') + ' (' + (entry.mount || '') + ')', used: Math.max(0, (Number(entry.size) || 0) - (Number(entry.free) || 0)) / 1024, total: (Number(entry.size) || 0) / 1024 });
        });
        const existingStorage = findStatusSection('Storage');
        if (existingStorage) existingStorage.appendChild(createStatusPanel('', rows).querySelector('.table'));
        else host.appendChild(createStatusPanel('Storage', rows));
      }
    }).catch(function() {});
  }

  let statusFallbackTimer;
  function scheduleStatusFallback() {
    clearTimeout(statusFallbackTimer);
    statusFallbackTimer = setTimeout(ensureStatusFallback, 1000);
  }

  function watchNestedForms() {
    if (!document.body) return;
    markNestedFormRows(document);
    markCancelButtons(document);
    markStatusSections(document);
    syncModalState();
    scheduleModalStateSync();
    scheduleStatusFallback();
    if (!window.MutationObserver) return;
    const observer = new MutationObserver(function(records) {
      syncModalState();
      records.forEach(function(record) {
        record.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            markNestedFormRows(node);
            markCancelButtons(node);
            markStatusSections(node);
            syncModalState();
            scheduleModalStateSync();
            scheduleStatusFallback();
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', function(event) {
      if (event.target && event.target.closest && (event.target.closest('#modal_overlay') || event.target.closest('.cbi-button, .btn, button'))) {
        scheduleModalStateSync();
      }
    }, true);
    document.addEventListener('luci-loaded', scheduleModalStateSync);
    document.addEventListener('uci-loaded', scheduleModalStateSync);
  }

  function bindControls() {
    applyTheme(getSavedTheme());
    watchNestedForms();
    const themeBtn = document.getElementById('enan-theme-btn');
    if (themeBtn && !themeBtn.dataset.enanBound) {
      themeBtn.dataset.enanBound = '1';
      themeBtn.addEventListener('click', toggleTheme);
    }

    const userBtn = document.getElementById('enan-user-btn');
    if (userBtn && !userBtn.dataset.enanBound) {
      userBtn.dataset.enanBound = '1';
      userBtn.addEventListener('click', function() {
        window.location.href = getLogoutUrl();
      });
    }
  }

  // Apply the root theme immediately; DOM controls are bound after body exists.
  applyTheme(getSavedTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindControls, { once: true });
  } else {
    bindControls();
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(event) {
      if (!localStorage.getItem(STORAGE_KEY)) applyTheme(event.matches ? 'dark' : 'light');
    });
  }

  let hostnameRetries = 0;
  let hostnameRetryTimer;
  function retryHostname() {
    clearTimeout(hostnameRetryTimer);
    if (hostnameRetries >= 8) return;
    hostnameRetryTimer = setTimeout(updateHostname, 500);
  }

  function updateHostname() {
    const el = document.getElementById('enan-hostname');
    if (!el) return;
    if (typeof L === 'undefined' || !L.rpc || typeof L.rpc.declare !== 'function') {
      hostnameRetries++;
      retryHostname();
      return;
    }
    try {
      const infoCall = L.rpc.declare({ object: 'system', method: 'info', expect: { '': {} } });
      const boardCall = L.rpc.declare({ object: 'system', method: 'board', expect: { '': {} } });
      Promise.all([
        infoCall().catch(function() { return {}; }),
        boardCall().catch(function() { return {}; })
      ]).then(function(values) {
        const info = (values[0] && typeof values[0] === 'object') ? values[0] : {};
        const board = (values[1] && typeof values[1] === 'object') ? values[1] : {};
        const hostname = info.hostname || board.hostname;
        if (hostname) {
          el.textContent = hostname;
          hostnameRetries = 0;
        } else {
          hostnameRetries++;
          retryHostname();
        }
      }).catch(function() {
        hostnameRetries++;
        retryHostname();
      });
    } catch (error) {
      hostnameRetries++;
      retryHostname();
    }
  }

  document.addEventListener('luci-loaded', updateHostname);
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', updateHostname, { once: true });
  else
    updateHostname();

  window.enanToggleTheme = toggleTheme;
  window.enanSetTheme = setTheme;
  window.enanGetTheme = getSavedTheme;
})();
