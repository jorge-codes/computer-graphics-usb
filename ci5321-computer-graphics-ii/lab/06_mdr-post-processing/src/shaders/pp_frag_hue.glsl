precision mediump float;

// this is expected name unless we want to build our own custom shader pass
uniform sampler2D tDiffuse;
// hue value in degrees, set from TS (0.0 to 360.0)
uniform float uHue;

in vec2 vUv;
out vec4 fragColor;

// Converts an HSV value (S=1, V=1) to RGB
// We only need the Hue because we set saturation and value to 1 to get the purest color possible
vec3 hueToRGB(float hue) {
    float h = mod(hue, 360.0) / 60.0;
    float f = h - floor(h);

    // The values are derived from the HSV to RGB conversion formula, simplified for S=1 and V=1
    float p = 0.0;          // V*(1-S)   = 0
    float q = 1.0 - f;      // V*(1-S*f) simplified
    float t = f;            // V*(1-S*(1-f)) simplified

    int sector = int(floor(h));

    if (sector == 0) return vec3(1.0,  t,   p);
    if (sector == 1) return vec3(q,    1.0, p);
    if (sector == 2) return vec3(p,    1.0, t);
    if (sector == 3) return vec3(p,    q,   1.0);
    if (sector == 4) return vec3(t,    p,   1.0);
                     return vec3(1.0,  p,   q);  // sector 5
}

void main() {
    vec4 gray = texture(tDiffuse, vUv);
    // Assuming the input texture is already desaturated, we can use the red channel as the luminance
    float luminance = gray.r;

    vec3 color = hueToRGB(uHue);

    // We modulate the pure color with the luminance of the image
    // This maintains the intensity of the original image while changing the hue
    fragColor = vec4(color * luminance, gray.a);
}
