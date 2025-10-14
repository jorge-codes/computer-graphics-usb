precision mediump float;

// uniforms
uniform vec3 uColor;
uniform sampler2D uTexture;

// varyings
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;

out vec4 fragColor;

vec4 blueColor = vec4(0.3, 0.4, 1., 1.);
vec4 whiteColor = vec4(1.0, 1.0, 1.0, 1.0);
void main() {
  vec4 textureColor = texture(uTexture, vUv);

  fragColor = textureColor;
}
