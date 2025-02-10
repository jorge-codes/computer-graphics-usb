precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor;

vec3 colorBlue = vec3(0.2, 0.3, 1.0);
vec3 colorWhite = vec3(1.0);
float opacity = 1.0;

void main() {
  vec3 color = colorBlue;
  // vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  fragColor = vec4(color, opacity);
}