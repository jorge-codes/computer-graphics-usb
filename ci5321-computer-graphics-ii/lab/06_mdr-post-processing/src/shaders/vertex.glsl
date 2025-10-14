precision mediump float;

// uniforms
uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
// - custom uniforms
uniform float uTime;

// - attributes
in vec3 position;
in vec3 normal;
in vec2 uv;

// - varying
out vec3 vPosition;
out vec3 vNormal;
out vec2 vUv;

void main() {
  // base vertex shader
  vec4 viewPosition = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = viewPosition;

  vPosition = position;
  vNormal = normal;
  vUv = uv;
}
