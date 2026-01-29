// #version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor;

vec3 white = vec3(1.0, 1.0, 1.0);
vec3 red = vec3(1.0, 0.0, 0.0);
vec3 green = vec3(0.0, 1.0, 0.0);
vec3 blue = vec3(0.0, 0.0, 1.0);

void main() {
  // step 0 - show colors
  // use different color params: white | red | green | blue
  vec4 color = vec4(white, 1.0);
  fragColor = color;
  // ----------------------------------------

  // step 1 - basic operations
  // vec4 red4 = vec4(red, 1.0);
  // vec4 green4 = vec4(green, 1.0);
  // fragColor = red4 + green4; //yellow=red+green
  // ----------------------------------------

  // step 2 - show swizzling
  // swizzling: https://wikis.khronos.org/opengl/Data_Type_(GLSL)#Swizzling
  // more info: https://wikis.khronos.org/opengl/GLSL_Optimizations
  // Normalize fragment coordinates to [0.0, 1.0] range
  // vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  // fragColor = vec4(uv, 0.0, 1.0);
  // it's shorthand for:
  // float u = gl_FragCoord.x / u_resolution.x;
  // float v = gl_FragCoord.y / u_resolution.y;
  // vec2 uv = vec2(u, v);
  // fragColor = vec4(uv, 0.0, 1.0);
  // ----------------------------------------

  // step 3 - more operations
  // vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  // float z = 1.0 - max(uv.x, uv.y);
  // fragColor = vec4(uv.x, uv.y, z, 1.0);
  // ----------------------------------------

  // step 4 - more operations
  // vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  // float z = 1.0 - abs(uv.x - uv.y);
  // fragColor = vec4(uv.x, uv.y, z, 1.0);
  // ----------------------------------------

  // step 5 - name here
  // Normalization, as we already learned
  // vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  // Shift origin from bottom-left corner to screen center
  // Range changes from [0.0, 1.0] to [-0.5, 0.5]
  // uv = uv - 0.5;
  // Divide fragments to areas (test one by one)
  // uv *= u_resolution / 40.0;// a
  // uv *= u_resolution / 10.0;// b
  // uv *= u_resolution * 1.0;// c
  // 
  // vec3 color = vec3(uv, 0.0);
  // fragColor = vec4(color, 1.0);
  // ----------------------------------------

}
