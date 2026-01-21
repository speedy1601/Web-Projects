import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { TAARenderPass } from 'three/addons/postprocessing/TAARenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
// import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';

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
    // let geometry = new THREE.PlaneGeometry(1.6, 2.1, 30, 30); // It's an indexed geometry but shader works for even non-indexed!
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
            uniform float u_time;
            varying float smooth_step_value;

            // In general edge1 = 1.0 since each Gradient Strip's ending point = 1.0.
            float smoothstep_for_gradient(float edge0, float edge1, float x) {
                if(x < edge0 || x > edge1)
                    return x; // smoothstep() returns 0 if x < edge0, 1 if x > edge1. But we want to return x itself.
                return 1.0 - smoothstep(edge0, edge1, x);
            }

            void main() {
                // varyings :
                
                v_position = position; // you can't access 'position' outside function.
                v_uv = uv;
                v_normal = normal;
                v_world_position = mat3(modelMatrix) * position;
                v_world_normal   = mat3(modelMatrix) * normal;

                // To modify the vertices positions along their direction :

                vec2 pattern_coordinate = v_uv; // you can use v_normal too or v_uv.
                // vec3 pattern_coordinate = v_position; // you can use v_normal too or v_uv.
                pattern_coordinate.y += u_time; // that means pattern moving vertically.

                float smooth_step = smoothstep_for_gradient(0.95, 1.0, fract(pattern_coordinate.y * 3.0));
                // smooth_step = fract(pattern_coordinate.y * 3.0);
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

            // In general edge1 = 1.0 since each Gradient Strip's ending point = 1.0.
            float smoothstep_for_gradient(float edge0, float edge1, float x) {
                if(x < edge0 || x > edge1)
                    return x; // smoothstep() returns 0 if x < edge0, 1 if x > edge1. But we want to return x itself.
                return 1.0 - smoothstep(edge0, edge1, x);
            }

            // In general edge3 = 1.0 since each strip's ending point = 1.0.
            float smoothstep_twice(float edge0, float edge1, float edge2, float edge3, float x) {
                if(x < edge2) return       smoothstep(edge0, edge1, x);
                else          return 1.0 - smoothstep(edge2, edge3, x);
            }

            void main() {
                vec3 color1 = vec3(0.0, 0.0, 1.0), color2 = vec3(0.0, 1.0, 1.0); // blue, cyan.

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
    // scene.add(new VertexNormalsHelper(mesh, 0.5, 0xff0000)); // mesh, normal_direction_line's_length, normal_color.
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
    mesh.material.uniforms.u_time.value += 0.002; // 0.003
    // console.log(mesh.material.uniforms.uTime);

    requestAnimationFrame(animate);
}

// Initialize and start the animation loop once the window is loaded
window.onload = function () {
    animate();
};