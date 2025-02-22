// - attributes
in vec3 position;
in float instanceScale;
in vec3 instancePosition;

// - varying
out vec3 vColor

void main() {
  vec3 transformed = position * instanceScale + instancePosition;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(transformed, 1.0);

  vColor = vec3(instancePosition.x, instancePosition.y, instancePosition.z) * 0.001;
}