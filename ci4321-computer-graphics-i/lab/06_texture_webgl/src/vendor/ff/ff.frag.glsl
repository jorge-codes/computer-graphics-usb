#version 300 es
// FixedFunction (FF) v1.2 fragment shader.
// GL2: texture environment, color sum and fog stages. Lectures 2A, 6A, 9B.
precision mediump float;

in vec4 v_primary;    // interpolated across the triangle (Gouraud)
in vec3 v_specular;
in vec2 v_uv;
in float v_fogFactor;

uniform sampler2D u_sampler; // always texture unit 0. FF sets it once, at creation
uniform bool u_texture2D;    // GL2: glEnable(GL_TEXTURE_2D)
uniform vec4 u_fogColor;     // GL2: GL_FOG_COLOR

out vec4 outColor;

void main() {
  // Texturing. GL2: GL_TEXTURE_2D on unit 0. White when texturing is off. Lecture 6A.
  vec4 t = u_texture2D ? texture(u_sampler, v_uv) : vec4(1.0);

  // GL2: GL_TEXTURE_ENV_MODE = GL_MODULATE on the primary color. Alpha includes the texture alpha. Lecture 6A.
  vec4 color = vec4(t.rgb * v_primary.rgb, t.a * v_primary.a);

  // GL2: GL_SEPARATE_SPECULAR_COLOR. Specular is added after texturing. Lecture 9A.
  color.rgb += v_specular;

  // GL2: GL_FOG with GL_LINEAR. The factor is 1 when fog is off. Lecture 9B.
  color.rgb = mix(u_fogColor.rgb, color.rgb, v_fogFactor);

  outColor = color;
}
