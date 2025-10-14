// #version 300 es
precision mediump float;

uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
// - custom uniforms
uniform float uTime;

// - attributes
in vec3 position;
in vec3 normal;
in vec2 uv;
// - custom
in float a_random;

// - varying
out float vHeight;
out vec2 vUv;

vec4 clipSpaceTransform(vec4 modelPosition) {
  // already modelMatrix multiplied
  return projectionMatrix * viewMatrix * modelPosition;
}

void main() {
  vec2 frequency = vec2(9, -5);
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);

  float elevation = sin(modelPosition.x * frequency.x - uTime) * 0.1;
  elevation += sin(modelPosition.y * frequency.y - uTime) * 0.1;
  modelPosition.z = elevation;
  vec4 viewPosition = clipSpaceTransform(modelPosition);

  gl_Position = viewPosition;

  vHeight = elevation;
  vUv = uv;
}
