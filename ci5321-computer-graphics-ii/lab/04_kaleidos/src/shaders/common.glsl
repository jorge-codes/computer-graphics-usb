precision mediump float;
#define PI 3.14159

// reference material:
// https://iquilezles.org/articles/palettes/
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

vec3 paletteFixed(float t) {
  vec3 a = vec3(.5);
  vec3 b = vec3(.5);
  vec3 c = vec3(1.);
  vec3 d = vec3(.263, .416, .557);
  return palette(t, a, b, c, d);
  // return a + b * cos(6.28318 * (c * t + d));
}

// reference material: 
// https://iquilezles.org/articles/distfunctions2d/
// p -> fragment point
// r -> radius
float sdfCircle(vec2 p, float r) {
  return length(p) - r;
}

// reference material: 
// https://iquilezles.org/articles/distfunctions2d/
// p -> fragment point
// b -> box dimension
float sdfBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
