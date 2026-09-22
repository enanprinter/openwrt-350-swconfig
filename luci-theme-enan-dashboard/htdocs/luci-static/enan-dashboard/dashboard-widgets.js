/* ============================================
   ENAN Dashboard Live Widgets
   OpenWrt 24.10 LuCI — v3.5.2

   Data sources follow the official LuCI views and are redundant so a
   missing source never blanks the panels:
     * luci-rpc getNetworkDevices   -> per-netdev counters/carrier/speed
     * /proc/net/dev (single file)  -> counter fallback when ubus lacks data
     * luci getSwconfigPortState    -> switch link state (Switch page logic)
     * luci getBuiltinEthernetPorts -> physical ports on DSA targets
     * uci network switch_vlan      -> port-to-VLAN-device mapping for
                                       per-port byte counters

   v3.5.2:
   * Redundant counter sources (ubus + /proc/net/dev).
   * Switch ports show link (green) with tolerant parsing and carrier
     fallback; per-port totals come from the port's VLAN device.
   ============================================ */

(function() {
  'use strict';

  const icons = {
    cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/></svg>',
    conntrack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="3"/></svg>',
    memory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01"/><path d="M10 10h.01"/><path d="M14 10h.01"/><path d="M18 10h.01"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y="20" x2="12.01" y2="20"/></svg>',
    traffic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    wireless: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y="20" x2="12.01" y2="20"/></svg>',
    network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="1"/><path d="M5 12a7 7 0 0 1 7-7"/><path d="M12 19a7 7 0 0 0 7-7"/></svg>',
    wan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    lan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>'
  };

  function isNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function toNumber(value, fallback) {
    const number = Number(value);
    return isFinite(number) ? number : (fallback == null ? 0 : fallback);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatBytes(bytes) {
    const value = toNumber(bytes, 0);
    if (value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / Math.pow(1024, index);
    return (amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)) + ' ' + units[index];
  }

  function formatRate(bytesPerSec) {
    if (!isNumber(bytesPerSec) || bytesPerSec < 0) return '0 B/s';
    if (bytesPerSec < 100) return Math.round(bytesPerSec) + ' B/s';
    return formatBytes(bytesPerSec) + '/s';
  }

  function formatMemoryMB(bytes) {
    const value = Math.max(0, toNumber(bytes, 0)) / (1024 * 1024);
    if (value <= 0) return '0 MB';
    return (value >= 10 ? value.toFixed(0) : value.toFixed(1)) + ' MB';
  }

  function formatUptime(seconds) {
    const value = Math.max(0, toNumber(seconds, 0));
    if (!value) return 'N/A';
    const days = Math.floor(value / 86400);
    const hours = Math.floor((value % 86400) / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const parts = [];
    if (days) parts.push(days + 'd');
    if (hours) parts.push(hours + 'h');
    if (minutes || !parts.length) parts.push(minutes + 'm');
    return parts.join(' ');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, toNumber(value, min)));
  }

  function safeObject(value) {
    return value && typeof value === 'object' ? value : {};
  }

  /* lenient truthy for ubus link fields (true / 1 / "up") */
  function linkUp(value) {
    return value === true || value === 1 || value === '1' || value === 'up';
  }

  /* ── ubus data sources (same as the official LuCI views) ───────── */

  function callRpc(object, method) {
    if (typeof L === 'undefined' || !L.rpc || typeof L.rpc.declare !== 'function')
      return Promise.resolve({});

    try {
      const call = L.rpc.declare({
        object: object,
        method: method,
        expect: { '': {} }
      });
      return L.resolveDefault(call(), {});
    } catch (error) {
      return Promise.resolve({});
    }
  }

  function callNetworkDevices() {
    if (typeof L === 'undefined' || !L.rpc || typeof L.rpc.declare !== 'function')
      return Promise.resolve({});
    try {
      const call = L.rpc.declare({ object: 'luci-rpc', method: 'getNetworkDevices', expect: { '': {} } });
      return L.resolveDefault(call(), {});
    } catch (error) {
      return Promise.resolve({});
    }
  }

  function callBuiltinPorts() {
    if (typeof L === 'undefined' || !L.rpc || typeof L.rpc.declare !== 'function') return Promise.resolve([]);
    try {
      const call = L.rpc.declare({ object: 'luci', method: 'getBuiltinEthernetPorts', expect: { result: [] } });
      return L.resolveDefault(call(), []).then(function(result) {
        return Array.isArray(result) ? result : [];
      });
    } catch (error) { return Promise.resolve([]); }
  }

  function loadSwitchData() {
    if (typeof L === 'undefined' || !L.rpc || typeof L.rpc.declare !== 'function')
      return Promise.resolve({ ports: [], haveStates: false });

    const callState = L.rpc.declare({ object: 'luci', method: 'getSwconfigPortState', params: ['switch'], expect: { result: [] } });

    const loadTopologies = (typeof L.require === 'function')
      ? L.require('network').then(function(network) {
          return (network && typeof network.getSwitchTopologies === 'function')
            ? L.resolveDefault(network.getSwitchTopologies(), {})
            : {};
        }).catch(function() { return {}; })
      : Promise.resolve({});

    return loadTopologies.then(function(topologies) {
      const names = Object.keys(safeObject(topologies));
      if (!names.length) return { ports: [], haveStates: false };
      return Promise.all(names.map(function(switchName) {
        const topology = safeObject(topologies[switchName]);
        return L.resolveDefault(callState(switchName), []).then(function(states) {
          const stateList = Array.isArray(states) ? states : [];
          const haveStates = stateList.length > 0;

          /* Some swconfig drivers emit repeated blocks per port (an empty
             one first, then the real link state). The official Switch page
             applies every block in order, so the last one wins; here the
             blocks are aggregated per port: any "link up" block marks the
             port up, with the speed/duplex taken from the live block. */
          const byPort = {};
          stateList.forEach(function(item) {
            const p = Number(item && item.port);
            if (!isFinite(p)) return;
            const cur = byPort[p] || (byPort[p] = { link: false, speed: null, duplex: null });
            if (linkUp(item && item.link)) {
              cur.link = true;
              if (Number(item.speed) > 0) cur.speed = Number(item.speed);
              if (item.duplex) cur.duplex = (item.duplex === true ? 'full' : String(item.duplex));
            } else if (cur.speed == null && Number(item.speed) > 0) {
              cur.speed = Number(item.speed);
            }
          });

          const ports = (Array.isArray(topology.ports) ? topology.ports : []).map(function(port) {
            const portNumber = Number(port && (port.num != null ? port.num : (port.port != null ? port.port : port.idx)));
            const state = safeObject(byPort[portNumber]);
            const label = String(port && (port.label || port.name || '') || '').trim();
            if (/cpu/i.test(label)) return null;
            const lower = label.toLowerCase();
            return {
              port: portNumber,
              label: label || ('Port ' + portNumber),
              role: /wan/i.test(label) ? 'wan' : (/lan/i.test(label) ? 'lan' : 'unknown'),
              link: state.link === true,
              speed: state.speed,
              duplex: state.duplex
            };
          }).filter(Boolean);
          return ports.map(function(p) { p.haveStates = haveStates; return p; });
        });
      })).then(function(groups) {
        const ports = groups.reduce(function(all, group) { return all.concat(group); }, []);
        const haveStates = ports.some(function(p) { return p.haveStates; });
        return { ports: ports, haveStates: haveStates };
      });
    }).catch(function() { return { ports: [], haveStates: false }; });
  }

  /* Every non-CPU member port of a switch_vlan maps to eth0.<vid> so the
     VLAN byte counters can be shown under its ports. */
  function loadVlanPortMap() {
    if (typeof L === 'undefined' || !L.rpc || typeof L.rpc.declare !== 'function') return Promise.resolve({});
    try {
      const call = L.rpc.declare({ object: 'uci', method: 'get', params: ['config'], expect: { values: {} } });
      return L.resolveDefault(call('network'), {}).then(function(reply) {
        const values = safeObject(safeObject(reply).values);
        const map = {};
        Object.keys(values).forEach(function(section) {
          const item = safeObject(values[section]);
          if (item['.type'] !== 'switch_vlan') return;
          const vid = item.vid != null ? item.vid : item.vlan;
          if (vid == null) return;
          const tokens = String(item.ports || '').trim().split(/\s+/).filter(Boolean);
          const tagged = tokens.filter(function(token) { return /t$/.test(token); });
          const cpuToken = tagged.length === 1 ? tagged[0] : null;
          tokens.forEach(function(token) {
            if (token === cpuToken) return;
            const num = Number(token.replace(/[tu]$/, ''));
            if (isFinite(num) && map[num] == null) map[num] = String(vid);
          });
        });
        return map;
      });
    } catch (error) { return Promise.resolve({}); }
  }

  function callAssocList(device) {
    if (!device || typeof L === 'undefined' || !L.rpc || typeof L.rpc.declare !== 'function')
      return Promise.resolve([]);

    try {
      const call = L.rpc.declare({
        object: 'iwinfo',
        method: 'assoclist',
        params: ['device', 'mac'],
        expect: { results: [] }
      });
      return L.resolveDefault(call(device), []).then(function(result) {
        if (Array.isArray(result)) return result;
        return Array.isArray(result && result.results) ? result.results : [];
      });
    } catch (error) {
      return Promise.resolve([]);
    }
  }

  /* ── sysfs/procfs helpers (exact ACL paths only) ───────────────── */

  function readText(fs, path) {
    try { return L.resolveDefault(fs.read(path), ''); }
    catch (error) { return Promise.resolve(''); }
  }

  /* Single-file counter source: works wherever the ACL grants the exact
     path, independent of ubus. */
  function readProcNetDev(fs) {
    return readText(fs, '/proc/net/dev').then(function(text) {
      const map = {};
      String(text || '').split('\n').forEach(function(line) {
        const idx = line.indexOf(':');
        if (idx < 0) return;
        const name = line.slice(0, idx).trim();
        if (!name) return;
        const fields = line.slice(idx + 1).trim().split(/\s+/);
        if (fields.length < 10) return;
        map[name] = { rx: toNumber(fields[0], 0), tx: toNumber(fields[8], 0) };
      });
      return map;
    }).catch(function() { return {}; });
  }

  function readConntrack(fs) {
    return Promise.all([
      readText(fs, '/proc/sys/net/netfilter/nf_conntrack_count'),
      readText(fs, '/proc/sys/net/netfilter/nf_conntrack_max')
    ]).then(function(values) {
      const count = Number(String(values[0] || '').trim());
      const max = Number(String(values[1] || '').trim());
      if (!isFinite(count) || count < 0) return null;
      return { count: count, max: isFinite(max) && max > 0 ? max : null };
    }).catch(function() { return null; });
  }

  /* v3.6.1 — Active Connections on firewall-less builds: conntrack stays 0
     when no nft hook tracks flows, so fall back to live socket endpoints:
     TCP sockets in ESTABLISHED (st 01) + bound UDP endpoints. */
  function readSocketConns(fs) {
    return Promise.all([
      readText(fs, '/proc/net/tcp'),
      readText(fs, '/proc/net/tcp6'),
      readText(fs, '/proc/net/udp'),
      readText(fs, '/proc/net/udp6')
    ]).then(function(texts) {
      let count = 0;
      texts.forEach(function(text, idx) {
        String(text || '').split('\n').slice(1).forEach(function(line) {
          const parts = String(line).trim().split(/\s+/);
          if (parts.length < 4) return;
          if (idx < 2) {
            if (parts[3] === '01') count++;
          } else {
            count++;
          }
        });
      });
      return count;
    }).catch(function() { return 0; });
  }

  /* Merge ubus getNetworkDevices with /proc/net/dev into one dev map. */
  function buildDevMap(netdevs, procdevs) {
    const map = {};
    const names = {};
    Object.keys(safeObject(netdevs)).forEach(function(n) { names[n] = true; });
    Object.keys(safeObject(procdevs)).forEach(function(n) { names[n] = true; });
    Object.keys(names).forEach(function(name) {
      const dev = safeObject(safeObject(netdevs)[name]);
      const stats = safeObject(dev.stats);
      const link = safeObject(dev.link);
      const flags = safeObject(dev.flags);
      const proc = safeObject(safeObject(procdevs)[name]);
      const hasUbus = Object.keys(dev).length > 0;
      const hasProc = Object.keys(proc).length > 0;
      map[name] = {
        present: hasUbus || hasProc,
        rx: hasUbus ? toNumber(stats.rx_bytes, 0) : toNumber(proc.rx, 0),
        tx: hasUbus ? toNumber(stats.tx_bytes, 0) : toNumber(proc.tx, 0),
        carrier: !!link.carrier,
        up: !!(flags.up || link.carrier),
        speed: Number(link.speed) > 0 ? Number(link.speed) : null,
        duplex: link.duplex && link.duplex !== 'unknown' ? link.duplex : null
      };
    });
    return map;
  }

  function devAt(devMap, name) {
    return name ? safeObject(devMap[name]) : safeObject(null);
  }

  /* Top-level physical devices only, so VLAN/bridge children are not
     double counted in the boot-time traffic total. */
  function isPhysicalNetdev(name) {
    return /^(eth|wlan|wwan|usb|ppp|tun)[0-9]*$/.test(name);
  }

  /* ── hardware metrics (cpu freq / temperature) ─────────────────── */

  function parseCpuInfoFrequency(value) {
    const text = String(value == null ? '' : value);
    const match = text.match(/(?:cpu\s+MHz|clock)\s*[:@]\s*([0-9]+(?:\.[0-9]+)?)/i) || text.match(/([0-9]+(?:\.[0-9]+)?)\s*MHz/i);
    return match && Number(match[1]) > 0 ? Number(match[1]) : null;
  }

  function parseFrequencyMHz(value) {
    const text = String(value == null ? '' : value).trim();
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return null;
    const number = Number(match[1]);
    if (!isFinite(number) || number <= 0) return null;
    return number > 100000 ? number / 1000 : number;
  }

  function parseTemperatureC(value) {
    const text = String(value == null ? '' : value).trim();
    const match = text.match(/-?[0-9]+(?:\.[0-9]+)?/);
    if (!match) return null;
    const number = Number(match[0]);
    if (!isFinite(number)) return null;
    return Math.abs(number) > 200 ? number / 1000 : number;
  }

  function readHwmonTemperature(fs) {
    return L.resolveDefault(fs.list('/sys/class/hwmon'), []).then(function(entries) {
      const dirs = Array.isArray(entries) ? entries.filter(function(entry) { return entry && /^hwmon[0-9]+$/.test(entry.name || ''); }) : [];
      return Promise.all(dirs.map(function(dir) {
        const base = '/sys/class/hwmon/' + dir.name;
        return Promise.all([readText(fs, base + '/name')].concat(Array.from({length: 8}, function(_, i) { return readText(fs, base + '/temp' + (i + 1) + '_input'); })));
      })).then(function(groups) {
        let fallback = null;
        groups.forEach(function(group) {
          for (let i = 1; i < group.length; i++) {
            const value = parseTemperatureC(group[i]);
            if (value != null && fallback == null) fallback = value;
          }
        });
        return fallback;
      });
    }).catch(function() { return null; });
  }

  function readHardwareMetrics(fs) {
    const empty = { cpuMHz: null, temperature: null };
    const cpuPaths = [
      '/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq',
      '/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_cur_freq',
      '/sys/devices/system/cpu/cpufreq/policy0/scaling_cur_freq',
      '/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq',
      '/proc/cpuinfo'
    ];
    return Promise.all(cpuPaths.map(function(path) { return readText(fs, path); })).then(function(cpuValues) {
      let cpuMHz = null;
      for (let i = 0; i < cpuValues.length && cpuMHz == null; i++) {
        cpuMHz = i === cpuValues.length - 1 ? parseCpuInfoFrequency(cpuValues[i]) : parseFrequencyMHz(cpuValues[i]);
      }
      return L.resolveDefault(fs.list('/sys/class/thermal'), []).then(function(entries) {
        const zones = Array.isArray(entries) ? entries.filter(function(entry) {
          return entry && /^thermal_zone[0-9]+$/.test(entry.name || '');
        }) : [];
        return Promise.all(zones.map(function(zone) {
          const base = '/sys/class/thermal/' + zone.name;
          return Promise.all([readText(fs, base + '/temp'), readText(fs, base + '/type')]);
        })).then(function(values) {
          let temperature = null;
          let fallback = null;
          values.forEach(function(pair) {
            const value = parseTemperatureC(pair[0]);
            const type = String(pair[1] || '').toLowerCase();
            if (value == null) return;
            if (fallback == null) fallback = value;
            if (temperature == null && (type.indexOf('cpu') >= 0 || type.indexOf('soc') >= 0 || type.indexOf('package') >= 0)) temperature = value;
          });
          if (temperature != null || fallback != null)
            return { cpuMHz: cpuMHz, temperature: temperature == null ? fallback : temperature };
          return readHwmonTemperature(fs).then(function(hwmonTemperature) {
            return { cpuMHz: cpuMHz, temperature: hwmonTemperature };
          });
        });
      }).catch(function() {
        return readHwmonTemperature(fs).then(function(hwmonTemperature) {
          return { cpuMHz: cpuMHz, temperature: hwmonTemperature };
        });
      });
    }).catch(function() { return empty; });
  }

  function extractCpuFrequency(systemInfo, hardware) {
    const hardwareInfo = safeObject(hardware);
    if (isNumber(hardwareInfo.cpuMHz) && hardwareInfo.cpuMHz > 0)
      return Math.round(hardwareInfo.cpuMHz) + ' MHz';
    const sysInfo = safeObject(systemInfo);
    const candidates = [sysInfo.cpu_mhz, sysInfo.cpufreq];
    for (let i = 0; i < candidates.length; i++) {
      if (isNumber(candidates[i]) && candidates[i] > 0)
        return Math.round(candidates[i]) + ' MHz';
      if (typeof candidates[i] === 'string') {
        const match = candidates[i].match(/([0-9]+(?:\.[0-9]+)?)\s*(?:MHz|Mhz)/);
        if (match) return Math.round(Number(match[1])) + ' MHz';
      }
    }
    return null;
  }

  /* ── wireless ──────────────────────────────────────────────────── */

  function getWirelessEntries(devices) {
    const source = safeObject(devices);
    const entries = [];

    Object.keys(source).forEach(function(radioName) {
      const radio = safeObject(source[radioName]);
      const interfaces = Array.isArray(radio.interfaces) ? radio.interfaces : [];

      if (interfaces.length) {
        interfaces.forEach(function(iface) {
          const item = safeObject(iface);
          const info = safeObject(item.iwinfo || radio.iwinfo || item);
          entries.push({
            radio: radioName,
            ifname: item.ifname || item.device || radioName,
            ssid: item.ssid || info.ssid || radio.ssid || item.ifname || radioName,
            band: item.band || radio.band || '',
            channel: info.channel || item.channel || radio.channel || null,
            frequency: info.frequency || item.frequency || radio.frequency || null,
            bitrate: info.bitrate || item.bitrate || radio.bitrate || null,
            quality: info.quality,
            qualityMax: info.quality_max,
            clients: []
          });
        });
      } else if (radio.ifname || radio.ssid || radio.iwinfo) {
        const info = safeObject(radio.iwinfo || radio);
        entries.push({
          radio: radioName,
          ifname: radio.ifname || radioName,
          ssid: radio.ssid || info.ssid || radioName,
          band: radio.band || '',
          channel: info.channel || radio.channel || null,
          frequency: info.frequency || radio.frequency || null,
          bitrate: info.bitrate || radio.bitrate || null,
          quality: info.quality,
          qualityMax: info.quality_max,
          clients: []
        });
      }
    });

    return entries;
  }

  function bandLabel(entry) {
    const band = String(entry.band || '').toLowerCase();
    if (band.indexOf('5') >= 0) return '5 GHz';
    if (band.indexOf('2') >= 0) return '2.4 GHz';
    const frequency = toNumber(entry.frequency, 0);
    if (frequency >= 5000) return '5 GHz';
    if (frequency >= 2000) return '2.4 GHz';
    return 'Wireless';
  }

  function wirelessLoad(entry) {
    if (entry.qualityMax && isNumber(entry.quality))
      return clamp((entry.quality / entry.qualityMax) * 100, 0, 100);
    return 0;
  }

  function loadWirelessData(devices) {
    const entries = getWirelessEntries(devices);
    return Promise.all(entries.map(function(entry) {
      return callAssocList(entry.ifname).then(function(clients) {
        entry.clients = clients;
        return entry;
      });
    }));
  }

  /* ── throughput sampling between update ticks ──────────────────── */

  const trafficSamples = {};

  function computeRates(devices, devMap) {
    const now = Date.now();
    const rates = {};
    (Array.isArray(devices) ? devices : []).forEach(function(dev) {
      const info = devAt(devMap, dev);
      const prev = trafficSamples[dev];
      if (prev && (now - prev.t) > 800 && info.present) {
        const dt = (now - prev.t) / 1000;
        rates[dev] = {
          rx: Math.max(0, (info.rx - prev.rx) / dt),
          tx: Math.max(0, (info.tx - prev.tx) / dt)
        };
      } else {
        rates[dev] = null;
      }
      if (info.present) trafficSamples[dev] = { t: now, rx: info.rx, tx: info.tx };
    });
    return rates;
  }

  /* ── system resources ──────────────────────────────────────────── */

  function getMemory(systemInfo) {
    const memory = safeObject(safeObject(systemInfo).memory);
    const total = toNumber(memory.total, 0);
    const free = memory.free != null ? toNumber(memory.free, 0) : toNumber(memory.available, 0);
    const used = Math.max(0, total - free);
    return { total: total, free: free, used: used };
  }

  function getStorage(systemInfo, key) {
    const item = safeObject(safeObject(systemInfo)[key]);
    const total = toNumber(item.total, 0) * 1024;
    const free = toNumber(item.free, 0) * 1024;
    const used = item.used != null ? toNumber(item.used, 0) * 1024 : Math.max(0, total - free);
    return { total: total, free: free, used: used };
  }

  function getLoad(systemInfo) {
    const load = Array.isArray(safeObject(systemInfo).load) ? safeObject(systemInfo).load[0] : 0;
    return clamp(toNumber(load, 0) / 65535, 0, 1);
  }

  function getTemperature(systemInfo, board, hardware) {
    const hardwareInfo = safeObject(hardware);
    if (isNumber(hardwareInfo.temperature)) return Math.round(hardwareInfo.temperature);
    const sysInfo = safeObject(systemInfo);
    const boardInfo = safeObject(board);
    const candidates = [sysInfo.temperature, sysInfo.cpu_temperature, boardInfo.temperature];
    for (let i = 0; i < candidates.length; i++) {
      if (isNumber(candidates[i])) return Math.round(candidates[i]);
    }
    return null;
  }

  /* ── dashboard skeleton (built once, updated in place) ─────────── */

  function statCard(id, icon) {
    return '<div class="enan-dash-card"><div class="enan-dash-card-header"><div class="enan-dash-card-icon" id="' + id + '-icon">' + icon + '</div></div><div class="enan-dash-card-value" id="' + id + '-value">N/A</div><div class="enan-dash-card-label" id="' + id + '-label">&nbsp;</div></div>';
  }

  function buildDashboard() {
    const container = document.getElementById('enan-dashboard-content');
    if (!container) return;
    if (container.dataset.enanBuilt === '1') return;
    container.dataset.enanBuilt = '1';
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'enan-dash-header';
    header.innerHTML = '<h1 class="enan-dash-title">Dashboard Overview</h1>' +
      '<div class="enan-dash-meta">' +
      '<span id="dash-model">N/A</span><span class="dot"></span>' +
      '<span id="dash-release">OpenWrt N/A</span><span class="dot"></span>' +
      '<span id="dash-kernel">Kernel N/A</span><span class="dot"></span>' +
      '<span id="dash-uptime">Uptime: N/A</span></div>';
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'enan-dash-grid';
    grid.id = 'enan-dash-grid';
    grid.innerHTML =
      statCard('dash-stat-cpu', icons.cpu) +
      statCard('dash-stat-ram', icons.memory) +
      statCard('dash-stat-clients', icons.wifi) +
      statCard('dash-stat-traffic', icons.traffic);
    container.appendChild(grid);

    const sysPanel = document.createElement('div');
    sysPanel.className = 'enan-panel';
    sysPanel.innerHTML = '<div class="enan-panel-header"><div class="enan-panel-title">' + icons.system + ' System Resources</div></div><div id="enan-sys-resources"></div>';
    container.appendChild(sysPanel);

    const wifiPanel = document.createElement('div');
    wifiPanel.className = 'enan-panel';
    wifiPanel.innerHTML = '<div class="enan-panel-header"><div class="enan-panel-title">' + icons.wireless + ' Wireless Load</div><span id="enan-wifi-badge" class="enan-panel-badge broadcasting">N/A</span></div><div id="enan-wireless-load"></div>';
    container.appendChild(wifiPanel);

    const netPanel = document.createElement('div');
    netPanel.className = 'enan-panel';
    netPanel.innerHTML = '<div class="enan-panel-header"><div class="enan-panel-title">' + icons.network + ' Network Interfaces</div><span id="enan-net-badge" class="enan-panel-badge online">N/A</span></div><div class="enan-net-grid" id="enan-net-interfaces"></div>';
    container.appendChild(netPanel);

    updateDashboard();
    if (window._enanDashboardInterval) clearInterval(window._enanDashboardInterval);
    window._enanDashboardInterval = setInterval(updateDashboard, 5000);
  }

  /* ── updaters ──────────────────────────────────────────────────── */

  function updateHeader(systemInfo, board) {
    const release = safeObject(board.release);
    const model = board.model || board.board_name || 'N/A';
    const releaseText = release.version || release.description || 'N/A';
    const kernel = board.kernel || 'N/A';
    const uptime = formatUptime(systemInfo.uptime);
    const modelEl = document.getElementById('dash-model');
    const releaseEl = document.getElementById('dash-release');
    const kernelEl = document.getElementById('dash-kernel');
    const uptimeEl = document.getElementById('dash-uptime');
    if (modelEl) modelEl.textContent = model;
    if (releaseEl) releaseEl.textContent = 'OpenWrt ' + releaseText;
    if (kernelEl) kernelEl.textContent = 'Kernel ' + kernel;
    if (uptimeEl) uptimeEl.textContent = 'Uptime: ' + uptime;

    const hostnameValue = safeObject(systemInfo).hostname || safeObject(board).hostname || '';
    const hostname = document.getElementById('enan-hostname');
    if (hostname && hostnameValue) hostname.textContent = hostnameValue;
    const deviceInfo = document.getElementById('enan-device-info');
    if (deviceInfo) {
      const description = release.description || release.version || 'OpenWrt';
      deviceInfo.textContent = (board.model || 'N/A') + ' • ' + (board.system || 'N/A') + ' • ' + description;
    }
  }

  function setStatCard(prefix, icon, value, label) {
    const iconEl = document.getElementById(prefix + '-icon');
    const valueEl = document.getElementById(prefix + '-value');
    const labelEl = document.getElementById(prefix + '-label');
    if (iconEl && iconEl.dataset.icon !== icon) {
      iconEl.dataset.icon = icon;
      iconEl.innerHTML = icon;
    }
    if (valueEl && valueEl.textContent !== value) valueEl.textContent = value;
    if (labelEl && labelEl.textContent !== label) labelEl.textContent = label;
  }

  function updateStatsGrid(systemInfo, hardware, conntrack, wireless, totalTrafficBytes, socketConns) {
    const memory = getMemory(systemInfo);
    const clients = wireless.reduce(function(total, item) {
      return total + (Array.isArray(item.clients) ? item.clients.length : 0);
    }, 0);

    const cpuMHz = extractCpuFrequency(systemInfo, hardware);
    /* v3.6.1: prefer real conntrack; on firewall-less builds (count stuck
       at 0) show the live socket-endpoint count instead of a dead zero. */
    const sock = toNumber(socketConns, 0);
    const connCount = (conntrack && conntrack.count > 0) ? conntrack.count : sock;
    const connMax = (conntrack && conntrack.max) ? conntrack.max : null;
    if (cpuMHz) {
      setStatCard('dash-stat-cpu', icons.cpu, cpuMHz, 'CPU Frequency');
    } else if (connCount > 0) {
      setStatCard('dash-stat-cpu', icons.conntrack, String(connCount),
        connMax ? 'Active Connections / ' + connMax : 'Active Connections');
    } else if (conntrack && conntrack.count != null) {
      setStatCard('dash-stat-cpu', icons.conntrack, String(conntrack.count),
        connMax ? 'Active Connections / ' + connMax : 'Active Connections');
    } else {
      setStatCard('dash-stat-cpu', icons.cpu, 'N/A', 'CPU Frequency');
    }

    setStatCard('dash-stat-ram', icons.memory, formatMemoryMB(memory.free), 'RAM Free / ' + formatMemoryMB(memory.total));
    setStatCard('dash-stat-clients', icons.wifi, String(clients), 'Active WiFi Clients');
    setStatCard('dash-stat-traffic', icons.traffic, formatBytes(totalTrafficBytes), 'Total Traffic Since Boot');
  }

  function progressRow(label, value, percent, color) {
    return '<div class="enan-progress-row"><div class="enan-progress-label"><span class="enan-progress-label-name">' + escapeHtml(label) + '</span><span class="enan-progress-label-value">' + escapeHtml(value) + '</span></div><div class="enan-progress-track"><div class="enan-progress-fill ' + color + '" style="width:' + clamp(percent, 0, 100) + '%"></div></div></div>';
  }

  function updateSystemResources(systemInfo, board, hardware) {
    const container = document.getElementById('enan-sys-resources');
    if (!container) return;
    const memory = getMemory(systemInfo);
    const root = getStorage(systemInfo, 'root');
    const temperature = getTemperature(systemInfo, board, hardware);
    const load = getLoad(systemInfo);
    const memoryPercent = memory.total > 0 ? clamp((memory.used / memory.total) * 100, 0, 100) : 0;
    const flashPercent = root.total > 0 ? clamp((root.used / root.total) * 100, 0, 100) : 0;
    const tempPercent = temperature == null ? 0 : clamp((temperature / 80) * 100, 0, 100);
    const tempText = temperature == null ? 'N/A' : temperature + '°C';
    const rootText = root.total > 0 ? formatBytes(root.used) + ' / ' + formatBytes(root.total) : 'N/A';
    const memoryText = memory.total > 0 ? formatBytes(memory.used) + ' / ' + formatBytes(memory.total) : 'N/A';

    container.innerHTML =
      progressRow('CPU Load (1m)', load.toFixed(2), load * 100, 'blue') +
      progressRow('Memory Usage', memoryText, memoryPercent, 'green') +
      progressRow('Flash Usage', rootText, flashPercent, 'gold') +
      progressRow('Temperature', tempText, tempPercent, 'red');
  }

  function updateWirelessLoad(entries, rates, devMap) {
    const container = document.getElementById('enan-wireless-load');
    const badge = document.getElementById('enan-wifi-badge');
    if (!container) return;
    if (!entries.length) {
      if (badge) badge.textContent = 'Unavailable';
      container.innerHTML = '<div class="enan-empty-state">No wireless interfaces detected</div>';
      return;
    }

    const totalClients = entries.reduce(function(total, entry) {
      return total + entry.clients.length;
    }, 0);
    if (badge) badge.textContent = totalClients + ' client' + (totalClients === 1 ? '' : 's');
    container.innerHTML = entries.map(function(entry) {
      const channel = entry.channel ? 'Ch ' + entry.channel : 'Ch N/A';
      const rate = rates[entry.ifname];
      const info = devAt(devMap, entry.ifname);
      const downRate = rate ? formatRate(rate.rx) : '0 B/s';
      const upRate = rate ? formatRate(rate.tx) : '0 B/s';
      const totals = info.present ? 'Σ ↓ ' + formatBytes(info.rx) + ' / ↑ ' + formatBytes(info.tx) : '';
      const link = entry.bitrate ? formatBytes(toNumber(entry.bitrate, 0) * 1000 / 8) + '/s link' : '';
      return '<div class="enan-wifi-item">' +
        '<div class="enan-wifi-header"><div class="enan-wifi-name">' + escapeHtml(entry.ssid) + '<span class="enan-wifi-band">' + escapeHtml(bandLabel(entry)) + '</span></div>' +
        '<span class="enan-wifi-clients">' + entry.clients.length + ' client' + (entry.clients.length === 1 ? '' : 's') + '</span></div>' +
        '<div class="enan-wifi-stats"><span title="Download throughput">↓ ' + escapeHtml(downRate) + '</span><span title="Upload throughput">↑ ' + escapeHtml(upRate) + '</span><span>' + escapeHtml(channel) + '</span>' + (link ? '<span title="Link rate">' + escapeHtml(link) + '</span>' : '') + '</div>' +
        (totals ? '<div class="enan-wifi-totals">' + escapeHtml(totals) + '</div>' : '') +
        '<div class="enan-progress-track enan-wifi-bar"><div class="enan-progress-fill gold" style="width:' + wirelessLoad(entry) + '%"></div></div>' +
        '</div>';
    }).join('');
  }

  function buildPortRows(builtinPorts, switchData, devMap, vlanMap, mibStats) {
    const rows = [];
    const mibs = safeObject(mibStats);
    const switchPorts = Array.isArray(safeObject(switchData).ports) ? switchData.ports : [];
    const haveStates = !!safeObject(switchData).haveStates;
    const baseCarrier = (devAt(devMap, 'eth0').carrier === true);

    /* swconfig targets first: real LAN/WAN switch ports with link state,
       exactly like the official Switch page. Byte counters come from the
       port's VLAN device (eth0.<vid>). */
    if (switchPorts.length) {
      switchPorts.forEach(function(port) {
        const vid = vlanMap[port.port];
        const vlanDev = vid != null ? 'eth0.' + vid : null;
        const info = devAt(devMap, vlanDev);
        let up = port.link === true;
        if (!up && (!haveStates || port.link == null)) {
          /* swconfig state unavailable: fall back to the carrier of the
             port's VLAN device, or of the switch uplink. */
          up = (vlanDev ? info.carrier === true : false) || baseCarrier;
        }
        const speed = port.speed || (vlanDev ? info.speed : null) || (baseCarrier ? devAt(devMap, 'eth0').speed : null);
        rows.push({
          name: port.label.toUpperCase(),
          device: vlanDev || port.label,
          role: port.role,
          isUp: up,
          speed: speed,
          duplex: port.duplex || (vlanDev ? info.duplex : null),
          rx: info.rx,
          tx: info.tx,
          hasTraffic: info.present,
          icon: port.role === 'wan' ? icons.wan : icons.lan
        });
      });
      return rows;
    }

    /* DSA / builtin ports: each port is a real net device. Kernel counters
       are blind to hardware-offloaded forwarding, so prefer the switch MIB
       counters (ethtool -S RxGoodByte/TxByte) delivered by the
       /usr/libexec/enan-port-stats helper when available (v3.6.1). */
    if (Array.isArray(builtinPorts) && builtinPorts.length) {
      builtinPorts.forEach(function(port) {
        const item = safeObject(port);
        const device = item.device || item.name;
        const info = devAt(devMap, device);
        const mib = safeObject(mibs[device]);
        const useMib = (mib.rx != null && mib.tx != null);
        /* v3.6.2 — link = physical carrier ONLY. The admin flag (IFF_UP)
           stays up when the cable is unplugged, which kept the port card
           green forever on DSA builds. */
        const linkUp = (info.carrier === true) || (mib.carrier === 1);
        const lower = String(item.label || device || '').toLowerCase();
        const role = item.role || (lower.indexOf('wan') === 0 ? 'wan' : (lower.indexOf('lan') === 0 ? 'lan' : 'unknown'));
        rows.push({
          name: String(item.label || device || '').toUpperCase(),
          device: device,
          role: role,
          isUp: linkUp,
          speed: linkUp ? info.speed : null,
          duplex: linkUp ? info.duplex : null,
          rx: useMib ? toNumber(mib.rx, 0) : info.rx,
          tx: useMib ? toNumber(mib.tx, 0) : info.tx,
          hasTraffic: useMib ? true : info.present,
          icon: role === 'wan' ? icons.wan : icons.lan
        });
      });
      return rows;
    }

    return rows;
  }

  function updateNetworkInterfaces(rows) {
    const container = document.getElementById('enan-net-interfaces');
    const badge = document.getElementById('enan-net-badge');
    if (!container) return;
    const online = rows.filter(function(row) { return row.isUp; }).length;
    if (badge) badge.textContent = rows.length ? online + '/' + rows.length + ' online' : 'Unavailable';
    if (!rows.length) {
      container.innerHTML = '<div class="enan-empty-state">No network interfaces detected</div>';
      return;
    }
    container.innerHTML = rows.map(function(row) {
      const speed = row.speed ? row.speed + ' Mbps' + (row.duplex ? ' ' + row.duplex : '') : 'N/A';
      const traffic = row.hasTraffic
        ? '<span class="down">↓ ' + escapeHtml(formatBytes(row.rx)) + '</span><span class="up">↑ ' + escapeHtml(formatBytes(row.tx)) + '</span>'
        : '<span class="muted">—</span>';
      return '<div class="enan-net-item ' + (row.isUp ? 'up' : '') + '"><div class="enan-net-icon">' + row.icon + '</div><div class="enan-net-name">' + escapeHtml(row.name) + '</div><div class="enan-net-status">' + (row.isUp ? 'UP' : 'DOWN') + '</div><div class="enan-net-speed">' + escapeHtml(speed) + '</div><div class="enan-net-traffic">' + traffic + '</div></div>';
    }).join('');
  }

  /* ── main update tick ──────────────────────────────────────────── */

  function updateDashboard() {
    if (window._enanDashboardUpdating) return;
    if (typeof L === 'undefined' || !L.rpc) return;
    window._enanDashboardUpdating = true;

    Promise.all([
      callRpc('system', 'info'),
      callRpc('system', 'board'),
      callRpc('luci-rpc', 'getWirelessDevices'),
      callNetworkDevices(),
      callBuiltinPorts(),
      loadSwitchData(),
      loadVlanPortMap(),
      typeof L.require === 'function' ? L.require('fs') : Promise.resolve(null)
    ]).then(function(data) {
      const systemInfo = safeObject(data[0]);
      const board = safeObject(data[1]);
      const wirelessDevices = data[2];
      const netdevs = safeObject(data[3]);
      const builtinPorts = Array.isArray(data[4]) ? data[4] : [];
      const switchData = safeObject(data[5]);
      const vlanMap = safeObject(data[6]);
      const fs = data[7];

      const procPromise = fs ? readProcNetDev(fs) : Promise.resolve({});

      /* v3.6.1: per-port switch MIB counters (qca8k/DSA hardware offload
         makes kernel netdev counters blind to forwarded traffic). */
      const portNames = (Array.isArray(builtinPorts) ? builtinPorts : [])
        .map(function(p) { return safeObject(p).device || safeObject(p).name; })
        .filter(Boolean);
      const mibPromise = (fs && portNames.length)
        ? L.resolveDefault(
            fs.exec('/usr/libexec/enan-port-stats', portNames).then(function(res) {
              const text = (res && typeof res.stdout === 'string') ? res.stdout
                : (typeof res === 'string' ? res : null);
              try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
            }), null)
        : Promise.resolve(null);

      return Promise.all([loadWirelessData(wirelessDevices), procPromise, mibPromise]).then(function(part2) {
        const wireless = part2[0];
        const mibStats = safeObject(part2[2]);
        const devMap = buildDevMap(netdevs, safeObject(part2[1]));
        const rates = computeRates(wireless.map(function(entry) { return entry.ifname; }), devMap);

        /* Total traffic since boot: sum of the physical top-level net
           device counters (VLAN/bridge children would double count);
           on DSA prefer the switch MIB totals when the helper provided them. */
        let totalTraffic = 0;
        Object.keys(devMap).forEach(function(name) {
          if (!isPhysicalNetdev(name)) return;
          const mib = safeObject(mibStats[name]);
          if (mib.rx != null && mib.tx != null) {
            totalTraffic += toNumber(mib.rx, 0) + toNumber(mib.tx, 0);
            return;
          }
          const info = devAt(devMap, name);
          totalTraffic += info.rx + info.tx;
        });

        const rows = buildPortRows(builtinPorts, switchData, devMap, vlanMap, mibStats);

        const metricsPromise = fs
          ? Promise.all([readHardwareMetrics(fs), readConntrack(fs), readSocketConns(fs)])
          : Promise.resolve([{ cpuMHz: null, temperature: null }, null, 0]);

        return metricsPromise.then(function(metrics) {
          const hardware = safeObject(metrics[0]);
          const conntrack = metrics[1];
          const socketConns = metrics[2];
          updateHeader(systemInfo, board);
          updateStatsGrid(systemInfo, hardware, conntrack, wireless, totalTraffic, socketConns);
          updateSystemResources(systemInfo, board, hardware);
          updateWirelessLoad(wireless, rates, devMap);
          updateNetworkInterfaces(rows);
        });
      });
    }).catch(function(error) {
      if (window.console && console.warn) console.warn('[ENAN Dashboard] Update error', error);
    }).then(function() {
      window._enanDashboardUpdating = false;
    });
  }

  window.enanBuildDashboard = buildDashboard;
  window.enanRefreshDashboard = updateDashboard;
})();
