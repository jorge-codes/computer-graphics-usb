precision mediump float;

// uniforms
uniform vec4 uColor;
uniform sampler2D uTexture;

// varyings
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;

out vec4 fragColor;

// there is no null check in GLSL and no short-circuit or
// so we use a sentinel color (check main.ts uColor initial assignment)
vec4 sentinelColor = vec4(-1.0, -1.0, -1.0, -1.0);
vec4 whiteColor = vec4(1.0);
void main() {
  vec4 color = (uColor == sentinelColor) ? whiteColor : uColor;
  vec4 textureColor = texture(uTexture, vUv);

  fragColor = textureColor * color;
}
