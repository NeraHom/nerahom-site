// Sensör firmware'inin (sensor_final_modular/ui_manager.cpp) ST7735 çizimlerinin
// tarayıcıya birebir aktarımı: Adafruit_GFX klasik font yolu, aynı koordinatlar ve renkler.
import { GLCDFONT } from "./glcdfont.js";

export const W = 128, H = 160; // setRotation çağrılmıyor -> dikey

// Adafruit_ST77xx.h
export const ST77XX = {
  BLACK: 0x0000, WHITE: 0xffff, RED: 0xf800, GREEN: 0x07e0, BLUE: 0x001f,
  CYAN: 0x07ff, MAGENTA: 0xf81f, YELLOW: 0xffe0, ORANGE: 0xfc00,
};

const rgb565 = (c) =>
  `rgb(${(((c >> 11) & 31) * 255 / 31) | 0},${(((c >> 5) & 63) * 255 / 63) | 0},${((c & 31) * 255 / 31) | 0})`;

export class TFT {
  constructor(canvas) {
    canvas.width = W;
    canvas.height = H;
    this.g = canvas.getContext("2d");
    this.cx = 0; this.cy = 0; this.boy = 1; this.renk = ST77XX.WHITE;
  }
  fillRect(x, y, w, h, c) { this.g.fillStyle = rgb565(c); this.g.fillRect(x, y, w, h); }
  drawRect(x, y, w, h, c) {
    this.fillRect(x, y, w, 1, c); this.fillRect(x, y + h - 1, w, 1, c);
    this.fillRect(x, y, 1, h, c); this.fillRect(x + w - 1, y, 1, h, c);
  }
  drawLine(x0, y0, x1, y1, c) { this.fillRect(Math.min(x0, x1), y0, Math.abs(x1 - x0) + 1, 1, c); } // yalnız yatay
  fillScreen(c) { this.fillRect(0, 0, W, H, c); }
  setCursor(x, y) { this.cx = x; this.cy = y; }
  setTextSize(s) { this.boy = s; }
  setTextColor(c) { this.renk = c; }
  drawChar(x, y, ch) {
    const s = this.boy, kod = ch.charCodeAt(0) & 0xff;
    for (let i = 0; i < 5; i++) {
      let satir = GLCDFONT[kod * 5 + i];
      for (let j = 0; j < 8; j++, satir >>= 1) if (satir & 1) this.fillRect(x + i * s, y + j * s, s, s, this.renk);
    }
  }
  print(metin) {
    for (const ch of metin) {
      if (this.cx + this.boy * 6 > W) { this.cx = 0; this.cy += this.boy * 8; } // wrap
      this.drawChar(this.cx, this.cy, ch);
      this.cx += this.boy * 6;
    }
  }
}

const f1 = (v) => v.toFixed(1);

/** ui_manager.cpp → drawStatic() (devicePaired = true). Kombi kararını döndürür. */
export function drawStatic(t, { temp, hum, thresh, mod }) {
  const C = ST77XX;
  t.fillScreen(C.BLACK);
  t.setTextSize(2); t.setCursor(5, 5); t.setTextColor(C.CYAN); t.print("NeraHom");
  t.fillRect(95, 3, 30, 16, C.BLACK);
  t.setTextSize(1); t.setCursor(98, 8);
  t.setTextColor(mod === "SRV" ? C.GREEN : C.YELLOW); t.print(mod);
  t.drawLine(0, 24, 128, 24, C.CYAN);
  t.setTextColor(C.WHITE); t.setTextSize(1);
  t.setCursor(5, 32); t.print("Sicaklik");
  t.setCursor(5, 58); t.print("Nem");
  t.setCursor(5, 84); t.print("Esik");
  t.drawLine(0, 110, 128, 110, C.WHITE);
  t.setCursor(5, 118); t.print("Durum:");
  t.setCursor(5, 150); t.setTextColor(C.YELLOW); t.print("BUTON: Menu");
  t.setTextSize(2); t.setTextColor(C.YELLOW); t.setCursor(5, 42); t.print(`${f1(temp)}C`);
  t.setTextSize(2); t.setTextColor(C.GREEN); t.setCursor(5, 68); t.print(`${f1(hum)}%`);
  t.setTextSize(2); t.setTextColor(C.WHITE); t.setCursor(5, 94); t.print(`${f1(thresh)}C`);
  t.setTextSize(1); t.setCursor(50, 118);
  const acik = temp < thresh - 0.5; // firmware'deki histerezis koşulu
  t.setTextColor(acik ? C.RED : C.BLUE); t.print(acik ? "ACIK" : "KAPALI");
  return acik;
}

/** ui_manager.cpp → drawScreensaver() */
export function drawScreensaver(t, { temp, acik }) {
  t.fillScreen(ST77XX.BLACK);
  const buf = `${f1(temp)}C`;
  t.setTextSize(3); t.setTextColor(ST77XX.WHITE);
  const tw = buf.length * 6 * 3, th = 8 * 3;
  const yt = Math.max(0, ((H - th) / 2) | 0), xt = Math.max(0, ((W - tw) / 2) | 0);
  let bx = Math.max(0, xt - 6), by = Math.max(0, yt - 6), bw = tw + 12, bh = th + 12;
  if (bx + bw > W) bw = W - bx;
  if (by + bh > H) bh = H - by;
  t.drawRect(bx, by, bw, bh, acik ? ST77XX.RED : ST77XX.GREEN);
  t.setCursor(xt, yt); t.print(buf);
}
