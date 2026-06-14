/* =============================================================
   Instagram 캐러셀 템플릿 — 렌더 엔진 + 에디터
   양식 스펙 2026.06 (260410 반영)
   ============================================================= */

/* ---------- 1. 스펙 상수 ---------- */
const SPEC = {
  W: 1080,
  H: 1350,
  MARGIN: 72,
  SLATE: "#828FAC",
  PAPER: "#FAFAFA",
  WRAP_W: 936,            // 1080 − 마진×2
  FONT: '"Noto Sans KR", "Noto Sans CJK KR", system-ui, sans-serif',

  // 폰트 (px / weight)
  title:    { size: 132, weight: 900, lh: 150 },
  subtitle: { size: 41,  weight: 400 },
  date:     { size: 46,  weight: 500 },
  body:     { size: 47,  weight: 400, lh: 70 },
  index:    { size: 26,  weight: 500 },

  // 표지
  cover: {
    scrimStart: 0.55,    // 화면 55% 지점
    scrimAlpha: 205,
    scrimCurve: 1.3,
    dateY: 78,
    kickerW: 70,
    kickerH: 3,
    kickerGap: 30,       // 타이틀 상단에서 위로
    titleX: 72 - 4,      // 마진−4 (살짝 흘림)
    titleGap: 24,        // 부제 바 위
    barRadius: 8,
    barPadX: 26,
    barPadY: 16,
    barBottom: 1350 - 64 // H−64
  },

  // 내지
  page: {
    blockBottom: 1350 - 78,  // H−78
    ruleGap: 18,             // 인덱스 오른쪽
    ruleW: 60,
    ruleH: 4,
    bodyGap: 62,             // 인덱스 아래
    scrimGap: 90,            // 본문 블록 상단 −90px
    scrimAlpha: 205,
    scrimCurve: 1.3
  },

  // 영상 / 인덱스-온리
  video: {
    scrimStart: 1350 - 180,  // H−180
    scrimAlpha: 190,
    scrimCurve: 1.3,
    indexY: 1350 - 120       // y≈H−120
  }
};

/* ---------- 2. 상태 ---------- */
function todayYYMMDD() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getFullYear() % 100) + p(d.getMonth() + 1) + p(d.getDate());
}

let slides = [
  { type: "cover", date: todayYYMMDD(), title: "여기에\n주제를 입력", subtitle: "부제를 입력하세요" },
  { type: "body", content: "본문 내용을 입력하세요.\n원문 단어는 바꾸지 않고\n줄바꿈·배치만 조정합니다." }
];
let current = 0;
let guides = true;
let fontsReady = false;

/* ---------- 3. 유틸 ---------- */
const pad2 = (n) => String(n).padStart(2, "0");

function setFont(ctx, spec) {
  ctx.font = `${spec.weight} ${spec.size}px ${SPEC.FONT}`;
}

// 줄바꿈: 사용자 개행 우선, 그 다음 폭 기준 자동 줄바꿈 (한/영 모두)
function wrapText(ctx, text, maxWidth) {
  const out = [];
  const paragraphs = (text || "").split("\n");
  for (const para of paragraphs) {
    if (para === "") { out.push(""); continue; }
    const tokens = para.split(/(\s+)/); // 공백 보존
    let line = "";
    const pushLine = () => { out.push(line.replace(/\s+$/, "")); line = ""; };

    for (const tok of tokens) {
      if (ctx.measureText(line + tok).width <= maxWidth) {
        line += tok;
        continue;
      }
      // 토큰 자체가 폭을 넘으면 글자 단위로 분해 (한글/긴 단어 대응)
      if (ctx.measureText(tok).width > maxWidth) {
        if (line) pushLine();
        for (const ch of tok) {
          if (ctx.measureText(line + ch).width <= maxWidth) line += ch;
          else { pushLine(); line = ch; }
        }
      } else {
        if (line) pushLine();
        line = tok.replace(/^\s+/, "");
      }
    }
    out.push(line.replace(/\s+$/, ""));
  }
  return out;
}

// 곡선 적용 하단 스크림 (투명 → maxAlpha, 검정)
function fillScrim(ctx, startY, endY, maxAlpha, curve) {
  const g = ctx.createLinearGradient(0, startY, 0, endY);
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = (maxAlpha * Math.pow(t, curve)) / 255;
    g.addColorStop(t, `rgba(0,0,0,${a.toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, startY, SPEC.W, endY - startY);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- 4. 렌더 엔진 ---------- */
function renderSlide(canvas, idx, withGuides) {
  const ctx = canvas.getContext("2d");
  const { W, H, MARGIN } = SPEC;
  ctx.clearRect(0, 0, W, H); // 배경 투명 유지

  const slide = slides[idx];
  const total = slides.length;
  const posNum = idx + 1; // 장 위치 = 인덱스 번호

  if (slide.type === "cover") renderCover(ctx, slide);
  else if (slide.type === "body") renderBody(ctx, slide, posNum, total);
  else if (slide.type === "video") renderVideo(ctx, slide, posNum, total);

  if (withGuides) drawGuides(ctx);
}

function renderCover(ctx, slide) {
  const { W, H } = SPEC;
  const c = SPEC.cover;

  // 하단 스크림 (55% 지점부터, 곡선 1.3)
  fillScrim(ctx, H * c.scrimStart, H, c.scrimAlpha, c.scrimCurve);

  // 날짜 (우상단, 우측 끝 = 마진)
  if (slide.date) {
    setFont(ctx, SPEC.date);
    ctx.fillStyle = SPEC.PAPER;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillText(slide.date, W - SPEC.MARGIN, c.dateY);
    ctx.restore();
  }

  // 부제 바 (있을 때만)
  let titleBottom;
  const hasSub = slide.subtitle && slide.subtitle.trim() !== "";
  if (hasSub) {
    setFont(ctx, SPEC.subtitle);
    const txt = slide.subtitle.trim();
    const tw = ctx.measureText(txt).width;
    const barH = SPEC.subtitle.size + c.barPadY * 2;
    const barW = tw + c.barPadX * 2;
    const barX = c.titleX;
    const barY = c.barBottom - barH;

    ctx.fillStyle = SPEC.SLATE;
    roundRect(ctx, barX, barY, barW, barH, c.barRadius);
    ctx.fill();

    ctx.fillStyle = SPEC.PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(txt, barX + c.barPadX, barY + c.barPadY);

    titleBottom = barY - c.titleGap;
  } else {
    titleBottom = c.barBottom;
  }

  // 타이틀 (좌하단, 위로 쌓임)
  setFont(ctx, SPEC.title);
  const lines = wrapText(ctx, slide.title || "", W - c.titleX - SPEC.MARGIN);
  ctx.fillStyle = SPEC.PAPER;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const lh = SPEC.title.lh;
  const n = lines.length;
  let firstBaseline = titleBottom - (n - 1) * lh;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, c.titleX, firstBaseline + i * lh);
  });

  // 흰 키커 룰 (타이틀 상단 위 30px)
  const titleTopY = firstBaseline - SPEC.title.size * 0.84;
  ctx.fillStyle = SPEC.PAPER;
  ctx.fillRect(c.titleX, titleTopY - c.kickerGap, c.kickerW, c.kickerH);
}

function renderBody(ctx, slide, posNum, total) {
  const { H, MARGIN } = SPEC;
  const p = SPEC.page;

  setFont(ctx, SPEC.body);
  const lines = wrapText(ctx, slide.content || "", SPEC.WRAP_W);
  const lh = SPEC.body.lh;
  const blockHeight = lines.length * lh;
  const blockBottom = p.blockBottom;
  const blockTop = blockBottom - blockHeight;

  // 하단 스크림 (본문 블록 상단 −90px부터)
  fillScrim(ctx, blockTop - p.scrimGap, H, p.scrimAlpha, p.scrimCurve);

  // 인덱스 NN / NN (블록 맨 위, 좌 마진)
  const idxBaseline = blockTop - p.bodyGap;
  drawIndex(ctx, posNum, total, MARGIN, idxBaseline);

  // 본문 (흰색, 행간 70, top 기준)
  setFont(ctx, SPEC.body);
  ctx.fillStyle = SPEC.PAPER;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((ln, i) => {
    ctx.fillText(ln, MARGIN, blockTop + i * lh);
  });
}

function renderVideo(ctx, slide, posNum, total) {
  const { H, MARGIN } = SPEC;
  const v = SPEC.video;

  // 사진에 텍스트 박혀 있으면 렌더 안 함
  if (slide.noRender) return;

  fillScrim(ctx, v.scrimStart, H, v.scrimAlpha, v.scrimCurve);
  drawIndex(ctx, posNum, total, MARGIN, v.indexY);
}

// 인덱스 "NN / NN" + 슬레이트 룰
function drawIndex(ctx, posNum, total, x, baseline) {
  const label = `${pad2(posNum)} / ${pad2(total)}`;
  setFont(ctx, SPEC.index);
  ctx.fillStyle = SPEC.SLATE;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, x, baseline);

  const tw = ctx.measureText(label).width;
  const ruleX = x + tw + SPEC.page.ruleGap;
  const ruleY = baseline - SPEC.index.size * 0.32 - SPEC.page.ruleH / 2;
  ctx.fillStyle = SPEC.SLATE;
  ctx.fillRect(ruleX, ruleY, SPEC.page.ruleW, SPEC.page.ruleH);
}

// 안전마진 가이드 (미리보기 전용 — 출력엔 포함 안 됨)
function drawGuides(ctx) {
  const { W, H, MARGIN } = SPEC;
  ctx.save();
  ctx.strokeStyle = "rgba(130,143,172,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
  ctx.restore();
}

/* ---------- 5. UI ---------- */
const els = {
  preview: document.getElementById("previewCanvas"),
  slideList: document.getElementById("slideList"),
  editorFields: document.getElementById("editorFields"),
  editorType: document.getElementById("editorType"),
  slidePos: document.getElementById("slidePos"),
  fontHint: document.getElementById("fontHint")
};

const TYPE_LABEL = { cover: "표지", body: "내지", video: "영상/인덱스" };

function refresh() {
  renderSlide(els.preview, current, guides);
  els.slidePos.textContent = `${current + 1} / ${slides.length}`;
  renderSlideList();
  renderEditor();
  saveState();
}

function renderSlideList() {
  els.slideList.innerHTML = "";
  slides.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "slide-item" + (i === current ? " active" : "");
    const labelText =
      s.type === "cover" ? (s.title || "표지").replace(/\n/g, " ")
      : s.type === "body" ? (s.content || "내지").replace(/\n/g, " ")
      : (s.noRender ? "영상(렌더 안 함)" : "영상/인덱스");

    item.innerHTML = `
      <span class="num">${pad2(i + 1)}</span>
      <span class="label">${TYPE_LABEL[s.type]} · ${escapeHtml(labelText)}</span>
      <span class="ops">
        <button class="iconbtn" data-op="up" title="위로">▲</button>
        <button class="iconbtn" data-op="down" title="아래로">▼</button>
        <button class="iconbtn" data-op="del" title="삭제">✕</button>
      </span>`;

    item.addEventListener("click", (e) => {
      if (e.target.dataset.op) return;
      current = i; refresh();
    });
    item.querySelector('[data-op="up"]').addEventListener("click", (e) => { e.stopPropagation(); move(i, -1); });
    item.querySelector('[data-op="down"]').addEventListener("click", (e) => { e.stopPropagation(); move(i, 1); });
    item.querySelector('[data-op="del"]').addEventListener("click", (e) => { e.stopPropagation(); removeSlide(i); });

    els.slideList.appendChild(item);
  });
}

function renderEditor() {
  const s = slides[current];
  els.editorType.textContent = TYPE_LABEL[s.type];
  const f = [];

  // 타입 변경
  f.push(`
    <div class="field">
      <label>장 유형</label>
      <select id="f_type">
        <option value="cover" ${s.type === "cover" ? "selected" : ""}>표지</option>
        <option value="body" ${s.type === "body" ? "selected" : ""}>내지(본문)</option>
        <option value="video" ${s.type === "video" ? "selected" : ""}>영상/인덱스-온리</option>
      </select>
    </div>`);

  if (s.type === "cover") {
    f.push(`
      <div class="field">
        <label>날짜 (YYMMDD · 자유 편집)</label>
        <input type="text" id="f_date" value="${escapeAttr(s.date || "")}" maxlength="12" />
        <div class="help">예: 260614 — 형식을 바꿔도 입력한 그대로 표기됩니다.</div>
      </div>
      <div class="field">
        <label>주제 (타이틀)</label>
        <textarea id="f_title" style="min-height:90px">${escapeHtml(s.title || "")}</textarea>
        <div class="help">Enter로 줄바꿈. 폭 초과 시 자동 줄바꿈.</div>
      </div>
      <div class="field">
        <label>부제</label>
        <input type="text" id="f_subtitle" value="${escapeAttr(s.subtitle || "")}" />
        <div class="help">비우면 부제 바 생략 (시리즈 일관상 1줄 권장).</div>
      </div>`);
  } else if (s.type === "body") {
    f.push(`
      <div class="field">
        <label>본문 내용</label>
        <textarea id="f_content">${escapeHtml(s.content || "")}</textarea>
        <div class="help">원문 단어 불변경 — 줄바꿈·배치만. 자동 줄바꿈 폭 936px.</div>
      </div>`);
  } else if (s.type === "video") {
    f.push(`
      <div class="field">
        <label class="checkrow">
          <input type="checkbox" id="f_norender" ${s.noRender ? "checked" : ""} />
          사진에 텍스트 박혀 있음 → 렌더 안 함
        </label>
        <div class="help">체크 해제 시 인덱스(NN/NN)만 표기됩니다.</div>
      </div>`);
  }

  els.editorFields.innerHTML = f.join("");

  // 바인딩
  document.getElementById("f_type").addEventListener("change", (e) => {
    convertType(s, e.target.value);
    refresh();
  });
  bind("f_date", "date");
  bind("f_subtitle", "subtitle");
  bind("f_title", "title");
  bind("f_content", "content");
  const nr = document.getElementById("f_norender");
  if (nr) nr.addEventListener("change", (e) => { s.noRender = e.target.checked; refresh(); });

  function bind(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", (e) => {
      s[key] = e.target.value;
      renderSlide(els.preview, current, guides);
      // 목록 라벨도 갱신하되 포커스 유지 위해 전체 refresh는 디바운스
      clearTimeout(bind._t);
      bind._t = setTimeout(() => { renderSlideList(); saveState(); }, 200);
    });
  }
}

function convertType(s, newType) {
  if (s.type === newType) return;
  s.type = newType;
  if (newType === "cover") {
    if (s.date == null) s.date = todayYYMMDD();
    if (s.title == null) s.title = "";
    if (s.subtitle == null) s.subtitle = "";
  } else if (newType === "body") {
    if (s.content == null) s.content = "";
  } else if (newType === "video") {
    if (s.noRender == null) s.noRender = false;
  }
}

function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= slides.length) return;
  [slides[i], slides[j]] = [slides[j], slides[i]];
  if (current === i) current = j;
  else if (current === j) current = i;
  refresh();
}

function removeSlide(i) {
  if (slides.length === 1) return;
  slides.splice(i, 1);
  if (current >= slides.length) current = slides.length - 1;
  refresh();
}

function addSlide(type) {
  const base =
    type === "cover" ? { type, date: todayYYMMDD(), title: "주제", subtitle: "부제" }
    : type === "body" ? { type, content: "" }
    : { type, noRender: false };
  slides.splice(current + 1, 0, base);
  current += 1;
  refresh();
}

/* ---------- 6. 출력 (배경 투명 PNG) ---------- */
function exportCanvas() {
  const c = document.createElement("canvas");
  c.width = SPEC.W; c.height = SPEC.H;
  return c;
}

function downloadSlide(idx) {
  const c = exportCanvas();
  renderSlide(c, idx, false); // 가이드 제외
  c.toBlob((blob) => {
    const s = slides[idx];
    const name = `carousel_${pad2(idx + 1)}_${s.type}.png`;
    triggerDownload(blob, name);
  }, "image/png");
}

async function downloadAll() {
  for (let i = 0; i < slides.length; i++) {
    downloadSlide(i);
    await new Promise((r) => setTimeout(r, 350)); // 다중 다운로드 안정화
  }
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- 7. 저장/복원 (로컬) ---------- */
const LS_KEY = "ig-carousel-state-v1";
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ slides, current })); } catch (e) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.slides) && data.slides.length) {
      slides = data.slides;
      current = Math.min(data.current || 0, slides.length - 1);
    }
  } catch (e) {}
}

/* ---------- 8. 헬퍼 / 이벤트 ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

document.getElementById("prevSlide").addEventListener("click", () => {
  current = (current - 1 + slides.length) % slides.length; refresh();
});
document.getElementById("nextSlide").addEventListener("click", () => {
  current = (current + 1) % slides.length; refresh();
});
document.getElementById("guideToggle").addEventListener("change", (e) => {
  guides = e.target.checked; renderSlide(els.preview, current, guides);
});
document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", () => addSlide(btn.dataset.add));
});
document.getElementById("exportCurrent").addEventListener("click", () => downloadSlide(current));
document.getElementById("exportAll").addEventListener("click", () => downloadAll());

/* ---------- 9. 부팅 (폰트 동기화) ---------- */
async function boot() {
  loadState();
  refresh();

  if (document.fonts && document.fonts.load) {
    try {
      await Promise.all([
        document.fonts.load(`900 132px ${SPEC.FONT}`, "주제"),
        document.fonts.load(`500 46px ${SPEC.FONT}`, "260614"),
        document.fonts.load(`400 47px ${SPEC.FONT}`, "본문")
      ]);
      await document.fonts.ready;
      fontsReady = true;
      els.fontHint.textContent = "폰트 로드 완료 · Noto Sans KR (Freesentation 대체)";
      renderSlide(els.preview, current, guides);
    } catch (e) {
      els.fontHint.textContent = "웹폰트 로드 실패 — 시스템 폰트로 대체 렌더링";
    }
  } else {
    els.fontHint.textContent = "폰트 API 미지원 — 시스템 폰트 사용";
  }
}
boot();
