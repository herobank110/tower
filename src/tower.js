var THREE = require("three");

const CANVAS_SIZE = new THREE.Vector2(800, 600);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, CANVAS_SIZE.x / CANVAS_SIZE.y, 0.1, 1000);

var renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("#tower-canvas") });
renderer.setSize(CANVAS_SIZE.x, CANVAS_SIZE.y);
document.body.appendChild(renderer.domElement);

var geometry = new THREE.BoxGeometry();
var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
var cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

var animate = function () {
    requestAnimationFrame(animate);

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    renderer.render(scene, camera);
};

animate();
