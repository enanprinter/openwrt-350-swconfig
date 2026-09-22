'use strict';
'require view';
'require dom';

return view.extend({
  load: function() {
    return Promise.resolve();
  },

  render: function() {
    /* The Dashboard view belongs to the A-HADDAD theme. When another theme
       is active (menu cache may still show the entry), hand over to the
       active theme's defaults instead of rendering an empty page. */
    var media = '';
    try {
      media = (window.L && L.env && L.env.media) ? String(L.env.media) : '';
    } catch (e) { media = ''; }
    if (!media) {
      media = String(document.body ? (document.body.getAttribute('data-media') || '') : '');
    }

    if (media.indexOf('enan-dashboard') === -1) {
      var target = '/cgi-bin/luci/admin/status/overview';
      if (window.L && typeof L.url === 'function') {
        try { target = L.url('admin', 'status', 'overview'); } catch (e) {}
      }
      window.setTimeout(function() { window.location.replace(target); }, 50);
      return E('div', { 'class': 'cbi-map', 'style': 'padding:20px' },
        E('p', {}, _('This dashboard belongs to the A-HADDAD theme. Redirecting to the active theme overview…')));
    }

    var node = E('div', { 'id': 'enan-dashboard-content' });

    // Wait for next frame then build dashboard if function exists
    requestAnimationFrame(function() {
      if (typeof window.enanBuildDashboard === 'function') {
        window.enanBuildDashboard();
      } else {
        // Fallback: poll until available
        var attempts = 0;
        var interval = setInterval(function() {
          attempts++;
          if (typeof window.enanBuildDashboard === 'function') {
            clearInterval(interval);
            window.enanBuildDashboard();
          } else if (attempts > 50) { // ~5 seconds timeout
            clearInterval(interval);
            var container = document.getElementById('enan-dashboard-content');
            if (container) {
              container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--enan-text-2)">Failed to load dashboard widgets. Please refresh.</div>';
            }
          }
        }, 100);
      }
    });

    return node;
  },

  handleSaveApply: null,
  handleSave: null,
  handleReset: null,
  remove: function() {
    if (window._enanDashboardInterval) {
      clearInterval(window._enanDashboardInterval);
      window._enanDashboardInterval = null;
    }
    window._enanDashboardUpdating = false;
  }
});
