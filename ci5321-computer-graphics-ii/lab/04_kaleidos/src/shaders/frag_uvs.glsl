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
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  fragColor = vec4(uv.x, uv.y, 0.0, 1.0);
}
