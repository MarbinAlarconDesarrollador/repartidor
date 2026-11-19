/**
 * ============================================================================
 * EL REPARTIDOR EXPRÉS — Juego 3D de Parkour Urbano en Azoteas (Three.js + PWA)
 * ============================================================================
 * Arquitectura modular en JavaScript vanilla:
 *  1. Configuración PWA (Service Worker, botón Instalar, estado offline)
 *  2. Sintetizador de audio procedural (Web Audio API)
 *  3. Generador de texturas procedurales (Canvas 2D) y entorno PBR
 *  4. Modelo 3D articulado del repartidor (THREE.Group compuesto)
 *  5. Pool de edificios/azoteas, obstáculos, relojes y zonas de entrega
 *  6. Pool de partículas y retroalimentación visual
 *  7. Motor de físicas, carriles, entradas (Teclado + Gestos Touch) y bucle 60fps
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js';

// ============================================================================
// 1. CONSTANTES DEL JUEGO Y REFERENCIAS DEL DOM
// ============================================================================

const STORAGE_HIGHSCORE_KEY = 'repartidor_expres_highscore';
const STORAGE_MUTE_KEY = 'repartidor_expres_muted';
const STORAGE_PLAYER_KEY = 'repartidor_expres_player';
const STORAGE_AVATAR_KEY = 'repartidor_expres_avatar';
const STORAGE_RANKING_KEY = 'repartidor_expres_ranking';

const AVATARES = {
  rayo: {
    id: 'rayo',
    nombre: 'Rayo',
    c1: '#0284c7',
    c2: '#facc15',
    chaqueta: 0x0284c7,
    mochila: 0xfacc15,
    tapa: 0xeab308,
    gorra: 0xf97316,
    franja: 0x38bdf8,
    tenis: 0xf97316,
  },
  neon: {
    id: 'neon',
    nombre: 'Neón',
    c1: '#6d28d9',
    c2: '#22d3ee',
    chaqueta: 0x6d28d9,
    mochila: 0x22d3ee,
    tapa: 0x06b6d4,
    gorra: 0xe879f9,
    franja: 0x22d3ee,
    tenis: 0xe879f9,
  },
  eco: {
    id: 'eco',
    nombre: 'Eco',
    c1: '#059669',
    c2: '#a3e635',
    chaqueta: 0x059669,
    mochila: 0xa3e635,
    tapa: 0x65a30d,
    gorra: 0xfacc15,
    franja: 0x6ee7b7,
    tenis: 0x84cc16,
  },
  fuego: {
    id: 'fuego',
    nombre: 'Turbo',
    c1: '#dc2626',
    c2: '#fbbf24',
    chaqueta: 0xdc2626,
    mochila: 0xfbbf24,
    tapa: 0xd97706,
    gorra: 0x1e293b,
    franja: 0xfb923c,
    tenis: 0xef4444,
  },
};

const LANES = [-2.5, 0, 2.5];
const ROOFTOP_WIDTH = 9.4;
const INITIAL_TIME = 30.0;
const BASE_SPEED = 16.5;
const MAX_SPEED = 29.0;
const SPEED_INCREMENT_PER_DELIVERY = 0.65;
const JUMP_VELOCITY = 14.6;
const GRAVITY = 38.0;
const SLIDE_DURATION = 0.62;
const COYOTE_TIME = 0.1;
const INPUT_BUFFER_TIME = 0.13;

const ESTADOS = {
  INICIO: 'inicio',
  JUGANDO: 'jugando',
  PAUSA: 'pausa',
  FIN: 'fin',
};

const dom = {
  canvas: document.getElementById('game-canvas'),
  hud: document.getElementById('hud'),
  timerCard: document.getElementById('timer-card'),
  hudTime: document.getElementById('hud-time'),
  hudDeliveries: document.getElementById('hud-deliveries'),
  hudAvatarDot: document.getElementById('hud-avatar-dot'),
  hudPlayerName: document.getElementById('hud-player-name'),
  hudScore: document.getElementById('hud-score'),
  toastLayer: document.getElementById('toast-layer'),
  offlineBanner: document.getElementById('offline-banner'),

  screenStart: document.getElementById('screen-start'),
  inputPlayerName: document.getElementById('input-player-name'),
  avatarSelector: document.getElementById('avatar-selector'),
  startHighscore: document.getElementById('start-highscore'),
  btnStart: document.getElementById('btn-start'),
  btnRules: document.getElementById('btn-rules'),
  btnRanking: document.getElementById('btn-ranking'),
  btnInstall: document.getElementById('btn-install'),
  btnInstallLabel: document.getElementById('btn-install-label'),

  screenPause: document.getElementById('screen-pause'),
  btnResume: document.getElementById('btn-resume'),
  btnRulesPause: document.getElementById('btn-rules-pause'),
  btnRestartPause: document.getElementById('btn-restart-pause'),

  screenGameOver: document.getElementById('screen-gameover'),
  gameoverReason: document.getElementById('gameover-reason'),
  overAvatarDot: document.getElementById('over-avatar-dot'),
  overPlayerName: document.getElementById('over-player-name'),
  newRecordBadge: document.getElementById('new-record-badge'),
  overScore: document.getElementById('over-score'),
  overDeliveries: document.getElementById('over-deliveries'),
  overHighscore: document.getElementById('over-highscore'),
  btnRestart: document.getElementById('btn-restart'),
  btnRankingOver: document.getElementById('btn-ranking-over'),
  btnMenu: document.getElementById('btn-menu'),

  modalRanking: document.getElementById('modal-ranking'),
  rankingList: document.getElementById('ranking-list'),
  btnCloseRanking: document.getElementById('btn-close-ranking'),

  modalRules: document.getElementById('modal-rules'),
  btnCloseRules: document.getElementById('btn-close-rules'),

  modalIos: document.getElementById('modal-ios'),
  btnCloseIos: document.getElementById('btn-close-ios'),

  btnMute: document.getElementById('btn-mute'),
  iconSoundOn: document.getElementById('icon-sound-on'),
  iconSoundOff: document.getElementById('icon-sound-off'),
  btnPause: document.getElementById('btn-pause'),
};

// ============================================================================
// 2. UTILIDADES SEGURAS DE ALMACENAMIENTO Y PWA
// ============================================================================

function leerStorage(clave, defecto) {
  try {
    const val = localStorage.getItem(clave);
    return val !== null ? val : defecto;
  } catch {
    return defecto;
  }
}

function guardarStorage(clave, valor) {
  try {
    localStorage.setItem(clave, String(valor));
  } catch {
    // Ignorar en contextos donde localStorage esté restringido
  }
}

function inicializarPWA() {
  // Registrar Service Worker para funcionamiento offline
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Silencioso si el entorno bloquea SW
      });
    });
  }

  // Indicador de estado sin conexión
  const actualizarEstadoRed = () => {
    dom.offlineBanner.classList.toggle('hidden', navigator.onLine);
  };
  window.addEventListener('online', actualizarEstadoRed);
  window.addEventListener('offline', actualizarEstadoRed);
  actualizarEstadoRed();

  // Control del botón de instalación en el menú principal
  let deferredPrompt = null;
  const esStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const esIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  if (esStandalone) {
    dom.btnInstall.classList.add('hidden');
    return;
  }

  if (esIOS) {
    dom.btnInstallLabel.textContent = 'INSTALAR EN IPHONE / IPAD';
    dom.btnInstall.classList.remove('hidden');
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    dom.btnInstallLabel.textContent = 'INSTALAR APP (PWA)';
    dom.btnInstall.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    dom.btnInstall.classList.add('hidden');
  });

  dom.btnInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        dom.btnInstall.classList.add('hidden');
      }
    } else if (esIOS) {
      dom.modalIos.classList.remove('hidden');
    }
  });

  dom.btnCloseIos.addEventListener('click', () => {
    dom.modalIos.classList.add('hidden');
  });
}

// ============================================================================
// 3. SINTETIZADOR DE AUDIO PROCEDURAL (WEB AUDIO API)
// ============================================================================

class AudioFX {
  constructor() {
    this.ctx = null;
    this.muted = leerStorage(STORAGE_MUTE_KEY, '0') === '1';
    this.actualizarIcono();
  }

  desbloquear() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  alternarMute() {
    this.muted = !this.muted;
    guardarStorage(STORAGE_MUTE_KEY, this.muted ? '1' : '0');
    this.actualizarIcono();
  }

  actualizarIcono() {
    dom.iconSoundOn.classList.toggle('hidden', this.muted);
    dom.iconSoundOff.classList.toggle('hidden', !this.muted);
  }

  tono(freqStart, freqEnd, duracion, tipo = 'sine', ganancia = 0.14, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duracion);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(ganancia, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duracion + 0.02);
  }

  paso() {
    this.tono(130, 80, 0.045, 'triangle', 0.045);
  }

  cambioCarril() {
    this.tono(240, 380, 0.075, 'sine', 0.08);
  }

  salto() {
    this.tono(210, 520, 0.16, 'triangle', 0.14);
  }

  aterrizaje() {
    this.tono(140, 65, 0.09, 'sine', 0.11);
  }

  deslizar() {
    this.tono(320, 110, 0.18, 'sawtooth', 0.06);
  }

  reloj() {
    this.tono(587.33, 659.25, 0.09, 'triangle', 0.15, 0);
    this.tono(880, 1046.5, 0.16, 'triangle', 0.15, 0.07);
  }

  entrega() {
    this.tono(523.25, 523.25, 0.1, 'triangle', 0.15, 0);
    this.tono(659.25, 659.25, 0.1, 'triangle', 0.15, 0.07);
    this.tono(783.99, 1046.5, 0.22, 'triangle', 0.17, 0.14);
  }

  choque() {
    this.tono(160, 42, 0.28, 'sawtooth', 0.22);
    this.tono(95, 38, 0.3, 'square', 0.14, 0.02);
  }

  caida() {
    this.tono(420, 120, 0.42, 'sine', 0.15);
  }
}

// ============================================================================
// 4. DETECCIÓN DE WEBGL POR SOFTWARE Y TEXTURAS PROCEDURALES
// ============================================================================

const isSoftwareGl = (() => {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

function crearTexturaCieloDegradado() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#0f2347');
  grad.addColorStop(0.32, '#1e4b85');
  grad.addColorStop(0.62, '#4ea3d8');
  grad.addColorStop(0.84, '#f6a87b');
  grad.addColorStop(1.0, '#fbbf85');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function crearTexturaFachadaRealista(estilo, maxAniso) {
  const W = 512;
  const H = 1024;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = W;
  albedoCanvas.height = H;
  const ctx = albedoCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = W;
  roughCanvas.height = H;
  const rCtx = roughCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bCtx = bumpCanvas.getContext('2d');

  // 1) Base del revestimiento arquitectónico (ladrillo, concreto o muro cortina)
  ctx.fillStyle = estilo.pared;
  ctx.fillRect(0, 0, W, H);
  rCtx.fillStyle = estilo.cristalDominante ? '#9a9a9a' : '#e0e0e0';
  rCtx.fillRect(0, 0, W, H);
  bCtx.fillStyle = '#c8c8c8';
  bCtx.fillRect(0, 0, W, H);

  // Textura de paneles / ladrillos y sutil desgaste vertical
  for (let y = 0; y < H; y += 16) {
    ctx.fillStyle = y % 64 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, W, 2);
    bCtx.fillStyle = y % 64 === 0 ? '#707070' : '#a8a8a8';
    bCtx.fillRect(0, y, W, 2);
  }
  for (let x = 0; x < W; x += 64) {
    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    ctx.fillRect(x, 0, 2, H);
    bCtx.fillStyle = '#909090';
    bCtx.fillRect(x, 0, 2, H);
  }

  // Ruido sutil de concreto / ladrillo
  for (let i = 0; i < 3200; i++) {
    const nx = (i * 97) % W;
    const ny = (i * 193) % H;
    const claro = i % 2 === 0;
    ctx.fillStyle = claro ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(nx, ny, 4, 3);
  }

  // 2) Pisos, cornisas y ventanas empotradas con marcos, persianas y reflejos
  const pisos = 14;
  const cols = 8;
  const margenX = 16;
  const margenY = 18;
  const pasoX = (W - margenX * 2) / cols;
  const pasoY = (H - margenY * 2) / pisos;

  for (let r = 0; r < pisos; r++) {
    const pisoY = margenY + r * pasoY;

    // Losa o cornisa entre pisos
    ctx.fillStyle = estilo.losa;
    ctx.fillRect(0, pisoY - 8, W, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, pisoY - 8, W, 2);
    bCtx.fillStyle = '#efefef';
    bCtx.fillRect(0, pisoY - 8, W, 9);

    for (let c = 0; c < cols; c++) {
      const wx = margenX + c * pasoX + 6;
      const wy = pisoY + 6;
      const ww = pasoX - 12;
      const wh = pasoY - 19;

      // Sombra de alféizar y hueco empotrado
      ctx.fillStyle = 'rgba(10, 15, 28, 0.72)';
      ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      bCtx.fillStyle = '#383838';
      bCtx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);

      // Alféizar inferior iluminado
      ctx.fillStyle = estilo.losa;
      ctx.fillRect(wx - 4, wy + wh + 2, ww + 8, 4);
      bCtx.fillStyle = '#ffffff';
      bCtx.fillRect(wx - 4, wy + wh + 2, ww + 8, 4);

      // Cristal interior: mezcla de oficinas encendidas cálidas, cian y oscuras
      const hash = (r * 17 + c * 31 + estilo.semilla) % 11;
      let vidrioColor = estilo.vidrioOscuro;
      if (hash === 0 || hash === 4) vidrioColor = '#fde68a';
      else if (hash === 7) vidrioColor = '#fed7aa';
      else if (hash === 2 || hash === 9) vidrioColor = estilo.vidrioTinte;

      ctx.fillStyle = vidrioColor;
      ctx.fillRect(wx, wy, ww, wh);

      // Persianas / interior en parte superior de algunas ventanas
      if (hash !== 0 && hash !== 4) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.fillRect(wx, wy, ww, wh * ((hash % 3) * 0.16 + 0.14));
      }

      // Reflejo diagonal del cielo en el cristal
      const gradRef = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      gradRef.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
      gradRef.addColorStop(0.55, 'rgba(255, 255, 255, 0.04)');
      gradRef.addColorStop(1, 'rgba(15, 23, 42, 0.12)');
      ctx.fillStyle = gradRef;
      ctx.fillRect(wx, wy, ww, wh);

      // Parteluz central de ventana
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(wx + ww * 0.5 - 1.5, wy, 3, wh);
      ctx.fillRect(wx, wy + wh * 0.52, ww, 2);

      // Mapa de rugosidad: cristal muy liso y brillante (negro = ~0.12)
      rCtx.fillStyle = '#242424';
      rCtx.fillRect(wx, wy, ww, wh);
    }
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAniso;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAniso;

  return { map, roughnessMap, bumpMap };
}

function crearTexturaHorizonte(maxAniso) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = 256;
  emCanvas.height = 512;
  const eCtx = emCanvas.getContext('2d');

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 512);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 512);

  for (let r = 0; r < 24; r++) {
    for (let c = 0; c < 10; c++) {
      const wx = 10 + c * 24;
      const wy = 10 + r * 20;
      const h = (r * 19 + c * 7) % 10;
      ctx.fillStyle = h < 3 ? '#fde68a' : h < 5 ? '#7dd3fc' : '#0f172a';
      ctx.fillRect(wx, wy, 14, 12);

      if (h < 3) {
        eCtx.fillStyle = '#f59e0b';
        eCtx.fillRect(wx, wy, 14, 12);
      } else if (h === 3) {
        eCtx.fillStyle = '#38bdf8';
        eCtx.fillRect(wx, wy, 14, 12);
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAniso;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;

  return { map, emissiveMap };
}

function crearTexturaAzotea(maxAniso) {
  const W = 512;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bCtx = bumpCanvas.getContext('2d');

  // Membrana bituminosa / grava gris pizarra
  ctx.fillStyle = '#384354';
  ctx.fillRect(0, 0, W, H);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, W, H);

  // Grano realista de grava en la azotea
  for (let i = 0; i < 4200; i++) {
    const gx = (i * 73) % W;
    const gy = (i * 137) % H;
    const claro = i % 2 === 0;
    ctx.fillStyle = claro ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(gx, gy, 3, 3);
    bCtx.fillStyle = claro ? '#989898' : '#656565';
    bCtx.fillRect(gx, gy, 3, 3);
  }

  // Juntas de losas de concreto centrales (zona de carrera)
  ctx.fillStyle = '#475569';
  ctx.fillRect(68, 0, 376, H);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
  for (let y = 0; y < H; y += 64) {
    ctx.fillRect(68, y, 376, 3);
    bCtx.fillStyle = '#454545';
    bCtx.fillRect(68, y, 376, 3);
  }
  for (const jx of [186, 326]) {
    ctx.fillRect(jx - 1, 0, 2, H);
    bCtx.fillStyle = '#505050';
    bCtx.fillRect(jx - 1, 0, 2, H);
  }

  // Líneas discontinuas sutiles para guiar los 3 carriles
  ctx.fillStyle = 'rgba(241, 245, 249, 0.24)';
  for (const gx of [186, 326]) {
    for (let y = 16; y < H; y += 64) {
      ctx.fillRect(gx - 3, y, 6, 34);
    }
  }

  // Franjas laterales de seguridad
  ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.fillRect(24, 0, 10, H);
  ctx.fillRect(478, 0, 10, H);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAniso;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAniso;

  return { map, bumpMap };
}

function crearDecoracionAzoteaLateral(tipo, materiales) {
  const group = new THREE.Group();
  if (tipo === 0) {
    // Torre de agua clásica de madera y acero sobre 4 patas
    const plataforma = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 1.7), materiales.concretoClaro);
    plataforma.position.y = 0.07;
    group.add(plataforma);

    for (const sx of [-0.52, 0.52]) {
      for (const sz of [-0.52, 0.52]) {
        const pata = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.15, 0.11), materiales.metalOscuro);
        pata.position.set(sx, 0.65, sz);
        pata.castShadow = true;
        group.add(pata);
      }
    }

    const tanque = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.35, 14), materiales.maderaTanque);
    tanque.position.y = 1.85;
    tanque.castShadow = true;
    tanque.receiveShadow = true;
    group.add(tanque);

    for (const bandY of [1.45, 1.85, 2.25]) {
      const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 14), materiales.metalOscuro);
      aro.position.y = bandY;
      group.add(aro);
    }

    const techo = new THREE.Mesh(new THREE.ConeGeometry(0.76, 0.52, 14), materiales.metalOscuro);
    techo.position.y = 2.78;
    techo.castShadow = true;
    group.add(techo);
  } else if (tipo === 1) {
    // Caseta de ascensor / acceso a azotea + antena con baliza roja
    const caseta = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.75, 2.2), materiales.concretoClaro);
    caseta.position.y = 0.875;
    caseta.castShadow = true;
    caseta.receiveShadow = true;

    const techo = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.16, 2.36), materiales.metalOscuro);
    techo.position.y = 1.82;

    const puerta = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.75), materiales.metalOscuro);
    puerta.position.set(-0.83, 0.65, 0);

    const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 2.4, 8), materiales.acTapa);
    mastil.position.set(0.25, 3.0, -0.5);

    const baliza = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), materiales.balizaRoja);
    baliza.position.set(0.25, 4.22, -0.5);

    group.add(caseta, techo, puerta, mastil, baliza);
  } else {
    // Batería industrial de climatización con chimenea de extracción
    const bloque = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 2.4), materiales.acGris);
    bloque.position.y = 0.525;
    bloque.castShadow = true;
    bloque.receiveShadow = true;

    const rejilla = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.68, 1.7), materiales.metalOscuro);
    rejilla.position.set(-0.76, 0.55, 0);

    const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 12), materiales.acTapa);
    tubo.position.set(0.15, 1.5, 0.55);

    group.add(bloque, rejilla, tubo);
  }
  return group;
}

function crearTexturaSombraContacto() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.65)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.25)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// 5. MODELO 3D COMPUESTO DEL REPARTIDOR (THREE.Group ARTICULADO)
// ============================================================================

function crearRepartidor() {
  const root = new THREE.Group(); // Pivote en la base (y = 0)
  const bodyPivot = new THREE.Group(); // Para inclinación, agachado y squash-stretch
  root.add(bodyPivot);

  // Materiales diferenciados por rugosidad y metalicidad
  const matChaqueta = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.65,
    metalness: 0.05,
  });
  const matFranja = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.2,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.15,
  });
  const matPantalon = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.0,
  });
  const matPiel = new THREE.MeshStandardMaterial({
    color: 0xf1c27d,
    roughness: 0.72,
    metalness: 0.0,
  });
  const matMochila = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.38,
    metalness: 0.1,
  });
  const matMochilaTapa = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.42,
    metalness: 0.1,
  });
  const matGorra = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.52,
    metalness: 0.05,
  });
  const matVisor = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.85,
    clearcoat: 1.0,
  });
  const matTenis = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.6,
    metalness: 0.05,
  });
  const matSuela = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.75,
    metalness: 0.0,
  });

  // 1) Torso
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.96, 0);
  bodyPivot.add(torsoGroup);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.64, 0.34), matChaqueta);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Franja reflectante en el pecho
  const franjaPecho = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.36), matFranja);
  franjaPecho.position.set(0, 0.06, 0);
  torsoGroup.add(franjaPecho);

  // 2) Mochila cúbica amarilla brillante (icónica del repartidor)
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 0.05, 0.37);
  torsoGroup.add(backpackGroup);

  const packBody = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.56, 0.44), matMochila);
  packBody.castShadow = true;
  packBody.receiveShadow = true;
  backpackGroup.add(packBody);

  const packLid = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.1, 0.47), matMochilaTapa);
  packLid.position.set(0, 0.25, 0);
  packLid.castShadow = true;
  backpackGroup.add(packLid);

  const packStripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.04), matFranja);
  packStripe.position.set(0, -0.05, 0.22);
  backpackGroup.add(packStripe);

  // 3) Cabeza + Gorra con visera + Gafas
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.52, 0);
  torsoGroup.add(headGroup);

  const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), matPiel);
  cabeza.castShadow = true;
  headGroup.add(cabeza);

  const gafas = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.06), matVisor);
  gafas.position.set(0, 0.03, -0.19);
  headGroup.add(gafas);

  const gorraCopa = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.16, 0.41), matGorra);
  gorraCopa.position.set(0, 0.18, 0);
  gorraCopa.castShadow = true;
  headGroup.add(gorraCopa);

  const gorraVisera = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.05, 0.24), matGorra);
  gorraVisera.position.set(0, 0.12, -0.27);
  gorraVisera.castShadow = true;
  headGroup.add(gorraVisera);

  // 4) Brazos articulados (pivote en hombros)
  const crearBrazo = (lado) => {
    const hombro = new THREE.Group();
    hombro.position.set(lado * 0.37, 0.24, 0);
    const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.16), matChaqueta);
    brazo.position.set(0, -0.22, 0);
    brazo.castShadow = true;
    const mano = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.14), matPiel);
    mano.position.set(0, -0.49, 0);
    hombro.add(brazo, mano);
    torsoGroup.add(hombro);
    return hombro;
  };
  const armL = crearBrazo(-1);
  const armR = crearBrazo(1);

  // 5) Piernas articuladas + zapatillas (pivote en cadera, y = 0.64)
  const crearPierna = (lado) => {
    const cadera = new THREE.Group();
    cadera.position.set(lado * 0.16, 0.64, 0);

    const pierna = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 0.2), matPantalon);
    pierna.position.set(0, -0.24, 0);
    pierna.castShadow = true;

    const tenis = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.12, 0.3), matTenis);
    tenis.position.set(0, -0.52, -0.04);
    tenis.castShadow = true;

    const suela = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.31), matSuela);
    suela.position.set(0, -0.605, -0.04);

    cadera.add(pierna, tenis, suela);
    bodyPivot.add(cadera);
    return cadera;
  };
  const legL = crearPierna(-1);
  const legR = crearPierna(1);

  return {
    root,
    bodyPivot,
    torsoGroup,
    headGroup,
    armL,
    armR,
    legL,
    legR,
    mats: {
      matChaqueta,
      matFranja,
      matMochila,
      matMochilaTapa,
      matGorra,
      matTenis,
    },
  };
}

// ============================================================================
// 6. CONSTRUCTORES DE OBSTÁCULOS Y COLECCIONABLES COMPUESTOS
// ============================================================================

function crearObstaculoBajo(tipo, materiales) {
  const group = new THREE.Group();
  if (tipo === 'ac') {
    // Aire acondicionado industrial sobre rieles
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.15), materiales.metalOscuro);
    base.position.y = 0.06;
    const carcasa = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.84, 1.04), materiales.acGris);
    carcasa.position.y = 0.54;
    carcasa.castShadow = true;
    carcasa.receiveShadow = true;

    const rejilla = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12),
      materiales.metalOscuro
    );
    rejilla.rotation.x = Math.PI / 2;
    rejilla.position.set(0, 0.54, 0.52);

    const aspa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.04), materiales.alertaNaranja);
    aspa.position.set(0, 0.54, 0.56);
    group.userData.fan = aspa;

    const tapaSup = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 1.1), materiales.acTapa);
    tapaSup.position.y = 0.98;
    group.add(base, carcasa, rejilla, aspa, tapaSup);
  } else {
    // Muro bajo con franja de precaución
    const muro = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.85), materiales.muroConcreto);
    muro.position.y = 0.425;
    muro.castShadow = true;
    muro.receiveShadow = true;

    const remate = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.16, 0.92), materiales.alertaAmarillo);
    remate.position.y = 0.92;
    remate.castShadow = true;
    group.add(muro, remate);
  }

  group.userData.kind = 'low';
  group.userData.halfW = 0.78;
  group.userData.halfD = 0.52;
  group.userData.minY = 0;
  group.userData.maxY = 1.0;
  return group;
}

function crearObstaculoAlto(materiales) {
  // Tubería aérea o viga sobre postes laterales (el jugador pasa deslizándose por debajo)
  const group = new THREE.Group();

  const posteIzq = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.35, 0.24), materiales.metalOscuro);
  posteIzq.position.set(-1.02, 1.175, 0);
  posteIzq.castShadow = true;

  const posteDer = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.35, 0.24), materiales.metalOscuro);
  posteDer.position.set(1.02, 1.175, 0);
  posteDer.castShadow = true;

  const tuberia = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 2.25, 14),
    materiales.tuboNaranja
  );
  tuberia.rotation.z = Math.PI / 2;
  tuberia.position.set(0, 1.62, 0);
  tuberia.castShadow = true;

  const brida1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 14), materiales.metalOscuro);
  brida1.rotation.z = Math.PI / 2;
  brida1.position.set(-0.55, 1.62, 0);

  const brida2 = brida1.clone();
  brida2.position.set(0.55, 1.62, 0);

  const panelAviso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, 0.1), materiales.alertaAmarillo);
  panelAviso.position.set(0, 1.25, 0.38);

  group.add(posteIzq, posteDer, tuberia, brida1, brida2, panelAviso);
  group.userData.kind = 'high';
  group.userData.halfW = 0.85;
  group.userData.halfD = 0.42;
  group.userData.minY = 1.06; // Permite pasar agachado (hitbox agachado <= 0.78)
  group.userData.maxY = 2.45;
  return group;
}

function crearRelojVerde(materiales) {
  const group = new THREE.Group();

  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 10, 22), materiales.relojBorde);
  const esfera = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 18), materiales.relojEsfera);
  esfera.rotation.x = Math.PI / 2;

  const manecilla1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.14), materiales.blancoBrillante);
  manecilla1.position.set(0, 0.08, 0);
  const manecilla2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.14), materiales.blancoBrillante);
  manecilla2.position.set(0.06, 0, 0);

  const corona = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10), materiales.oroBrillante);
  corona.position.set(0, 0.52, 0);

  group.add(aro, esfera, manecilla1, manecilla2, corona);
  group.userData.kind = 'clock';
  group.userData.collected = false;
  return group;
}

function crearZonaEntrega(materiales) {
  const group = new THREE.Group();

  // Aro luminoso vertical que el jugador atraviesa
  const aroExterior = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.1, 12, 28), materiales.entregaAro);
  aroExterior.position.y = 1.28;

  const aroInterior = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 8, 24), materiales.entregaCian);
  aroInterior.position.y = 1.28;

  // Plataforma / marca de aterrizaje en la azotea (con polygonOffset para evitar z-fighting)
  const pad = new THREE.Mesh(new THREE.RingGeometry(0.65, 1.05, 24), materiales.entregaPad);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.03;

  // Paquete flotante en el centro del aro
  const paquete = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), materiales.oroBrillante);
  paquete.position.y = 1.28;
  group.userData.parcel = paquete;

  group.add(aroExterior, aroInterior, pad, paquete);
  group.userData.kind = 'delivery';
  group.userData.collected = false;
  return group;
}

// ============================================================================
// 7. CLASE PRINCIPAL DEL JUEGO (Escena, Pool, Físicas, Entradas, Loop)
// ============================================================================

class RepartidorGame {
  constructor() {
    this.audio = new AudioFX();
    this.estado = ESTADOS.INICIO;
    this.highScore = Number(leerStorage(STORAGE_HIGHSCORE_KEY, '0')) || 0;
    this.ranking = this.cargarRanking();
    this.playerName = leerStorage(STORAGE_PLAYER_KEY, '');
    const savedAvatar = leerStorage(STORAGE_AVATAR_KEY, 'rayo');
    this.avatarId = AVATARES[savedAvatar] ? savedAvatar : 'rayo';

    // Vectores temporales reutilizables (cero GC en el loop)
    this._vecA = new THREE.Vector3();
    this._vecB = new THREE.Vector3();

    this.initRenderer();
    this.initScene();
    this.initMaterials();
    this.initPlayer();
    this.initPools();
    this.initInput();

    if (dom.inputPlayerName) {
      dom.inputPlayerName.value = this.playerName;
    }
    this.aplicarAvatar(this.avatarId);
    this.actualizarHighscoreUI();

    this.resetGameState();
    this.onResize();

    this.clock = new THREE.Clock();
    this.frameId = 0;
    this.startLoop();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: dom.canvas,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = crearTexturaCieloDegradado();
    this.scene.fog = new THREE.Fog(0xf29f79, 44, 132);

    // Entorno PBR procedural obligatorio (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 5.2, 8.8);

    // Iluminación equilibrada cálida/fría
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x3b2f4a, 0.85);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.sunLight.position.set(14, 24, 12);
    this.sunLight.castShadow = !isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 75;
    const d = 18;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-12, 8, -14);
    this.scene.add(rimLight);
  }

  initMaterials() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.azoteaBaseMaps = crearTexturaAzotea(maxAniso);

    // Estilos arquitectónicos realistas (ladrillo urbano, cristal corporativo, concreto, etc.)
    const estilos = [
      { pared: '#475569', losa: '#64748b', vidrioOscuro: '#1e3a5f', vidrioTinte: '#38bdf8', cristalDominante: false, semilla: 1 },
      { pared: '#7c3a26', losa: '#9a8478', vidrioOscuro: '#1e293b', vidrioTinte: '#7dd3fc', cristalDominante: false, semilla: 3 },
      { pared: '#243b55', losa: '#475569', vidrioOscuro: '#1b4965', vidrioTinte: '#67e8f9', cristalDominante: true, semilla: 5 },
      { pared: '#6b645c', losa: '#948d84', vidrioOscuro: '#273549', vidrioTinte: '#93c5fd', cristalDominante: false, semilla: 7 },
      { pared: '#2c303a', losa: '#525866', vidrioOscuro: '#172554', vidrioTinte: '#7dd3fc', cristalDominante: true, semilla: 11 },
    ];

    this.buildingTextureSets = estilos.map((e) => crearTexturaFachadaRealista(e, maxAniso));

    this.parapetMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.78,
      metalness: 0.08,
    });

    this.copingMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.42,
      metalness: 0.55,
    });

    this.edgeWarnMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.45,
      metalness: 0.1,
    });

    this.propMaterials = {
      metalOscuro: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.72 }),
      acGris: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.52, metalness: 0.35 }),
      acTapa: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.48, metalness: 0.25 }),
      concretoClaro: new THREE.MeshStandardMaterial({ color: 0x7c8798, roughness: 0.85, metalness: 0.05 }),
      maderaTanque: new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.86, metalness: 0.02 }),
      balizaRoja: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.2,
        metalness: 0.1,
        emissive: 0xef4444,
        emissiveIntensity: 1.4,
      }),
      muroConcreto: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.04 }),
      tuboNaranja: new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.36, metalness: 0.45 }),
      alertaAmarillo: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.4,
        metalness: 0.1,
        emissive: 0x854d0e,
        emissiveIntensity: 0.25,
      }),
      alertaNaranja: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.2 }),
      relojBorde: new THREE.MeshStandardMaterial({
        color: 0x10b981,
        roughness: 0.28,
        metalness: 0.55,
        emissive: 0x059669,
        emissiveIntensity: 0.45,
      }),
      relojEsfera: new THREE.MeshStandardMaterial({
        color: 0xecfdf5,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0x34d399,
        emissiveIntensity: 0.25,
      }),
      blancoBrillante: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.2 }),
      oroBrillante: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.22,
        metalness: 0.75,
        emissive: 0xca8a04,
        emissiveIntensity: 0.35,
      }),
      entregaAro: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.2,
        metalness: 0.6,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.65,
      }),
      entregaCian: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.2,
        metalness: 0.5,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.75,
      }),
      entregaPad: new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    };

    // Horizonte urbano con rascacielos iluminados (InstancedMesh)
    const skyTex = crearTexturaHorizonte(maxAniso);
    skyTex.map.repeat.set(2, 4);
    skyTex.emissiveMap.repeat.set(2, 4);

    const skyGeo = new THREE.BoxGeometry(1, 1, 1);
    const skyMat = new THREE.MeshStandardMaterial({
      map: skyTex.map,
      emissive: 0xffffff,
      emissiveMap: skyTex.emissiveMap,
      emissiveIntensity: 0.55,
      roughness: 0.65,
      metalness: 0.25,
    });

    this.bgSkylineCount = 52;
    this.bgSkyline = new THREE.InstancedMesh(skyGeo, skyMat, this.bgSkylineCount);
    this.bgSkyline.frustumCulled = false;

    const pentMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.3,
    });
    this.bgPenthouses = new THREE.InstancedMesh(skyGeo, pentMat, this.bgSkylineCount);
    this.bgPenthouses.frustumCulled = false;

    this.bgData = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.bgSkylineCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tier = i % 4;
      const x = side * (14.5 + tier * 7.8 + ((i * 13) % 5));
      const w = 7.5 + (i % 4) * 2.6;
      const h = 40 + (i % 7) * 8.5;
      const d = 8.5 + (i % 3) * 4.2;
      const z = -Math.floor(i / 2) * 9.5 + 18;
      this.bgData.push({ x, w, h, d, z, z0: z });

      dummy.position.set(x, h * 0.5 - 38, z);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      this.bgSkyline.setMatrixAt(i, dummy.matrix);

      // Corona o cuarto de máquinas en la cima del rascacielos lejano
      dummy.position.set(x, h - 38 + 1.4, z);
      dummy.scale.set(w * 0.52, 2.8, d * 0.52);
      dummy.updateMatrix();
      this.bgPenthouses.setMatrixAt(i, dummy.matrix);
    }
    this.bgSkyline.instanceMatrix.needsUpdate = true;
    this.bgPenthouses.instanceMatrix.needsUpdate = true;
    this.scene.add(this.bgSkyline, this.bgPenthouses);

    // Suelo profundo de avenida entre edificios para dar sensación real de altura
    this.streetPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 260),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95, metalness: 0.05 })
    );
    this.streetPlane.rotation.x = -Math.PI / 2;
    this.streetPlane.position.y = -36;
    this.scene.add(this.streetPlane);
  }

  initPlayer() {
    this.player = crearRepartidor();
    this.scene.add(this.player.root);

    // Sombra de contacto proyectada sobre la azotea
    const shadowTex = crearTexturaSombraContacto();
    this.contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      })
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.025;
    this.scene.add(this.contactShadow);
  }

  initPools() {
    // Pool de edificios/azoteas arquitectónicas reutilizables
    this.buildingPool = [];
    const poolSize = 12;
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const edgeGeo = new THREE.BoxGeometry(ROOFTOP_WIDTH - 0.6, 0.24, 0.36);

    for (let i = 0; i < poolSize; i++) {
      const group = new THREE.Group();
      const texSet = this.buildingTextureSets[i % this.buildingTextureSets.length];

      // Clonar textura por instancia de pool para escalar repeat sin deformar ventanas
      const fMap = texSet.map.clone();
      fMap.needsUpdate = true;
      const fRough = texSet.roughnessMap.clone();
      fRough.needsUpdate = true;
      const fBump = texSet.bumpMap.clone();
      fBump.needsUpdate = true;

      const matBody = new THREE.MeshStandardMaterial({
        map: fMap,
        roughnessMap: fRough,
        bumpMap: fBump,
        bumpScale: 0.14,
        roughness: 1.0,
        metalness: 0.15,
      });

      const rMap = this.azoteaBaseMaps.map.clone();
      rMap.needsUpdate = true;
      const rBump = this.azoteaBaseMaps.bumpMap.clone();
      rBump.needsUpdate = true;

      const matRoof = new THREE.MeshStandardMaterial({
        map: rMap,
        bumpMap: rBump,
        bumpScale: 0.06,
        roughness: 0.85,
        metalness: 0.05,
      });

      const body = new THREE.Mesh(unitBox, matBody);
      body.receiveShadow = true;

      // Cornisa superior arquitectónica que sobresale ligeramente debajo de la azotea
      const cornice = new THREE.Mesh(unitBox, this.parapetMaterial);
      cornice.receiveShadow = true;

      // Superficie superior de la azotea
      const roofTop = new THREE.Mesh(unitBox, matRoof);
      roofTop.receiveShadow = true;

      // Pretiles laterales + remates metálicos + barandillas de seguridad
      const parapetL = new THREE.Mesh(unitBox, this.parapetMaterial);
      const parapetR = new THREE.Mesh(unitBox, this.parapetMaterial);
      parapetL.castShadow = true;
      parapetR.castShadow = true;

      const copingL = new THREE.Mesh(unitBox, this.copingMaterial);
      const copingR = new THREE.Mesh(unitBox, this.copingMaterial);
      const railL = new THREE.Mesh(unitBox, this.copingMaterial);
      const railR = new THREE.Mesh(unitBox, this.copingMaterial);
      const railPosts = [];
      for (let p = 0; p < 10; p++) {
        const post = new THREE.Mesh(unitBox, this.copingMaterial);
        post.scale.set(0.06, 0.3, 0.06);
        group.add(post);
        railPosts.push(post);
      }

      // Franjas amarillas de borde al inicio y final de la azotea
      const warnFront = new THREE.Mesh(edgeGeo, this.edgeWarnMaterial);
      const warnBack = new THREE.Mesh(edgeGeo, this.edgeWarnMaterial);

      // Alas arquitectónicas laterales escalonadas (fuera de la pista, dan volumen real de edificio)
      const wingL = new THREE.Mesh(unitBox, matBody);
      const wingR = new THREE.Mesh(unitBox, matBody);
      const balconyL = new THREE.Mesh(unitBox, this.parapetMaterial);
      const balconyR = new THREE.Mesh(unitBox, this.parapetMaterial);

      // Elementos reales de azotea (tanque de agua, caseta de ascensor, HVAC) en el balcón lateral
      const decorL = crearDecoracionAzoteaLateral(i % 3, this.propMaterials);
      const decorR = crearDecoracionAzoteaLateral((i + 1) % 3, this.propMaterials);

      group.add(
        body,
        cornice,
        roofTop,
        parapetL,
        parapetR,
        copingL,
        copingR,
        railL,
        railR,
        warnFront,
        warnBack,
        wingL,
        wingR,
        balconyL,
        balconyR,
        decorL,
        decorR
      );
      group.visible = false;
      this.scene.add(group);

      this.buildingPool.push({
        group,
        body,
        cornice,
        roofTop,
        parapetL,
        parapetR,
        copingL,
        copingR,
        railL,
        railR,
        railPosts,
        warnFront,
        warnBack,
        wingL,
        wingR,
        balconyL,
        balconyR,
        decorL,
        decorR,
        facadeMaps: [fMap, fRough, fBump],
        roofMaps: [rMap, rBump],
        active: false,
        zStart: 0, // Borde cercano (mayor Z)
        zEnd: 0,   // Borde lejano (menor Z, hacia -Z)
        length: 20,
        items: [],
      });
    }

    // Pools de obstáculos y coleccionables
    this.lowObstaclePool = [];
    this.highObstaclePool = [];
    this.clockPool = [];
    this.deliveryPool = [];

    for (let i = 0; i < 14; i++) {
      const low = crearObstaculoBajo(i % 2 === 0 ? 'ac' : 'wall', this.propMaterials);
      low.visible = false;
      this.scene.add(low);
      this.lowObstaclePool.push(low);
    }
    for (let i = 0; i < 10; i++) {
      const high = crearObstaculoAlto(this.propMaterials);
      high.visible = false;
      this.scene.add(high);
      this.highObstaclePool.push(high);
    }
    for (let i = 0; i < 14; i++) {
      const clk = crearRelojVerde(this.propMaterials);
      clk.visible = false;
      this.scene.add(clk);
      this.clockPool.push(clk);
    }
    for (let i = 0; i < 6; i++) {
      const del = crearZonaEntrega(this.propMaterials);
      del.visible = false;
      this.scene.add(del);
      this.deliveryPool.push(del);
    }

    // Pool de partículas para ráfagas de impacto/recolección
    this.particles = [];
    const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    for (let i = 0; i < 48; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        active: false,
      });
    }
  }

  spawnParticles(x, y, z, colorHex, count = 10, speed = 5.5) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.25;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(1);
      p.mesh.material.color.setHex(colorHex);
      p.mesh.material.opacity = 1;
      p.vel.set(
        (Math.random() - 0.5) * speed * 1.6,
        Math.random() * speed + 1.5,
        (Math.random() - 0.5) * speed
      );
      spawned++;
    }
  }

  obtenerDePool(pool) {
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].visible) {
        pool[i].visible = true;
        return pool[i];
      }
    }
    return null;
  }

  liberarItemsDeEdificio(building) {
    for (const item of building.items) {
      item.visible = false;
    }
    building.items.length = 0;
  }

  colocarEdificio(zStart, length, esInicial = false) {
    const b = this.buildingPool.find((item) => !item.active);
    if (!b) return null;

    b.active = true;
    b.zStart = zStart;
    b.zEnd = zStart - length;
    b.length = length;
    b.group.visible = true;

    const alturaEdificio = 42;
    const zCenter = zStart - length * 0.5;

    // Escalar texturas de fachada y azotea para evitar deformación según el largo
    const repZ = Math.max(1, Math.round(length / 11));
    for (const tex of b.facadeMaps) {
      tex.repeat.set(repZ, 2);
    }
    for (const tex of b.roofMaps) {
      tex.repeat.set(1, Math.max(1, Math.round(length / 10)));
    }

    // Cuerpo del edificio (cara superior bajo la losa de la azotea)
    b.body.scale.set(ROOFTOP_WIDTH, alturaEdificio, length);
    b.body.position.set(0, -alturaEdificio * 0.5 - 0.24, zCenter);

    // Cornisa sobresaliente alrededor del edificio
    b.cornice.scale.set(ROOFTOP_WIDTH + 0.55, 0.34, length + 0.45);
    b.cornice.position.set(0, -0.32, zCenter);

    // Superficie superior de la azotea (y = 0)
    b.roofTop.scale.set(ROOFTOP_WIDTH, 0.22, length);
    b.roofTop.position.set(0, -0.11, zCenter);

    // Pretiles laterales, remates metálicos y barandillas de seguridad
    const edgeX = ROOFTOP_WIDTH * 0.5 - 0.14;
    b.parapetL.scale.set(0.28, 0.38, length);
    b.parapetL.position.set(-edgeX, 0.17, zCenter);
    b.parapetR.scale.set(0.28, 0.38, length);
    b.parapetR.position.set(edgeX, 0.17, zCenter);

    b.copingL.scale.set(0.36, 0.08, length + 0.1);
    b.copingL.position.set(-edgeX, 0.38, zCenter);
    b.copingR.scale.set(0.36, 0.08, length + 0.1);
    b.copingR.position.set(edgeX, 0.38, zCenter);

    b.railL.scale.set(0.06, 0.06, length);
    b.railL.position.set(-edgeX, 0.68, zCenter);
    b.railR.scale.set(0.06, 0.06, length);
    b.railR.position.set(edgeX, 0.68, zCenter);

    for (let k = 0; k < 5; k++) {
      const zPos = zStart - 1.0 - ((length - 2.0) * k) / 4;
      b.railPosts[k * 2].position.set(-edgeX, 0.54, zPos);
      b.railPosts[k * 2 + 1].position.set(edgeX, 0.54, zPos);
    }

    // Franjas amarillas de borde al inicio y al final de la azotea
    b.warnFront.position.set(0, -0.09, b.zEnd + 0.22);
    b.warnBack.position.set(0, -0.09, b.zStart - 0.22);

    // Alas arquitectónicas escalonadas y balcones técnicos laterales (fuera de la pista jugable)
    const wingLen = length * 0.62;
    const wingZ = zCenter + (Math.random() - 0.5) * length * 0.16;
    const wingOffsetX = ROOFTOP_WIDTH * 0.5 + 1.15;

    b.wingL.scale.set(2.3, alturaEdificio - 2.2, wingLen);
    b.wingL.position.set(-wingOffsetX, -alturaEdificio * 0.5 - 1.3, wingZ);
    b.balconyL.scale.set(2.45, 0.26, wingLen + 0.2);
    b.balconyL.position.set(-wingOffsetX, -0.35, wingZ);

    b.wingR.scale.set(2.3, alturaEdificio - 2.8, wingLen * 0.88);
    b.wingR.position.set(wingOffsetX, -alturaEdificio * 0.5 - 1.6, zCenter);
    b.balconyR.scale.set(2.45, 0.26, wingLen * 0.88 + 0.2);
    b.balconyR.position.set(wingOffsetX, -0.65, zCenter);

    b.decorL.position.set(-wingOffsetX - 0.05, -0.22, wingZ);
    b.decorR.position.set(wingOffsetX + 0.05, -0.52, zCenter);

    // Poblar con obstáculos, relojes y zonas de entrega
    if (!esInicial) {
      this.poblarAzotea(b);
    }
    return b;
  }

  poblarAzotea(b) {
    // Dejar margen seguro al aterrizar (5u) y antes de saltar el siguiente abismo (4.5u)
    let cursorZ = b.zStart - 6.5;
    const limitZ = b.zEnd + 5.0;
    let tuvoEntrega = false;

    while (cursorZ > limitZ) {
      const roll = Math.random();

      if (!tuvoEntrega && this.buildingsSpawned % 3 === 0 && cursorZ < b.zStart - 8) {
        // Zona de entrega en uno de los 3 carriles
        const lane = Math.floor(Math.random() * 3);
        const del = this.obtenerDePool(this.deliveryPool);
        if (del) {
          del.position.set(LANES[lane], 0, cursorZ);
          del.userData.collected = false;
          del.userData.lane = lane;
          b.items.push(del);
          tuvoEntrega = true;
        }
        cursorZ -= 9.5;
        continue;
      }

      if (roll < 0.62) {
        // Fila de obstáculos (1 o 2 carriles bloqueados, dejando al menos 1 libre o saltable)
        const carrilPrincipal = Math.floor(Math.random() * 3);
        const esAlto = Math.random() < 0.44;
        const obs = this.obtenerDePool(esAlto ? this.highObstaclePool : this.lowObstaclePool);
        if (obs) {
          obs.position.set(LANES[carrilPrincipal], 0, cursorZ);
          obs.userData.lane = carrilPrincipal;
          b.items.push(obs);
        }

        // Probabilidad de segundo obstáculo en otro carril para forzar decisión
        if (Math.random() < 0.42) {
          const otroCarril = (carrilPrincipal + 1 + Math.floor(Math.random() * 2)) % 3;
          const esAlto2 = Math.random() < 0.5;
          const obs2 = this.obtenerDePool(esAlto2 ? this.highObstaclePool : this.lowObstaclePool);
          if (obs2) {
            obs2.position.set(LANES[otroCarril], 0, cursorZ);
            obs2.userData.lane = otroCarril;
            b.items.push(obs2);
          }
        }

        // Ocasionalmente colocar un reloj verde en el carril libre
        if (Math.random() < 0.36) {
          const carrilLibre = (carrilPrincipal + 2) % 3;
          const clk = this.obtenerDePool(this.clockPool);
          if (clk) {
            clk.position.set(LANES[carrilLibre], 1.0, cursorZ);
            clk.userData.collected = false;
            clk.userData.baseY = 1.0;
            b.items.push(clk);
          }
        }
      } else if (roll < 0.88) {
        // Reloj verde flotante (+5s)
        const lane = Math.floor(Math.random() * 3);
        const clk = this.obtenerDePool(this.clockPool);
        if (clk) {
          clk.position.set(LANES[lane], 1.05, cursorZ);
          clk.userData.collected = false;
          clk.userData.baseY = 1.05;
          b.items.push(clk);
        }
      }

      cursorZ -= 9.0 + Math.random() * 3.0;
    }
  }

  generarSiguientesEdificios() {
    while (this.furthestZ > this.playerZ - 145) {
      const gapBase = 5.4 + (this.speed - BASE_SPEED) * 0.18;
      const gap = Math.min(8.6, gapBase + Math.random() * 1.4);
      const length = 22 + Math.random() * 22;
      const zStart = this.furthestZ - gap;
      this.buildingsSpawned++;
      const b = this.colocarEdificio(zStart, length, false);
      if (!b) break;
      this.furthestZ = b.zEnd;
    }
  }

  // ==========================================================================
  // 8. CONTROLES DUALES (TECLADO + GESTOS TÁCTILES SWIPE/TAP)
  // ==========================================================================

  initInput() {
    this.keysHeld = new Set();

    window.addEventListener('keydown', (e) => {
      // Permitir escribir libremente en el campo del nombre sin activar atajos del juego
      if (document.activeElement === dom.inputPlayerName) {
        if (e.code === 'Enter') {
          e.preventDefault();
          dom.inputPlayerName.blur();
        }
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (this.keysHeld.has(e.code)) return;
      this.keysHeld.add(e.code);

      this.audio.desbloquear();

      if (e.code === 'KeyM') {
        this.audio.alternarMute();
        return;
      }

      if (e.code === 'Escape') {
        if (!dom.modalRanking.classList.contains('hidden')) {
          dom.modalRanking.classList.add('hidden');
          return;
        }
        if (!dom.modalRules.classList.contains('hidden')) {
          dom.modalRules.classList.add('hidden');
          return;
        }
        if (!dom.modalIos.classList.contains('hidden')) {
          dom.modalIos.classList.add('hidden');
          return;
        }
      }

      const modalAbierto =
        !dom.modalRules.classList.contains('hidden') ||
        !dom.modalRanking.classList.contains('hidden') ||
        !dom.modalIos.classList.contains('hidden');

      if (this.estado === ESTADOS.INICIO) {
        if (!modalAbierto && (e.code === 'Enter' || e.code === 'Space')) {
          this.iniciarPartida();
        }
        return;
      }

      if (this.estado === ESTADOS.FIN) {
        if (!modalAbierto && (e.code === 'Enter' || e.code === 'Space')) {
          this.iniciarPartida();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.alternarPausa();
        return;
      }

      if (this.estado !== ESTADOS.JUGANDO) return;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.moverCarril(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.moverCarril(1);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this.solicitarSalto();
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.solicitarDeslizar();
    });

    window.addEventListener('keyup', (e) => {
      this.keysHeld.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysHeld.clear();
      if (this.estado === ESTADOS.JUGANDO) {
        this.alternarPausa();
      }
    });

    // Gestos táctiles (Swipe izquierda/derecha/arriba/abajo y toque rápido para saltar)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let swipeConsumido = false;
    const SWIPE_UMBRAL = 28;

    dom.canvas.addEventListener(
      'touchstart',
      (e) => {
        this.audio.desbloquear();
        if (this.estado !== ESTADOS.JUGANDO || e.touches.length === 0) return;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartTime = performance.now();
        swipeConsumido = false;
      },
      { passive: true }
    );

    dom.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (this.estado !== ESTADOS.JUGANDO || swipeConsumido || e.touches.length === 0) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX < SWIPE_UMBRAL && absY < SWIPE_UMBRAL) return;

        swipeConsumido = true;
        if (absX > absY) {
          this.moverCarril(dx < 0 ? -1 : 1);
        } else if (dy < 0) {
          this.solicitarSalto();
        } else {
          this.solicitarDeslizar();
        }
      },
      { passive: true }
    );

    dom.canvas.addEventListener(
      'touchend',
      () => {
        if (this.estado !== ESTADOS.JUGANDO || swipeConsumido) return;
        const elapsed = performance.now() - touchStartTime;
        if (elapsed < 230) {
          // Toque rápido salta
          this.solicitarSalto();
        }
      },
      { passive: true }
    );

    // Personalización de nombre y selección de avatar 3D
    dom.inputPlayerName.addEventListener('input', () => {
      this.playerName = dom.inputPlayerName.value.trim();
      guardarStorage(STORAGE_PLAYER_KEY, this.playerName);
      this.actualizarHighscoreUI();
    });

    dom.avatarSelector.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target.closest('.avatar-option') : null;
      if (!target) return;
      const avatarId = target.getAttribute('data-avatar');
      if (avatarId && AVATARES[avatarId]) {
        this.audio.desbloquear();
        this.audio.cambioCarril();
        this.aplicarAvatar(avatarId);
      }
    });

    // Botones de interfaz, reglas y tabla de puntos
    dom.btnStart.addEventListener('click', () => {
      this.audio.desbloquear();
      this.iniciarPartida();
    });
    dom.btnRules.addEventListener('click', () => {
      dom.modalRules.classList.remove('hidden');
    });
    dom.btnRulesPause.addEventListener('click', () => {
      dom.modalRules.classList.remove('hidden');
    });
    dom.btnCloseRules.addEventListener('click', () => {
      dom.modalRules.classList.add('hidden');
    });
    dom.btnRanking.addEventListener('click', () => {
      this.abrirRanking(null);
    });
    dom.btnRankingOver.addEventListener('click', () => {
      this.abrirRanking(this.lastRunTs || null);
    });
    dom.btnCloseRanking.addEventListener('click', () => {
      dom.modalRanking.classList.add('hidden');
    });
    dom.btnRestart.addEventListener('click', () => {
      this.audio.desbloquear();
      this.iniciarPartida();
    });
    dom.btnRestartPause.addEventListener('click', () => {
      this.audio.desbloquear();
      this.iniciarPartida();
    });
    dom.btnResume.addEventListener('click', () => this.alternarPausa());
    dom.btnPause.addEventListener('click', () => this.alternarPausa());
    dom.btnMenu.addEventListener('click', () => this.volverAlMenu());
    dom.btnMute.addEventListener('click', () => {
      this.audio.desbloquear();
      this.audio.alternarMute();
    });

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);

    // Ajustar FOV dinámicamente en pantallas móviles verticales para ver los 3 carriles con claridad
    const fov = aspect < 0.85 ? THREE.MathUtils.clamp(58 + (0.85 - aspect) * 48, 58, 82) : 56;
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  }

  moverCarril(dir) {
    const nuevo = THREE.MathUtils.clamp(this.targetLane + dir, 0, 2);
    if (nuevo !== this.targetLane) {
      this.targetLane = nuevo;
      this.laneLean = -dir * 0.34;
      this.audio.cambioCarril();
    }
  }

  solicitarSalto() {
    this.jumpBufferTimer = INPUT_BUFFER_TIME;
  }

  solicitarDeslizar() {
    this.slideBufferTimer = INPUT_BUFFER_TIME;
  }

  // ==========================================================================
  // 9. PERFIL DEL JUGADOR, AVATARES Y CICLO DE ESTADOS DEL JUEGO
  // ==========================================================================

  obtenerNombreJugador() {
    const limpio = (this.playerName || '').trim();
    return limpio || 'Repartidor';
  }

  cargarRanking() {
    try {
      const raw = leerStorage(STORAGE_RANKING_KEY, '[]');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  guardarRanking() {
    guardarStorage(STORAGE_RANKING_KEY, JSON.stringify(this.ranking));
  }

  obtenerRecordJugador(nombre) {
    const clave = nombre.trim().toLowerCase();
    let best = 0;
    for (const r of this.ranking) {
      if (String(r.name || '').trim().toLowerCase() === clave && r.score > best) {
        best = r.score;
      }
    }
    if (clave === 'repartidor' && this.ranking.length === 0) {
      best = Math.max(best, this.highScore);
    }
    return best;
  }

  registrarPuntuacion(nombre, avatarId, score, deliveries) {
    const ahora = Date.now();
    this.ranking.push({
      name: nombre,
      avatar: AVATARES[avatarId] ? avatarId : 'rayo',
      score,
      deliveries,
      ts: ahora,
    });
    this.ranking.sort((a, b) => b.score - a.score || b.deliveries - a.deliveries);
    if (this.ranking.length > 15) {
      this.ranking.length = 15;
    }
    this.guardarRanking();
    return ahora;
  }

  aplicarAvatar(avatarId) {
    const av = AVATARES[avatarId] || AVATARES.rayo;
    this.avatarId = av.id;
    guardarStorage(STORAGE_AVATAR_KEY, av.id);

    // Actualizar colores 3D del personaje en tiempo real
    const { mats } = this.player;
    mats.matChaqueta.color.setHex(av.chaqueta);
    mats.matMochila.color.setHex(av.mochila);
    mats.matMochilaTapa.color.setHex(av.tapa);
    mats.matGorra.color.setHex(av.gorra);
    mats.matFranja.emissive.setHex(av.franja);
    mats.matTenis.color.setHex(av.tenis);

    // Actualizar selectores UI y mini insignias en HUD / Game Over
    const buttons = dom.avatarSelector.querySelectorAll('.avatar-option');
    buttons.forEach((btn) => {
      const esActivo = btn.getAttribute('data-avatar') === av.id;
      btn.classList.toggle('active', esActivo);
      btn.setAttribute('aria-checked', esActivo ? 'true' : 'false');
    });

    for (const dot of [dom.hudAvatarDot, dom.overAvatarDot]) {
      if (!dot) continue;
      dot.style.setProperty('--c1', av.c1);
      dot.style.setProperty('--c2', av.c2);
    }
  }

  abrirRanking(highlightTs = null) {
    dom.rankingList.innerHTML = '';
    if (this.ranking.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'ranking-empty';
      empty.textContent = 'Aún no hay repartos registrados. ¡Sé el primero en correr!';
      dom.rankingList.appendChild(empty);
    } else {
      const top = this.ranking.slice(0, 10);
      top.forEach((entry, idx) => {
        const av = AVATARES[entry.avatar] || AVATARES.rayo;
        const row = document.createElement('div');
        row.className = 'ranking-row';
        if (highlightTs && entry.ts === highlightTs) {
          row.classList.add('is-current');
        }

        const rank = document.createElement('span');
        rank.className = 'ranking-rank';
        rank.textContent = `#${idx + 1}`;

        const dot = document.createElement('span');
        dot.className = 'avatar-mini';
        dot.style.setProperty('--c1', av.c1);
        dot.style.setProperty('--c2', av.c2);

        const info = document.createElement('div');
        info.className = 'ranking-player';

        const nameEl = document.createElement('span');
        nameEl.className = 'ranking-name';
        nameEl.textContent = entry.name || 'Repartidor';

        const metaEl = document.createElement('span');
        metaEl.className = 'ranking-meta';
        metaEl.textContent = `${av.nombre} · ${entry.deliveries} ${entry.deliveries === 1 ? 'entrega' : 'entregas'}`;

        info.append(nameEl, metaEl);

        const scoreEl = document.createElement('span');
        scoreEl.className = 'ranking-score';
        scoreEl.textContent = `${Number(entry.score || 0).toLocaleString('es-ES')} PTS`;

        row.append(rank, dot, info, scoreEl);
        dom.rankingList.appendChild(row);
      });
    }
    dom.modalRanking.classList.remove('hidden');
  }

  resetGameState() {
    // Limpiar edificios e ítems activos por completo antes de reconstruir el recorrido
    for (const b of this.buildingPool) {
      this.liberarItemsDeEdificio(b);
      b.active = false;
      b.group.visible = false;
    }
    for (const pool of [this.lowObstaclePool, this.highObstaclePool, this.clockPool, this.deliveryPool]) {
      for (const item of pool) {
        item.visible = false;
      }
    }
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }

    this.targetLane = 1;
    this.playerX = LANES[1];
    this.playerY = 0;
    this.playerZ = 0;
    this.velY = 0;
    this.onGround = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.slideBufferTimer = 0;
    this.slideTimer = 0;
    this.squashY = 1;
    this.laneLean = 0;
    this.runCycle = 0;
    this.lastStepHalf = -1;

    this.timeLeft = INITIAL_TIME;
    this.deliveries = 0;
    this.distanceScore = 0;
    this.bonusScore = 0;
    this.speed = BASE_SPEED;
    this.buildingsSpawned = 0;
    this.shakeIntensity = 0;
    this.hitstopTimer = 0;

    // Restablecer el horizonte de rascacielos y la avenida profunda a z = 0
    for (const d of this.bgData) {
      d.z = d.z0;
    }
    this.actualizarHorizonteDecorativo();

    // Azotea inicial larga y segura
    const inicial = this.colocarEdificio(10, 44, true);
    this.furthestZ = inicial ? inicial.zEnd : -34;
    this.generarSiguientesEdificios();

    // Posicionar jugador, luz y cámara sin desfase de fotogramas
    this.player.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.player.bodyPivot.position.set(0, 0, 0);
    this.player.bodyPivot.scale.set(1, 1, 1);
    this.player.bodyPivot.rotation.set(0, 0, 0);
    this.animarRepartidor(0);

    this.sunLight.position.set(this.playerX + 14, 24, this.playerZ + 8);
    this.sunLight.target.position.set(this.playerX, 0, this.playerZ - 12);
    this.sunLight.target.updateMatrixWorld();

    if (this.estado !== ESTADOS.INICIO) {
      this.camera.position.set(0, 4.9, 8.6);
      this.camera.lookAt(0, 1.25, -9.0);
    }

    this.actualizarHUD();
  }

  iniciarPartida() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.estado = ESTADOS.JUGANDO;
    this.resetGameState();
    this.camera.position.set(0, 4.9, 8.6);
    this.camera.lookAt(0, 1.25, -9.0);
    if (this.clock) {
      this.clock.getDelta();
    }

    dom.hudPlayerName.textContent = this.obtenerNombreJugador().toUpperCase();
    dom.screenStart.classList.add('hidden');
    dom.screenPause.classList.add('hidden');
    dom.screenGameOver.classList.add('hidden');
    dom.modalRanking.classList.add('hidden');
    dom.modalRules.classList.add('hidden');
    dom.hud.classList.remove('hidden');
    dom.toastLayer.innerHTML = '';
  }

  alternarPausa() {
    if (this.estado === ESTADOS.JUGANDO) {
      this.estado = ESTADOS.PAUSA;
      dom.screenPause.classList.remove('hidden');
    } else if (this.estado === ESTADOS.PAUSA) {
      this.estado = ESTADOS.JUGANDO;
      dom.screenPause.classList.add('hidden');
      this.clock.getDelta();
    }
  }

  volverAlMenu() {
    this.estado = ESTADOS.INICIO;
    this.resetGameState();
    this.actualizarHighscoreUI();
    dom.screenGameOver.classList.add('hidden');
    dom.screenPause.classList.add('hidden');
    dom.modalRanking.classList.add('hidden');
    dom.hud.classList.add('hidden');
    dom.screenStart.classList.remove('hidden');
  }

  terminarPartida(motivo) {
    if (this.estado === ESTADOS.FIN) return;
    this.estado = ESTADOS.FIN;

    const nombre = this.obtenerNombreJugador();
    const totalScore = Math.floor(this.distanceScore + this.bonusScore);
    const prevPersonalBest = this.obtenerRecordJugador(nombre);
    const esNuevoRecord = totalScore > prevPersonalBest && totalScore > 0;
    const personalBest = Math.max(prevPersonalBest, totalScore);

    this.lastRunTs = this.registrarPuntuacion(nombre, this.avatarId, totalScore, this.deliveries);

    if (totalScore > this.highScore) {
      this.highScore = totalScore;
      guardarStorage(STORAGE_HIGHSCORE_KEY, this.highScore);
    }
    this.actualizarHighscoreUI();

    dom.gameoverReason.textContent = motivo;
    dom.overPlayerName.textContent = nombre;
    dom.overScore.textContent = totalScore.toLocaleString('es-ES');
    dom.overDeliveries.textContent = String(this.deliveries);
    dom.overHighscore.textContent = personalBest.toLocaleString('es-ES');
    dom.newRecordBadge.classList.toggle('hidden', !esNuevoRecord);

    dom.hud.classList.add('hidden');
    dom.screenGameOver.classList.remove('hidden');
  }

  actualizarHighscoreUI() {
    const personal = this.obtenerRecordJugador(this.obtenerNombreJugador());
    dom.startHighscore.textContent = `${personal.toLocaleString('es-ES')} PTS`;
  }

  actualizarHUD() {
    const t = Math.max(0, this.timeLeft);
    dom.hudTime.textContent = `${t.toFixed(1)}s`;
    dom.timerCard.classList.toggle('timer-warning', t <= 7.0);
    dom.hudDeliveries.textContent = String(this.deliveries);
    const score = Math.floor(this.distanceScore + this.bonusScore);
    dom.hudScore.textContent = score.toLocaleString('es-ES');
  }

  mostrarToast(texto, tipo) {
    const el = document.createElement('div');
    el.className = `game-toast ${tipo}`;
    el.textContent = texto;
    dom.toastLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 950);
  }

  // ==========================================================================
  // 10. SIMULACIÓN POR FOTOGRAMA (FÍSICAS, COLISIONES, ANIMACIÓN Y CÁMARA)
  // ==========================================================================

  hayAzoteaDebajo(x, z) {
    const halfW = ROOFTOP_WIDTH * 0.5 - 0.15;
    if (Math.abs(x) > halfW) return false;
    for (const b of this.buildingPool) {
      if (!b.active) continue;
      if (z <= b.zStart + 0.35 && z >= b.zEnd - 0.35) {
        return true;
      }
    }
    return false;
  }

  updatePlaying(dt, elapsed) {
    // Hitstop breve tras colisión
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Temporizador
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.actualizarHUD();
      this.audio.choque();
      this.terminarPartida('TIEMPO AGOTADO');
      return;
    }

    // Avance automático hacia -Z
    const stepZ = this.speed * dt;
    this.playerZ -= stepZ;
    this.distanceScore += stepZ * 1.8;

    // Interpolación suave entre carriles (lerp exponencial independiente de FPS)
    const targetX = LANES[this.targetLane];
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 15, dt);
    this.laneLean = THREE.MathUtils.damp(this.laneLean, 0, 10, dt);

    // Temporizadores de input buffer y coyote time
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.slideBufferTimer > 0) this.slideBufferTimer -= dt;
    if (this.onGround) this.coyoteTimer = COYOTE_TIME;
    else if (this.coyoteTimer > 0) this.coyoteTimer -= dt;

    // Ejecutar salto si hay buffer y estamos en suelo o en coyote time
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velY = JUMP_VELOCITY;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.slideTimer = 0; // Cancelar deslizamiento al saltar
      this.squashY = 1.24;
      this.audio.salto();
      this.spawnParticles(this.playerX, 0.1, this.playerZ, 0xe2e8f0, 7, 3.6);
    }

    // Ejecutar deslizamiento (en aire actúa también como caída rápida)
    if (this.slideBufferTimer > 0) {
      this.slideBufferTimer = 0;
      if (this.onGround) {
        this.slideTimer = SLIDE_DURATION;
        this.squashY = 0.72;
        this.audio.deslizar();
      } else {
        // Fast-fall en el aire para aterrizar rápido y encadenar parkour
        this.velY = Math.min(this.velY, -18.5);
        this.slideTimer = SLIDE_DURATION * 0.75;
        this.audio.deslizar();
      }
    }

    if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - dt);
    }

    // Gravedad y detección de suelo de azoteas
    const sobreAzotea = this.hayAzoteaDebajo(this.playerX, this.playerZ);
    const prevY = this.playerY;

    if (!this.onGround || !sobreAzotea) {
      this.velY -= GRAVITY * dt;
      this.playerY += this.velY * dt;

      if (sobreAzotea && prevY >= -0.25 && this.playerY <= 0 && this.velY <= 0) {
        // Aterrizaje limpio sobre una azotea
        this.playerY = 0;
        this.velY = 0;
        this.onGround = true;
        this.squashY = 0.76;
        this.audio.aterrizaje();
        this.spawnParticles(this.playerX, 0.08, this.playerZ, 0xcbd5e1, 8, 4.2);
      } else {
        this.onGround = false;
      }
    } else {
      this.playerY = 0;
      this.velY = 0;
    }

    // Derrota por caída al vacío entre edificios
    if (this.playerY < -6.2) {
      this.audio.caida();
      this.terminarPartida('CAÍSTE AL VACÍO');
      return;
    }

    // Recuperar squash-and-stretch suavemente
    this.squashY = THREE.MathUtils.damp(this.squashY, 1.0, 12, dt);

    // Animar pose del repartidor (corriendo, saltando o deslizándose)
    this.animarRepartidor(dt);

    // Reciclar edificios que quedaron detrás de la cámara y generar nuevos al frente
    for (const b of this.buildingPool) {
      if (b.active && b.zEnd > this.playerZ + 18) {
        this.liberarItemsDeEdificio(b);
        b.active = false;
        b.group.visible = false;
      }
    }
    this.generarSiguientesEdificios();

    // Desplazar horizonte decorativo acompañando al jugador
    this.actualizarHorizonteDecorativo();

    // Comprobar colisiones con obstáculos, relojes y zonas de entrega
    if (this.evaluarInteracciones(dt, elapsed)) {
      return;
    }

    this.actualizarHUD();
  }

  animarRepartidor(dt) {
    this.player.root.position.set(this.playerX, this.playerY, this.playerZ);

    const isSliding = this.slideTimer > 0 && this.onGround;
    const invXZ = 1 / Math.sqrt(Math.max(0.55, this.squashY));

    if (isSliding) {
      // Pose encogida/deslizándose debajo de tuberías altas
      this.player.bodyPivot.scale.set(1.08, 0.48, 1.15);
      this.player.bodyPivot.rotation.set(0.55, 0, this.laneLean * 0.4);
      this.player.legL.rotation.x = -0.95;
      this.player.legR.rotation.x = -0.55;
      this.player.armL.rotation.x = 0.85;
      this.player.armR.rotation.x = 0.85;
    } else if (!this.onGround) {
      // Pose atlética en el aire
      this.player.bodyPivot.scale.set(invXZ, this.squashY, invXZ);
      this.player.bodyPivot.rotation.set(-0.14, 0, this.laneLean);
      this.player.legL.rotation.x = 0.55;
      this.player.legR.rotation.x = -0.65;
      this.player.armL.rotation.x = -0.85;
      this.player.armR.rotation.x = 0.45;
    } else {
      // Ciclo de carrera animado
      this.runCycle += dt * this.speed * 0.92;
      const s = Math.sin(this.runCycle);
      const bob = Math.abs(Math.cos(this.runCycle)) * 0.09;

      const stepHalf = Math.floor(this.runCycle / Math.PI);
      if (stepHalf !== this.lastStepHalf) {
        this.lastStepHalf = stepHalf;
        this.audio.paso();
      }

      this.player.bodyPivot.scale.set(invXZ, this.squashY, invXZ);
      this.player.bodyPivot.position.y = bob;
      this.player.bodyPivot.rotation.set(0.12, 0, this.laneLean + s * 0.04);

      this.player.legL.rotation.x = s * 0.88;
      this.player.legR.rotation.x = -s * 0.88;
      this.player.armL.rotation.x = -s * 0.78;
      this.player.armR.rotation.x = s * 0.78;
    }

    // Sombra de contacto proyectada cuando hay azotea debajo
    const haySuelo = this.hayAzoteaDebajo(this.playerX, this.playerZ);
    this.contactShadow.visible = haySuelo && this.playerY >= -0.2;
    if (this.contactShadow.visible) {
      const factorAltura = THREE.MathUtils.clamp(1 - this.playerY / 4.2, 0.25, 1);
      this.contactShadow.position.set(this.playerX, 0.025, this.playerZ);
      this.contactShadow.scale.setScalar(factorAltura);
      this.contactShadow.material.opacity = 0.55 * factorAltura;
    }
  }

  evaluarInteracciones(dt, elapsed) {
    const isSliding = this.slideTimer > 0 && this.onGround;
    const pMinY = this.playerY;
    const pMaxY = this.playerY + (isSliding ? 0.78 : 1.72);
    const pHalfW = 0.34;
    const pHalfD = 0.32;

    // 1) Obstáculos bajos
    for (const obs of this.lowObstaclePool) {
      if (!obs.visible) continue;
      if (obs.userData.fan) obs.userData.fan.rotation.z += dt * 12;

      if (
        Math.abs(this.playerX - obs.position.x) < pHalfW + obs.userData.halfW &&
        Math.abs(this.playerZ - obs.position.z) < pHalfD + obs.userData.halfD &&
        pMaxY > obs.userData.minY &&
        pMinY < obs.userData.maxY
      ) {
        this.impactarObstaculo(obs.position);
        return true;
      }
    }

    // 2) Obstáculos altos (tuberías)
    for (const obs of this.highObstaclePool) {
      if (!obs.visible) continue;
      if (
        Math.abs(this.playerX - obs.position.x) < pHalfW + obs.userData.halfW &&
        Math.abs(this.playerZ - obs.position.z) < pHalfD + obs.userData.halfD &&
        pMaxY > obs.userData.minY &&
        pMinY < obs.userData.maxY
      ) {
        this.impactarObstaculo(obs.position);
        return true;
      }
    }

    // 3) Relojes verdes (+5 segundos)
    for (const clk of this.clockPool) {
      if (!clk.visible || clk.userData.collected) continue;
      clk.rotation.y += dt * 3.0;
      clk.position.y = clk.userData.baseY + Math.sin(elapsed * 4.2 + clk.position.z) * 0.14;

      if (
        Math.abs(this.playerX - clk.position.x) < 1.05 &&
        Math.abs(this.playerZ - clk.position.z) < 1.15 &&
        Math.abs((this.playerY + 0.85) - clk.position.y) < 1.35
      ) {
        clk.userData.collected = true;
        clk.visible = false;
        this.timeLeft = Math.min(99.9, this.timeLeft + 5.0);
        this.audio.reloj();
        this.spawnParticles(clk.position.x, clk.position.y, clk.position.z, 0x34d399, 14, 6.2);
        this.mostrarToast('+5 SEGUNDOS', 'toast-time');
      }
    }

    // 4) Zonas de entrega (+1 entrega, +100 pts, acelera ligeramente)
    for (const del of this.deliveryPool) {
      if (!del.visible || del.userData.collected) continue;
      if (del.userData.parcel) {
        del.userData.parcel.rotation.y += dt * 2.5;
        del.userData.parcel.position.y = 1.28 + Math.sin(elapsed * 3.5) * 0.12;
      }

      if (
        Math.abs(this.playerX - del.position.x) < 1.35 &&
        Math.abs(this.playerZ - del.position.z) < 1.1 &&
        this.playerY < 2.6
      ) {
        del.userData.collected = true;
        del.visible = false;
        this.deliveries += 1;
        this.bonusScore += 100;
        this.speed = Math.min(MAX_SPEED, this.speed + SPEED_INCREMENT_PER_DELIVERY);
        this.audio.entrega();
        this.spawnParticles(del.position.x, 1.3, del.position.z, 0xfacc15, 18, 7.5);
        this.mostrarToast('+1 ENTREGA · +100 PTS', 'toast-delivery');
      }
    }

    return false;
  }

  impactarObstaculo(pos) {
    this.audio.choque();
    this.shakeIntensity = 0.45;
    this.hitstopTimer = 0.05;
    this.spawnParticles(pos.x, pos.y + 0.8, pos.z, 0xf97316, 16, 7.5);
    this.terminarPartida('IMPACTO CON OBSTÁCULO');
  }

  actualizarHorizonteDecorativo() {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.bgSkylineCount; i++) {
      const d = this.bgData[i];
      while (d.z > this.playerZ + 28) {
        d.z -= 247;
      }
      while (d.z < this.playerZ - 230) {
        d.z += 247;
      }
      dummy.position.set(d.x, d.h * 0.5 - 38, d.z);
      dummy.scale.set(d.w, d.h, d.d);
      dummy.updateMatrix();
      this.bgSkyline.setMatrixAt(i, dummy.matrix);

      dummy.position.set(d.x, d.h - 38 + 1.4, d.z);
      dummy.scale.set(d.w * 0.52, 2.8, d.d * 0.52);
      dummy.updateMatrix();
      this.bgPenthouses.setMatrixAt(i, dummy.matrix);
    }
    this.bgSkyline.instanceMatrix.needsUpdate = true;
    this.bgPenthouses.instanceMatrix.needsUpdate = true;
    this.streetPlane.position.z = this.playerZ - 60;
  }

  actualizarParticulas(dt) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(t);
      p.mesh.material.opacity = t;
    }
  }

  actualizarCamara(dt, elapsed) {
    if (this.estado === ESTADOS.INICIO) {
      // Paneo cinematográfico en el menú principal alrededor del repartidor
      const orbitX = Math.sin(elapsed * 0.42) * 3.8;
      const orbitZ = 6.2 + Math.cos(elapsed * 0.35) * 1.4;
      this.camera.position.set(orbitX, 3.2, orbitZ);
      this.camera.lookAt(0, 1.35, -3.5);

      // Animación suave de trote en reposo
      this.runCycle += dt * 7.5;
      const s = Math.sin(this.runCycle);
      this.player.legL.rotation.x = s * 0.4;
      this.player.legR.rotation.x = -s * 0.4;
      this.player.armL.rotation.x = -s * 0.35;
      this.player.armR.rotation.x = s * 0.35;
      this.player.bodyPivot.position.y = Math.abs(Math.cos(this.runCycle)) * 0.04;
    } else {
      // Seguimiento suave detrás del jugador
      const camTargetX = this.playerX * 0.52;
      const camTargetY = Math.max(2.6, this.playerY + 4.9);
      const camTargetZ = this.playerZ + 8.6;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camTargetX, 10, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camTargetY, 8, dt);
      this.camera.position.z = camTargetZ;

      if (this.shakeIntensity > 0.005) {
        this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
        this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 14, dt);
      }

      this._vecA.set(this.playerX * 0.36, Math.max(0.4, this.playerY + 1.25), this.playerZ - 9.0);
      this.camera.lookAt(this._vecA);
    }

    // Mantener la luz direccional y su frustum de sombras centrados en el jugador
    this.sunLight.position.set(this.playerX + 14, 24, this.playerZ + 8);
    this.sunLight.target.position.set(this.playerX, 0, this.playerZ - 12);
    this.sunLight.target.updateMatrixWorld();
  }

  // ==========================================================================
  // 11. BUCLE PRINCIPAL CON CONTROL PARA SOFTWARE WEBGL
  // ==========================================================================

  afterDraw(cb) {
    const gl = this.renderer.getContext();
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  startLoop() {
    const tick = () => {
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = this.clock.elapsedTime;

      if (this.estado === ESTADOS.JUGANDO) {
        this.updatePlaying(dt, elapsed);
      }

      this.actualizarParticulas(dt);
      this.actualizarCamara(dt, elapsed);
      this.renderer.render(this.scene, this.camera);

      if (isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }
}

// Arranque de la PWA y del juego 3D
inicializarPWA();
new RepartidorGame();
