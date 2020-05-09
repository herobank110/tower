var THREE = require("three");

const CANVAS_SIZE = new THREE.Vector2(800, 600);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, CANVAS_SIZE.x / CANVAS_SIZE.y, 0.1, 1000);

var renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("#tower-canvas") });
renderer.setSize(CANVAS_SIZE.x, CANVAS_SIZE.y);
renderer.setClearColor(0xbbbbbb);

var gridHelper = new THREE.GridHelper( 100, 100 );
gridHelper.rotation.x = Math.PI / 2;
scene.add( gridHelper );

camera.position.z = 5;

var animate = function () {
    requestAnimationFrame(animate);

    renderer.render(scene, camera);
};

animate();


window.addEventListener("mousemove", function (event) {
    camera.position.x -= event.movementX * 0.012;
    camera.position.y += event.movementY * 0.012;
})
