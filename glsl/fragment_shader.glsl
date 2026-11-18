#version 300 es
precision highp float;
uniform vec3 lightdir;
uniform vec3 lightcolor;
uniform vec3 eyepos;
out vec4 fragColor;
in vec3 vnormal;
in vec3 vpos;
void main()
{
    vec3 n = normalize(vnormal);
    vec3 L = normalize(lightdir);
    vec3 V = normalize(eyepos - vpos);
    vec3 H = normalize(L + V);

    // Flat when n.y is near 1; cliffs when near 0. Crisp pick via step.
    float shallow = step(0.5, n.y);
    vec3 color = mix(vec3(0.6, 0.3, 0.3), vec3(0.2, 0.6, 0.1), shallow);
    float shininess = mix(20.0, 150.0, shallow);
    float specularScale = mix(0.4, 2.0, shallow);

    float lambert = max(dot(n, L), 0.0);
    float blinn = pow(max(dot(n, H), 0.0), shininess) * specularScale;
    fragColor = vec4(color * lightcolor * lambert + lightcolor * blinn, 1.0);
}
