const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const SAVE_KEY = "homeward-progress-v4";
const HIGH_SCORE_KEY = "homeward-high-score-v1";
const WORLD_GRAVITY = 1760;
const MAX_LIVES = 9;
const EXTRA_LIFE_EVERY = 10;
const TAU = Math.PI * 2;

let viewW = 0;
let viewH = 0;
let dpr = 1;
let lastTime = performance.now();
let audio = null;
let music = null;

const keys = new Set();
const justPressed = new Set();
const particles = [];
const camera = { x: 0, y: 0 };
const levelBackground = new Image();
const foregroundParallax = new Image();

levelBackground.decoding = "async";
levelBackground.src = new URL("../assets/level-background.png", import.meta.url).href;
foregroundParallax.decoding = "async";
foregroundParallax.src = new URL("../assets/foreground-parallax.png", import.meta.url).href;

const state = {
  levelIndex: 0,
  skillPoints: 0,
  score: 0,
  lives: MAX_LIVES,
  highScore: 0,
  nextExtraLifeScore: EXTRA_LIFE_EVERY,
  shrineLifeClaims: {},
  collected: {},
  flippedCreatures: {},
  unlocked: {
    root: true,
    doubleJump: false,
    dash: false,
    glide: false,
  },
  mode: "play",
  treeSelection: "doubleJump",
  message: "",
  messageTime: 0,
  messageLife: 0,
  lifeModalTitle: "",
  lifeModalSubtitle: "",
  lifeModalTime: 0,
  lifeModalLife: 0,
  hint: "",
  hintId: "",
  hintTime: 0,
  hintLife: 0,
  hintLockTime: 0,
  hintsSeen: {},
  actions: {
    moved: false,
    jumped: false,
    doubleJumped: false,
    dashed: false,
    glided: false,
    pounced: false,
    openedTree: false,
    unlockedAny: false,
    claimedShrineLife: false,
  },
  transition: 1,
  shake: 0,
  endingTime: 0,
  gameOverScore: 0,
};

const player = {
  x: 110,
  y: 680,
  w: 26,
  h: 42,
  vx: 0,
  vy: 0,
  dir: 1,
  grounded: false,
  wallSide: 0,
  airJumps: 0,
  dashTimer: 0,
  dashCooldown: 0,
  pounceTimer: 0,
  pounceCooldown: 0,
  respawnX: 110,
  respawnY: 680,
  coyote: 0,
  idleTime: 0,
  walkTime: 0,
  airTime: 0,
  trail: [],
};

const SKILLS = [
  {
    id: "doubleJump",
    label: "Double Jump",
    cost: 1,
    parent: "root",
    x: -150,
    y: 18,
    color: "#a9ffd7",
  },
  {
    id: "dash",
    label: "Dash",
    cost: 1,
    parent: "doubleJump",
    x: -18,
    y: -112,
    color: "#ffe08a",
  },
  {
    id: "glide",
    label: "Glide Down",
    cost: 1,
    parent: "dash",
    x: 142,
    y: 22,
    color: "#94d7ff",
  },
];

const MUSIC_THEMES = {
  forest: {
    pad: [98, 146.83],
    notes: [293.66, 329.63, 392, 329.63, 246.94, 293.66, 392, 440, 392, 329.63, 293.66, 246.94],
  },
  lantern: {
    pad: [110, 164.81],
    notes: [329.63, 392, 493.88, 440, 392, 329.63, 277.18, 329.63, 392, 493.88, 587.33, 440],
  },
  glass: {
    pad: [123.47, 185],
    notes: [369.99, 493.88, 554.37, 493.88, 415.3, 369.99, 311.13, 369.99, 493.88, 622.25, 554.37, 493.88],
  },
  dawn: {
    pad: [130.81, 196],
    notes: [392, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 493.88, 523.25, 659.25, 783.99, 587.33],
  },
};

function platform(x, y, w, h, kind = "earth") {
  return { x, y, w, h, kind };
}

function hazard(x, y, w, h, kind = "thorn") {
  return { x, y, w, h, kind };
}

function seed(id, x, y, text) {
  return { id, x, y, r: 13, text };
}

function point(id, x, y, value = 1) {
  return { id, x, y, value, r: 8 };
}

function scentPoint(x, y, strength = 1) {
  return { x, y, strength };
}

function gate(x, y, w, h, requires) {
  return { x, y, w, h, requires };
}

function movingHazard(id, x, y, w, h, axis, range, speed, phase = 0, kind = "thorn") {
  return { id, x, y, w, h, axis, range, speed, phase, kind };
}

function creature(id, minX, maxX, y, speed = 0.45, phase = 0) {
  return { id, minX, maxX, y, w: 42, h: 24, speed, phase };
}

const LEVELS = [
  {
    name: "Lost in Moss",
    width: 3600,
    height: 1240,
    spawn: { x: 110, y: 860 },
    killY: 1360,
    theme: "forest",
    palette: {
      skyTop: "#142036",
      skyMid: "#29484a",
      skyBottom: "#5b7b62",
      far: "#143332",
      mid: "#205042",
      near: "#18382f",
      ground: "#173127",
      lip: "#93d89a",
      glow: "#ffd37d",
      accent: "#b4f5ca",
      haze: "rgba(179, 247, 201, 0.16)",
      player: "#f8e9b5",
    },
    story: "Rain has washed the familiar scent away. Somewhere beyond the moss, a warm window is waiting.",
    platforms: [
      platform(0, 920, 430, 140),
      platform(500, 850, 240, 34),
      platform(830, 760, 245, 34),
      platform(1110, 825, 310, 34),
      platform(1550, 700, 220, 34),
      platform(1880, 600, 260, 34),
      platform(2260, 780, 360, 130),
      platform(2700, 700, 240, 34),
      platform(3040, 820, 520, 140),
    ],
    hazards: [hazard(432, 982, 58, 38), hazard(1770, 742, 76, 38), hazard(2948, 742, 64, 38)],
    seeds: [seed("mosswake-core", 940, 710, "A familiar scent returns: the first fence, the warm sill.")],
    points: [
      point("moss-01", 556, 802),
      point("moss-02", 646, 792),
      point("moss-03", 1662, 652),
      point("moss-04", 2035, 552),
      point("moss-05", 2808, 652),
      point("moss-06", 3215, 774),
    ],
    movingHazards: [
      movingHazard("moss-briar-01", 2160, 686, 42, 30, "y", 74, 0.25, 0.4),
      movingHazard("moss-briar-02", 2860, 666, 42, 30, "x", 92, 0.21, 1.7),
    ],
    creatures: [creature("moss-snail-01", 540, 675, 826, 0.34), creature("moss-snail-02", 2285, 2520, 756, 0.28, 2)],
    shrine: { x: 1256, y: 793 },
    gates: [gate(1452, 650, 24, 176, "doubleJump")],
    exit: { x: 3438, y: 690, w: 92, h: 132, requires: "doubleJump" },
    scent: [
      scentPoint(130, 852),
      scentPoint(575, 800),
      scentPoint(940, 705, 1.2),
      scentPoint(1260, 770, 1.15),
      scentPoint(1595, 650),
      scentPoint(2020, 540),
      scentPoint(2390, 728),
      scentPoint(2820, 652),
      scentPoint(3210, 774),
      scentPoint(3480, 646, 1.25),
    ],
    messages: [
      { x: 760, y: 640, w: 230, h: 220, text: "The path does not know your name yet, but your paws remember." },
      { x: 1810, y: 450, w: 270, h: 240, text: "High moss keeps the scent of home from the ground." },
      { x: 2660, y: 560, w: 300, h: 250, text: "Past these green ledges, the air smells warmer." },
    ],
  },
  {
    name: "Lantern Trail",
    width: 3980,
    height: 1280,
    spawn: { x: 100, y: 880 },
    killY: 1400,
    theme: "lantern",
    palette: {
      skyTop: "#10172e",
      skyMid: "#263461",
      skyBottom: "#5c5979",
      far: "#17264b",
      mid: "#253b63",
      near: "#152038",
      ground: "#151d31",
      lip: "#ffc985",
      glow: "#ffcf7d",
      accent: "#8ff4ff",
      haze: "rgba(255, 207, 125, 0.14)",
      player: "#fff1b8",
    },
    story: "Lanterns mark a path through the dark, each one almost smelling like home.",
    platforms: [
      platform(0, 920, 320, 130),
      platform(420, 840, 245, 32, "wood"),
      platform(760, 725, 230, 32, "wood"),
      platform(1065, 805, 320, 32, "wood"),
      platform(1480, 650, 235, 32, "wood"),
      platform(1880, 540, 260, 32, "wood"),
      platform(2300, 660, 300, 32, "wood"),
      platform(2700, 790, 360, 130, "wood"),
      platform(3140, 640, 260, 32, "wood"),
      platform(3540, 800, 420, 130, "wood"),
    ],
    hazards: [hazard(690, 884, 76, 38), hazard(2160, 586, 95, 38), hazard(3070, 852, 70, 38)],
    seeds: [seed("lantern-core", 1188, 745, "Another scent returns: lantern oil, wet stone, a door left open.")],
    points: [
      point("lantern-01", 500, 792),
      point("lantern-02", 835, 675),
      point("lantern-03", 1550, 602),
      point("lantern-04", 2015, 490),
      point("lantern-05", 2395, 610),
      point("lantern-06", 3235, 590),
      point("lantern-07", 3710, 750),
    ],
    movingHazards: [
      movingHazard("lantern-briar-01", 1760, 598, 52, 28, "x", 112, 0.24, 0.2),
      movingHazard("lantern-briar-02", 2870, 704, 46, 34, "y", 86, 0.2, 1.6),
    ],
    creatures: [creature("lantern-mote-01", 2350, 2580, 636, 0.34), creature("lantern-mote-02", 3570, 3880, 776, 0.29, 1.4)],
    shrine: { x: 1262, y: 773 },
    gates: [gate(1828, 502, 28, 152, "dash")],
    exit: { x: 3808, y: 670, w: 92, h: 132, requires: "dash" },
    scent: [
      scentPoint(126, 850),
      scentPoint(520, 790),
      scentPoint(860, 670),
      scentPoint(1188, 742, 1.2),
      scentPoint(1264, 770, 1.15),
      scentPoint(1578, 600),
      scentPoint(2000, 488),
      scentPoint(2440, 612),
      scentPoint(2880, 748),
      scentPoint(3275, 590),
      scentPoint(3745, 752),
      scentPoint(3855, 626, 1.25),
    ],
    messages: [
      { x: 620, y: 610, w: 310, h: 240, text: "The lanterns swing like porch lights seen from far away." },
      { x: 1900, y: 380, w: 300, h: 230, text: "A brave little heart can cross a dark distance." },
      { x: 2950, y: 570, w: 340, h: 250, text: "Each light says the same thing: keep going." },
    ],
  },
  {
    name: "Glassbrook",
    width: 4200,
    height: 1360,
    spawn: { x: 100, y: 920 },
    killY: 1480,
    theme: "glass",
    palette: {
      skyTop: "#071624",
      skyMid: "#12384a",
      skyBottom: "#4f6e77",
      far: "#082230",
      mid: "#103b45",
      near: "#102a35",
      ground: "#10222d",
      lip: "#9eefff",
      glow: "#9eefff",
      accent: "#ffb8d0",
      haze: "rgba(158, 239, 255, 0.14)",
      player: "#eafcff",
    },
    story: "Glasswater and steep roots carry echoes of rooftops after rain.",
    platforms: [
      platform(0, 960, 330, 130, "crystal"),
      platform(445, 850, 245, 32, "crystal"),
      platform(835, 730, 245, 32, "crystal"),
      platform(1165, 810, 340, 32, "crystal"),
      platform(1665, 680, 215, 32, "crystal"),
      platform(2035, 560, 210, 32, "crystal"),
      platform(2365, 705, 230, 32, "crystal"),
      platform(2720, 850, 340, 130, "crystal"),
      platform(3140, 700, 230, 32, "crystal"),
      platform(3370, 540, 58, 290, "crystal"),
      platform(3580, 820, 620, 130, "crystal"),
    ],
    hazards: [hazard(330, 1008, 105, 44, "glass"), hazard(1515, 858, 130, 44, "glass"), hazard(2245, 608, 105, 44, "glass"), hazard(3068, 900, 64, 44)],
    seeds: [seed("glassfall-core", 1284, 750, "The last scent returns: hearth smoke and a voice calling supper.")],
    points: [
      point("glass-01", 512, 800),
      point("glass-02", 920, 680),
      point("glass-03", 1718, 632),
      point("glass-04", 2110, 512),
      point("glass-05", 2460, 656),
      point("glass-06", 3210, 650),
      point("glass-07", 3695, 770),
      point("glass-08", 4055, 770),
    ],
    movingHazards: [
      movingHazard("glass-briar-01", 1900, 618, 44, 36, "y", 104, 0.22, 0.7, "glass"),
      movingHazard("glass-briar-02", 2950, 790, 54, 34, "x", 130, 0.19, 2.1, "glass"),
    ],
    creatures: [creature("glass-crawler-01", 1685, 1848, 656, 0.32), creature("glass-crawler-02", 3595, 4120, 796, 0.28, 2.2)],
    shrine: { x: 1350, y: 778 },
    gates: [gate(2268, 500, 28, 208, "glide")],
    exit: { x: 4040, y: 686, w: 92, h: 132, requires: "glide" },
    scent: [
      scentPoint(128, 890),
      scentPoint(520, 800),
      scentPoint(925, 680),
      scentPoint(1284, 748, 1.2),
      scentPoint(1350, 776, 1.15),
      scentPoint(1740, 630),
      scentPoint(2110, 506),
      scentPoint(2435, 655),
      scentPoint(2890, 800),
      scentPoint(3235, 650),
      scentPoint(3400, 498),
      scentPoint(3710, 770),
      scentPoint(4090, 642, 1.25),
    ],
    messages: [
      { x: 790, y: 570, w: 270, h: 240, text: "Water remembers every roof it has run from." },
      { x: 2040, y: 360, w: 310, h: 260, text: "Hold the air gently and it will carry you down." },
      { x: 3180, y: 510, w: 350, h: 260, text: "The glass creek shines like windows after rain." },
    ],
  },
  {
    name: "Garden Gate",
    width: 4700,
    height: 1400,
    spawn: { x: 110, y: 900 },
    killY: 1520,
    theme: "dawn",
    palette: {
      skyTop: "#2b1c35",
      skyMid: "#72506d",
      skyBottom: "#f0a66f",
      far: "#2b2e47",
      mid: "#39425a",
      near: "#1f2d36",
      ground: "#20271f",
      lip: "#f6d076",
      glow: "#fff0a1",
      accent: "#8df7cf",
      haze: "rgba(255, 221, 141, 0.18)",
      player: "#fff6ca",
    },
    story: "Dawn gathers behind the old garden gate. Home is close enough to hear.",
    platforms: [
      platform(0, 940, 335, 130, "root"),
      platform(470, 850, 235, 34, "root"),
      platform(845, 730, 220, 34, "root"),
      platform(1095, 620, 54, 260, "root"),
      platform(1320, 820, 320, 34, "root"),
      platform(1800, 690, 220, 34, "root"),
      platform(2135, 560, 56, 285, "root"),
      platform(2340, 720, 250, 34, "root"),
      platform(2785, 600, 230, 34, "root"),
      platform(3120, 810, 330, 130, "root"),
      platform(3520, 700, 240, 34, "root"),
      platform(3830, 580, 220, 34, "root"),
      platform(4090, 780, 590, 130, "root"),
    ],
    hazards: [hazard(725, 888, 100, 42, "root"), hazard(1645, 868, 130, 42, "root"), hazard(2605, 760, 150, 42, "root"), hazard(3735, 742, 76, 42)],
    seeds: [],
    points: [
      point("root-01", 520, 800),
      point("root-02", 920, 680),
      point("root-03", 1398, 770),
      point("root-04", 1860, 640),
      point("root-05", 2420, 672),
      point("root-06", 2860, 552),
      point("root-07", 3600, 652),
      point("root-08", 3910, 532),
      point("root-09", 4260, 732),
    ],
    movingHazards: [
      movingHazard("root-briar-01", 1730, 742, 54, 34, "x", 126, 0.21, 0.2, "root"),
      movingHazard("root-briar-02", 3000, 684, 48, 38, "y", 104, 0.18, 1.8, "root"),
      movingHazard("root-briar-03", 3970, 704, 54, 34, "x", 98, 0.16, 2.4, "root"),
    ],
    creatures: [creature("root-creeper-01", 2350, 2565, 696, 0.28), creature("root-creeper-02", 3135, 3425, 786, 0.24, 2)],
    shrine: { x: 1510, y: 788 },
    gates: [gate(3042, 555, 28, 258, "glide")],
    exit: { x: 4528, y: 648, w: 96, h: 132, requires: "glide" },
    scent: [
      scentPoint(135, 872),
      scentPoint(530, 800),
      scentPoint(930, 680),
      scentPoint(1130, 560),
      scentPoint(1510, 786, 1.15),
      scentPoint(1880, 640),
      scentPoint(2165, 506),
      scentPoint(2440, 672),
      scentPoint(2885, 552),
      scentPoint(3280, 760),
      scentPoint(3615, 652),
      scentPoint(3935, 532),
      scentPoint(4290, 730),
      scentPoint(4578, 604, 1.35),
    ],
    messages: [
      { x: 960, y: 470, w: 330, h: 250, text: "The roots twist like streets you almost know." },
      { x: 2330, y: 540, w: 340, h: 250, text: "The forest is not a prison. It is the long way around." },
      { x: 3540, y: 490, w: 350, h: 250, text: "Beyond the old gate, someone left a light on." },
    ],
  },
];

const HINTS = [
  {
    id: "move",
    text: "Move with A/D or the arrow keys.",
    sticky: true,
    when: () => state.levelIndex === 0 && player.x < 320,
    done: () => state.actions.moved && player.x > currentLevel().spawn.x + 42,
  },
  {
    id: "scent-trail",
    text: "Follow the glowing scent. It curls upward and downward toward home.",
    sticky: true,
    when: () => state.levelIndex === 0 && player.x > 170 && player.x < 390,
    done: () => player.x > 395,
  },
  {
    id: "jump",
    text: "Jump with Space, W, or the up arrow.",
    sticky: true,
    when: () => state.levelIndex === 0 && player.x > 250 && player.x < 760,
    done: () => (state.actions.jumped && player.x > 480) || player.x > 760,
  },
  {
    id: "seed",
    text: "Scent memories become skill points. Touch the glow to remember the way.",
    sticky: true,
    when: () => state.levelIndex === 0 && !state.collected["mosswake-core"] && player.x > 760 && player.x < 1100,
    done: () => state.collected["mosswake-core"] || player.x > 1110,
  },
  {
    id: "points",
    text: "Collect bright spores for points. Every ten can restore one life.",
    sticky: true,
    when: () => state.levelIndex === 0 && player.x > 480 && player.x < 760,
    done: () => state.score > 0 || player.x > 780,
  },
  {
    id: "pounce",
    text: "Press F to pounce. A clean pounce flips creatures safely onto their backs.",
    sticky: true,
    when: () => state.levelIndex === 0 && player.x > 440 && player.x < 760,
    done: () => state.actions.pounced || Object.keys(state.flippedCreatures).length > 0 || player.x > 790,
  },
  {
    id: "creatures",
    text: "Slow forest creatures patrol the paths. Step around them or pounce from the front.",
    sticky: true,
    when: () => state.levelIndex === 0 && player.x > 500 && player.x < 760,
    done: () => player.x > 780,
  },
  {
    id: "shrine",
    text: "At waystones, press E to open the skill tree.",
    sticky: true,
    when: () => state.mode === "play" && isNearShrine(currentLevel()) && state.skillPoints > 0,
    done: () => state.actions.openedTree || state.unlocked.doubleJump,
  },
  {
    id: "tree",
    text: "Choose a remembered trick with the arrows or A/D/W/S. Press E to awaken it.",
    sticky: true,
    when: () => state.mode === "tree" && state.skillPoints > 0,
    done: () => state.actions.unlockedAny,
  },
  {
    id: "shrine-life",
    text: "With every trick remembered, press E at a waystone to reclaim one life.",
    sticky: true,
    when: () => state.mode === "play" && isNearShrine(currentLevel()) && canClaimShrineLife(currentLevel()),
    done: () => state.actions.claimedShrineLife,
  },
  {
    id: "double-jump",
    text: "Double Jump gives one extra jump before you touch ground.",
    sticky: true,
    when: () => state.levelIndex === 0 && state.unlocked.doubleJump && player.x > 1350 && player.x < 1660,
    done: () => state.actions.doubleJumped || player.x > 1660,
  },
  {
    id: "dash",
    text: "Dash bursts forward with Q. Shift, K, or L still work.",
    sticky: true,
    when: () => state.levelIndex === 1 && state.unlocked.dash && player.x > 1430 && player.x < 1970,
    done: () => state.actions.dashed || player.x > 1970,
  },
  {
    id: "moving-briars",
    text: "Moving briars drift gently, but not perfectly. Watch the sway, then cross.",
    sticky: true,
    when: () => (state.levelIndex === 1 && player.x > 1640 && player.x < 1940) || (state.levelIndex === 2 && player.x > 1840 && player.x < 2060),
    done: () => player.x > 2060,
  },
  {
    id: "glide",
    text: "Glide Down slows your fall when you hold jump in the air.",
    sticky: true,
    when: () => state.levelIndex === 2 && state.unlocked.glide && player.x > 2050 && player.x < 2460,
    done: () => state.actions.glided || player.x > 2460,
  },
];

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function normalizeKey(event) {
  return event.code || event.key;
}

function startAudio() {
  if (audio) {
    if (audio.state === "suspended") audio.resume();
    startMusic();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio = new AudioContext();
  startMusic();
}

function tone(freq, duration = 0.12, gain = 0.04, type = "sine", delay = 0) {
  if (!audio) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function startMusic() {
  if (!audio || music) return;
  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, audio.currentTime);
  master.gain.linearRampToValueAtTime(0.18, audio.currentTime + 1.6);
  master.connect(audio.destination);
  music = {
    master,
    nextNoteTime: audio.currentTime + 0.24,
    step: 0,
    timer: window.setInterval(scheduleMusic, 260),
  };
  scheduleMusic();
}

function currentMusicTheme() {
  const level = currentLevel();
  return MUSIC_THEMES[level.theme] || MUSIC_THEMES.forest;
}

function playMusicNote(freq, when, duration, gain, type = "sine") {
  if (!audio || !music) return;
  const osc = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1700, when);
  filter.Q.setValueAtTime(0.35, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.08);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(filter);
  filter.connect(amp);
  amp.connect(music.master);
  osc.start(when);
  osc.stop(when + duration + 0.08);
}

function scheduleMusic() {
  if (!audio || !music) return;
  const theme = currentMusicTheme();
  const horizon = audio.currentTime + 1.8;
  while (music.nextNoteTime < horizon) {
    const note = theme.notes[music.step % theme.notes.length];
    const isHighAnswer = music.step % 16 === 11;
    playMusicNote(note * (isHighAnswer ? 2 : 1), music.nextNoteTime, 1.25, 0.038, "triangle");

    if (music.step % 4 === 0) {
      const bass = theme.pad[Math.floor(music.step / 4) % theme.pad.length];
      playMusicNote(bass, music.nextNoteTime, 3.2, 0.032, "sine");
      playMusicNote(bass * 1.5, music.nextNoteTime + 0.04, 3, 0.016, "sine");
    }

    if (state.mode === "ending" && music.step % 3 === 0) {
      playMusicNote(note * 2, music.nextNoteTime + 0.18, 1.8, 0.028, "sine");
    }

    music.nextNoteTime += 0.72 + (music.step % 5 === 4 ? 0.28 : 0);
    music.step += 1;
  }
}

function chime(kind) {
  if (kind === "seed") {
    tone(523.25, 0.16, 0.035, "triangle");
    tone(784, 0.18, 0.028, "sine", 0.07);
  } else if (kind === "point") {
    tone(659.25, 0.08, 0.02, "triangle");
    tone(880, 0.1, 0.016, "sine", 0.04);
  } else if (kind === "unlock") {
    tone(392, 0.22, 0.035, "triangle");
    tone(659.25, 0.24, 0.03, "triangle", 0.08);
    tone(987.77, 0.28, 0.025, "sine", 0.16);
  } else if (kind === "dash") {
    tone(220, 0.08, 0.025, "sawtooth");
    tone(440, 0.1, 0.02, "triangle", 0.03);
  } else if (kind === "jump") {
    tone(330, 0.09, 0.025, "triangle");
  } else if (kind === "pounce") {
    tone(196, 0.08, 0.022, "triangle");
    tone(392, 0.11, 0.018, "sine", 0.025);
  } else if (kind === "flip") {
    tone(587.33, 0.1, 0.024, "triangle");
    tone(293.66, 0.16, 0.018, "sine", 0.055);
  } else if (kind === "life") {
    tone(523.25, 0.1, 0.028, "triangle");
    tone(783.99, 0.16, 0.026, "sine", 0.06);
    tone(1046.5, 0.18, 0.018, "triangle", 0.13);
  } else if (kind === "hurt") {
    tone(220, 0.12, 0.025, "triangle");
    tone(164.81, 0.18, 0.018, "sine", 0.06);
  } else if (kind === "gameover") {
    tone(246.94, 0.22, 0.026, "triangle");
    tone(196, 0.3, 0.02, "sine", 0.16);
  }
}

function onKeyDown(event) {
  const key = normalizeKey(event);
  if (!keys.has(key)) justPressed.add(key);
  keys.add(key);
  if (isGameKey(key)) event.preventDefault();
  startAudio();
}

function onKeyUp(event) {
  const key = normalizeKey(event);
  keys.delete(key);
  if (isGameKey(key)) event.preventDefault();
}

function isGameKey(key) {
  return (
    key.startsWith("Arrow") ||
    key === "Space" ||
    key === "KeyA" ||
    key === "KeyD" ||
    key === "KeyW" ||
    key === "KeyS" ||
    key === "KeyQ" ||
    key === "KeyE" ||
    key === "KeyF" ||
    key === "KeyJ" ||
    key === "KeyK" ||
    key === "KeyL" ||
    key === "KeyR" ||
    key === "Enter" ||
    key === "Escape" ||
    key === "Backspace" ||
    key.startsWith("Shift")
  );
}

function held(...names) {
  return names.some((name) => keys.has(name));
}

function tapped(...names) {
  return names.some((name) => justPressed.has(name));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function approach(value, target, amount) {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function currentLevel() {
  return LEVELS[state.levelIndex];
}

function nextExtraLifeTargetForScore(score) {
  return Math.floor(score / EXTRA_LIFE_EVERY) * EXTRA_LIFE_EVERY + EXTRA_LIFE_EVERY;
}

function recordHighScore() {
  state.highScore = Math.max(state.highScore, state.score);
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(state.highScore));
  } catch {
    // The high score still shows for this session if storage is blocked.
  }
}

function saveGame() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        levelIndex: state.levelIndex,
        skillPoints: state.skillPoints,
        score: state.score,
        highScore: state.highScore,
        shrineLifeClaims: state.shrineLifeClaims,
        collected: state.collected,
        unlocked: state.unlocked,
        hintsSeen: state.hintsSeen,
      })
    );
  } catch {
    // Progress still works for the current session if storage is blocked.
  }
}

function loadGame() {
  try {
    const highScoreRaw = localStorage.getItem(HIGH_SCORE_KEY);
    state.highScore = Math.max(0, Number(highScoreRaw) || 0);
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.levelIndex = clamp(data.levelIndex || 0, 0, LEVELS.length - 1);
    state.skillPoints = data.skillPoints || 0;
    state.score = data.score || 0;
    state.highScore = Math.max(state.highScore, data.highScore || 0);
    state.nextExtraLifeScore = nextExtraLifeTargetForScore(state.score);
    state.shrineLifeClaims = data.shrineLifeClaims || {};
    state.collected = data.collected || {};
    state.flippedCreatures = {};
    state.unlocked = { ...state.unlocked, ...(data.unlocked || {}) };
    state.hintsSeen = data.hintsSeen || {};
  } catch {
    state.levelIndex = 0;
  }
}

function resetPlayerToSpawn() {
  const level = currentLevel();
  player.x = level.spawn.x;
  player.y = level.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.dir = 1;
  player.airJumps = 0;
  player.dashTimer = 0;
  player.dashCooldown = 0;
  player.pounceTimer = 0;
  player.pounceCooldown = 0;
  player.respawnX = level.spawn.x;
  player.respawnY = level.spawn.y;
  player.idleTime = 0;
  player.walkTime = 0;
  player.airTime = 0;
  player.trail = [];
  resetFlippedCreatures(level);
}

function restartRun() {
  const best = state.highScore;
  state.levelIndex = 0;
  state.skillPoints = 0;
  state.score = 0;
  state.lives = MAX_LIVES;
  state.highScore = best;
  state.nextExtraLifeScore = EXTRA_LIFE_EVERY;
  state.shrineLifeClaims = {};
  state.collected = {};
  state.flippedCreatures = {};
  state.unlocked = {
    root: true,
    doubleJump: false,
    dash: false,
    glide: false,
  };
  state.mode = "play";
  state.treeSelection = "doubleJump";
  state.message = "";
  state.messageTime = 0;
  state.messageLife = 0;
  state.lifeModalTitle = "";
  state.lifeModalSubtitle = "";
  state.lifeModalTime = 0;
  state.lifeModalLife = 0;
  state.hint = "";
  state.hintId = "";
  state.hintTime = 0;
  state.hintLife = 0;
  state.hintLockTime = 0;
  state.hintsSeen = {};
  state.actions = {
    moved: false,
    jumped: false,
    doubleJumped: false,
    dashed: false,
    glided: false,
    pounced: false,
    openedTree: false,
    unlockedAny: false,
    claimedShrineLife: false,
  };
  state.transition = 1;
  state.shake = 0;
  state.endingTime = 0;
  state.gameOverScore = 0;
  particles.length = 0;
  camera.x = 0;
  camera.y = 0;
  resetPlayerToSpawn();
  showMessage(currentLevel().story, 4.6);
  saveGame();
}

function showMessage(text, life = 4.2) {
  state.message = text;
  state.messageTime = life;
  state.messageLife = life;
}

function showLifeModal(title, subtitle = "", life = 2.4) {
  state.lifeModalTitle = title;
  state.lifeModalSubtitle = subtitle;
  state.lifeModalTime = life;
  state.lifeModalLife = life;
}

function addScore(value, level, x, y) {
  state.score += value;
  let gainedLife = false;

  while (state.score >= state.nextExtraLifeScore) {
    if (state.lives < MAX_LIVES) {
      state.lives += 1;
      gainedLife = true;
    }
    state.nextExtraLifeScore += EXTRA_LIFE_EVERY;
  }

  if (gainedLife) {
    state.shake = Math.max(state.shake, 4);
    chime("life");
    spawnParticles(x, y, level.palette.glow, 42, 150, 1, 3.4);
    showLifeModal("Extra life found", "Ten bright spores pulled one life back.", 2.8);
  }
}

function showHint(hint, life = 5.5, force = false) {
  if (state.hintsSeen[hint.id]) return;
  if (!force && state.hintLockTime > 0 && state.hintId !== hint.id) return;
  if (state.hintId !== hint.id) {
    state.hintId = hint.id;
    state.hint = hint.text;
    state.hintLife = life;
    state.hintTime = life;
    state.hintLockTime = force ? Math.min(life, 3.4) : state.hintLockTime;
    return;
  }
  if (hint.sticky) state.hintTime = Math.max(state.hintTime, 1.15);
  if (force) state.hintLockTime = Math.min(life, 3.4);
}

function showSkillInstruction(id) {
  const copy = {
    doubleJump: "Double Jump added: press jump again while airborne.",
    dash: "Dash added: press Q to burst forward.",
    glide: "Glide Down added: hold jump while falling to drift down.",
  };
  showHint({ id: `skill-${id}`, text: copy[id] || "A new trick has returned." }, 6.4, true);
}

function completeHint(id) {
  if (state.hintsSeen[id]) return;
  state.hintsSeen[id] = true;
  if (state.hintId === id) state.hintTime = Math.min(state.hintTime, 0.7);
  saveGame();
}

function updateHints(dt, level) {
  if (state.hintTime > 0) state.hintTime -= dt;
  if (state.hintLockTime > 0) state.hintLockTime -= dt;

  for (const hint of HINTS) {
    if (!state.hintsSeen[hint.id] && hint.done(level)) {
      completeHint(hint.id);
    }
  }

  if (state.mode === "ending") return;

  const active = HINTS.find((hint) => !state.hintsSeen[hint.id] && hint.when(level));
  if (active) showHint(active);
}

function spawnParticles(x, y, color, count, speed = 120, life = 0.8, size = 3) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const force = speed * (0.2 + Math.random() * 0.8);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * force,
      vy: Math.sin(angle) * force - speed * 0.2,
      life: life * (0.55 + Math.random() * 0.55),
      maxLife: life,
      size: size * (0.5 + Math.random()),
      color,
      drift: Math.random() * TAU,
    });
  }
  if (particles.length > 420) particles.splice(0, particles.length - 420);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.vy += 90 * dt;
    p.vx += Math.sin(p.drift + p.life * 4) * 8 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function solidRects(level) {
  const solids = [...level.platforms];
  for (const item of level.gates) {
    if (!state.unlocked[item.requires]) solids.push(item);
  }
  return solids;
}

function movingHazardRect(item, t = performance.now() / 1000) {
  const personality = item.phase + item.id.length * 0.37;
  const base = t * item.speed * TAU + item.phase;
  const drift = Math.sin(t * item.speed * 1.7 + personality) * 0.35;
  const wobble = Math.sin(t * item.speed * 3.1 + personality * 1.9) * 0.16;
  const raw = Math.sin(base + drift + wobble);
  const eased = Math.sign(raw) * Math.pow(Math.abs(raw), 0.72);
  const rangeScale = 0.86 + Math.sin(t * item.speed * 0.9 + personality) * 0.1;
  const wave = clamp(eased * rangeScale, -1, 1);
  return {
    x: item.x + (item.axis === "x" ? wave * item.range : 0),
    y: item.y + (item.axis === "y" ? wave * item.range : 0),
    w: item.w,
    h: item.h,
    kind: item.kind,
  };
}

function creatureRect(item, t = performance.now() / 1000) {
  const flipped = state.flippedCreatures[item.id];
  if (flipped) {
    return {
      x: flipped.x,
      y: flipped.y,
      w: item.w,
      h: item.h,
      dir: flipped.dir || 1,
    };
  }

  const wave = (Math.sin(t * item.speed * TAU + item.phase) + 1) / 2;
  return {
    x: lerp(item.minX, item.maxX, wave),
    y: item.y,
    w: item.w,
    h: item.h,
    dir: Math.cos(t * item.speed * TAU + item.phase) >= 0 ? 1 : -1,
  };
}

function creatureOverlapsUnlockZone(item, level) {
  const unlockZones = [
    ...(level.seeds || []).map((item) => ({ x: item.x, y: item.y, radius: 230 })),
    { x: level.shrine.x, y: level.shrine.y, radius: 260 },
  ];

  for (const zone of unlockZones) {
    const overlapsX = item.maxX >= zone.x - zone.radius && item.minX <= zone.x + zone.radius;
    const overlapsY = Math.abs(item.y + item.h / 2 - zone.y) < 190;
    if (overlapsX && overlapsY) return true;
  }
  return false;
}

function safeCreatures(level) {
  return (level.creatures || []).filter((item) => !creatureOverlapsUnlockZone(item, level));
}

function resetFlippedCreatures(level = currentLevel()) {
  for (const item of level.creatures || []) {
    delete state.flippedCreatures[item.id];
  }
}

function isCreatureFlipped(item) {
  return Boolean(state.flippedCreatures[item.id]);
}

function pounceRect() {
  const reach = 46;
  return {
    x: player.dir > 0 ? player.x + player.w - 6 : player.x - reach + 6,
    y: player.y + 2,
    w: reach,
    h: player.h - 2,
  };
}

function isNearShrine(level) {
  const dx = player.x + player.w / 2 - level.shrine.x;
  const dy = player.y + player.h / 2 - level.shrine.y;
  return Math.hypot(dx, dy) < 82;
}

function allSkillsUnlocked() {
  return SKILLS.every((node) => state.unlocked[node.id]);
}

function shrineLifeKey(level = currentLevel()) {
  return `level-${LEVELS.indexOf(level)}`;
}

function canClaimShrineLife(level = currentLevel()) {
  return allSkillsUnlocked() && state.lives < MAX_LIVES && !state.shrineLifeClaims[shrineLifeKey(level)];
}

function claimShrineLife(level) {
  state.actions.openedTree = true;
  if (!allSkillsUnlocked()) {
    openSkillTree();
    return;
  }

  if (state.lives >= MAX_LIVES) {
    showLifeModal("Nine lives are bright", "The waystone is warm, but you are already whole.", 2.6);
    return;
  }

  const key = shrineLifeKey(level);
  if (state.shrineLifeClaims[key]) {
    showLifeModal("Waystone resting", "This stone has already given its life back.", 2.6);
    return;
  }

  state.shrineLifeClaims[key] = true;
  state.lives = Math.min(MAX_LIVES, state.lives + 1);
  state.actions.claimedShrineLife = true;
  state.shake = Math.max(state.shake, 5);
  chime("life");
  spawnParticles(level.shrine.x, level.shrine.y - 30, level.palette.glow, 58, 170, 1.1, 4);
  showLifeModal("Waystone life restored", "With every trick remembered, the stone lends one life.", 3);
  saveGame();
}

function openSkillTree() {
  state.mode = "tree";
  state.actions.openedTree = true;
  const available = SKILLS.find((node) => canUnlock(node));
  const firstLocked = SKILLS.find((node) => !state.unlocked[node.id]);
  state.treeSelection = (available || firstLocked || SKILLS[SKILLS.length - 1]).id;
}

function canUnlock(node) {
  return !state.unlocked[node.id] && state.unlocked[node.parent] && state.skillPoints >= node.cost;
}

function selectedSkill() {
  return SKILLS.find((node) => node.id === state.treeSelection) || SKILLS[0];
}

function moveTreeSelection(dx, dy) {
  const current = selectedSkill();
  let best = null;
  let bestScore = -Infinity;
  for (const node of SKILLS) {
    if (node.id === current.id) continue;
    const vx = node.x - current.x;
    const vy = node.y - current.y;
    const dist = Math.hypot(vx, vy) || 1;
    const dot = (vx / dist) * dx + (vy / dist) * dy;
    if (dot <= 0.28) continue;
    const score = dot * 1000 - dist;
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }
  if (best) state.treeSelection = best.id;
}

function updateTree() {
  if (tapped("Escape", "Backspace")) {
    state.mode = "play";
    return;
  }
  if (tapped("ArrowLeft", "KeyA")) moveTreeSelection(-1, 0);
  if (tapped("ArrowRight", "KeyD")) moveTreeSelection(1, 0);
  if (tapped("ArrowUp", "KeyW")) moveTreeSelection(0, -1);
  if (tapped("ArrowDown", "KeyS")) moveTreeSelection(0, 1);

  const node = selectedSkill();
  if (tapped("Enter", "Space", "KeyE") && canUnlock(node)) {
    state.unlocked[node.id] = true;
    state.skillPoints -= node.cost;
    state.mode = "play";
    state.actions.unlockedAny = true;
    state.transition = 0.6;
    state.shake = 7;
    chime("unlock");
    showMessage(unlockText(node.id), 4.3);
    showSkillInstruction(node.id);
    spawnParticles(player.x + player.w / 2, player.y + 8, node.color, 70, 210, 1.2, 4.2);
    saveGame();
  }
}

function unlockText(id) {
  if (id === "doubleJump") return "You remember the spring from fence to fence.";
  if (id === "dash") return "You remember the burst between porch lights.";
  return "You remember how to drift down from high walls.";
}

function updateGame(dt) {
  const level = currentLevel();

  if (state.lifeModalTime > 0) state.lifeModalTime -= dt;

  if (state.mode === "gameover") {
    updateParticles(dt);
    if (tapped("KeyR", "Enter", "Space")) restartRun();
    return;
  }

  if (state.mode === "tree") {
    updateTree();
    updateHints(dt, level);
    updateParticles(dt);
    return;
  }

  if (state.mode === "ending") {
    state.endingTime += dt;
    updateParticles(dt);
    if (Math.random() < 0.65) {
      const x = camera.x + viewW * (0.2 + Math.random() * 0.6);
      const y = camera.y + viewH * (0.14 + Math.random() * 0.5);
      spawnParticles(x, y, level.palette.glow, 1, 45, 1.8, 3);
    }
    return;
  }

  state.transition = Math.max(0, state.transition - dt);
  state.shake = Math.max(0, state.shake - 24 * dt);
  if (state.messageTime > 0) state.messageTime -= dt;

  if (tapped("KeyR")) respawn();
  if (tapped("KeyE") && isNearShrine(level)) {
    if (allSkillsUnlocked()) claimShrineLife(level);
    else openSkillTree();
    updateHints(dt, level);
    return;
  }

  updatePlayer(dt, level);
  updateWorldInteractions(level);
  updateHints(dt, level);
  updateParticles(dt);
}

function updatePlayer(dt, level) {
  const left = held("ArrowLeft", "KeyA");
  const right = held("ArrowRight", "KeyD");
  const input = (right ? 1 : 0) - (left ? 1 : 0);

  if (input !== 0) player.dir = input;
  if (input !== 0) state.actions.moved = true;
  if (player.grounded) player.coyote = 0.1;
  else player.coyote = Math.max(0, player.coyote - dt);

  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.pounceCooldown = Math.max(0, player.pounceCooldown - dt);
  player.pounceTimer = Math.max(0, player.pounceTimer - dt);

  if (tapped("KeyJ", "KeyF") && player.pounceCooldown <= 0) {
    const wasGrounded = player.grounded;
    player.pounceTimer = 0.24;
    player.pounceCooldown = 0.58;
    state.actions.pounced = true;
    player.idleTime = 0;
    player.grounded = false;
    player.vx = player.dir * (wasGrounded ? 430 : 390);
    player.vy = Math.min(player.vy, wasGrounded ? -320 : -180);
    chime("pounce");
    spawnParticles(player.x + player.w / 2 + player.dir * 8, player.y + player.h * 0.55, level.palette.accent, 14, 100, 0.45, 2.4);
  }

  if (state.unlocked.dash && tapped("KeyQ", "ShiftLeft", "ShiftRight", "KeyK", "KeyL") && player.dashCooldown <= 0) {
    player.dashTimer = 0.18;
    player.dashCooldown = 0.42;
    state.actions.dashed = true;
    player.vx = player.dir * 720;
    player.vy = 0;
    player.airJumps = Math.min(player.airJumps, 1);
    chime("dash");
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, currentLevel().palette.glow, 20, 230, 0.5, 3.5);
  }

  if (tapped("Space", "ArrowUp", "KeyW")) {
    if (player.grounded || player.coyote > 0) {
      player.vy = -620;
      player.grounded = false;
      state.actions.jumped = true;
      player.coyote = 0;
      player.airJumps = 0;
      chime("jump");
      spawnParticles(player.x + player.w / 2, player.y + player.h, currentLevel().palette.lip, 12, 80, 0.5, 2.5);
    } else if (state.unlocked.doubleJump && player.airJumps < 1) {
      player.vy = -580;
      player.airJumps += 1;
      state.actions.jumped = true;
      state.actions.doubleJumped = true;
      chime("jump");
      spawnParticles(player.x + player.w / 2, player.y + player.h / 2, currentLevel().palette.accent, 24, 150, 0.7, 3.5);
    }
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = player.dir * 720;
    player.vy = 0;
    player.trail.push({ x: player.x, y: player.y, life: 0.25 });
  } else {
    const accel = player.grounded ? 3300 : 2100;
    const maxSpeed = player.pounceTimer > 0 ? 430 : state.unlocked.dash ? 292 : 252;
    if (player.pounceTimer > 0) {
      player.vx = approach(player.vx, player.dir * 360, 900 * dt);
      player.trail.push({ x: player.x, y: player.y, life: 0.2 });
    } else if (input !== 0) player.vx += input * accel * dt;
    else player.vx = approach(player.vx, 0, (player.grounded ? 2500 : 780) * dt);
    player.vx = clamp(player.vx, -maxSpeed, maxSpeed);
    player.vy += WORLD_GRAVITY * dt;

    if (state.unlocked.glide && !player.grounded && player.vy > 45 && held("Space", "ArrowUp", "KeyW")) {
      player.vy = Math.min(player.vy, 145);
      player.vx += input * 520 * dt;
      player.vx = clamp(player.vx, -210, 210);
      state.actions.glided = true;
      if (Math.random() < 0.42) {
        spawnParticles(player.x + player.w / 2 - player.dir * 7, player.y + player.h * 0.58, level.palette.accent, 1, 42, 0.65, 2.5);
      }
    }
  }

  moveAndCollide(dt, level);
  updateCatAnimation(dt, input);

  for (const mark of player.trail) mark.life -= dt;
  player.trail = player.trail.filter((mark) => mark.life > 0);
}

function updateCatAnimation(dt, input) {
  const moving = player.grounded && (Math.abs(player.vx) > 10 || input !== 0);
  if (moving) {
    player.walkTime += dt * clamp(Math.abs(player.vx) / 95, 1.2, 3.8);
    player.idleTime = 0;
  } else if (player.grounded && Math.abs(player.vx) < 8 && player.dashTimer <= 0 && player.pounceTimer <= 0) {
    player.idleTime += dt;
  } else {
    player.idleTime = 0;
  }

  if (player.grounded) player.airTime = 0;
  else player.airTime += dt;
}

function moveAndCollide(dt, level) {
  const solids = solidRects(level);
  player.wallSide = 0;

  player.x += player.vx * dt;
  for (const solid of solids) {
    if (!rectsOverlap(player, solid)) continue;
    if (player.vx > 0) {
      player.x = solid.x - player.w;
      player.wallSide = 1;
    } else if (player.vx < 0) {
      player.x = solid.x + solid.w;
      player.wallSide = -1;
    }
    player.vx = 0;
  }

  player.y += player.vy * dt;
  player.grounded = false;
  for (const solid of solids) {
    if (!rectsOverlap(player, solid)) continue;
    if (player.vy > 0) {
      player.y = solid.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.airJumps = 0;
    } else if (player.vy < 0) {
      player.y = solid.y + solid.h;
      player.vy = 0;
    }
  }

  player.x = clamp(player.x, 0, level.width - player.w);
}

function findWallSide(level) {
  const solids = solidRects(level);
  const leftProbe = { x: player.x - 2, y: player.y + 5, w: 2, h: player.h - 10 };
  const rightProbe = { x: player.x + player.w, y: player.y + 5, w: 2, h: player.h - 10 };
  for (const solid of solids) {
    if (rectsOverlap(leftProbe, solid)) return -1;
    if (rectsOverlap(rightProbe, solid)) return 1;
  }
  return 0;
}

function updateWorldInteractions(level) {
  if (player.y > level.killY) {
    respawn();
    return;
  }

  for (const item of level.hazards) {
    if (rectsOverlap(player, item)) {
      respawn();
      return;
    }
  }

  for (const item of level.movingHazards || []) {
    if (rectsOverlap(player, movingHazardRect(item))) {
      respawn();
      return;
    }
  }

  const activePounce = player.pounceTimer > 0 ? pounceRect() : null;
  for (const item of safeCreatures(level)) {
    const rect = creatureRect(item);
    if (!isCreatureFlipped(item) && activePounce && rectsOverlap(activePounce, rect)) {
      state.flippedCreatures[item.id] = {
        x: rect.x,
        y: rect.y,
        dir: rect.dir,
      };
      state.shake = 4;
      player.pounceTimer = 0.06;
      player.pounceCooldown = Math.max(player.pounceCooldown, 0.25);
      player.vx = -player.dir * 120;
      player.vy = -360;
      chime("flip");
      spawnParticles(rect.x + rect.w / 2, rect.y + rect.h / 2, level.palette.glow, 36, 145, 0.8, 3);
      showMessage("The creature tumbles onto its back.", 2.4);
      continue;
    }
    if (!isCreatureFlipped(item) && rectsOverlap(player, rect)) {
      respawn();
      return;
    }
  }

  if (isNearShrine(level)) {
    player.respawnX = level.shrine.x - player.w / 2;
    player.respawnY = level.shrine.y - player.h - 4;
  }

  for (const item of level.seeds) {
    if (state.collected[item.id]) continue;
    const pickup = { x: item.x - item.r, y: item.y - item.r, w: item.r * 2, h: item.r * 2 };
    if (rectsOverlap(player, pickup)) {
      state.collected[item.id] = true;
      state.skillPoints += 1;
      state.shake = 5;
      chime("seed");
      showMessage(item.text, 4.1);
      spawnParticles(item.x, item.y, level.palette.glow, 58, 170, 1, 4);
      saveGame();
    }
  }

  for (const item of level.points || []) {
    if (state.collected[item.id]) continue;
    const pickup = { x: item.x - item.r, y: item.y - item.r, w: item.r * 2, h: item.r * 2 };
    if (rectsOverlap(player, pickup)) {
      state.collected[item.id] = true;
      addScore(item.value, level, item.x, item.y);
      chime("point");
      spawnParticles(item.x, item.y, level.palette.accent, 24, 120, 0.7, 2.8);
      saveGame();
    }
  }

  for (const zone of level.messages) {
    if (pointInRect(player.x + player.w / 2, player.y + player.h / 2, zone) && state.message !== zone.text) {
      showMessage(zone.text, 4.6);
    }
  }

  const exit = level.exit;
  if (rectsOverlap(player, exit)) {
    if (!exit.requires || state.unlocked[exit.requires]) {
      advanceLevel();
    } else if (state.messageTime <= 0.2) {
      showMessage("The path asks for another remembered trick.", 2.8);
      state.shake = 3;
    }
  }
}

function respawn() {
  const level = currentLevel();
  if (state.mode !== "play") return;

  resetFlippedCreatures(level);
  state.lives = Math.max(0, state.lives - 1);

  if (state.lives <= 0) {
    triggerGameOver(level);
    return;
  }

  player.x = player.respawnX;
  player.y = player.respawnY;
  player.vx = 0;
  player.vy = 0;
  player.dashTimer = 0;
  player.dashCooldown = 0.18;
  player.pounceTimer = 0;
  player.pounceCooldown = 0.18;
  player.airJumps = 0;
  player.idleTime = 0;
  player.walkTime = 0;
  player.airTime = 0;
  state.shake = 9;
  chime("hurt");
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, level.palette.accent, 34, 155, 0.8, 3);
  showLifeModal("Life lost", "The checkpoint scent pulls you back.", 2.6);
  saveGame();
}

function triggerGameOver(level) {
  state.mode = "gameover";
  state.gameOverScore = state.score;
  state.lifeModalTime = 0;
  state.messageTime = 0;
  state.hintTime = 0;
  state.transition = 0;
  state.shake = 0;
  player.vx = 0;
  player.vy = 0;
  player.dashTimer = 0;
  player.pounceTimer = 0;
  player.trail = [];
  chime("gameover");
  recordHighScore();
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, level.palette.accent, 70, 175, 1.1, 3.6);
  saveGame();
}

function advanceLevel() {
  if (state.levelIndex === LEVELS.length - 1) {
    state.mode = "ending";
    state.endingTime = 0;
    showMessage("The cat finds the warm window, and the long night lets go.", 8);
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, currentLevel().palette.glow, 140, 260, 1.8, 5);
    recordHighScore();
    saveGame();
    return;
  }
  state.levelIndex += 1;
  resetPlayerToSpawn();
  state.transition = 1;
  state.shake = 0;
  showMessage(currentLevel().story, 4.4);
  saveGame();
}

function draw() {
  const level = currentLevel();
  updateCamera(level);
  const sx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  const sy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;

  drawBackground(level);

  drawForegroundParallax(level);
  ctx.save();
  ctx.translate(Math.round(-camera.x + sx), Math.round(-camera.y + sy));
  drawWorld(level);
  ctx.restore();

  drawVignette(level);
  drawTinyProgress(level);
  drawHint();
  drawMessage();
  drawLifeModal(level);
  if (state.mode === "tree") drawSkillTree(level);
  if (state.mode === "ending") drawEnding(level);
  if (state.mode === "gameover") drawGameOver(level);
  if (state.transition > 0) drawTransition(level);
}

function updateCamera(level) {
  const targetX = player.x + player.w / 2 - viewW * 0.47;
  const verticalLook = clamp(player.vy * 0.08, -70, 95);
  const targetY = player.y + player.h / 2 - viewH * 0.55 + verticalLook;
  const maxX = Math.max(0, level.width - viewW);
  const maxY = Math.max(0, level.height - viewH);
  camera.x = lerp(camera.x, clamp(targetX, 0, maxX), 0.09);
  camera.y = lerp(camera.y, clamp(targetY, 0, maxY), 0.11);
}

function drawBackground(level) {
  if (drawImportedLevelBackground(level)) return;

  const p = level.palette;
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(0.55, p.skyMid);
  sky.addColorStop(1, p.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);

  drawCelestial(level);
  drawParallax(level, 0.08, viewH * 0.58, 86, p.far, 0.78);
  drawParallax(level, 0.17, viewH * 0.66, 70, p.mid, 0.9);
  drawThemeBackdrops(level);
  drawParallax(level, 0.29, viewH * 0.77, 48, p.near, 1);

  const haze = ctx.createLinearGradient(0, viewH * 0.28, 0, viewH);
  haze.addColorStop(0, "rgba(255,255,255,0)");
  haze.addColorStop(1, p.haze);
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, viewW, viewH);

  drawAtmosphereTexture(level);
}

function drawImportedLevelBackground(level) {
  if (!levelBackground.complete || !levelBackground.naturalWidth) return false;

  const imageW = levelBackground.naturalWidth;
  const imageH = levelBackground.naturalHeight;
  const scale = Math.max(viewW / imageW, viewH / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  const maxPanX = Math.max(0, drawW - viewW);
  const maxPanY = Math.max(0, drawH - viewH);
  const worldPanX = clamp(camera.x / Math.max(1, level.width - viewW), 0, 1);
  const worldPanY = clamp(camera.y / Math.max(1, level.height - viewH), 0, 1);
  const x = -maxPanX * worldPanX;
  const y = -maxPanY * clamp(worldPanY * 0.36, 0, 1);

  ctx.drawImage(levelBackground, x, y, drawW, drawH);

  const depth = ctx.createLinearGradient(0, 0, 0, viewH);
  depth.addColorStop(0, "rgba(2, 8, 18, 0.2)");
  depth.addColorStop(0.5, "rgba(5, 17, 22, 0.02)");
  depth.addColorStop(1, "rgba(2, 8, 14, 0.34)");
  ctx.fillStyle = depth;
  ctx.fillRect(0, 0, viewW, viewH);

  const sideShade = ctx.createLinearGradient(0, 0, viewW, 0);
  sideShade.addColorStop(0, "rgba(2, 8, 16, 0.22)");
  sideShade.addColorStop(0.5, "rgba(2, 8, 16, 0)");
  sideShade.addColorStop(1, "rgba(2, 8, 16, 0.22)");
  ctx.fillStyle = sideShade;
  ctx.fillRect(0, 0, viewW, viewH);

  drawAtmosphereTexture(level);
  return true;
}

function drawForegroundParallax(level) {
  if (!foregroundParallax.complete || !foregroundParallax.naturalWidth) return;

  const imageW = foregroundParallax.naturalWidth;
  const imageH = foregroundParallax.naturalHeight;
  const scale = Math.max(viewW / imageW, viewH / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  const maxPanX = Math.max(0, drawW - viewW);
  const maxPanY = Math.max(0, drawH - viewH);
  const worldPanX = clamp(camera.x / Math.max(1, level.width - viewW), 0, 1);
  const worldPanY = clamp(camera.y / Math.max(1, level.height - viewH), 0, 1);
  const x = -maxPanX * clamp(worldPanX * 1.16 + 0.02, 0, 1);
  const y = -maxPanY * clamp(worldPanY * 0.58, 0, 1);

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.filter = "brightness(0.9) saturate(0.88)";
  ctx.drawImage(foregroundParallax, x, y, drawW, drawH);
  ctx.restore();
}

function drawCelestial(level) {
  const t = performance.now() / 1000;
  const p = level.palette;
  const cx = viewW * (level.theme === "dawn" ? 0.72 : 0.24) - camera.x * 0.04;
  const cy = viewH * (level.theme === "forest" ? 0.26 : 0.2);
  const radius = level.theme === "dawn" ? 86 : 52;
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius * 2.8);
  glow.addColorStop(0, p.glow);
  glow.addColorStop(0.2, "rgba(255, 237, 171, 0.45)");
  glow.addColorStop(1, "rgba(255, 237, 171, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 2.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = level.theme === "dawn" ? "#ffe2a1" : "#f7e6b1";
  ctx.beginPath();
  ctx.arc(cx, cy + Math.sin(t * 0.12) * 3, radius, 0, TAU);
  ctx.fill();
  if (level.theme !== "dawn") {
    ctx.fillStyle = p.skyTop;
    ctx.beginPath();
    ctx.arc(cx + 18, cy - 10, radius * 0.85, 0, TAU);
    ctx.fill();
  }
}

function drawParallax(level, speed, baseY, amp, color, alpha) {
  const offset = -(camera.x * speed) % 360;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, viewH);
  ctx.lineTo(offset - 360, baseY);
  for (let x = offset - 360; x <= viewW + 720; x += 90) {
    const y = baseY + Math.sin((x + level.width * speed) * 0.012) * amp * 0.32 + Math.cos(x * 0.031) * amp * 0.23;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(viewW, viewH);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawThemeBackdrops(level) {
  if (level.theme === "forest") drawForestBackdrop(level);
  if (level.theme === "lantern") drawLanternBackdrop(level);
  if (level.theme === "glass") drawGlassBackdrop(level);
  if (level.theme === "dawn") drawDawnBackdrop(level);
}

function drawForestBackdrop(level) {
  const offset = -(camera.x * 0.22) % 180;
  for (let x = offset - 180; x < viewW + 220; x += 180) {
    const sway = Math.sin((x + performance.now() * 0.01) * 0.02) * 5;
    ctx.fillStyle = "rgba(18, 45, 37, 0.8)";
    roundedRect(x + sway, viewH * 0.36, 24, viewH * 0.48, 16);
    ctx.fill();
    ctx.fillStyle = "rgba(36, 83, 61, 0.45)";
    ctx.beginPath();
    ctx.ellipse(x + 12 + sway, viewH * 0.36, 74, 92, 0, 0, TAU);
    ctx.fill();
  }
  drawFireflies(level.palette.glow, 0.55);
}

function drawLanternBackdrop(level) {
  const offset = -(camera.x * 0.25) % 240;
  ctx.strokeStyle = "rgba(255, 226, 153, 0.2)";
  ctx.lineWidth = 2;
  for (let x = offset - 240; x < viewW + 280; x += 240) {
    const y = viewH * (0.18 + ((x / 240) % 2) * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 20, y * 0.5, x + 2, y);
    ctx.stroke();
    const glow = ctx.createRadialGradient(x, y + 30, 2, x, y + 30, 52);
    glow.addColorStop(0, "rgba(255, 200, 116, 0.7)");
    glow.addColorStop(1, "rgba(255, 200, 116, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y + 30, 52, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffd28a";
    roundedRect(x - 10, y + 12, 20, 34, 8);
    ctx.fill();
  }
  drawFireflies(level.palette.accent, 0.4);
}

function drawGlassBackdrop(level) {
  const offset = -(camera.x * 0.18) % 150;
  for (let x = offset - 150; x < viewW + 180; x += 150) {
    const h = 130 + ((x * 17) % 90);
    const y = viewH * 0.78 - h;
    ctx.fillStyle = "rgba(158, 239, 255, 0.16)";
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + 28, y);
    ctx.lineTo(x + 56, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 184, 208, 0.2)";
    ctx.stroke();
  }
  for (let x = offset; x < viewW; x += 300) {
    const grad = ctx.createLinearGradient(x, viewH * 0.18, x, viewH * 0.85);
    grad.addColorStop(0, "rgba(158, 239, 255, 0)");
    grad.addColorStop(0.35, "rgba(158, 239, 255, 0.18)");
    grad.addColorStop(1, "rgba(158, 239, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, viewH * 0.15, 34, viewH * 0.72);
  }
}

function drawDawnBackdrop(level) {
  const offset = -(camera.x * 0.16) % 420;
  ctx.strokeStyle = "rgba(255, 225, 158, 0.18)";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  for (let x = offset - 420; x < viewW + 520; x += 420) {
    ctx.beginPath();
    ctx.moveTo(x, viewH * 0.86);
    ctx.bezierCurveTo(x + 70, viewH * 0.34, x + 270, viewH * 0.34, x + 340, viewH * 0.86);
    ctx.stroke();
  }
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(141, 247, 207, 0.2)";
  for (let i = 0; i < 8; i += 1) {
    const x = viewW * 0.5 - camera.x * 0.08;
    const y = viewH * 0.62;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(i) * 180, y - 190 - i * 8, x + Math.cos(i * 1.7) * 420, y - 220 + Math.sin(i) * 80);
    ctx.stroke();
  }
  drawFireflies(level.palette.glow, 0.5);
}

function drawFireflies(color, alpha) {
  const t = performance.now() / 1000;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 137 + Math.sin(t * 0.6 + i) * 18 - camera.x * 0.1) % (viewW + 80);
    const y = viewH * (0.22 + ((i * 53) % 420) / 1000) + Math.cos(t * 0.8 + i) * 12;
    ctx.beginPath();
    ctx.arc(x < -20 ? x + viewW + 80 : x, y, 1.2 + (i % 3) * 0.45, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function textureNoise(x, y, salt = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 73.3) * 43758.5453;
  return value - Math.floor(value);
}

function drawAtmosphereTexture(level) {
  const p = level.palette;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let x = -8; x < viewW + 8; x += 18) {
    for (let y = -8; y < viewH + 8; y += 18) {
      const grain = textureNoise(Math.floor((x + camera.x * 0.08) / 18), Math.floor((y + camera.y * 0.08) / 18), level.width);
      if (grain < 0.58) continue;
      const size = 0.7 + grain * 1.4;
      ctx.globalAlpha = 0.018 + grain * 0.018;
      ctx.fillStyle = grain > 0.86 ? p.glow : "rgba(255, 246, 220, 0.75)";
      ctx.fillRect(x + grain * 5, y + textureNoise(y, x, 4) * 5, size, size);
    }
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255, 246, 220, 0.08)";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.18;
  for (let x = -120; x < viewW + 160; x += 96) {
    const drift = textureNoise(Math.floor((x + camera.x * 0.04) / 96), level.height, 12);
    if (drift < 0.38) continue;
    ctx.beginPath();
    ctx.moveTo(x + drift * 42, viewH * 0.18);
    ctx.quadraticCurveTo(x + 24, viewH * 0.46, x - 10, viewH * 0.82);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWorld(level) {
  drawDistantWorldDetails(level);
  drawForestGrowth(level);
  for (const item of level.gates) drawGate(item, level);
  for (const item of level.platforms) drawPlatform(item, level);
  drawScentTrail(level);
  for (const item of level.hazards) drawHazard(item, level);
  for (const item of level.movingHazards || []) drawMovingHazard(item, level);
  for (const item of safeCreatures(level)) drawCreature(item, level);
  for (const item of level.seeds) {
    if (!state.collected[item.id]) drawSeed(item, level);
  }
  for (const item of level.points || []) {
    if (!state.collected[item.id]) drawPoint(item, level);
  }
  drawShrine(level);
  drawExit(level);
  drawParticles();
  drawPlayer(level);
}

function windScentPoint(point, index, t) {
  const strength = point.strength || 1;
  return {
    x: point.x + (Math.sin(t * 0.18 + index * 0.72) * 10 + Math.sin(t * 0.1 + index * 1.17) * 4) * strength,
    y: point.y + (Math.cos(t * 0.16 + index * 0.63) * 8 + Math.sin(t * 0.12 + index * 0.89) * 5) * strength,
    strength,
  };
}

function cubicPoint(a, c1, c2, b, amount) {
  const inv = 1 - amount;
  return {
    x: inv * inv * inv * a.x + 3 * inv * inv * amount * c1.x + 3 * inv * amount * amount * c2.x + amount * amount * amount * b.x,
    y: inv * inv * inv * a.y + 3 * inv * inv * amount * c1.y + 3 * inv * amount * amount * c2.y + amount * amount * amount * b.y,
  };
}

function cubicTangent(a, c1, c2, b, amount) {
  const inv = 1 - amount;
  return {
    x: 3 * inv * inv * (c1.x - a.x) + 6 * inv * amount * (c2.x - c1.x) + 3 * amount * amount * (b.x - c2.x),
    y: 3 * inv * inv * (c1.y - a.y) + 6 * inv * amount * (c2.y - c1.y) + 3 * amount * amount * (b.y - c2.y),
  };
}

function buildScentSpline(points, t) {
  const smoothPoints = points.map((point, index) => windScentPoint(point, index, t));
  const segments = [];
  let total = 0;
  const tension = 0.58;

  for (let i = 0; i < smoothPoints.length - 1; i += 1) {
    const p0 = smoothPoints[Math.max(0, i - 1)];
    const p1 = smoothPoints[i];
    const p2 = smoothPoints[i + 1];
    const p3 = smoothPoints[Math.min(smoothPoints.length - 1, i + 2)];
    const c1 = {
      x: p1.x + ((p2.x - p0.x) * tension) / 6,
      y: p1.y + ((p2.y - p0.y) * tension) / 6,
    };
    const c2 = {
      x: p2.x - ((p3.x - p1.x) * tension) / 6,
      y: p2.y - ((p3.y - p1.y) * tension) / 6,
    };

    let length = 0;
    let last = p1;
    const samples = [];
    for (let step = 1; step <= 14; step += 1) {
      const amount = step / 14;
      const point = cubicPoint(p1, c1, c2, p2, amount);
      length += Math.hypot(point.x - last.x, point.y - last.y);
      samples.push({ amount, length });
      last = point;
    }
    segments.push({ p1, c1, c2, p2, length, samples });
    total += length;
  }

  return { segments, total };
}

function traceScentPath(spline) {
  if (!spline.segments.length) return;
  ctx.beginPath();
  ctx.moveTo(spline.segments[0].p1.x, spline.segments[0].p1.y);
  for (const segment of spline.segments) {
    ctx.bezierCurveTo(segment.c1.x, segment.c1.y, segment.c2.x, segment.c2.y, segment.p2.x, segment.p2.y);
  }
}

function sampleScentPath(spline, progress) {
  if (!spline.segments.length || spline.total <= 0) return null;

  let target = (((progress % 1) + 1) % 1) * spline.total;
  for (const segment of spline.segments) {
    if (target <= segment.length || segment === spline.segments[spline.segments.length - 1]) {
      let previousLength = 0;
      let previousAmount = 0;
      let amount = 1;

      for (const sample of segment.samples) {
        if (target <= sample.length) {
          const span = sample.length - previousLength || 1;
          amount = lerp(previousAmount, sample.amount, (target - previousLength) / span);
          break;
        }
        previousLength = sample.length;
        previousAmount = sample.amount;
      }

      const point = cubicPoint(segment.p1, segment.c1, segment.c2, segment.p2, amount);
      const tangent = cubicTangent(segment.p1, segment.c1, segment.c2, segment.p2, amount);
      return {
        ...point,
        angle: Math.atan2(tangent.y, tangent.x),
        strength: lerp(segment.p1.strength, segment.p2.strength, amount),
      };
    }
    target -= segment.length;
  }

  const last = spline.segments[spline.segments.length - 1].p2;
  return { ...last, angle: 0 };
}

function drawScentTrail(level) {
  const points = level.scent || [];
  if (points.length < 2) return;

  const t = performance.now() / 1000;
  const spline = buildScentSpline(points, t);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const passes = [
    { width: 18, alpha: 0.025, color: level.palette.glow },
    { width: 8, alpha: 0.045, color: level.palette.accent },
    { width: 1.4, alpha: 0.16, color: "rgba(255, 247, 204, 0.82)" },
  ];

  for (const pass of passes) {
    traceScentPath(spline);
    ctx.strokeStyle = pass.color;
    ctx.globalAlpha = pass.alpha + Math.sin(t * 1.4) * pass.alpha * 0.18;
    ctx.lineWidth = pass.width;
    ctx.stroke();
  }

  const moteCount = Math.min(44, Math.max(18, Math.floor(level.width / 140)));
  for (let i = 0; i < moteCount; i += 1) {
    const progress = i / moteCount + t * 0.018;
    const dot = sampleScentPath(spline, progress);
    if (!dot) continue;
    const pulse = (Math.sin(t * 3.1 + i * 0.9) + 1) / 2;
    const radius = (1.1 + pulse * 1.5) * dot.strength;
    const glow = ctx.createRadialGradient(dot.x, dot.y, 1, dot.x, dot.y, radius * 4.8);
    glow.addColorStop(0, "rgba(255, 250, 214, 0.3)");
    glow.addColorStop(0.35, level.palette.glow);
    glow.addColorStop(1, "rgba(255, 250, 214, 0)");
    ctx.globalAlpha = 0.06 + pulse * 0.14;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, radius * 4.8, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.14 + pulse * 0.18;
    ctx.fillStyle = "rgba(255, 250, 214, 0.54)";
    ctx.beginPath();
    ctx.ellipse(dot.x, dot.y, radius * 0.5, radius * 1.15, dot.angle + Math.PI / 2 + Math.sin(t + i) * 0.18, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function drawDistantWorldDetails(level) {
  if (level.theme === "dawn") {
    const baseX = level.width * 0.52;
    ctx.fillStyle = "rgba(16, 22, 24, 0.36)";
    roundedRect(baseX - 60, 130, 120, 650, 60);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 239, 180, 0.1)";
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.moveTo(baseX, 275 + i * 18);
      ctx.quadraticCurveTo(baseX - 260 + i * 28, 200 - i * 15, baseX - 520 + i * 96, 130 + i * 38);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(baseX, 270 + i * 20);
      ctx.quadraticCurveTo(baseX + 250 - i * 18, 190 - i * 11, baseX + 520 - i * 82, 150 + i * 35);
      ctx.stroke();
    }
  }
}

function drawForestGrowth(level) {
  const p = level.palette;
  ctx.save();
  ctx.globalAlpha = level.theme === "forest" ? 0.5 : 0.24;
  for (let x = -120; x < level.width + 220; x += 210) {
    const wobble = Math.sin(x * 0.017) * 28;
    const trunkX = x + wobble;
    const top = 130 + ((x * 19) % 120);
    const base = level.height + 40;
    const trunkW = 26 + ((x / 210) % 3) * 6;
    ctx.fillStyle = level.theme === "dawn" ? "rgba(28, 35, 31, 0.48)" : "rgba(14, 36, 31, 0.55)";
    roundedRect(trunkX, top, trunkW, base - top, 18);
    ctx.fill();
    drawBarkTexture(trunkX, top, trunkW, base - top, level);

    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.globalAlpha = level.theme === "forest" ? 0.22 : 0.12;
    for (let i = 0; i < 3; i += 1) {
      const by = top + 90 + i * 95;
      ctx.beginPath();
      ctx.moveTo(trunkX + 12, by);
      ctx.quadraticCurveTo(trunkX + 70 + i * 18, by - 65, trunkX + 132 + i * 34, by - 28);
      ctx.stroke();
    }
    ctx.globalAlpha = level.theme === "forest" ? 0.34 : 0.16;
    ctx.fillStyle = p.near;
    ctx.beginPath();
    ctx.ellipse(trunkX + 13, top + 18, 72, 46, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBarkTexture(x, y, w, h, level) {
  ctx.save();
  roundedRect(x, y, w, h, 18);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.strokeStyle = level.theme === "dawn" ? "rgba(255, 229, 163, 0.11)" : "rgba(180, 245, 202, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < Math.max(4, h / 96); i += 1) {
    const tx = x + 6 + textureNoise(i, x, 31) * Math.max(4, w - 12);
    const top = y + i * 88 + textureNoise(x, i, 22) * 30;
    ctx.globalAlpha = 0.18 + textureNoise(i, y, 4) * 0.2;
    ctx.beginPath();
    ctx.moveTo(tx, top);
    ctx.bezierCurveTo(tx - 8, top + 30, tx + 10, top + 68, tx + textureNoise(i, top, 7) * 12 - 6, top + 112);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlatformTexture(item, level, top) {
  const p = level.palette;
  const salt = item.x * 0.017 + item.y * 0.031;

  ctx.save();
  roundedRect(item.x, item.y, item.w, item.h, 9);
  ctx.clip();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 246, 220, 0.12)";
  ctx.lineWidth = 1;
  for (let y = item.y + 18; y < item.y + item.h - 8; y += 20) {
    ctx.globalAlpha = 0.08 + textureNoise(y, item.x, salt) * 0.08;
    ctx.beginPath();
    ctx.moveTo(item.x + 12, y);
    for (let x = item.x + 36; x < item.x + item.w - 10; x += 48) {
      ctx.lineTo(x, y + (textureNoise(x, y, salt) - 0.5) * 9);
    }
    ctx.stroke();
  }

  const fleckStep = item.kind === "crystal" ? 28 : 22;
  for (let x = item.x + 12; x < item.x + item.w - 8; x += fleckStep) {
    for (let y = item.y + 16; y < item.y + item.h - 10; y += fleckStep) {
      const n = textureNoise(Math.floor(x), Math.floor(y), salt);
      if (n < 0.52) continue;
      ctx.globalAlpha = 0.08 + n * 0.1;
      ctx.fillStyle = n > 0.84 ? p.accent : "rgba(255, 246, 220, 0.58)";
      ctx.beginPath();
      ctx.ellipse(x + n * 7, y + textureNoise(y, x, salt) * 7, 1.2 + n * 1.8, 0.7 + n, n * TAU, 0, TAU);
      ctx.fill();
    }
  }

  if (item.kind === "wood" || item.kind === "root") {
    ctx.strokeStyle = item.kind === "wood" ? "rgba(255, 210, 145, 0.2)" : "rgba(141, 247, 207, 0.16)";
    ctx.lineWidth = 1.2;
    for (let y = item.y + 12; y < item.y + item.h - 8; y += 14) {
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(item.x + 14, y);
      for (let x = item.x + 34; x < item.x + item.w - 12; x += 42) {
        ctx.quadraticCurveTo(x - 12, y + Math.sin(x * 0.03 + salt) * 5, x, y + Math.cos(x * 0.04) * 3);
      }
      ctx.stroke();
    }
  } else if (item.kind === "crystal") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.3;
    for (let x = item.x + 24; x < item.x + item.w - 18; x += 46) {
      const lean = textureNoise(x, item.y, salt) * 26 - 13;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.moveTo(x, item.y + 6);
      ctx.lineTo(x + lean, item.y + item.h - 8);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = p.lip;
    for (let x = item.x + 14; x < item.x + item.w - 10; x += 17) {
      const n = textureNoise(x, item.y, salt);
      if (n < 0.42) continue;
      ctx.globalAlpha = 0.16 + n * 0.2;
      ctx.beginPath();
      ctx.arc(x, item.y + 7 + n * 4, 1 + n * 2.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.lineCap = "round";
  if (item.kind === "crystal") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.44)";
    ctx.globalAlpha = 0.38;
    for (let x = item.x + 22; x < item.x + item.w - 18; x += 54) {
      ctx.beginPath();
      ctx.moveTo(x, item.y - 1);
      ctx.lineTo(x + 18, item.y - 4);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = top;
    for (let x = item.x + 10; x < item.x + item.w - 8; x += 13) {
      const n = textureNoise(x, item.y, salt);
      if (n < 0.33) continue;
      ctx.globalAlpha = 0.26 + n * 0.28;
      ctx.lineWidth = 1 + n;
      ctx.beginPath();
      ctx.moveTo(x, item.y - 1);
      ctx.quadraticCurveTo(x + 2, item.y - 6 - n * 5, x + 5, item.y - 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPlatform(item, level) {
  const p = level.palette;
  const top = item.kind === "crystal" ? p.lip : item.kind === "wood" ? "#f1b76f" : p.lip;
  const body = ctx.createLinearGradient(item.x, item.y, item.x, item.y + item.h);
  body.addColorStop(0, top);
  body.addColorStop(0.12, p.ground);
  body.addColorStop(1, "#081018");
  ctx.fillStyle = body;
  roundedRect(item.x, item.y, item.w, item.h, 9);
  ctx.fill();

  ctx.fillStyle = top;
  roundedRect(item.x + 6, item.y - 4, item.w - 12, 10, 8);
  ctx.fill();
  drawPlatformTexture(item, level, top);

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1.5;
  for (let x = item.x + 18; x < item.x + item.w - 16; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, item.y + 10);
    ctx.lineTo(x + Math.sin(x) * 7, item.y + item.h - 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawHazard(item, level) {
  const p = level.palette;
  ctx.fillStyle = "rgba(4, 8, 12, 0.62)";
  ctx.fillRect(item.x, item.y + item.h - 8, item.w, 12);
  for (let x = item.x; x < item.x + item.w; x += 18) {
    const h = item.h * (0.75 + ((x * 13) % 8) / 20);
    const grad = ctx.createLinearGradient(x, item.y + item.h, x, item.y);
    grad.addColorStop(0, p.ground);
    grad.addColorStop(1, p.accent);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, item.y + item.h);
    ctx.lineTo(x + 9, item.y + item.h - h);
    ctx.lineTo(x + 18, item.y + item.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 246, 220, 0.18)";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.moveTo(x + 9, item.y + item.h - h + 5);
    ctx.lineTo(x + 9 + Math.sin(x * 0.08) * 3, item.y + item.h - 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawMovingHazard(item, level) {
  const rect = movingHazardRect(item);
  const p = level.palette;
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(Math.sin(performance.now() / 420 + item.phase) * 0.12);
  const grad = ctx.createLinearGradient(-rect.w / 2, 0, rect.w / 2, 0);
  grad.addColorStop(0, p.ground);
  grad.addColorStop(0.5, p.accent);
  grad.addColorStop(1, p.ground);
  ctx.fillStyle = grad;
  roundedRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h, 10);
  ctx.fill();
  ctx.strokeStyle = p.glow;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.accent;
  for (let x = -rect.w / 2 + 5; x < rect.w / 2; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, -rect.h / 2 + 2);
    ctx.lineTo(x + 5, -rect.h / 2 - 13);
    ctx.lineTo(x + 10, -rect.h / 2 + 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, rect.h / 2 - 2);
    ctx.lineTo(x + 5, rect.h / 2 + 13);
    ctx.lineTo(x + 10, rect.h / 2 - 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCreature(item, level) {
  const rect = creatureRect(item);
  const p = level.palette;
  const t = performance.now() / 1000;
  const flipped = isCreatureFlipped(item);
  const x = rect.x + rect.w / 2;
  const y = rect.y + rect.h / 2;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * (flipped ? 1.7 : 4) + item.phase) * (flipped ? 0.7 : 1.2));
  ctx.fillStyle = "rgba(4, 8, 12, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 14, flipped ? 20 : 24, flipped ? 4 : 5, 0, 0, TAU);
  ctx.fill();
  ctx.scale(rect.dir, flipped ? -1 : 1);
  if (flipped) ctx.translate(0, -2);

  const body = ctx.createLinearGradient(0, -15, 0, 14);
  body.addColorStop(0, p.accent);
  body.addColorStop(1, p.ground);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-3, 3, 22, 13, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 246, 220, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = p.glow;
  ctx.beginPath();
  ctx.arc(13, -4, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#111722";
  ctx.beginPath();
  ctx.arc(16, -6, 1.8, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = p.glow;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(11, -10);
  ctx.quadraticCurveTo(14, -18, 20, -18);
  ctx.moveTo(6, -9);
  ctx.quadraticCurveTo(6, -17, 1, -19);
  ctx.stroke();

  if (flipped) {
    ctx.strokeStyle = "rgba(255, 246, 220, 0.6)";
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const legX = -16 + i * 8;
      const wiggle = Math.sin(t * 9 + i * 1.8) * 4;
      ctx.moveTo(legX, 8);
      ctx.quadraticCurveTo(legX + wiggle, 17, legX + wiggle * 1.25, 24 + Math.cos(t * 7 + i) * 2);
    }
    ctx.stroke();

    ctx.strokeStyle = p.glow;
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(-19, 23 + Math.sin(t * 2.2) * 1.5, 2.5, 0, TAU);
    ctx.moveTo(-6, 27 + Math.cos(t * 2.1) * 1.2);
    ctx.arc(-6, 27 + Math.cos(t * 2.1) * 1.2, 1.8, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawSeed(item, level) {
  const t = performance.now() / 1000;
  const bob = Math.sin(t * 2.5 + item.x * 0.02) * 8;
  const x = item.x;
  const y = item.y + bob;
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 62);
  glow.addColorStop(0, level.palette.glow);
  glow.addColorStop(0.35, "rgba(255, 230, 155, 0.34)");
  glow.addColorStop(1, "rgba(255, 230, 155, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 62, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  ctx.fillStyle = "#fff0b0";
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.bezierCurveTo(17, -4, 16, 14, 0, 18);
  ctx.bezierCurveTo(-16, 14, -17, -4, 0, -16);
  ctx.fill();
  ctx.strokeStyle = level.palette.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawPoint(item, level) {
  const t = performance.now() / 1000;
  const bob = Math.sin(t * 3.2 + item.x * 0.04) * 5;
  const x = item.x;
  const y = item.y + bob;
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 34);
  glow.addColorStop(0, level.palette.accent);
  glow.addColorStop(0.35, "rgba(255, 246, 190, 0.34)");
  glow.addColorStop(1, "rgba(255, 246, 190, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2 + item.x) * 0.4);
  ctx.fillStyle = "#fff7b9";
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 9, 0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = level.palette.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawShrine(level) {
  const s = level.shrine;
  const p = level.palette;
  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(s.x, s.y);

  const near = isNearShrine(level);
  const glow = ctx.createRadialGradient(0, -32, 2, 0, -32, near ? 130 : 90);
  glow.addColorStop(0, near ? p.glow : p.accent);
  glow.addColorStop(0.35, near ? "rgba(255, 238, 180, 0.34)" : "rgba(160, 240, 220, 0.18)");
  glow.addColorStop(1, "rgba(255, 238, 180, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -32, near ? 130 : 90, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = p.lip;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-16, -54, 6, -95, 0, -140);
  ctx.stroke();

  for (let i = 0; i < SKILLS.length; i += 1) {
    const node = SKILLS[i];
    const lit = state.unlocked[node.id];
    const angle = -Math.PI / 2 + i * 0.76;
    const len = 44 + i * 9;
    ctx.strokeStyle = lit ? node.color : "rgba(255,255,255,0.16)";
    ctx.lineWidth = lit ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(0, -78);
    ctx.quadraticCurveTo(Math.cos(angle) * 26, -100 + Math.sin(angle) * 18, Math.cos(angle) * len, -118 + Math.sin(angle) * len * 0.35);
    ctx.stroke();
    ctx.fillStyle = lit ? node.color : "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * len, -118 + Math.sin(angle) * len * 0.35, lit ? 5 : 3, 0, TAU);
    ctx.fill();
  }

  ctx.fillStyle = p.ground;
  roundedRect(-35, -10, 70, 20, 10);
  ctx.fill();
  ctx.strokeStyle = p.glow;
  ctx.globalAlpha = near ? 0.9 : 0.45;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -63 + Math.sin(t * 2) * 3, 18, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (near) {
    ctx.font = "700 18px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 246, 210, 0.84)";
    ctx.fillText("E", 0, -172);
  }
  ctx.restore();
}

function drawGate(item, level) {
  if (state.unlocked[item.requires]) return;
  const t = performance.now() / 1000;
  const p = level.palette;
  const grad = ctx.createLinearGradient(item.x, item.y, item.x + item.w, item.y);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, p.accent);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = 0.4 + Math.sin(t * 3) * 0.08;
  ctx.fillStyle = grad;
  ctx.fillRect(item.x, item.y, item.w, item.h);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = p.glow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = item.y; y <= item.y + item.h; y += 20) {
    const x = item.x + item.w / 2 + Math.sin(y * 0.06 + t * 2) * 8;
    if (y === item.y) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawExit(level) {
  const e = level.exit;
  const open = !e.requires || state.unlocked[e.requires];
  const t = performance.now() / 1000;
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const p = level.palette;
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, open ? 112 : 72);
  glow.addColorStop(0, open ? p.glow : p.accent);
  glow.addColorStop(0.45, open ? "rgba(255, 235, 160, 0.28)" : "rgba(150, 180, 210, 0.16)");
  glow.addColorStop(1, "rgba(255, 235, 160, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, open ? 112 : 72, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 0.6) * 0.05);
  ctx.strokeStyle = open ? p.glow : "rgba(255,255,255,0.22)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, e.w * 0.38, e.h * 0.46, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = open ? p.accent : "rgba(255,255,255,0.13)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, e.w * (0.25 + Math.sin(t * 2) * 0.03), e.h * 0.34, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(level) {
  const p = level.palette;
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const t = performance.now() / 1000;
  const walking = player.grounded && Math.abs(player.vx) > 18 && player.idleTime < 0.25;
  const pouncing = player.pounceTimer > 0;
  const jumping = !player.grounded || pouncing;
  const licking = player.grounded && player.idleTime >= 3 && player.idleTime < 8;
  const napping = player.grounded && player.idleTime >= 8;
  const walkPhase = player.walkTime * TAU;
  const bodyBob = walking ? Math.sin(walkPhase * 2) * 1.5 : 0;
  const breath = napping ? Math.sin(t * 2.2) * 0.8 : 0;

  for (const mark of player.trail) {
    const alpha = mark.life / 0.25;
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = p.glow;
    ctx.beginPath();
    ctx.ellipse(mark.x + player.w / 2 - player.dir * 5, mark.y + player.h * 0.58, 22, 14, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (pouncing) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(player.dir, 1);
    ctx.strokeStyle = p.accent;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i += 1) {
      ctx.globalAlpha = 0.18 + i * 0.14;
      ctx.lineWidth = 2 + i;
      ctx.beginPath();
      ctx.moveTo(-24 - i * 8, 3 + i * 5);
      ctx.quadraticCurveTo(-4, -10 + i * 2, 27 + i * 4, -3 + i * 4);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const auraRadius = state.unlocked.glide ? 54 : state.unlocked.dash ? 42 : 30;
  const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, auraRadius);
  aura.addColorStop(0, state.unlocked.glide ? "rgba(148, 215, 255, 0.38)" : "rgba(255, 255, 255, 0.28)");
  aura.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, auraRadius, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy + (napping ? 9 : bodyBob));
  ctx.scale(player.dir, 1);
  if (jumping) ctx.rotate(clamp(player.vy / 2100, -0.22, 0.24));

  ctx.fillStyle = "rgba(4, 6, 10, 0.25)";
  ctx.beginPath();
  ctx.ellipse(napping ? 1 : 0, player.h / 2 + 6 - (napping ? 5 : 0), napping ? 24 : 19, napping ? 6 : 5, 0, 0, TAU);
  ctx.fill();

  const fur = ctx.createLinearGradient(0, -22, 0, 18);
  fur.addColorStop(0, p.player);
  fur.addColorStop(0.68, "#f3ddb0");
  fur.addColorStop(1, p.accent);

  ctx.strokeStyle = "rgba(255, 246, 220, 0.48)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (napping) {
    ctx.moveTo(-15, 7);
    ctx.bezierCurveTo(-27, 11, -27, -5, -13, -3);
  } else if (jumping) {
    ctx.moveTo(-14, 3);
    ctx.bezierCurveTo(-31, -5, -28, -26, -9, -22);
  } else {
    const tailLift = licking ? -9 + Math.sin(t * 8) * 2 : -17 + Math.sin(walkPhase) * 4;
    ctx.moveTo(-12, 6);
    ctx.bezierCurveTo(-28, -1, -26, tailLift, -12, tailLift);
  }
  ctx.stroke();

  ctx.fillStyle = fur;
  ctx.beginPath();
  if (napping) ctx.ellipse(-2, 8 + breath, 22, 10, -0.04, 0, TAU);
  else if (jumping) ctx.ellipse(-3, 4, 20, 11, -0.08, 0, TAU);
  else ctx.ellipse(-2, licking ? 7 : 5, 17, licking ? 12 : 13, -0.08, 0, TAU);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(napping ? 15 : 10, napping ? 3 + breath : licking ? -8 : jumping ? -12 : -10, napping ? 11 : 12, napping ? 9 : 11, napping ? -0.1 : 0.12, 0, TAU);
  ctx.fill();

  ctx.beginPath();
  if (napping) {
    ctx.moveTo(8, -3 + breath);
    ctx.lineTo(9, -13 + breath);
    ctx.lineTo(15, -4 + breath);
  } else {
    ctx.moveTo(3, licking ? -16 : jumping ? -20 : -18);
    ctx.lineTo(6, licking ? -28 : jumping ? -34 : -31);
    ctx.lineTo(13, licking ? -17 : jumping ? -19 : -18);
  }
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  if (napping) {
    ctx.moveTo(16, -4 + breath);
    ctx.lineTo(24, -12 + breath);
    ctx.lineTo(23, 0 + breath);
  } else {
    ctx.moveTo(13, licking ? -17 : jumping ? -19 : -18);
    ctx.lineTo(21, licking ? -27 : jumping ? -32 : -29);
    ctx.lineTo(21, licking ? -13 : jumping ? -15 : -14);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 182, 203, 0.72)";
  ctx.beginPath();
  ctx.moveTo(napping ? 10 : 7, (napping ? -4 : -19) + breath);
  ctx.lineTo(napping ? 10 : 8, (napping ? -10 : -26) + breath);
  ctx.lineTo(napping ? 14 : 12, (napping ? -4 : -19) + breath);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(napping ? 18 : 16, (napping ? -4 : -18) + breath);
  ctx.lineTo(napping ? 22 : 20, (napping ? -9 : -24) + breath);
  ctx.lineTo(napping ? 22 : 20, (napping ? -1 : -16) + breath);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#101722";
  ctx.fillStyle = "#101722";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (napping) {
    ctx.moveTo(13, 3 + breath);
    ctx.quadraticCurveTo(16, 5 + breath, 19, 3 + breath);
    ctx.stroke();
  } else if (licking) {
    ctx.moveTo(12, -9);
    ctx.quadraticCurveTo(15, -7, 18, -9);
    ctx.stroke();
  } else {
    ctx.arc(14, jumping ? -13 : -11, 2.3, 0, TAU);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(16, 23, 34, 0.72)";
  ctx.beginPath();
  ctx.arc(napping ? 24 : 22, napping ? 5 + breath : licking ? -5 : jumping ? -9 : -7, 1.5, 0, TAU);
  ctx.fill();

  if (licking && Math.sin((player.idleTime - 3) * TAU * 1.55) > 0.1) {
    ctx.fillStyle = "rgba(255, 139, 163, 0.82)";
    ctx.beginPath();
    ctx.ellipse(21, -4, 2.6, 1.5, -0.3, 0, TAU);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(16, 23, 34, 0.48)";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  const whiskerY = napping ? 5 + breath : licking ? -4 : jumping ? -8 : -6;
  ctx.moveTo(19, whiskerY);
  ctx.lineTo(28, whiskerY - 3);
  ctx.moveTo(19, whiskerY + 2);
  ctx.lineTo(29, whiskerY + 3);
  ctx.moveTo(19, whiskerY + 4);
  ctx.lineTo(27, whiskerY + 8);
  ctx.stroke();

  ctx.strokeStyle = state.unlocked.glide ? p.accent : "rgba(255,255,255,0.58)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (napping) {
    ctx.moveTo(-9, 16 + breath);
    ctx.lineTo(8, 16 + breath);
  } else if (licking) {
    const pawLift = Math.max(0, Math.sin((player.idleTime - 3) * TAU * 1.55));
    ctx.moveTo(-8, 14);
    ctx.lineTo(-9, 21);
    ctx.moveTo(6, 14);
    ctx.quadraticCurveTo(12, 5 - pawLift * 5, 18, -2);
  } else if (jumping) {
    ctx.moveTo(-10, 12);
    ctx.lineTo(-20, 18);
    ctx.moveTo(4, 13);
    ctx.lineTo(16, 18);
    ctx.moveTo(-2, 14);
    ctx.lineTo(-7, 20);
    ctx.moveTo(12, 12);
    ctx.lineTo(21, 15);
  } else {
    const strideA = walking ? Math.sin(walkPhase) * 5 : 0;
    const strideB = walking ? Math.sin(walkPhase + Math.PI) * 5 : 0;
    ctx.globalAlpha = 0.38;
    ctx.moveTo(-10, 13);
    ctx.lineTo(-10 - strideB * 0.6, 21);
    ctx.moveTo(7, 14);
    ctx.lineTo(7 + strideA * 0.6, 21);
    ctx.globalAlpha = 1;
    ctx.moveTo(-6, 14);
    ctx.lineTo(-6 - strideA, 22);
    ctx.moveTo(12, 14);
    ctx.lineTo(12 + strideB, 22);
  }
  ctx.stroke();

  if (napping) {
    ctx.strokeStyle = p.glow;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.35 + Math.sin(t * 1.5) * 0.12;
    ctx.beginPath();
    ctx.arc(28, -14 + Math.sin(t * 1.3) * 2, 3, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(36, -23 + Math.sin(t * 1.1) * 2, 5, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (state.unlocked.doubleJump) {
    ctx.strokeStyle = "rgba(255,255,255,0.58)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1, napping ? -12 : jumping ? -29 : -26);
    ctx.quadraticCurveTo(8, napping ? -20 : jumping ? -42 : -37, 18, napping ? -12 : jumping ? -29 : -26);
    ctx.stroke();
  }
  if (state.unlocked.glide) {
    ctx.fillStyle = p.glow;
    for (let i = 0; i < 4; i += 1) {
      const a = i * TAU / 4 + t * 0.8;
      ctx.beginPath();
      ctx.ellipse(4 + Math.cos(a) * 19, -25 + Math.sin(a) * 8, 2.2, 4.6, a, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTinyProgress(level) {
  const x = 26;
  const y = 26;
  ctx.save();
  ctx.globalAlpha = 0.78;
  for (let i = 0; i < SKILLS.length; i += 1) {
    const node = SKILLS[i];
    const px = x + i * 28;
    const py = y + Math.sin(i) * 3;
    if (i > 0) {
      ctx.strokeStyle = state.unlocked[node.id] ? level.palette.glow : "rgba(255,255,255,0.17)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 24, py);
      ctx.lineTo(px - 4, py);
      ctx.stroke();
    }
    ctx.fillStyle = state.unlocked[node.id] ? node.color : "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(px, py, state.unlocked[node.id] ? 5 : 4, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < state.skillPoints; i += 1) {
    ctx.fillStyle = level.palette.glow;
    ctx.beginPath();
    ctx.ellipse(x + 2 + i * 10, y + 24, 3, 5, 0.5, 0, TAU);
    ctx.fill();
  }
  if (state.score > 0) {
    ctx.fillStyle = level.palette.accent;
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 42, 4, 6, 0.4, 0, TAU);
    ctx.fill();
    ctx.font = "14px Georgia, serif";
    ctx.fillStyle = "rgba(255, 246, 220, 0.82)";
    ctx.textAlign = "left";
    ctx.fillText(String(state.score), x + 12, y + 47);
  }
  ctx.restore();
}

function drawHint() {
  if (state.hintTime <= 0 || !state.hint) return;
  const alpha = clamp(Math.min(state.hintTime, state.hintLife - state.hintTime, 1), 0, 1);
  const maxWidth = Math.min(560, viewW - 48);
  const fontSize = viewW < 560 ? 15 : 16;
  const lines = measureWrappedLines(state.hint, maxWidth - 42, `${fontSize}px Georgia, serif`);
  const boxW = Math.min(maxWidth, Math.max(260, Math.max(...lines.map((line) => ctx.measureText(line).width)) + 42));
  const boxH = 28 + lines.length * 22;
  const x = (viewW - boxW) / 2;
  const y = 28;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(7, 11, 17, 0.52)";
  roundedRect(x, y, boxW, boxH, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 239, 190, 0.32)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `${fontSize}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 246, 220, 0.94)";
  const startY = y + boxH / 2 - ((lines.length - 1) * 22) / 2;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], viewW / 2, startY + i * 22);
  }
  ctx.restore();
}

function drawMessage() {
  if (state.messageTime <= 0) return;
  const alpha = clamp(Math.min(state.messageTime, state.messageLife - state.messageTime, 1), 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha * 0.92;
  ctx.font = "20px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 246, 220, 0.92)";
  wrapText(state.message, viewW / 2, viewH - 82, Math.min(680, viewW - 52), 28);
  ctx.restore();
}

function drawCatLifeSymbols(cx, y, lives, maxLives, size, level) {
  const spacing = size * 1.2;
  const startX = cx - ((maxLives - 1) * spacing) / 2;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < maxLives; i += 1) {
    const x = startX + i * spacing;
    const lit = i < lives;
    ctx.globalAlpha = lit ? 0.96 : 0.2;
    ctx.fillStyle = lit ? level.palette.player : "rgba(255, 246, 220, 0.35)";
    ctx.strokeStyle = lit ? "rgba(35, 46, 52, 0.5)" : "rgba(255, 246, 220, 0.22)";
    ctx.lineWidth = Math.max(1, size * 0.08);

    ctx.beginPath();
    ctx.moveTo(x - size * 0.32, y - size * 0.1);
    ctx.lineTo(x - size * 0.2, y - size * 0.48);
    ctx.lineTo(x - size * 0.02, y - size * 0.19);
    ctx.lineTo(x + size * 0.02, y - size * 0.19);
    ctx.lineTo(x + size * 0.2, y - size * 0.48);
    ctx.lineTo(x + size * 0.32, y - size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.02, size * 0.34, size * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    if (size >= 15) {
      ctx.globalAlpha = lit ? 0.62 : 0.22;
      ctx.fillStyle = "rgba(22, 30, 36, 0.78)";
      ctx.beginPath();
      ctx.arc(x - size * 0.12, y, size * 0.035, 0, TAU);
      ctx.arc(x + size * 0.12, y, size * 0.035, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawLifeModal(level) {
  if (state.lifeModalTime <= 0 || state.mode === "gameover") return;
  const fade = Math.min(state.lifeModalTime, state.lifeModalLife - state.lifeModalTime, 0.45) / 0.45;
  const alpha = clamp(fade, 0, 1);
  const boxW = Math.min(500, viewW - 40);
  const boxH = 178;
  const x = (viewW - boxW) / 2;
  const y = viewH * 0.5 - boxH / 2;
  const cx = viewW / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(5, 8, 13, 0.68)";
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = "rgba(12, 18, 24, 0.86)";
  roundedRect(x, y, boxW, boxH, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 239, 190, 0.36)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 246, 220, 0.97)";
  ctx.font = `${viewW < 520 ? 24 : 28}px Georgia, serif`;
  ctx.fillText(state.lifeModalTitle, cx, y + 42);
  ctx.font = `${viewW < 520 ? 16 : 18}px Georgia, serif`;
  ctx.fillStyle = level.palette.glow;
  ctx.fillText(`${state.lives} of ${MAX_LIVES} lives left`, cx, y + 78);
  drawCatLifeSymbols(cx, y + 116, state.lives, MAX_LIVES, Math.min(23, Math.max(15, (boxW - 92) / MAX_LIVES)), level);

  if (state.lifeModalSubtitle) {
    ctx.font = "14px Georgia, serif";
    ctx.fillStyle = "rgba(255, 246, 220, 0.74)";
    ctx.fillText(state.lifeModalSubtitle, cx, y + boxH - 22);
  }
  ctx.restore();
}

function drawGameOver(level) {
  const boxW = Math.min(560, viewW - 36);
  const boxH = Math.min(336, viewH - 52);
  const x = (viewW - boxW) / 2;
  const y = (viewH - boxH) / 2;
  const cx = viewW / 2;

  ctx.save();
  ctx.fillStyle = "rgba(4, 7, 11, 0.74)";
  ctx.fillRect(0, 0, viewW, viewH);

  const glow = ctx.createRadialGradient(cx, y + 86, 20, cx, y + 86, boxW * 0.62);
  glow.addColorStop(0, "rgba(255, 211, 125, 0.14)");
  glow.addColorStop(1, "rgba(255, 211, 125, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, y + 88, boxW * 0.58, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(11, 16, 22, 0.92)";
  roundedRect(x, y, boxW, boxH, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 239, 190, 0.4)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 246, 220, 0.98)";
  ctx.font = `${viewW < 520 ? 30 : 36}px Georgia, serif`;
  ctx.fillText("Game over", cx, y + 54);
  drawCatLifeSymbols(cx, y + 100, 0, MAX_LIVES, Math.min(22, Math.max(14, (boxW - 108) / MAX_LIVES)), level);

  ctx.font = `${viewW < 520 ? 18 : 20}px Georgia, serif`;
  ctx.fillStyle = level.palette.accent;
  ctx.fillText(`Score ${state.gameOverScore}`, cx, y + 150);
  ctx.fillStyle = level.palette.glow;
  ctx.fillText(`High score ${state.highScore}`, cx, y + 182);

  ctx.font = `${viewW < 520 ? 15 : 17}px Georgia, serif`;
  ctx.fillStyle = "rgba(255, 246, 220, 0.78)";
  wrapText("Press R, Enter, or Space to start again from the beginning.", cx, y + boxH - 58, boxW - 68, 24);
  ctx.restore();
}

function drawSkillTree(level) {
  const p = level.palette;
  ctx.save();
  ctx.fillStyle = "rgba(4, 7, 11, 0.58)";
  ctx.fillRect(0, 0, viewW, viewH);

  const cx = viewW / 2;
  const cy = viewH / 2;
  const pulse = 1 + Math.sin(performance.now() / 420) * 0.035;
  const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 260);
  glow.addColorStop(0, "rgba(255, 235, 180, 0.16)");
  glow.addColorStop(1, "rgba(255, 235, 180, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 260, 0, TAU);
  ctx.fill();

  ctx.lineCap = "round";
  for (const node of SKILLS) {
    const parent = node.parent === "root" ? { x: 0, y: 0, id: "root" } : SKILLS.find((item) => item.id === node.parent);
    const lit = state.unlocked[node.id];
    const ready = canUnlock(node);
    ctx.strokeStyle = lit ? node.color : ready ? p.glow : "rgba(255,255,255,0.14)";
    ctx.lineWidth = lit ? 5 : ready ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + parent.x * pulse, cy + parent.y * pulse);
    ctx.quadraticCurveTo(cx + (parent.x + node.x) * 0.5, cy + (parent.y + node.y) * 0.5 - 26, cx + node.x * pulse, cy + node.y * pulse);
    ctx.stroke();
  }

  ctx.fillStyle = p.glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 23, 0, TAU);
  ctx.stroke();

  for (const node of SKILLS) {
    const x = cx + node.x * pulse;
    const y = cy + node.y * pulse;
    const selected = node.id === state.treeSelection;
    const lit = state.unlocked[node.id];
    const ready = canUnlock(node);
    const radius = selected ? 20 : 15;
    const nodeGlow = ctx.createRadialGradient(x, y, 1, x, y, selected ? 72 : 46);
    nodeGlow.addColorStop(0, lit || ready ? node.color : "rgba(255,255,255,0.16)");
    nodeGlow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = nodeGlow;
    ctx.beginPath();
    ctx.arc(x, y, selected ? 72 : 46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lit ? node.color : ready ? "#fff0b0" : "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = selected ? "#fff8d8" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();
    drawSkillIcon(node.id, x, y, lit || ready ? "#15202a" : "rgba(10,14,20,0.55)");
  }

  const selected = selectedSkill();
  const ready = canUnlock(selected);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 246, 220, 0.95)";
  ctx.font = "24px Georgia, serif";
  ctx.fillText(selected.label, cx, cy + 208);
  ctx.font = "17px Georgia, serif";
  ctx.globalAlpha = ready ? 0.92 : 0.56;
  ctx.fillText(state.unlocked[selected.id] ? "lit" : ready ? "E" : "sleeping", cx, cy + 236);
  ctx.globalAlpha = 1;

  for (let i = 0; i < state.skillPoints; i += 1) {
    ctx.fillStyle = p.glow;
    ctx.beginPath();
    ctx.ellipse(cx - (state.skillPoints - 1) * 7 + i * 14, cy - 216, 4, 8, 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawSkillIcon(id, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (id === "doubleJump") {
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(0, -10, 8, 4);
    ctx.moveTo(-5, 8);
    ctx.quadraticCurveTo(0, 1, 5, 8);
    ctx.stroke();
  } else if (id === "dash") {
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(5, 2);
    ctx.lineTo(0, -5);
    ctx.moveTo(5, 2);
    ctx.lineTo(0, 9);
    ctx.stroke();
  } else if (id === "glide") {
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.quadraticCurveTo(0, -12, 11, -2);
    ctx.quadraticCurveTo(2, 8, -11, -2);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 9);
    ctx.stroke();
  } else {
    for (let i = 0; i < 6; i += 1) {
      const a = i * TAU / 6;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 5, Math.sin(a) * 5, 4, 8, a, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnding(level) {
  const t = state.endingTime;
  ctx.save();
  ctx.globalAlpha = clamp(t / 2, 0, 0.78);
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, "rgba(255, 226, 154, 0.05)");
  grad.addColorStop(1, "rgba(8, 12, 16, 0.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.globalAlpha = clamp(t / 2, 0, 1);
  const cx = viewW / 2;
  const cy = viewH * 0.48;
  ctx.strokeStyle = level.palette.glow;
  ctx.lineCap = "round";
  for (let i = 0; i < 14; i += 1) {
    const grow = clamp(t * 0.34 - i * 0.035, 0, 1);
    const angle = -Math.PI / 2 + (i - 6.5) * 0.22;
    ctx.lineWidth = 8 - Math.min(i, 7) * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 170);
    ctx.quadraticCurveTo(cx + Math.cos(angle) * 110 * grow, cy + 20 - i * 7 * grow, cx + Math.cos(angle) * 290 * grow, cy - 150 * grow + Math.sin(i) * 30);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 246, 220, 0.95)";
  ctx.font = "24px Georgia, serif";
  ctx.textAlign = "center";
  wrapText("The cat finds the warm window, and the long night lets go.", cx, viewH - 96, Math.min(720, viewW - 40), 32);
  ctx.restore();
}

function drawTransition(level) {
  const alpha = clamp(state.transition, 0, 1);
  const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, 80, viewW / 2, viewH / 2, Math.max(viewW, viewH));
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(1, `rgba(5, 8, 12, ${alpha * 0.72})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  if (alpha > 0.55) {
    ctx.globalAlpha = (alpha - 0.55) / 0.45;
    ctx.textAlign = "center";
    ctx.font = "26px Georgia, serif";
    ctx.fillStyle = level.palette.glow;
    ctx.fillText(level.name, viewW / 2, viewH * 0.36);
    ctx.globalAlpha = 1;
  }
}

function drawVignette(level) {
  const grad = ctx.createRadialGradient(viewW / 2, viewH * 0.48, viewH * 0.24, viewW / 2, viewH * 0.48, Math.max(viewW, viewH) * 0.74);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
}

function measureWrappedLines(text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], x, startY + i * lineHeight);
  }
}

function roundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  updateGame(dt);
  draw();
  justPressed.clear();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", onKeyDown, { passive: false });
window.addEventListener("keyup", onKeyUp, { passive: false });
window.addEventListener("blur", () => keys.clear());

resize();
loadGame();
resetPlayerToSpawn();
showMessage(currentLevel().story, 4.6);
requestAnimationFrame(frame);
