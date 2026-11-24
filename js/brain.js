/*
 * brain.js — 코드로 그린 "합성" 뇌 MRI 축상면(axial, T1 느낌) 슬라이스
 *
 * 실제 환자 영상이 아니라, 타원·노이즈 함수로 두피/두개골/뇌척수액/회백질/
 * 백질/뇌실/심부 회색질을 흉내 낸 그림입니다. 같은 seed면 항상 같은 그림이 나옵니다.
 * 화면 위쪽이 앞(Anterior), 영상의 왼쪽이 환자의 오른쪽(R)인 영상의학 관례를 따릅니다.
 */
(function (global) {
  'use strict';

  // ---------- 결정론적 난수 / 노이즈 ----------
  function hash2(ix, iy, seed) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  function valueNoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y, seed, octaves) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm; // 0..1
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function inEllipse(x, y, cx, cy, a, b, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const dx = x - cx, dy = y - cy;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    return (u * u) / (a * a) + (v * v) / (b * b) <= 1;
  }

  // ---------- 조직 강도 (0..1) ----------
  const T = { air: 0.02, fat: 0.8, muscle: 0.38, bone: 0.06, diploe: 0.42, csf: 0.1, gm: 0.46, wm: 0.72, deep: 0.55 };

  // 정규화 좌표 (x, y ∈ [-1, 1]) 한 점의 강도
  function intensity(x, y, seed) {
    const A = 0.76, B = 0.92; // 머리 외곽 타원 (세로가 더 김)
    const theta = Math.atan2(y / B, x / A);
    const rho = Math.hypot(x / A, y / B);
    const wobble = 0.02 * (fbm(Math.cos(theta) * 1.5 + 4, Math.sin(theta) * 1.5 + 4, seed, 3) - 0.5);
    const r = rho + wobble;

    if (r > 1.0) return T.air;
    if (r > 0.955) return T.fat;
    if (r > 0.935) return T.muscle;
    if (r > 0.875) return r > 0.895 && r < 0.915 ? T.diploe : T.bone;
    if (r > 0.86) return T.csf;

    // --- 뇌 실질 ---
    const n = fbm(x * 4 + 11, y * 4 + 11, seed, 4);
    const g = Math.sin(theta * 22 + 13 * n); // 이랑(gyri)/고랑(sulci) 패턴 — 노이즈로 위상을 흔들어 불규칙하게
    const wmEdge = 0.64 + 0.13 * Math.max(g, 0) + 0.08 * (n - 0.5);

    // 대뇌 종렬(좌우 반구 사이 틈) — 앞쪽과 뒤쪽
    const fissureW = 0.011 + 0.006 * n;
    if (Math.abs(x) < fissureW && (y < -0.3 || y > 0.42)) return T.csf;

    // 고랑: 표면에서 안쪽으로 들어오는 뇌척수액
    if (g < -0.8 && r > wmEdge - 0.03) return T.csf;

    if (r > wmEdge) return T.gm; // 피질(회백질)

    // --- 심부 구조 (나중에 그린 것이 위에 덮임) ---
    // 측뇌실 전각 (V자로 벌어짐) + 삼각부
    if (inEllipse(x, y, -0.065, -0.1, 0.042, 0.17, 0.32) || inEllipse(x, y, 0.065, -0.1, 0.042, 0.17, -0.32)) return T.csf;
    if (inEllipse(x, y, -0.17, 0.31, 0.032, 0.12, -0.55) || inEllipse(x, y, 0.17, 0.31, 0.032, 0.12, 0.55)) return T.csf;
    // 제3뇌실
    if (Math.abs(x) < 0.013 && y > 0.02 && y < 0.17) return T.csf;
    // 미상핵 머리
    if (inEllipse(x, y, -0.14, -0.13, 0.05, 0.085, 0.3) || inEllipse(x, y, 0.14, -0.13, 0.05, 0.085, -0.3)) return T.deep;
    // 시상
    if (inEllipse(x, y, -0.085, 0.1, 0.07, 0.095, 0) || inEllipse(x, y, 0.085, 0.1, 0.07, 0.095, 0)) return T.deep;
    // 조가비핵
    if (inEllipse(x, y, -0.25, -0.01, 0.045, 0.13, 0.15) || inEllipse(x, y, 0.25, -0.01, 0.045, 0.13, -0.15)) return T.deep - 0.04;

    return T.wm;
  }

  /**
   * size×size 합성 MRI를 ImageData(RGBA, 회색조)로 만듭니다.
   * 2×2 슈퍼샘플링으로 경계를 부드럽게 하고, 약한 바이어스 필드와 노이즈를 더합니다.
   */
  function generateBrain(size, seed = 7) {
    const img = new ImageData(size, size);
    const d = img.data;
    const rand = mulberry32(seed * 9973);
    const offs = [0.25, 0.75];
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        let v = 0;
        for (const oy of offs) {
          for (const ox of offs) {
            const x = ((px + ox) / size) * 2 - 1;
            const y = ((py + oy) / size) * 2 - 1;
            v += intensity(x, y, seed);
          }
        }
        v /= 4;
        const x0 = (px / size) * 2 - 1, y0 = (py / size) * 2 - 1;
        v *= 1 + 0.16 * (fbm(x0 * 0.9 + 30, y0 * 0.9 + 30, seed + 3, 2) - 0.5); // 바이어스 필드
        v += (rand() + rand() + rand() - 1.5) * 0.035; // 노이즈
        const g = Math.max(0, Math.min(255, Math.round(v * 255)));
        const i = (py * size + px) * 4;
        d[i] = d[i + 1] = d[i + 2] = g;
        d[i + 3] = 255;
      }
    }
    return img;
  }

  global.generateBrain = generateBrain;
})(window);
