import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { TAARenderPass } from 'three/addons/postprocessing/TAARenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// --- Scene Setup ---
let scene = new THREE.Scene();
// scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({color:0xffff00, side:THREE.DoubleSide}));
// scene.fog = new THREE.Fog(0x050505, 5, 50);

// --- Camera Setup ---
let camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
// const aspect = window.innerWidth / window.innerHeight; // 'window' because we're adding the scene to the document.body, not in a div.
// const zoom = 2; // It controls the "zoom" level. Mathmatically it is "half frustum (orthographic camera) size" if aspect is around 1. Larger the zoom, larger the captured (zoomed out) area of 'scene'.
// let camera = new THREE.OrthographicCamera(-zoom * aspect, zoom * aspect, zoom, -zoom, 0.1, 1000); // left, right, top, bottom, near, far.
                                                                                                // |------ rectangle ------| |👁 range|
camera.position.set(0, 0, 15); // 5. After creating the rectangle camera above, we position it in the scene.

// --- Renderer Setup ---
let renderer = null, composer = null, taaRenderPass = null;
render_orderly();
function render_orderly(){
    // 0. Set renderer initially.
    renderer = new THREE.WebGLRenderer({ antialias: true,
                                         alpha: true,
                                         preserveDrawingBuffer: false }); // , stencil: true.
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
    composer = new EffectComposer(renderer);
    // EffectComposer is a Render Pipeline (Like a ML Pipeline) where we need to pass function(s) we wanna apply with probably setting some parameters if needed.
    
    // What happens per frame :
    // 1. First: Render the 3D scene to a texture/image because we can't edit/filter and smooth_edges on the image if we don't have the image.
    composer.addPass(new RenderPass(scene, camera));

    // 2. Middle: Any post-processing effects on the texture/image e.g., BloomPass(), ColorCorrectionPass(), GlitchPass() etc -> Postprocessing section in "https://threejs.org/docs/".
    // const resolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
    // composer.addPass(new UnrealBloomPass( resolution, 1.5, 0.4, 0.85 )); // its written as an example.

    // 3. Last: Anti-aliasing/smoothing ALL EDGES (Of each mesh on that image) (Original edges + edges created from the post-processing effects).
    if(!taaRenderPass){ // So that we dont have to create the same "TAARenderPass(scene, camera)" thing again and again.
        taaRenderPass = new TAARenderPass(scene, camera);
        taaRenderPass.unbiased = false; // Set to true for less blur, more ghosting
        taaRenderPass.sampleLevel = 2; // // Higher = better Anti-aliasing. 2, 3, 4 ... worked same.
    }
    composer.addPass(taaRenderPass);
    
    // 4. Optional: Read -> https://threejs.org/docs/#OutputPass. So if any object has transparency involved and you might notice color issues, if you do then contact deepseek asap.
    composer.addPass(new OutputPass()); // Its ≈ "renderer.outputColorSpace = THREE.SRGBColorSpace" but since we're using EffectComposer(), not renderer() to render in animate(), use OutputPass().
}

// --- Controls ---
let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // smooth rotation
controls.dampingFactor = 0.05;
// controls.screenSpacePanning = false;
// controls.minDistance = 3;
// controls.maxDistance = 20;
// controls.target.set(0, 0, 0);

// --- Event Listener ---
window.addEventListener('resize', onWindowResize, false);

let mesh;
practice_shader_programming();
function practice_shader_programming() {
    // let geometry = new THREE.BoxGeometry(1, 1, 1, 32, 32); // It's an indexed geometry but shader works for even non-indexed!
    let geometry = new THREE.IcosahedronGeometry(1, 50); // With 200, is more pretty but COMPUTIONALLY EXPENSIVE.
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            u_time: {value: 0.0},
        },

        vertexShader: /* glsl */`
            // attribute vec2 uv; 
            // attribute vec3 normal;
            // attribute vec3 position; // Shader automatically provide these 3 values internally. No need to call them.

            varying vec3 v_position; // v_ as in vertex.
            varying vec2 v_uv;
            varying vec3 v_normal;
            varying vec3 v_world_position;
            varying vec3 v_world_normal;
            uniform float u_time;

            //	Classic Perlin 3D Noise by Stefan Gustavson :
            vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
            vec3 fade(vec3 t) { return t*t*t * (t * (t*6.0 - 15.0) + 10.0); }

            float noise(vec3 P){
                vec3 Pi0 = floor(P); // Integer part for indexing
                vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
                Pi0 = mod(Pi0, 289.0);
                Pi1 = mod(Pi1, 289.0);
                vec3 Pf0 = fract(P); // Fractional part for interpolation
                vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
                vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
                vec4 iy = vec4(Pi0.yy, Pi1.yy);
                vec4 iz0 = Pi0.zzzz;
                vec4 iz1 = Pi1.zzzz;

                vec4 ixy = permute(permute(ix) + iy);
                vec4 ixy0 = permute(ixy + iz0);
                vec4 ixy1 = permute(ixy + iz1);

                vec4 gx0 = ixy0 / 7.0;
                vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
                gx0 = fract(gx0);
                vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
                vec4 sz0 = step(gz0, vec4(0.0));
                gx0 -= sz0 * (step(0.0, gx0) - 0.5);
                gy0 -= sz0 * (step(0.0, gy0) - 0.5);

                vec4 gx1 = ixy1 / 7.0;
                vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
                gx1 = fract(gx1);
                vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
                vec4 sz1 = step(gz1, vec4(0.0));
                gx1 -= sz1 * (step(0.0, gx1) - 0.5);
                gy1 -= sz1 * (step(0.0, gy1) - 0.5);

                vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
                vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
                vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
                vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
                vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
                vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
                vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
                vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

                vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
                g000 *= norm0.x;
                g010 *= norm0.y;
                g100 *= norm0.z;
                g110 *= norm0.w;
                vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
                g001 *= norm1.x;
                g011 *= norm1.y;
                g101 *= norm1.z;
                g111 *= norm1.w;

                float n000 = dot(g000, Pf0);
                float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
                float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
                float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
                float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
                float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
                float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
                float n111 = dot(g111, Pf1);

                vec3 fade_xyz = fade(Pf0);
                vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
                vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
                float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
                return 2.2 * n_xyz;
            }

            float smoothstep_twice(float edge0, float edge1, float edge2, float x) {
                if(x < edge2) return       smoothstep(edge0, edge1, x);
                else          return 1.0 - smoothstep(edge2, 1.0, x);
            }

            float random (in vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }


            varying float smooth_step_value;
            void main() {
                // varyings :
                
                v_position = position; // you can't access 'position' outside function.
                v_uv = uv;
                v_normal = normal;
                v_world_position = mat3(modelMatrix) * position;
                v_world_normal   = mat3(modelMatrix) * normal;

                // To modify the vertices' positions :

                vec3 pattern_coordinate = v_position; // you can use v_normal too or v_uv.
                pattern_coordinate.y += u_time; // that means pattern moving vertically.

                vec3 noise_pattern_coordinate = vec3( noise(pattern_coordinate) );
                    // noise(pattern_coordinate) modifies the pattern_coordinate which is random, so its a noise.

                // float smooth_step = smoothstep_twice(0.45, 0.5, 0.95, fract(noise_pattern_coordinate.y * 3.0));
                // The smoothstep_twice(..) logic must be SAME as it was before noise(pattern_coordinate).
                // Commented the above line because I want gradient color (Hence used mix() in fragmentShader) instead of blue and cyan color strips.
                float smooth_step = fract(noise_pattern_coordinate.y * 3.0);
                smooth_step_value = smooth_step;

                vec3 new_position = v_position + v_normal * (smooth_step / 7.0);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(new_position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            varying vec3 v_position;
            varying vec2 v_uv;
            varying vec3 v_normal;
            uniform float u_time;
            varying float smooth_step_value;
            varying vec3 v_world_normal;

            float custom_smoothstep(float edge0, float edge1, float x) {
                if(x < edge0 || x > edge1)
                    return x;
                return 1.0 - smoothstep(edge0, edge1, x);
            }

            float smoothstep_twice(float edge0, float edge1, float edge2, float x) {
                if(x < edge2) return       smoothstep(edge0, edge1, x);
                else          return 1.0 - smoothstep(edge2, 1.0, x);
            }

            void main() {
                vec3 color1 = vec3(0.0, 0.0, 1.0), color2 = vec3(0.0, 1.0, 1.0); // white, black.

                vec3 light = cameraPosition; // or a vector like vec3(1.0, 1.0, 1.0);
                float brightness = dot(v_world_normal, normalize(light)); // The lighting effect based on 'light' vector3.
                brightness = clamp(brightness, 0.1, 1.0) * 1.5; // Multiplied with 1.5 to increase the brightness of the base color.

                gl_FragColor = vec4(mix(color1, color2, smooth_step_value) * brightness, 1.0);
                // gl_FragColor = vec4(color1 * brightness, 1.0);
            }
        `,
        // wireframe: true,
        transparent: true,
        // opacity: 0.5,
    });

    // const material = new THREE.MeshNormalMaterial();

    mesh = new THREE.Mesh(geometry, material);
    // const mesh1 = mesh.clone(true);
    // mesh1.material.wireframe = false;
    // mesh1.position.set(0, 1.5, 0);
    
    scene.add(mesh);
    // scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshNormalMaterial()));
}

// Every time the window resizes, onWindowResize() is called.
function onWindowResize() {
    // For Perspective Camera :
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    controls.update(); 
    // renderer.render(scene, camera);
    composer.render(); // Instead of renderer.render(scene, camera).
    mesh.material.uniforms.u_time.value += 0.003; // 0.003
    // console.log(mesh.material.uniforms.uTime);

    requestAnimationFrame(animate);
}

// Initialize and start the animation loop once the window is loaded
window.onload = function () {
    animate();
};