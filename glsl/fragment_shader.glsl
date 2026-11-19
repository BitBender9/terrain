#version 300 es
precision highp float;
uniform vec3 lightdir;
uniform vec3 lightcolor;
uniform vec3 eyepos;
uniform float heightMin;
uniform float heightMax;
out vec4 fragColor;
in vec3 vnormal;
in vec3 vpos;
void main()
{
    vec3 n = normalize(vnormal);
    vec3 L = normalize(lightdir);
    vec3 V = normalize(eyepos - vpos);
    vec3 H = normalize(L + V);

    // Normalize altitude to [0,1], then lerp through a rainbow of stops.
    float t = clamp((vpos.y - heightMin) / max(heightMax - heightMin, 1e-5), 0.0, 1.0);
    vec3 c0 = vec3(0.4, 0.0, 0.6); // violet
    vec3 c1 = vec3(0.0, 0.2, 0.9); // blue
    vec3 c2 = vec3(0.0, 0.8, 0.8); // cyan
    vec3 c3 = vec3(0.1, 0.8, 0.1); // green
    vec3 c4 = vec3(0.95, 0.85, 0.1); // yellow
    vec3 c5 = vec3(0.95, 0.15, 0.1); // red

    float s = t * 5.0;
    vec3 color = mix(c0, c1, clamp(s, 0.0, 1.0));
    color = mix(color, c2, clamp(s - 1.0, 0.0, 1.0));
    color = mix(color, c3, clamp(s - 2.0, 0.0, 1.0));
    color = mix(color, c4, clamp(s - 3.0, 0.0, 1.0));
    color = mix(color, c5, clamp(s - 4.0, 0.0, 1.0));

    float lambert = max(dot(n, L), 0.0);
    float blinn = pow(max(dot(n, H), 0.0), 150.0);
    fragColor = vec4(color * lightcolor * lambert + lightcolor * blinn * 2.0, 1.0);
}
