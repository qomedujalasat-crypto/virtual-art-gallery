'use strict';

const loadTexture = async (texture, url) => {
    const result = await fetch(url);
    const blob = await result.blob();
    const data = await createImageBitmap(blob);
    texture({data,
        wrapS: 'repeat',
        wrapT: 'repeat'
    });
};

module.exports = (regl, data, useReflexion) => {
    const wallTexture = regl.texture();
    const floorTexture = regl.texture();
    loadTexture(wallTexture, "res/wall.jpg");
    loadTexture(floorTexture, "res/floor.jpg");
    return regl({
        frag: `
        precision lowp float;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform sampler2D wallTexture;
        uniform sampler2D floorTexture;

        void main() {
            float dist = length(v_relativepos);
            vec3 totalLight;

            // Classify horizontal surfaces by their normals, not their height.
            if (v_normal.y < -0.5) {
                // Plain white ceiling.
                totalLight = vec3(0.97, 0.97, 0.96);
            } else if (v_normal.y > 0.5) {
                // Light marble floor with subtle, low-contrast veins.
                vec3 stone = vec3(0.92, 0.90, 0.86);
                vec3 textureColor = texture2D(floorTexture, v_pos.xz / 8.0).rgb;
                totalLight = mix(stone, textureColor, 0.06);
                float pattern = sin((v_pos.x + v_pos.z * 0.65) * 2.4
                    + sin(v_pos.x * 0.7 + v_pos.z * 0.3) * 2.0);
                float vein = pow(1.0 - abs(pattern), 18.0);
                totalLight = mix(totalLight, vec3(0.68, 0.66, 0.62), vein * 0.14);
            } else {
                // Solid warm beige wall color; deliberately avoid the dark wall texture.
                totalLight = vec3(0.82, 0.75, 0.64);
                float softLight = mix(0.94, 1.0, smoothstep(0.1, 0.12, v_pos.y));
                totalLight *= softLight;
            }

            float alpha = .98 + smoothstep(150., 0., dist) - v_normal.y;
            gl_FragColor = vec4(totalLight, ${useReflexion ? "alpha" : "1.0"});
        }`,

        vert: `
        precision highp float;
        uniform mat4 proj, view;
        attribute vec3 position, normal;
        varying vec3 v_pos, v_relativepos, v_normal;
        uniform float yScale;
        void main() {
            vec3 pos = position;
            v_pos = pos;
            v_relativepos = (view * vec4(pos, 1)).xyz;
            pos.y *= yScale;
            v_normal = normal;
            gl_Position = proj * view * vec4(pos, 1);
        }`,

        attributes: {
            position: data.position,
            normal: data.normal
        },

        blend: useReflexion ? {
            enable: true,
            func: {
                src: 'src alpha',
                dst: 'one minus src alpha'
            },
        } : {},

        uniforms: {
            wallTexture,
            floorTexture
        },

        elements: new Uint32Array(data.elements)
    });
};
