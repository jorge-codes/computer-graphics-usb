#version 300 es
// FixedFunction (FF) v1.2 vertex shader.
// Emulates the OpenGL 2 fixed-function vertex stage, in WORLD space.
// Read it, but do not edit it.
precision highp float;

const int MAX_LIGHTS = 8; // v1.2: eight lights, directional, point or spot

struct Light {
  bool enabled;
  vec4 position; // world space. w = 0: directional, xyz points TOWARD the light. w = 1: positional
  vec4 ambient;
  vec4 diffuse;
  vec4 specular;
  vec3 attenuation;    // constant, linear, quadratic. GL2: GL_CONSTANT/LINEAR/QUADRATIC_ATTENUATION
  vec3 spotDirection;  // world space, unit length. FF normalizes it on the CPU. GL2: GL_SPOT_DIRECTION
  float spotCosCutoff; // cos(GL_SPOT_CUTOFF). FF stores -2 for "not a spot", so no branch is needed
  float spotExponent;  // GL2: GL_SPOT_EXPONENT. FF uploads 0 when the light is not a spot
};

struct Material {
  vec4 ambient;
  vec4 diffuse;
  vec4 specular;
  vec4 emissive; // GL2: GL_EMISSION
  float shininess;
};

// Attribute slots. GL2: glVertexPointer, glNormalPointer, glColorPointer, glTexCoordPointer. Lectures 2A, 6A.
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color;
layout(location = 3) in vec2 a_uv;

// Matrices. GL2: the modelview matrix, split in model and view. Lecture 2B.
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat3 u_normalMatrix; // inverse transpose of the model matrix, upper 3x3
uniform mat3 u_textureMatrix; // GL2: the texture matrix, 2D affine. Lecture 6A.
uniform vec3 u_eyePosition;  // world space. Computed by FF from the view matrix.

// Switches. GL2: glEnable(GL_LIGHTING), glEnable(GL_COLOR_MATERIAL), glEnable(GL_FOG).
// GL_TEXTURE_2D is a switch too, but the fragment shader reads it.
uniform bool u_lighting;
uniform bool u_colorMaterial;
uniform bool u_fog;

uniform vec4 u_globalAmbient; // GL2: GL_LIGHT_MODEL_AMBIENT
uniform Light u_lights[MAX_LIGHTS];
uniform Material u_material;

// Linear fog. GL2: GL_FOG_START, GL_FOG_END. Distances in eye space. Lecture 9B.
uniform float u_fogStart;
uniform float u_fogEnd;

out vec4 v_primary;   // ambient + diffuse + emission, with alpha
out vec3 v_specular;  // added after texturing
out vec2 v_uv;        // texture coordinates, after the texture matrix
out float v_fogFactor; // 1 = no fog, 0 = full fog

void main() {
  // Vertex position. GL2: gl_ModelViewProjectionMatrix * gl_Vertex. Lecture 2B.
  vec4 worldPosition = u_model * vec4(a_position, 1.0);
  gl_Position = u_projection * u_view * worldPosition;

  // Texture coordinates. GL2: the texture matrix applied to gl_MultiTexCoord0. Lecture 6A.
  v_uv = (u_textureMatrix * vec3(a_uv, 1.0)).xy;

  // Linear fog factor, per vertex. GL2: GL_FOG with GL_FOG_MODE = GL_LINEAR. Lecture 9B.
  // GL2 fog depends on the eye-space distance. FF uses the radial distance from the camera.
  // The factor is 1 when fog is off. Lit and unlit draws both use it.
  float eyeDistance = length((u_view * worldPosition).xyz);
  v_fogFactor = u_fog ? clamp((u_fogEnd - eyeDistance) / (u_fogEnd - u_fogStart), 0.0, 1.0) : 1.0;

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

  // Emission and global ambient. GL2: GL_EMISSION, GL_LIGHT_MODEL_AMBIENT. Lecture 9A.
  vec3 primary = u_material.emissive.rgb + ka.rgb * u_globalAmbient.rgb;
  vec3 specular = vec3(0.0);

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (!u_lights[i].enabled) continue;

    vec3 l;           // unit vector from the vertex toward the light
    float att = 1.0;  // attenuation
    float spot = 1.0; // spotlight factor

    if (u_lights[i].position.w == 0.0) {
      // Directional light (w = 0). No attenuation, no spot. Lecture 9A.
      l = normalize(u_lights[i].position.xyz);
    } else {
      // Positional light (w = 1). GL2: GL_POSITION with w = 1. Lecture 9A.
      vec3 toLight = u_lights[i].position.xyz - worldPosition.xyz;
      float d = length(toLight);
      l = toLight / d;

      // Distance attenuation. GL2: 1 / (kc + kl d + kq d^2). Lecture 9A.
      att = 1.0 / (u_lights[i].attenuation.x + u_lights[i].attenuation.y * d + u_lights[i].attenuation.z * d * d);

      // Spotlight cone. GL2: GL_SPOT_CUTOFF, GL_SPOT_EXPONENT. Lecture 9A.
      // Outside the cone the factor is 0. Inside, it is max(-l.s, 0)^exponent.
      // A light that is not a spot has spotCosCutoff = -2, so it is never outside the cone.
      // Its exponent is 0, so the factor is 1. GL2 gives pow(x, 0) = 1, but GLSL leaves pow(0, 0) undefined.
      float spotDot = dot(-l, u_lights[i].spotDirection);
      spot = spotDot < u_lights[i].spotCosCutoff
        ? 0.0
        : (u_lights[i].spotExponent > 0.0 ? pow(max(spotDot, 0.0), u_lights[i].spotExponent) : 1.0);
    }

    // Ambient and Lambert diffuse. GL2: GL_AMBIENT, GL_DIFFUSE. Lecture 9A.
    float nDotL = dot(n, l);
    primary += att * spot * ka.rgb * u_lights[i].ambient.rgb;
    primary += att * spot * kd.rgb * u_lights[i].diffuse.rgb * max(nDotL, 0.0);

    // Phong specular with the reflection vector r = 2(n.l)n - l. GL2: GL_SPECULAR. Lecture 9A.
    // GL2 uses the Blinn half-vector. FF uses Phong by course decision.
    if (nDotL > 0.0) {
      vec3 r = 2.0 * nDotL * n - l;
      // shininess = 0 would make pow(0, 0) undefined in GLSL. GL2 gives 1.
      float f = u_material.shininess > 0.0 ? pow(max(dot(r, v), 0.0), u_material.shininess) : 1.0;
      specular += att * spot * u_material.specular.rgb * u_lights[i].specular.rgb * f;
    }
  }

  v_primary = vec4(clamp(primary, 0.0, 1.0), kd.a);
  v_specular = specular;
}
