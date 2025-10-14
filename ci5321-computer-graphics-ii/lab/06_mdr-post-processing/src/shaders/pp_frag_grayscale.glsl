precision mediump float;

// this is expected name unless we want to build our own custom shader pass
uniform sampler2D tDiffuse;
uniform float uIntensity;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 color = texture(tDiffuse, vUv);
  // Convert to grayscale using the luminance formula
  // this is used to calculate the perceived brightness of a color
  // you can see that vec3, axis by ammounts to 1.0
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 grayscale = vec3(gray);
  color.rgb = mix(color.rgb, grayscale, uIntensity);
  fragColor = color;
}
