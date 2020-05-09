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
// var projector = new THREE.Projector();
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

function screenToWorld(_screenPos)
{
    var worldPos = _screenPos.clone();
    // worldPos.x = worldPos.x / CANVAS_SIZE.x/2 - 1;
    // worldPos.y = - worldPos.y / CANVAS_SIZE.y/2 + 1;
    worldPos.unproject( camera );
    return worldPos;                    
}

function worldToScreen(_worldPos)
{
    var screenPos = _worldPos.clone();
    projector.projectVector( screenPos, camera );
    screenPos.x = ( screenPos.x + 1 ) * windowHalfX;
    screenPos.y = ( - screenPos.y + 1) * windowHalfY;
    return screenPos;
}

window.addEventListener("mousemove", function (event) {
    var cameraDist = camera.position.z;

    if (model.sceneInteract.panStarted) {
        camera.position.x -= event.movementX * 0.0026 * cameraDist;
        camera.position.y += event.movementY * 0.0026 * cameraDist;
    } else if (model.sceneInteract.zoomStarted) {
        camera.position.z -= event.movementX * 0.0018 * cameraDist;
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

// We want to know whenever the key was released over the entire window.
window.addEventListener("mouseup", function (event) {
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

