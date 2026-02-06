precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_texture;

in float v_random;
in float v_depth;
in vec2 v_uv;
in float v_yorch;

out vec4 fragColor;

vec4 someColor = vec4(0.2, 0.3, 1.0, 1.0);

// "original" I guess(?)
// https://stackoverflow.com/a/17897228/99862
// the whole four: HSV and HSL to RGB and viceversa
// https://www.shadertoy.com/view/XljGzV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // 0 - no changes
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  fragColor = vec4(uv.x, uv.y, 1.0, 1.0);

  // // 1 - receiving varying pt1
  // fragColor = vec4(0.6, v_random, 1.0, 1.0);

  // 2 - receiving varying pt2
  // vec3 myBlue = vec3(0.15, 0.5, 1.0);
  // vec3 hsv = rgb2hsv(myBlue);
  // hsv.y = 1.0 - v_depth * 0.5;
  // vec3 rgb = hsv2rgb(hsv);
  // fragColor = vec4(rgb, 1.0);

}
