// #version 300 es
precision mediump float;

// uniforms
uniform vec3 uColor;
uniform sampler2D uTexture;

// varyings
in float vHeight;
in vec2 vUv;

out vec4 fragColor;

vec4 blueColor = vec4(0.3, 0.4, 1., 1.);
void main() {
  // some tutorials will use texture2D, which is deprecated
  vec4 textureColor = texture(uTexture, vUv);
  textureColor.rgb *= vHeight * 2.0 + 0.65;

  fragColor = textureColor;
}
