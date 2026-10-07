#version 300 es
// FixedFunction (FF) v1.0 fragment shader.
// GL2: the color sum stage. Texturing arrives in v1.1. Lecture 2A.
precision mediump float;

in vec4 v_primary;  // interpolated across the triangle (Gouraud)
in vec3 v_specular;

out vec4 outColor;

void main() {
  // GL2: GL_SEPARATE_SPECULAR_COLOR. Specular is added last.
  outColor = vec4(v_primary.rgb + v_specular, v_primary.a);
}
