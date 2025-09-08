// 프래그먼트 셰이더
precision highp float;

// 버텍스 셰이더에서 넘어온 월드 좌표 (x, y, z)
varying vec3 vWorldPos;

// --- 유니폼들: JS → 셰이더로 전달되는 값들 ---

// 그리드 색상 & 선 두께
uniform vec3  uColorMinor;   // 1 유닛 눈금 색
uniform vec3  uColorMajor;   // 10 유닛 눈금 색
uniform float uLineWidth1;   // 1 유닛 눈금 두께 (픽셀 단위)
uniform float uLineWidth10;  // 10 유닛 눈금 두께 (픽셀 단위)

// 십자(+) 마커 설정
uniform vec3  uCrossColor;      // 십자 색상
uniform float uCrossScale;      // 십자 간격 (1.0 → 1 유닛마다)
uniform float uCrossSize;       // 십자 팔 길이 (월드 단위)
uniform float uCrossThick;      // 십자 두께 (픽셀 단위)
uniform float uCrossIntensity;  // 십자 강도 (0~1)

// 페이드 효과
uniform float uFadeDistance;    // 카메라로부터 사라지기 시작하는 거리
uniform vec3  uCamPos;          // 카메라 월드 위치

// 그리드 이동 오프셋 (xz 평면에서)
uniform vec2  uOffset;

//
// fwidth()를 이용한 부드러운 안티에일리어싱 그리드
//
float gridLine(in vec2 p, float scale, float widthPx) {
  // 셀 좌표 (간격 = scale)
  vec2 q = (p + uOffset) / scale;

  // 셀의 중앙 기준 좌표 (0.0 부근이 선 위치)
  vec2 g = abs(fract(q - 0.5) - 0.5);

  // 픽셀 단위 미분값 (픽셀 크기에 따른 보정용)
  vec2 fw = fwidth(q);

  // x축 선 (|x|가 0일 때 선) → smoothstep으로 경계 부드럽게
  float lx = 1.0 - smoothstep(0.0, fw.x * widthPx, g.x);

  // z축 선 (|y|가 0일 때 선)
  float lz = 1.0 - smoothstep(0.0, fw.y * widthPx, g.y);

  // 둘 중 강한 선만 남기기
  return clamp(max(lx, lz), 0.0, 1.0);
}

//
// 십자(+) 패턴 (셀 중심에 표시)
//
float crossPattern(in vec2 p) {
  // 셀 간격 (uCrossScale이 0이 되는 걸 방지)
  float s = max(0.00001, uCrossScale);

  // 셀 좌표계로 정규화
  vec2 q = (p + uOffset) / s;

  // 셀 중심 기준 좌표 (-0.5 ~ 0.5)
  vec2 c = fract(q) - 0.5;

  // 십자 팔 길이 (월드 단위 → 셀 단위로 환산)
  float arm = clamp(uCrossSize / s, 0.0, 0.5);

  // 픽셀 크기에 맞춰 십자 두께 보정
  vec2 fw = fwidth(q);
  float t = uCrossThick * max(fw.x, fw.y);

  // 수평 팔: y값이 얇고, x는 팔 길이 안쪽
  float horiz = 1.0 - max(
    smoothstep(arm, arm + t, abs(c.x)),
    smoothstep(0.0, t, abs(c.y))
  );

  // 수직 팔: x값이 얇고, y는 팔 길이 안쪽
  float vert = 1.0 - max(
    smoothstep(0.0, t, abs(c.x)),
    smoothstep(arm, arm + t, abs(c.y))
  );

  // 수평·수직 중 더 강한 쪽 사용
  return clamp(max(horiz, vert), 0.0, 1.0);
}

void main() {
  // 현재 픽셀의 월드 xz 좌표
  vec2 p = vWorldPos.xz;

  // 그리드 두 종류 (1 단위, 10 단위)
  float minor = gridLine(p, 1.0,  uLineWidth1);
  float major = gridLine(p, 10.0, uLineWidth10);

  // 색상 혼합: major가 1일 때는 굵은 선 색이 우선
  vec3  lineCol = mix(uColorMinor, uColorMajor, major);

  // 라인 알파: 두 종류 중 더 강한 값
  float lineA   = max(minor, major);

  // 십자 마커 계산
  float crossM   = crossPattern(p);
  vec3  crossCol = uCrossColor;
  float crossA   = crossM * uCrossIntensity;

  // 라인과 십자 합성
  vec3  col   = mix(lineCol, crossCol, crossA);
  float alpha = max(lineA, crossA);

  // 카메라 거리 기반 페이드
  float dist = distance(uCamPos, vWorldPos);
  float fade = smoothstep(uFadeDistance, 0.0, dist);
  alpha *= fade;

  // 너무 약한 픽셀은 버려서 성능 최적화
  if (alpha < 0.01) discard;

  // 최종 색상 출력 (투명도 포함)
  gl_FragColor = vec4(col, alpha);
}