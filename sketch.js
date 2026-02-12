// ===============================
// SVG 自由落体 + 碰撞 + 手机倾斜
// 不变形 + B组视觉放大
// ===============================

let Engine = Matter.Engine;
let World = Matter.World;
let Bodies = Matter.Bodies;

let engine, world;

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

let baseSize; // 统一“最长边目标尺寸”
let gravityStrength = 1.0;

const B_GROUP_BOOST = 1.6; // ✅ B组放大倍数（你可调：1.15~1.35）

// 传感器
let hasMotion = false;
let betaVal = 0;
let gammaVal = 0;

// SVG 加载 Promise
let svgPromises = [];

// ===== 更稳地加载 SVG：fetch -> dataUrl -> loadImage =====
function preload() {
  svgPromises = FILES.map(async (f) => {
    const res = await fetch(`assets/${f}`);
    if (!res.ok) throw new Error(`加载失败: assets/${f} (${res.status})`);
    const text = await res.text();

    const encoded = encodeURIComponent(text)
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

  createCanvas(windowWidth, windowHeight);

  engine = Engine.create();
  world = engine.world;

  world.gravity.x = 0;
  world.gravity.y = gravityStrength;

  baseSize = min(width, height) * 0.12;

  createWalls();
  spawnAll();

  document.getElementById("motionBtn").addEventListener("click", async () => {
    await enableMotion();
    document.getElementById("motionBtn").style.display = "none";
  });

  document.body.addEventListener("touchmove", (e) => e.preventDefault(), {
    passive: false,
  });
}

function draw() {
  background(255);
  if (!engine) return;

  Engine.update(engine);

  // 手机倾斜 -> 重力
  if (hasMotion) {
    world.gravity.x = constrain(gammaVal / 45, -1, 1) * gravityStrength;
    world.gravity.y = constrain(betaVal / 45, -1, 1) * gravityStrength;
  } else {
    world.gravity.x = 0;
    world.gravity.y = gravityStrength;
  }

  // 渲染 SVG（保持比例，不变形）
  imageMode(CENTER);
  for (let it of items) {
    const pos = it.body.position;
    const ang = it.body.angle;

    push();
    translate(pos.x, pos.y);
    rotate(ang);

    image(it.img, 0, 0, it.w, it.h);

    pop();
  }
}

// ===============================
// 生成全部 12 个（A组正常，B组放大）
// ===============================
function spawnAll() {
  items = [];

  const cols = 6;
  const gapX = width / (cols + 1);
  const startY = -baseSize * 2.2;

  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];

    // === 等比缩放：最长边 = baseSize ===
    let scale = baseSize / max(img.width, img.height);

    // ✅ 视觉补偿：B组放大
    const isBgroup = i >= 6;
    scale *= isBgroup ? B_GROUP_BOOST : 1.0;

    const w = img.width * scale;
    const h = img.height * scale;

    // 碰撞半径：用最长边的一半（稳定）
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

// ===============================
// 边界墙
// ===============================
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
  baseSize = min(width, height) * 0.12;

  // 重建墙
  if (engine) {
    for (const w of walls) World.remove(world, w);
    createWalls();
  }
}

// ===============================
// 手机传感器（iOS 需权限）
// ===============================
async function enableMotion() {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") {
        alert("没有获得传感器权限：重力将保持向下。");
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
    alert("启用失败：浏览器可能不支持传感器权限。");
    hasMotion = false;
  }
}

// ===============================
// 点击/触摸：再生成一个随机图形
// ===============================
function mousePressed() {
  spawnOne(mouseX, mouseY);
}

function touchStarted() {
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

  // ✅ B组同样放大
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
