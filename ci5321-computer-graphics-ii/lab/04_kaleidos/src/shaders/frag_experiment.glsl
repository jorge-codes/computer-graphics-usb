precision mediump float;

// uniforms
uniform float uTime;
uniform vec2 uResolution;
uniform vec4 uColor;
uniform sampler2D uTexture;

// varyings
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
  vec2 uv0 = uv;
  vec3 finalColor = vec3(0.0);

  uv *= 2.0;

  // uv = fract(uv);
  // uv -= 0.5;

  float d = length(uv);
  vec3 col = paletteFixed(length(uv0) + uTime * 0.3);

  float thickness = 9.0;
  d = sin(d * thickness + uTime) / thickness;
  d = abs(d);

  d = 0.02 / d;

  finalColor += col * d;

  fragColor = vec4(finalColor, 1.0);
}
