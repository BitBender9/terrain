#version 300 es
precision highp float;
uniform vec4 color;
uniform vec3 lightdir;
uniform vec3 lightcolor;
uniform vec3 eyepos;
out vec4 fragColor;
in vec3 vnormal;
in vec3 vpos;
void main() {
    vec3 n = normalize(vnormal);
    vec3 L = normalize(lightdir);
    vec3 V = normalize(eyepos - vpos);
    vec3 H = normalize(L + V);
    float lambert = max(dot(n, L), 0.0);
    float blinn = pow(max(dot(n, H), 0.0), 150.0);
    fragColor = vec4(
        color.rgb * lightcolor * lambert
        + lightcolor * blinn * 2.0
    , color.a);
}
