// ==========================================
// SVG 自由落体 + 碰撞 + 手机倾斜（清晰版）
// 白色背景 | 不变形 | B组放大 | 首次触摸自动启用倾斜
// iPhone 清晰关键：pixelDensity + 提高 SVG 栅格化尺寸
// ==========================================

let Engine = Matter.Engine;
let World = Matter.World;
let Bodies = Matter.Bodies;

let engine, world;
let canvas;

const FILES = [
  "A1.svg",
  "A2.svg",
  "A3.svg",
  "A4.svg",
  "A5.svg",
  "A6.svg",
  "B7.svg",
  "B8.svg",
  "B9.svg",
  "B10.svg",
  "B11.svg",
  "B12.svg",
];

let imgs = [];
let items = [];
let walls = [];

let baseSize;
let gravityStrength = 1.0;

// ✅ B组放大倍数（在这里调！）
const B_GROUP_BOOST = 1.25;

// ✅ 提高 SVG 被栅格化时的分辨率（越大越清晰，但更吃性能）
const SVG_RASTER_SIZE = 1600;

// ✅ 控制 Retina 密度（2 通常“清晰+流畅”，想更清晰可试 3）
const MAX_DPR = 2;

let hasMotion = false;
let betaVal = 0;
let gammaVal = 0;

let svgPromises = [];
let motionArmed = false;

// ---------- SVG 加载：fetch ->（提高svg宽高）-> dataUrl -> loadImage ----------
function preload() {
  svgPromises = FILES.map(async (f) => {
    const res = await fetch(`assets/${f}`);
    if (!res.ok) throw new Error(`加载失败: assets/${f} (${res.status})`);
    let svgText = await res.text();

    // 关键：把 <svg> 的 width/height 临时设大，提高 raster 清晰度
    svgText = upscaleSvgForRaster(svgText, SVG_RASTER_SIZE);

    const encoded = encodeURIComponent(svgText)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22");

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
    return loadImage(dataUrl);
  });
}

async function setup() {
  try {
    imgs = await Promise.all(svgPromises);
  } catch (e) {
    console.error(e);
    alert(String(e));
    return;
  }

  canvas = createCanvas(windowWidth, windowHeight);
  setRetinaDensity();

  // 提升渲染质量
  smooth();

  engine = Engine.create();
  world = engine.world;

  world.gravity.x = 0;
  world.gravity.y = gravityStrength;

  baseSize = min(width, height) * 0.12;

  createWalls();
  spawnAll();

  // ✅ 首次触摸屏幕任意位置：自动启用倾斜（iOS 必须用户手势）
  armMotionOnFirstGesture();

  // 按钮保留：如果用户愿意也可以点
  const btn = document.getElementById("motionBtn");
  btn.addEventListener("click", async () => {
    await enableMotion();
    if (hasMotion) btn.style.display = "none";
  });

  // 只禁止画布区域滚动，避免按钮点不了
  canvas.elt.addEventListener("touchmove", (e) => e.preventDefault(), {
    passive: false,
  });
}

function draw() {
  background(255);
  if (!engine) return;

  Engine.update(engine);

  if (hasMotion) {
    world.gravity.x = constrain(gammaVal / 45, -1, 1) * gravityStrength;
    world.gravity.y = constrain(betaVal / 45, -1, 1) * gravityStrength;
  } else {
    world.gravity.x = 0;
    world.gravity.y = gravityStrength;
  }

  imageMode(CENTER);

  for (let it of items) {
    const pos = it.body.position;
    const ang = it.body.angle;

    push();
    translate(pos.x, pos.y);
    rotate(ang);

    // 不变形：直接用 w/h 等比尺寸绘制
    image(it.img, 0, 0, it.w, it.h);

    pop();
  }
}

// ---------- 生成初始 12 个（A 正常，B 放大） ----------
function spawnAll() {
  items = [];

  const cols = 6;
  const gapX = width / (cols + 1);
  const startY = -baseSize * 2.2;

  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];

    let scale = baseSize / max(img.width, img.height);
    const isBgroup = i >= 6;
    scale *= isBgroup ? B_GROUP_BOOST : 1.0;

    const w = img.width * scale;
    const h = img.height * scale;

    const r = max(w, h) / 2;

    const col = i % cols;
    const row = floor(i / cols);

    const x = gapX * (col + 1) + random(-10, 10);
    const y = startY - row * (baseSize * 1.4) + random(-10, 10);

    const body = Bodies.circle(x, y, r, {
      restitution: 0.35,
      friction: 0.15,
      frictionAir: 0.02,
      density: 0.0018,
    });

    World.add(world, body);
    items.push({ body, img, w, h, r, index: i });
  }
}

// ---------- 边界墙 ----------
function createWalls() {
  const t = 100;
  const opts = { isStatic: true, friction: 0.2, restitution: 0.2 };

  const floor = Bodies.rectangle(
    width / 2,
    height + t / 2,
    width + t * 2,
    t,
    opts,
  );
  const left = Bodies.rectangle(-t / 2, height / 2, t, height + t * 2, opts);
  const right = Bodies.rectangle(
    width + t / 2,
    height / 2,
    t,
    height + t * 2,
    opts,
  );
  const top = Bodies.rectangle(width / 2, -t / 2, width + t * 2, t, opts);

  walls = [floor, left, right, top];
  World.add(world, walls);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setRetinaDensity();

  baseSize = min(width, height) * 0.12;

  if (engine) {
    for (const w of walls) World.remove(world, w);
    createWalls();
  }
}

// ---------- iPhone 清晰关键：Retina 像素密度 ----------
function setRetinaDensity() {
  const dpr = window.devicePixelRatio || 1;
  pixelDensity(Math.min(dpr, MAX_DPR));
}

// ---------- iOS：首次触摸任意位置自动请求权限 ----------
function armMotionOnFirstGesture() {
  if (motionArmed) return;
  motionArmed = true;

  const tryEnable = async () => {
    await enableMotion();
    const btn = document.getElementById("motionBtn");
    if (hasMotion && btn) btn.style.display = "none";

    window.removeEventListener("pointerdown", tryEnable, true);
    window.removeEventListener("touchend", tryEnable, true);
  };

  window.addEventListener("pointerdown", tryEnable, true);
  window.addEventListener("touchend", tryEnable, true);
}

// ---------- 启用传感器 ----------
async function enableMotion() {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") {
        hasMotion = false;
        return;
      }
    }

    hasMotion = true;

    window.addEventListener(
      "deviceorientation",
      (e) => {
        if (e.beta != null) betaVal = e.beta;
        if (e.gamma != null) gammaVal = e.gamma;
      },
      true,
    );
  } catch (err) {
    console.error(err);
    hasMotion = false;
  }
}

// ---------- 点击/触摸生成（不挡按钮） ----------
function mousePressed() {
  const el = document.elementFromPoint(mouseX, mouseY);
  if (el && el.id === "motionBtn") return;
  spawnOne(mouseX, mouseY);
}

function touchStarted(e) {
  if (e && e.target && e.target.id === "motionBtn") return true;

  const x = touches?.[0]?.x ?? width / 2;
  const y = touches?.[0]?.y ?? height / 2;
  spawnOne(x, y);

  return false;
}

function spawnOne(x, y) {
  if (!engine || imgs.length === 0) return;

  const idx = floor(random(imgs.length));
  const img = imgs[idx];

  let scale = baseSize / max(img.width, img.height);
  const isBgroup = idx >= 6;
  scale *= isBgroup ? B_GROUP_BOOST : 1.0;

  const w = img.width * scale;
  const h = img.height * scale;
  const r = max(w, h) / 2;

  const body = Bodies.circle(x, y, r, {
    restitution: 0.35,
    friction: 0.15,
    frictionAir: 0.02,
    density: 0.0018,
  });

  World.add(world, body);
  items.push({ body, img, w, h, r, index: idx });
}

// ---------- 提高 SVG 栅格化尺寸（简单安全的字符串处理） ----------
function upscaleSvgForRaster(svgText, size) {
  // 找到 <svg ...> 开头标签
  const m = svgText.match(/<svg\b[^>]*>/i);
  if (!m) return svgText;

  let tag = m[0];

  // 如果没有 viewBox，尽量不乱改；但大多数 AI 导出会有 viewBox
  // 这里主要是把 width/height 设大：使 raster 时更清晰
  tag = tag.replace(/\swidth\s*=\s*["'][^"']*["']/i, "");
  tag = tag.replace(/\sheight\s*=\s*["'][^"']*["']/i, "");

  // 在 <svg ...> 末尾插入 width/height
  const insert = ` width="${size}" height="${size}"`;
  const newTag = tag.replace(/>$/, `${insert}>`);

  return svgText.replace(m[0], newTag);
}
