/*
 * edits.js — 이미지 편집 연산
 *
 * 모든 연산은 입력 ImageData를 바꾸지 않고 "새" ImageData를 돌려줍니다.
 * 그래야 Undo 스택에 넣어 둔 이전 스냅샷이 망가지지 않습니다.
 */
(function (global) {
  'use strict';

  function blank(w, h) {
    return new ImageData(w, h);
  }

  // 밝기·대비·반전처럼 픽셀 값만 바꾸는 연산: 256칸 룩업 테이블로 처리
  function mapLevels(src, fn) {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.round(fn(v));
    const out = blank(src.width, src.height);
    const s = src.data, d = out.data;
    for (let i = 0; i < s.length; i += 4) {
      d[i] = lut[s[i]];
      d[i + 1] = lut[s[i + 1]];
      d[i + 2] = lut[s[i + 2]];
      d[i + 3] = s[i + 3];
    }
    return out;
  }

  // 3×3 합성곱 (가장자리는 가장 가까운 픽셀을 복제)
  function convolve3(src, k, divisor) {
    const w = src.width, h = src.height;
    const out = blank(w, h);
    const s = src.data, d = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, ki = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const j = (yy * w + xx) * 4;
            const kv = k[ki++];
            r += s[j] * kv; g += s[j + 1] * kv; b += s[j + 2] * kv;
          }
        }
        const i = (y * w + x) * 4;
        d[i] = r / divisor; d[i + 1] = g / divisor; d[i + 2] = b / divisor; d[i + 3] = s[i + 3];
      }
    }
    return out;
  }

  // 시계 방향 90° 회전: 결과 (x', y') ← 원본 (x = y', y = H-1-x')
  function rotate90(src) {
    const w = src.width, h = src.height;
    const out = blank(h, w);
    const s = src.data, d = out.data;
    for (let yp = 0; yp < w; yp++) {
      for (let xp = 0; xp < h; xp++) {
        const j = ((h - 1 - xp) * w + yp) * 4;
        const i = (yp * h + xp) * 4;
        d[i] = s[j]; d[i + 1] = s[j + 1]; d[i + 2] = s[j + 2]; d[i + 3] = s[j + 3];
      }
    }
    return out;
  }

  function flipH(src) {
    const w = src.width, h = src.height;
    const out = blank(w, h);
    const s = src.data, d = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, j = (y * w + (w - 1 - x)) * 4;
        d[i] = s[j]; d[i + 1] = s[j + 1]; d[i + 2] = s[j + 2]; d[i + 3] = s[j + 3];
      }
    }
    return out;
  }

  function luminance(s, j) {
    return 0.299 * s[j] + 0.587 * s[j + 1] + 0.114 * s[j + 2];
  }

  // Sobel 경계 검출 (밝기 기준)
  function sobel(src) {
    const w = src.width, h = src.height;
    const out = blank(w, h);
    const s = src.data, d = out.data;
    const L = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) L[p] = luminance(s, p * 4);
    const at = (x, y) => L[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
        const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
        const m = Math.min(255, Math.hypot(gx, gy) * 0.6);
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = m;
        d[i + 3] = s[i + 3];
      }
    }
    return out;
  }

  // "hot" 컬러맵: 검정 → 빨강 → 노랑 → 흰색
  function hotMap(src) {
    const out = blank(src.width, src.height);
    const s = src.data, d = out.data;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    for (let i = 0; i < s.length; i += 4) {
      const t = luminance(s, i) / 255;
      d[i] = 255 * clamp01(3 * t);
      d[i + 1] = 255 * clamp01(3 * t - 1);
      d[i + 2] = 255 * clamp01(3 * t - 2);
      d[i + 3] = s[i + 3];
    }
    return out;
  }

  // 화면에 보이는 편집 버튼 순서대로
  const EDITS = {
    brighten: { label: '밝게', glyph: '☀', apply: (img) => mapLevels(img, (v) => v + 28) },
    darken:   { label: '어둡게', glyph: '◐', apply: (img) => mapLevels(img, (v) => v - 28) },
    contrast: { label: '대비 ↑', glyph: '◧', apply: (img) => mapLevels(img, (v) => (v - 128) * 1.35 + 128) },
    invert:   { label: '반전', glyph: '◑', apply: (img) => mapLevels(img, (v) => 255 - v) },
    blur:     { label: '블러', glyph: '◌', apply: (img) => convolve3(img, [1, 2, 1, 2, 4, 2, 1, 2, 1], 16) },
    sharpen:  { label: '선명하게', glyph: '◆', apply: (img) => convolve3(img, [0, -1, 0, -1, 5, -1, 0, -1, 0], 1) },
    edges:    { label: '경계 검출', glyph: '▦', apply: sobel },
    hot:      { label: 'Hot 컬러맵', glyph: '▲', apply: hotMap },
    rotate:   { label: '90° 회전', glyph: '↻', apply: rotate90 },
    flip:     { label: '좌우 반전', glyph: '⇋', apply: flipH },
  };

  global.EDITS = EDITS;
})(window);
