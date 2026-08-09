import Poco from "commodetto/Poco";
import Button from "pebble/button";
import Message from "pebble/message";
import Timer from "timer";

const render = new Poco(screen);
const PAGE_SIZE = 5;
const W = render.width;
const C = {
  bg: render.makeColor(5, 9, 14),
  surface: render.makeColor(15, 22, 30),
  surface2: render.makeColor(20, 29, 39),
  cyan: render.makeColor(0, 218, 235),
  cyanDark: render.makeColor(0, 82, 92),
  white: render.makeColor(244, 247, 249),
  gray: render.makeColor(137, 151, 163),
  dim: render.makeColor(78, 91, 102),
  yellow: render.makeColor(244, 198, 55),
  red: render.makeColor(235, 72, 78)
};
const F = {
  brand: new render.Font("Gothic-Bold", 18),
  label: new render.Font("Gothic-Regular", 14),
  row: new render.Font("Gothic-Bold", 18),
  value: new render.Font("Gothic-Bold", 14)
};
const DEMO_PAGES = [
  [
    { pos: "1", no: "14", driver: "FUKUZUMI", gap: "LEAD" },
    { pos: "2", no: "1", driver: "IWASA", gap: "0.505" },
    { pos: "3", no: "65", driver: "FRAGA", gap: "0.939" },
    { pos: "4", no: "6", driver: "OHTA", gap: "4.808" },
    { pos: "5", no: "16", driver: "NOJIRI", gap: "6.138" }
  ],
  [
    { pos: "6", no: "5", driver: "MAKINO", gap: "8.631" },
    { pos: "7", no: "36", driver: "TSUBOI", gap: "9.251" },
    { pos: "8", no: "37", driver: "FENESTRAZ", gap: "9.975" },
    { pos: "9", no: "19", driver: "O SULLIVAN", gap: "12.265" },
    { pos: "10", no: "64", driver: "SATO", gap: "14.161" }
  ]
];

let rows = DEMO_PAGES[0];
let page = 0;
let pages = 1;
let status = "FINAL DEMO";
let laps = "51/51";
let weather = "CLOUD / DRY";
let writable = false;
let demo = true;
let gotPhoneData = false;
let oldRows = [];
let slideOffset = 0;
let oldOffset = 0;
let animationTimer = null;
let pendingDirection = 1;
let animateNextRows = false;

function centerText(text, font, color, y) {
  const width = render.getTextWidth(text, font);
  render.drawText(text, font, color, Math.floor((W - width) / 2), y);
}
function rightText(text, font, color, right, y) {
  render.drawText(text, font, color, right - render.getTextWidth(text, font), y);
}
function fit(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max) : text;
}
function parseRows(value) {
  if (!value) return [];
  return String(value).split("\n").filter(Boolean).map(line => {
    const p = line.split("|");
    return { pos: p[0] || "-", no: p[1] || "-", driver: p[2] || "-", gap: p[3] || "-" };
  });
}
function parsePageInfo(value) {
  const p = String(value || "1/1").split("/");
  page = Math.max(0, (parseInt(p[0], 10) || 1) - 1);
  pages = Math.max(1, parseInt(p[1], 10) || 1);
}
function statusColor() {
  if (demo) return C.yellow;
  if (status === "LIVE" || status === "FINAL") return C.cyan;
  if (status.indexOf("ERROR") >= 0 || status.indexOf("OFFLINE") >= 0) return C.red;
  return C.yellow;
}
function drawChrome() {
  render.fillRectangle(C.bg, 0, 0, W, render.height);
  centerText("SF LIVE", F.brand, C.white, 13);
  centerText(`${status}  •  ${page + 1}/${pages}`, F.label, statusColor(), 36);
  render.fillRectangle(C.cyan, 101, 59, 58, 2);
  render.drawText("POS", F.label, C.dim, 39, 67);
  render.drawText("DRIVER", F.label, C.dim, 90, 67);
  rightText("GAP", F.label, C.dim, 220, 67);
}
function drawRows(list, offset) {
  for (let i = 0; i < PAGE_SIZE; i++) {
    const r = list[i];
    if (!r) continue;
    const x = 31 + offset;
    const y = 87 + i * 27;
    const bg = i % 2 ? C.surface2 : C.surface;
    render.fillRectangle(bg, x, y, 198, 23);
    if (r.pos === "1") render.fillRectangle(C.cyan, x, y, 4, 23);
    render.drawText(fit(r.pos, 2), F.value, r.pos === "1" ? C.cyan : C.gray, x + 10, y + 4);
    render.drawText("#" + fit(r.no, 3), F.label, C.dim, x + 35, y + 4);
    render.drawText(fit(r.driver, 9), F.row, C.white, x + 67, y + 2);
    rightText(fit(r.gap, 6), F.value, r.pos === "1" ? C.cyan : C.gray, x + 190, y + 4);
  }
}
function drawFooter() {
  const info = `LAP ${laps}` + (weather ? `  •  ${weather}` : "");
  centerText(info, F.label, C.gray, 225);
  const dotsWidth = pages * 8 - 3;
  const start = Math.floor((W - dotsWidth) / 2);
  for (let i = 0; i < pages; i++) {
    render.fillRectangle(i === page ? C.cyan : C.dim, start + i * 8, 245, i === page ? 5 : 3, 3);
  }
}
function draw() {
  render.begin();
  drawChrome();
  if (oldRows.length && oldOffset !== 0) drawRows(oldRows, oldOffset);
  drawRows(rows, slideOffset);
  drawFooter();
  render.end();
}
function easeOutCubic(t) {
  const n = 1 - t;
  return 1 - n * n * n;
}
function drawRowRegion() {
  // Keep the static header and footer on-screen; refresh only the list.
  render.begin(25, 84, 210, 137);
  render.fillRectangle(C.bg, 25, 84, 210, 137);
  if (oldRows.length && oldOffset !== 0) drawRows(oldRows, oldOffset);
  drawRows(rows, slideOffset);
  render.end();
}
function animateTo(newRows, direction) {
  if (animationTimer) {
    Timer.clear(animationTimer);
    animationTimer = null;
  }
  oldRows = rows;
  rows = newRows;
  const distance = 150;
  const dir = direction < 0 ? -1 : 1;
  const start = Date.now();
  const duration = 180;
  slideOffset = dir * distance;
  oldOffset = 0;
  animationTimer = Timer.repeat(() => {
    const t = Math.min(1, (Date.now() - start) / duration);
    const e = easeOutCubic(t);
    slideOffset = Math.round(dir * distance * (1 - e));
    oldOffset = Math.round(-dir * distance * e);
    drawRowRegion();
    if (t >= 1) {
      Timer.clear(animationTimer);
      animationTimer = null;
      slideOffset = 0;
      oldOffset = 0;
      oldRows = [];
      draw();
    }
  }, 33);
}
function showDemo(targetPage) {
  const next = ((targetPage % DEMO_PAGES.length) + DEMO_PAGES.length) % DEMO_PAGES.length;
  const direction = next < page ? -1 : 1;
  demo = true;
  page = next;
  pages = DEMO_PAGES.length;
  status = "FINAL DEMO";
  laps = "51/51";
  weather = "CLOUD / DRY";
  animateTo(DEMO_PAGES[page], direction);
}
function requestPage(targetPage, forceRefresh) {
  if (!writable) {
    showDemo(targetPage);
    return;
  }
  pendingDirection = targetPage < page ? -1 : 1;
  animateNextRows = !forceRefresh && targetPage !== page;
  demo = false;
  status = forceRefresh ? "UPDATING" : "LOADING";
  draw();
  message.write(new Map([
    ["COMMAND", forceRefresh ? 1 : 2],
    ["PAGE", targetPage]
  ]));
}

const message = new Message({
  keys: ["COMMAND", "PAGE", "STATUS", "UPDATED", "LAPS", "WEATHER", "PAGE_INFO", "ROWS"],
  onReadable() {
    const msg = this.read();
    let incomingRows = null;
    msg.forEach((value, key) => {
      if (key === "STATUS") status = String(value);
      else if (key === "LAPS") laps = String(value);
      else if (key === "WEATHER") weather = fit(String(value), 14);
      else if (key === "PAGE_INFO") parsePageInfo(value);
      else if (key === "ROWS") incomingRows = parseRows(value);
    });
    if (incomingRows) {
      gotPhoneData = true;
      demo = false;
      if (animateNextRows) animateTo(incomingRows, pendingDirection);
      else {
        rows = incomingRows;
        slideOffset = 0;
        oldOffset = 0;
        oldRows = [];
        draw();
      }
      animateNextRows = false;
    } else draw();
  },
  onWritable() {
    writable = true;
    requestPage(page, true);
  },
  onSuspend() {
    writable = false;
    if (!gotPhoneData && !demo) status = "PHONE OFFLINE";
    draw();
  }
});

new Button({
  types: ["select", "up", "down"],
  onPush(down, type) {
    if (!down || animationTimer) return;
    if (type === "up") requestPage(page - 1, false);
    else if (type === "down") requestPage(page + 1, false);
    else requestPage(page, true);
  }
});

draw();
