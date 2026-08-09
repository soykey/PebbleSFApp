/* SUPER FORMULA RaceNow WebSocket client for Alloy PKJS */
var WS_URL = "ws://superformula.racelive.jp:6001/get";
var PAGE_SIZE = 5;
var RECONNECT_MS = 5000;
var STALE_MS = 15000;
var socket = null;
var reconnectTimer = null;
var staleTimer = null;
var currentPage = 0;
var connected = false;
var state = {
  session: "CONNECTING",
  totalLaps: 0,
  weather: "",
  condition: "",
  rows: [],
  lastMessageAt: 0
};

function trim(value) { return String(value || "").replace(/^\s+|\s+$/g, ""); }
function clockText() {
  var d = new Date();
  return ("0" + d.getHours()).slice(-2) + ":" +
    ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
}
function shortName(name) {
  var clean = trim(name).replace(/\s+/g, " ");
  if (!clean) return "-";
  var parts = clean.split(" ");
  var last = parts[parts.length - 1];
  if (last.toLowerCase() === "sullivan" && parts.length > 1) last = "O SULLIVAN";
  return last.toUpperCase().substr(0, 10);
}
function makeGap(row, leader) {
  var laps = parseInt(row.LAPS, 10) || 0;
  var leaderLaps = parseInt(leader.LAPS, 10) || 0;
  var lapDiff = leaderLaps - laps;
  if (lapDiff > 0) return lapDiff + (lapDiff === 1 ? " LAP" : " LAPS");
  var total = Number(row.TOTAL_TIME);
  var leaderTotal = Number(leader.TOTAL_TIME);
  if (!isFinite(total) || !isFinite(leaderTotal)) return "--";
  var gap = total - leaderTotal;
  return gap <= 0.0001 ? "LEAD" : gap.toFixed(3);
}
function convertRows(source) {
  if (!source || !source.length) return [];
  var leader = source[0];
  return source.map(function(row, index) {
    return {
      pos: index + 1,
      no: row.CARNO || row.REGNO || "-",
      driver: shortName(row.DRIVER_E || row.DRIVER_J),
      laps: parseInt(row.LAPS, 10) || 0,
      gap: makeGap(row, leader),
      status: row.STATUS || ""
    };
  });
}
function normalizedPage(page) {
  var pages = Math.max(1, Math.ceil(state.rows.length / PAGE_SIZE));
  page = Number(page) || 0;
  if (page < 0) page = pages - 1;
  if (page >= pages) page = 0;
  return page;
}
function displayStatus() {
  if (!connected) return "OFFLINE";
  if (state.session === "FINAL" && state.rows.length) return "FINAL";
  return state.rows.length ? "LIVE" : state.session;
}
function sendPage(page) {
  currentPage = normalizedPage(page);
  var pages = Math.max(1, Math.ceil(state.rows.length / PAGE_SIZE));
  var visible = state.rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  var packed = visible.map(function(r) {
    return [r.pos, r.no, r.driver.replace(/[|\n]/g, " "), r.gap].join("|");
  }).join("\n");
  var leaderLaps = state.rows.length ? state.rows[0].laps : 0;
  var total = state.totalLaps || "-";
  var wx = trim((state.weather + " " + state.condition)).toUpperCase();
  Pebble.sendAppMessage({
    STATUS: displayStatus(),
    UPDATED: clockText(),
    LAPS: leaderLaps + "/" + total,
    WEATHER: wx.substr(0, 12),
    PAGE_INFO: (currentPage + 1) + "/" + pages,
    ROWS: packed
  }, function() {}, function(e) { console.log("send failed " + JSON.stringify(e)); });
}
function handleMessage(data) {
  var type = String(data.type);
  if (type === "S") {
    state.session = data.DESCR_E || data.DESCR_J || "SESSION";
    state.totalLaps = parseInt(data.TIME_LAP, 10) || 0;
  } else if (type === "W") {
    state.weather = trim(data.weather);
    state.condition = trim(data.condition);
  } else if (type === "T") {
    if (data.msg) console.log("RaceNow: " + data.msg);
  } else if (type === "0" && Array.isArray(data.rows)) {
    state.rows = convertRows(data.rows);
  } else {
    console.log("unknown RaceNow type " + type);
    return;
  }
  state.lastMessageAt = Date.now();
  sendPage(currentPage);
}
function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, RECONNECT_MS);
}
function connect() {
  if (socket) {
    try { socket.close(); } catch (e) {}
  }
  connected = false;
  state.session = "CONNECTING";
  sendPage(currentPage);
  try {
    socket = new WebSocket(WS_URL);
  } catch (e) {
    console.log("WebSocket create failed " + e);
    scheduleReconnect();
    return;
  }
  socket.onopen = function() {
    connected = true;
    state.session = "CONNECTED";
    state.lastMessageAt = Date.now();
    sendPage(currentPage);
  };
  socket.onmessage = function(event) {
    var data;
    try { data = JSON.parse(event.data); }
    catch (e) { console.log("invalid JSON " + e); return; }
    handleMessage(data);
  };
  socket.onerror = function() { console.log("RaceNow socket error"); };
  socket.onclose = function() {
    connected = false;
    socket = null;
    sendPage(currentPage);
    scheduleReconnect();
  };
}
function checkStale() {
  if (connected && state.lastMessageAt && Date.now() - state.lastMessageAt > STALE_MS) {
    console.log("RaceNow stale; reconnecting");
    connect();
  }
}
Pebble.addEventListener("ready", function() {
  console.log("SF Live WS ready");
  connect();
  if (staleTimer) clearInterval(staleTimer);
  staleTimer = setInterval(checkStale, 5000);
});
Pebble.addEventListener("appmessage", function(e) {
  var payload = e.payload || {};
  var command = Number(payload.COMMAND) || 0;
  var requestedPage = Number(payload.PAGE) || 0;
  if (command === 1) {
    currentPage = requestedPage;
    if (!connected) connect();
    else sendPage(currentPage);
  } else if (command === 2) {
    sendPage(requestedPage);
  }
});
