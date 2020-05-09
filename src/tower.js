var THREE = require("three");

var model = {
    sceneInteract: {
        panStarted: false,
        zoomStarted: false
    }
};

const CANVAS_SIZE = new THREE.Vector2(800, 600);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, CANVAS_SIZE.x / CANVAS_SIZE.y, 0.1, 1000);
var towerCanvas = document.querySelector("#tower-canvas");

var renderer = new THREE.WebGLRenderer({ canvas: towerCanvas });
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
    if (model.sceneInteract.panStarted) {
        camera.position.x -= event.movementX * 0.012;
        camera.position.y += event.movementY * 0.012;
    }
});

// Don't show the normal right click menu on the canvas.
towerCanvas.addEventListener('contextmenu', event => event.preventDefault());

towerCanvas.addEventListener("mousedown", function (event) {
    switch (event.which) {
    case 1: break;
    case 2:
        model.sceneInteract.zoomStarted = true;
        break;
    case 3:
        model.sceneInteract.panStarted = true;
        break;
    };
});

towerCanvas.addEventListener("mouseup", function (event) {
    event.preventDefault();
    switch (event.which) {
    case 1: break;
    case 2:
        model.sceneInteract.zoomStarted = false;
        break;
    case 3:
        model.sceneInteract.panStarted = false;
        break;
    };
});

