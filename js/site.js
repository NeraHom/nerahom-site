import { TFT, drawStatic, drawScreensaver } from "./tft.js";
import { METINLER, ORNEKLER } from "./metinler.js";

const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const azHareket = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ======================= dil =======================
let dil = (() => {
  // ?dil=en ile paylaşılan bağlantı her zaman o dilde açılır
  const p = new URLSearchParams(location.search).get("dil");
  if (p === "tr" || p === "en") return p;
  const k = localStorage.getItem("nerahom-dil");
  if (k === "tr" || k === "en") return k;
  return (navigator.language || "tr").toLowerCase().startsWith("tr") ? "tr" : "en";
})();
const t = (a) => METINLER[dil][a] ?? METINLER.tr[a] ?? a;
const sayi = (v) => (dil === "tr" ? v.toFixed(1).replace(".", ",") : v.toFixed(1));

function diliUygula() {
  document.documentElement.lang = dil;
  document.title = t("meta.title");
  $('meta[name="description"]').setAttribute("content", t("meta.desc"));
  $$("[data-i18n]").forEach((el) => {
    const a = el.dataset.i18n;
    if (a.endsWith("_html")) el.innerHTML = t(a);
    else el.textContent = t(a);
  });
  $$("[data-i18n-alt]").forEach((el) => (el.alt = t(el.dataset.i18nAlt)));
  $$("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  $$(".dil button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dil === dil)));
  $(".atla").textContent = dil === "tr" ? "İçeriğe geç" : "Skip to content";
  $(".menu").setAttribute("aria-label", dil === "tr" ? "Bölümler" : "Sections");
  ornekleriCiz();
  sohbetiYenidenCiz();
  okumalariGuncelle();
}
$$(".dil button").forEach((b) =>
  b.addEventListener("click", () => {
    dil = b.dataset.dil;
    localStorage.setItem("nerahom-dil", dil);
    diliUygula();
  }),
);

// ======================= TFT demosu =======================
// Firmware: eşik 18–30 °C, 0,5 adım (encoder sınırları 36..60, thresh = v / 2).
const ESIK_MIN = 18, ESIK_MAX = 30;
const KORUYUCU_MS = 12000; // cihazda 60 sn
const d = { temp: 21.4, hum: 48.0, thresh: 22.0, mod: "SRV", koruyucu: false, acik: false };
const tft = new TFT($("#tft"));
const bolum = $("#ekran");
let sonEtkilesim = performance.now();
let aci = 0;

function ciz() {
  if (d.koruyucu) {
    d.acik = d.temp < d.thresh - 0.5;
    drawScreensaver(tft, d);
  } else {
    d.acik = drawStatic(tft, d);
  }
  document.documentElement.style.setProperty("--isi", d.acik ? "1" : "0");
  bolum.classList.toggle("isiniyor", d.acik);
  okumalariGuncelle();
}

function okumalariGuncelle() {
  $("#okOda").textContent = `${sayi(d.temp)} °C`;
  $("#okEsik").textContent = `${sayi(d.thresh)} °C`;
  $("#okKombi").textContent = d.acik ? t("ekran.acik") : t("ekran.kapali");
  const topuz = $("#topuz");
  topuz.setAttribute("aria-valuenow", String(d.thresh));
  topuz.setAttribute("aria-valuetext", `${sayi(d.thresh)} °C`);
  $("#heroDerece").textContent = Number.isInteger(d.thresh) ? String(d.thresh) : sayi(d.thresh);
  $("#koruyucuDugme").textContent = d.koruyucu ? t("ekran.uyandir") : t("ekran.koruyucu");
}

function etkilesim() {
  sonEtkilesim = performance.now();
  if (d.koruyucu) { d.koruyucu = false; return true; } // firmware: ilk hareket ekranı uyandırır
  return false;
}

function esikDegistir(adim) {
  const uyandi = etkilesim();
  if (!uyandi) d.thresh = Math.min(ESIK_MAX, Math.max(ESIK_MIN, Math.round((d.thresh + adim) * 2) / 2));
  ciz();
}

function topuzuDondur(derece) {
  aci += derece;
  $("#topuzIsaret").style.setProperty("--aci", `${aci}deg`);
}

// --- düğme: sürükle / kaydır / klavye ---
const topuz = $("#topuz");
let surukle = null;
const merkezAci = (e) => {
  const r = topuz.getBoundingClientRect();
  return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
};
topuz.addEventListener("pointerdown", (e) => {
  topuz.setPointerCapture(e.pointerId);
  surukle = { son: merkezAci(e), birikim: 0, hareket: 0 };
});
topuz.addEventListener("pointermove", (e) => {
  if (!surukle) return;
  const a = merkezAci(e);
  let fark = a - surukle.son;
  if (fark > 180) fark -= 360;
  if (fark < -180) fark += 360;
  surukle.son = a;
  surukle.birikim += fark;
  surukle.hareket += Math.abs(fark);
  topuzuDondur(fark);
  const DETENT = 18; // her 18° bir tık = 0,5 °C
  while (surukle.birikim >= DETENT) { esikDegistir(+0.5); surukle.birikim -= DETENT; }
  while (surukle.birikim <= -DETENT) { esikDegistir(-0.5); surukle.birikim += DETENT; }
});
const birak = () => {
  if (surukle && surukle.hareket < 4) { etkilesim(); ciz(); } // dokunma = buton basışı
  surukle = null;
};
topuz.addEventListener("pointerup", birak);
topuz.addEventListener("pointercancel", () => (surukle = null));
topuz.addEventListener("wheel", (e) => {
  e.preventDefault();
  const yon = e.deltaY < 0 ? 1 : -1;
  topuzuDondur(yon * 18);
  esikDegistir(yon * 0.5);
}, { passive: false });
topuz.addEventListener("keydown", (e) => {
  const tablo = { ArrowUp: 0.5, ArrowRight: 0.5, PageUp: 1, ArrowDown: -0.5, ArrowLeft: -0.5, PageDown: -1 };
  if (e.key in tablo) {
    e.preventDefault();
    topuzuDondur(Math.sign(tablo[e.key]) * 18);
    esikDegistir(tablo[e.key]);
  } else if (e.key === "Home" || e.key === "End") {
    e.preventDefault();
    etkilesim();
    d.thresh = e.key === "Home" ? ESIK_MIN : ESIK_MAX;
    ciz();
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    etkilesim();
    ciz();
  }
});
$("#azalt").addEventListener("click", () => { topuzuDondur(-18); esikDegistir(-0.5); });
$("#artir").addEventListener("click", () => { topuzuDondur(18); esikDegistir(0.5); });

$$("[data-mod]").forEach((b) =>
  b.addEventListener("click", () => {
    d.mod = b.dataset.mod;
    $$("[data-mod]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    etkilesim();
    ciz();
  }),
);
$$(".secim [data-govde]").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".secim [data-govde]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#demoGorsel").src = `img/demo-${b.dataset.govde}.webp`;
  }),
);
$("#koruyucuDugme").addEventListener("click", () => {
  if (d.koruyucu) etkilesim();
  else { d.koruyucu = true; sonEtkilesim = performance.now(); }
  ciz();
});

// --- oda simülasyonu: yalnızca bölüm görünürken çalışır ---
let saat = null;
function adimAt() {
  const hedef = d.acik ? d.temp + 0.1 : d.temp - 0.05;
  d.temp = Math.round(Math.min(30, Math.max(15, hedef)) * 100) / 100;
  if (!d.koruyucu && performance.now() - sonEtkilesim > KORUYUCU_MS) d.koruyucu = true;
  ciz();
}
const izle = (gorunur) => {
  if (gorunur && !saat && !document.hidden) saat = setInterval(adimAt, 1500);
  if ((!gorunur || document.hidden) && saat) { clearInterval(saat); saat = null; }
};
let ekranGorunur = false;
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([g]) => { ekranGorunur = g.isIntersecting; izle(ekranGorunur); }, { threshold: 0.2 }).observe(bolum);
}
document.addEventListener("visibilitychange", () => izle(ekranGorunur));

// --- sensör kartı renk çalışmaları ---
$$(".renk").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".renk").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const img = $("#sensorGorsel");
    img.style.opacity = "0";
    setTimeout(() => {
      img.src = `img/sensor-${b.dataset.renk}-34.webp`;
      img.onload = () => (img.style.opacity = "1");
    }, azHareket ? 0 : 180);
  }),
);

// ======================= Claude prototipi =======================
const sohbet = $("#sohbet");
const gecmis = [];
let mesgul = false;

function ornekleriCiz() {
  const k = $("#ornekler");
  k.replaceChildren(
    ...ORNEKLER.map((o, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ornek";
      b.textContent = o.soru[dil];
      b.addEventListener("click", () => ornekCalistir(i));
      return b;
    }),
  );
}

const jsonGuzel = (x) => JSON.stringify(x).replace(/":/g, '": ').replace(/,"/g, ', "');

function olayElemani(o) {
  if (o.tip === "arac") {
    const el = document.createElement("div");
    el.className = "arac" + (o.adim.hata ? " hata" : "");
    const b1 = document.createElement("span");
    b1.className = "arac-bas";
    b1.textContent = `→ ${t("claude.arac")} · ${o.adim.arac}`;
    const b2 = document.createElement("span");
    b2.className = "arac-bas";
    b2.textContent = `← ${t("claude.sonuc")}`;
    el.append(b1, jsonGuzel(o.adim.girdi), "\n", b2, jsonGuzel(o.adim.sonuc));
    return el;
  }
  const el = document.createElement("div");
  el.className = `balon balon-${o.tip}`;
  const kim = document.createElement("span");
  kim.className = "balon-kim";
  kim.textContent = o.tip === "siz" ? t("claude.siz") : t("claude.asistan");
  el.append(kim, o.metin[dil]);
  return el;
}

function sohbetiYenidenCiz() {
  if (!gecmis.length) {
    sohbet.replaceChildren(Object.assign(document.createElement("p"), { className: "sohbet-bos", textContent: t("claude.bos") }));
    return;
  }
  sohbet.classList.add("sabit");
  sohbet.replaceChildren(...gecmis.map(olayElemani));
  sohbet.scrollTop = sohbet.scrollHeight;
  requestAnimationFrame(() => sohbet.classList.remove("sabit"));
}

function ekle(o) {
  gecmis.push(o);
  while (gecmis.length > 14) gecmis.shift();
  if (sohbet.querySelector(".sohbet-bos")) sohbet.replaceChildren();
  sohbet.append(olayElemani(o));
  while (sohbet.children.length > 14) sohbet.firstElementChild.remove();
  sohbet.scrollTop = sohbet.scrollHeight;
}

async function yaziyor(ms) {
  const el = document.createElement("div");
  el.className = "yaziyor";
  el.innerHTML = "<i></i><i></i><i></i>";
  sohbet.append(el);
  sohbet.scrollTop = sohbet.scrollHeight;
  await bekle(azHareket ? 0 : ms);
  el.remove();
}

async function ornekCalistir(i) {
  if (mesgul) return;
  mesgul = true;
  $$(".ornek").forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
  const o = ORNEKLER[i];
  const once = { ...d };
  ekle({ tip: "siz", metin: o.soru });
  await yaziyor(700);
  for (const adim of o.adimlar(once)) {
    ekle({ tip: "arac", adim });
    await bekle(azHareket ? 0 : 550);
  }
  if (o.uygula) {
    Object.assign(d, o.uygula(once));
    etkilesim();
    ciz();
  }
  await yaziyor(600);
  ekle({ tip: "asistan", metin: o.yanit(d, once) });
  mesgul = false;
}

// ======================= kaydırınca ortaya çıkma =======================
if ("IntersectionObserver" in window && !azHareket) {
  const io = new IntersectionObserver(
    (girdiler) => girdiler.forEach((g) => { if (g.isIntersecting) { g.target.classList.add("goster"); io.unobserve(g.target); } }),
    { threshold: 0.12 },
  );
  $$("[data-ortaya]").forEach((el) => io.observe(el));
} else {
  $$("[data-ortaya]").forEach((el) => el.classList.add("goster"));
}

diliUygula();
ciz();
