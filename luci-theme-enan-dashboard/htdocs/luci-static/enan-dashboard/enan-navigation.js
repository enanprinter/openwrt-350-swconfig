/* ============================================
   ENAN Navigation
   Bootstrap dropdown + Argon-style collapsible sidebar
   ============================================ */

(function() {
  'use strict';

  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    status: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H4a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15.32 5a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9v.09A1.65 1.65 0 0 0 21 10h.09a2 2 0 1 1 0 4H21a1.65 1.65 0 0 0-1.6 1z"/></svg>',
    services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>',
    network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="1"/><path d="M5 12a7 7 0 0 1 7-7"/><path d="M12 19a7 7 0 0 0 7-7"/></svg>',
    statistics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>'
  };

  function safeObject(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function currentPath() {
    const env = safeObject(window.L && L.env);
    const path = Array.isArray(env.dispatchpath) ? env.dispatchpath : [];
    if (path.length) return path.map(String);
    const raw = document.body && document.body.getAttribute('data-path');
    return raw ? raw.split('/').filter(Boolean) : [];
  }

  function isActive(path, name) {
    return path.indexOf(name) >= 0;
  }

  function menuUrl(parts) {
    if (window.L && typeof L.url === 'function') {
      try { return L.url.apply(L, parts); } catch (error) {}
    }
    return '/cgi-bin/luci/' + parts.join('/');
  }

  function children(menuApi, node) {
    try { return menuApi.getChildren(node); } catch (error) { return []; }
  }

  function createIcon(name) {
    const wrap = document.createElement('span');
    wrap.className = 'enan-nav-icon';
    wrap.innerHTML = icons[name] || icons.default;
    return wrap;
  }

  function createChevron() {
    const chevron = document.createElement('span');
    chevron.className = 'enan-nav-chevron';
    chevron.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    return chevron;
  }

  function titleOf(node) {
    return String(node && node.title != null ? node.title : node && node.name || 'Menu');
  }

  function hasChildren(menuApi, node) {
    return children(menuApi, node).length > 0;
  }

  function closeDropdowns(except) {
    document.querySelectorAll('.enan-top-dropdown.open').forEach(function(dropdown) {
      if (dropdown !== except) {
        dropdown.classList.remove('open');
        const trigger = dropdown.querySelector(':scope > .enan-menu-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function renderTopDropdown(menuApi, node, baseParts, path) {
    const wrapper = document.createElement('div');
    wrapper.className = 'enan-top-dropdown';
    wrapper.dataset.menuGroup = node.name;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'enan-topnav-item enan-menu-trigger' + (isActive(path, node.name) ? ' active' : '');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.dataset.menuTarget = node.name;
    trigger.appendChild(createIcon(node.name));
    trigger.appendChild(document.createTextNode(titleOf(node)));
    trigger.appendChild(createChevron());

    const menu = document.createElement('div');
    menu.className = 'enan-dropdown-menu';
    menu.setAttribute('role', 'menu');
    const directChildren = children(menuApi, node);

    directChildren.forEach(function(child) {
      const childParts = baseParts.concat(child.name);
      const item = document.createElement('div');
      item.className = 'enan-dropdown-entry';
      const childChildren = children(menuApi, child);

      if (childChildren.length) {
        const childTrigger = document.createElement('button');
        childTrigger.type = 'button';
        childTrigger.className = 'enan-dropdown-item enan-submenu-trigger';
        childTrigger.setAttribute('aria-expanded', 'false');
        childTrigger.appendChild(document.createTextNode(titleOf(child)));
        childTrigger.appendChild(createChevron());
        const submenu = document.createElement('div');
        submenu.className = 'enan-submenu';
        childChildren.forEach(function(grandchild) {
          const link = document.createElement('a');
          link.className = 'enan-dropdown-item';
          link.href = menuUrl(childParts.concat(grandchild.name));
          link.textContent = titleOf(grandchild);
          link.setAttribute('role', 'menuitem');
          submenu.appendChild(link);
        });
        childTrigger.addEventListener('click', function(event) {
          event.preventDefault();
          event.stopPropagation();
          const open = item.classList.toggle('open');
          childTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
          menu.querySelectorAll('.enan-dropdown-entry.open').forEach(function(other) {
            if (other !== item) other.classList.remove('open');
          });
        });
        item.appendChild(childTrigger);
        item.appendChild(submenu);
      } else {
        const link = document.createElement('a');
        link.className = 'enan-dropdown-item';
        link.href = menuUrl(childParts);
        link.textContent = titleOf(child);
        link.setAttribute('role', 'menuitem');
        item.appendChild(link);
      }
      menu.appendChild(item);
    });

    trigger.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      const open = !wrapper.classList.contains('open');
      closeDropdowns(wrapper);
      wrapper.classList.toggle('open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    return wrapper;
  }

  function renderSidebarChild(menuApi, node, baseParts, path, depth) {
    const nodeChildren = children(menuApi, node);
    const parts = baseParts.concat(node.name);
    if (!nodeChildren.length) {
      const link = document.createElement('a');
      link.className = 'enan-sidebar-subitem' + (isActive(path, node.name) ? ' active' : '');
      link.href = menuUrl(parts);
      link.textContent = titleOf(node);
      link.dataset.menuPath = parts.join('/');
      return link;
    }

    const group = document.createElement('div');
    group.className = 'enan-sidebar-nested' + (isActive(path, node.name) ? ' open active' : '');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'enan-sidebar-subitem enan-sidebar-nested-trigger' + (isActive(path, node.name) ? ' active' : '');
    trigger.setAttribute('aria-expanded', isActive(path, node.name) ? 'true' : 'false');
    trigger.appendChild(document.createTextNode(titleOf(node)));
    trigger.appendChild(createChevron());
    const nested = document.createElement('div');
    nested.className = 'enan-sidebar-submenu enan-sidebar-submenu-nested';
    nodeChildren.forEach(function(child) { nested.appendChild(renderSidebarChild(menuApi, child, parts, path, (depth || 0) + 1)); });
    trigger.addEventListener('click', function() {
      const open = group.classList.toggle('open');
      trigger.classList.toggle('active', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    group.appendChild(trigger);
    group.appendChild(nested);
    return group;
  }

  function renderSidebarGroup(menuApi, node, baseParts, path) {
    const group = document.createElement('div');
    group.className = 'enan-sidebar-group' + (isActive(path, node.name) ? ' open active' : '');
    group.dataset.sidebarGroup = node.name;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'enan-sidebar-item enan-sidebar-trigger' + (isActive(path, node.name) ? ' active' : '');
    trigger.setAttribute('aria-expanded', isActive(path, node.name) ? 'true' : 'false');
    trigger.appendChild(createIcon(node.name));
    trigger.appendChild(document.createTextNode(titleOf(node)));
    trigger.appendChild(createChevron());

    const submenu = document.createElement('div');
    submenu.className = 'enan-sidebar-submenu';
    children(menuApi, node).forEach(function(child) {
      submenu.appendChild(renderSidebarChild(menuApi, child, baseParts, path, 0));
    });

    trigger.addEventListener('click', function() {
      const wasOpen = group.classList.contains('open');
      document.querySelectorAll('.enan-sidebar-group.open').forEach(function(other) {
        other.classList.remove('open', 'active');
        const otherTrigger = other.querySelector(':scope > .enan-sidebar-trigger');
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        group.classList.add('open', 'active');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    group.appendChild(trigger);
    group.appendChild(submenu);
    return group;
  }

  function renderNavigation(menuApi, tree) {
    const admin = safeObject(safeObject(tree).children).admin;
    if (!admin) return;
    const path = currentPath();
    const top = document.getElementById('enan-topnav');
    const side = document.getElementById('enan-sidebar-nav');
    if (!top || !side) return;
    top.innerHTML = '';
    side.innerHTML = '';

    const dashboardNode = safeObject(admin.children)['enan-dashboard'];
    if (dashboardNode) {
      dashboardNode.name = 'enan-dashboard';
      const dashboardUrl = menuUrl(['admin', 'enan-dashboard']);
      const topLink = document.createElement('a');
      topLink.className = 'enan-topnav-item' + (isActive(path, 'enan-dashboard') ? ' active' : '');
      topLink.href = dashboardUrl;
      topLink.appendChild(createIcon('dashboard'));
      topLink.appendChild(document.createTextNode(titleOf(dashboardNode)));
      top.appendChild(topLink);

      const sideLink = document.createElement('a');
      sideLink.className = 'enan-sidebar-item' + (isActive(path, 'enan-dashboard') ? ' active' : '');
      sideLink.href = dashboardUrl;
      sideLink.appendChild(createIcon('dashboard'));
      sideLink.appendChild(document.createTextNode(titleOf(dashboardNode)));
      side.appendChild(sideLink);
    }

    const groups = children(menuApi, admin);
    groups.forEach(function(node) {
      if (node.name === 'enan-dashboard') return;
      const baseParts = ['admin', node.name];
      if (hasChildren(menuApi, node)) {
        top.appendChild(renderTopDropdown(menuApi, node, baseParts, path));
        side.appendChild(renderSidebarGroup(menuApi, node, baseParts, path));
      } else {
        const href = menuUrl(baseParts);
        const topLink = document.createElement('a');
        topLink.className = 'enan-topnav-item' + (isActive(path, node.name) ? ' active' : '');
        topLink.href = href;
        topLink.appendChild(createIcon(node.name));
        topLink.appendChild(document.createTextNode(titleOf(node)));
        top.appendChild(topLink);
        const sideLink = document.createElement('a');
        sideLink.className = 'enan-sidebar-item' + (isActive(path, node.name) ? ' active' : '');
        sideLink.href = href;
        sideLink.appendChild(createIcon(node.name));
        sideLink.appendChild(document.createTextNode(titleOf(node)));
        side.appendChild(sideLink);
      }
    });

    if (!document.documentElement.dataset.enanNavOutsideBound) {
      document.documentElement.dataset.enanNavOutsideBound = '1';
      document.addEventListener('click', function(event) {
        if (!event.target.closest('.enan-top-dropdown')) closeDropdowns(null);
      });
      document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeDropdowns(null);
      });
    }
  }

  function fallbackMenu() {
    const leaf = function(name, title, order) {
      return { name: name, title: title, order: order || 100, satisfied: true, action: { type: 'view' } };
    };
    const group = function(name, title, order, childMap) {
      return { name: name, title: title, order: order || 100, satisfied: true, children: childMap || {} };
    };
    return {
      children: {
        admin: { children: {
          'enan-dashboard': leaf('enan-dashboard', 'Dashboard', 1),
          status: group('status', 'Status', 2, {
            overview: leaf('overview', 'Overview', 1),
            logs: group('logs', 'Logs', 10, {
              syslog: leaf('syslog', 'System Log', 1),
              dmesg: leaf('dmesg', 'Kernel Log', 2)
            }),
            processes: leaf('processes', 'Processes', 20),
            realtime: leaf('realtime', 'Realtime Graphs', 30)
          }),
          system: group('system', 'System', 3, {
            system: leaf('system', 'General Settings', 1),
            logging: leaf('logging', 'Logging', 2),
            timesync: leaf('timesync', 'Time Synchronization', 3),
            language: leaf('language', 'Language and Style', 4),
            admin: leaf('admin', 'Administration', 5),
            startup: leaf('startup', 'Startup', 40),
            reboot: leaf('reboot', 'Reboot', 90)
          }),
          services: group('services', 'Services', 4, {
            overview: leaf('overview', 'Overview', 1)
          }),
          network: group('network', 'Network', 5, {
            interfaces: leaf('interfaces', 'Interfaces', 1),
            wireless: leaf('wireless', 'Wireless', 2)
          }),
          statistics: group('statistics', 'Statistics', 6, {
            graphs: leaf('graphs', 'Graphs', 1)
          })
        }}
      }
    };
  }

  function fallbackApi() {
    return {
      getChildren: function(node) {
        return Object.keys(safeObject(node && node.children)).map(function(name) {
          const item = node.children[name];
          item.name = name;
          return item;
        }).filter(function(item) { return item.satisfied !== false && item.title != null; });
      }
    };
  }

  function renderFallback() {
    const top = document.getElementById('enan-topnav');
    if (top && top.querySelector('.enan-topnav-item')) return;
    renderNavigation(fallbackApi(), fallbackMenu());
  }

  /* v3.6.1 — mobile drawer wiring. header.ut renders #enan-menu-btn and the
     CSS ships the off-canvas contract (body.enan-sidebar-open + .enan-backdrop),
     but the click wiring was lost in an earlier rewrite; restore it here.
     Closes on backdrop click, Escape, or choosing a sidebar link. */
  function initMobileDrawer() {
    const btn = document.getElementById('enan-menu-btn');
    const body = document.body;
    if (!btn || !body || btn._enanDrawerWired) return;
    btn._enanDrawerWired = true;

    let backdrop = document.querySelector('.enan-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'enan-backdrop';
      body.appendChild(backdrop);
    }

    function isOpen() { return body.classList.contains('enan-sidebar-open'); }
    function setOpen(open) {
      body.classList.toggle('enan-sidebar-open', !!open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    btn.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(!isOpen());
    });
    backdrop.addEventListener('click', function() { setOpen(false); });
    document.addEventListener('keydown', function(ev) {
      if (ev.key === 'Escape' || ev.keyCode === 27) setOpen(false);
    });
    const side = document.getElementById('enan-sidebar');
    if (side) {
      side.addEventListener('click', function(ev) {
        const target = ev.target && ev.target.closest ? ev.target.closest('a') : null;
        if (target && window.matchMedia && window.matchMedia('(max-width: 860px)').matches) setOpen(false);
      });
    }
  }

  function start() {
    initMobileDrawer();
    if (!window.L || typeof L.require !== 'function') {
      renderFallback();
      return;
    }
    L.require('ui').then(function(ui) {
      if (!ui || !ui.menu) {
        renderFallback();
        return;
      }
      return ui.menu.load().then(function(tree) {
        renderNavigation(ui.menu, tree);
      });
    }).catch(function(error) {
      if (window.console && console.warn) console.warn('[ENAN Navigation] Menu load failed', error);
      renderFallback();
    });
    window.setTimeout(renderFallback, 2000);
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start, { once: true });
  else
    start();
})();
