#version 300 es
// FixedFunction (FF) v1.0 vertex shader.
// Emulates the OpenGL 2 fixed-function vertex stage, in WORLD space.
// Read it, but do not edit it.
precision highp float;

const int MAX_LIGHTS = 1; // v1.0: one directional light

struct Light {
  bool enabled;
  vec4 position; // world space. w = 0: directional, xyz points TOWARD the light
  vec4 ambient;
  vec4 diffuse;
  vec4 specular;
};

struct Material {
  vec4 ambient;
  vec4 diffuse;
  vec4 specular;
  float shininess;
};

// Attribute slots. GL2: glVertexPointer, glNormalPointer, glColorPointer. Lecture 2A.
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color;
// layout(location = 3) in vec2 a_uv;  // reserved. Sampled from v1.1.

// Matrices. GL2: the modelview matrix, split in model and view. Lecture 2B.
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat3 u_normalMatrix; // inverse transpose of the model matrix, upper 3x3
uniform vec3 u_eyePosition;  // world space. Computed by FF from the view matrix.

// Switches. GL2: glEnable(GL_LIGHTING), glEnable(GL_COLOR_MATERIAL).
uniform bool u_lighting;
uniform bool u_colorMaterial;

uniform vec4 u_globalAmbient; // GL2: GL_LIGHT_MODEL_AMBIENT
uniform Light u_lights[MAX_LIGHTS];
uniform Material u_material;

out vec4 v_primary;  // ambient + diffuse + emission, with alpha
out vec3 v_specular; // added after texturing in later versions

void main() {
  // Vertex position. GL2: gl_ModelViewProjectionMatrix * gl_Vertex. Lecture 2B.
  vec4 worldPosition = u_model * vec4(a_position, 1.0);
  gl_Position = u_projection * u_view * worldPosition;

  // Unlit path. GL2: LIGHTING disabled. Output is the color attribute. Lecture 2A.
  if (!u_lighting) {
    v_primary = a_color;
    v_specular = vec3(0.0);
    return;
  }

  vec3 n = normalize(u_normalMatrix * a_normal);
  vec3 v = normalize(u_eyePosition - worldPosition.xyz);

  // GL2: GL_COLOR_MATERIAL with GL_AMBIENT_AND_DIFFUSE.
  vec4 ka = u_colorMaterial ? a_color : u_material.ambient;
  vec4 kd = u_colorMaterial ? a_color : u_material.diffuse;

  vec3 primary = ka.rgb * u_globalAmbient.rgb; // k_e (emission) arrives in v1.1
  vec3 specular = vec3(0.0);

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (!u_lights[i].enabled) continue;

    // v1.0: directional lights only (w = 0).
    vec3 l = normalize(u_lights[i].position.xyz);

    // Ambient and Lambert diffuse. GL2: GL_AMBIENT, GL_DIFFUSE. Lecture 9A.
    float nDotL = dot(n, l);
    primary += ka.rgb * u_lights[i].ambient.rgb;
    primary += kd.rgb * u_lights[i].diffuse.rgb * max(nDotL, 0.0);

    // Phong specular with the reflection vector r = 2(n.l)n - l. GL2: GL_SPECULAR. Lecture 9A.
    // GL2 uses the Blinn half-vector. FF uses Phong by course decision.
    if (nDotL > 0.0) {
      vec3 r = 2.0 * nDotL * n - l;
      // shininess = 0 would make pow(0, 0) undefined in GLSL. GL2 gives 1.
      float f = u_material.shininess > 0.0 ? pow(max(dot(r, v), 0.0), u_material.shininess) : 1.0;
      specular += u_material.specular.rgb * u_lights[i].specular.rgb * f;
    }
  }

  v_primary = vec4(clamp(primary, 0.0, 1.0), kd.a);
  v_specular = specular;
}
