var THREE = require("three");

var model = {
    sceneInteract: {
        bPanStarted: false,
        bZoomStarted: false,
        trueCameraZ: 5.,
        bJustMovedCamera: false,
        bJustReleasedPan: false,
        bMovedCameraSinceInteract: false
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

camera.position.z = Math.floor(model.sceneInteract.trueCameraZ);

var animate = function () {
    requestAnimationFrame(animate);

    if (!model.sceneInteract.bMovedCameraSinceInteract
        && model.sceneInteract.bJustReleasedPan
    ) {
        // Open the node palette.
        console.log("Opening node palette");
    }

    renderer.render(scene, camera);

    // Reset per-frame state.
    model.sceneInteract.bJustMovedCamera = false;
    model.sceneInteract.bJustReleasedPan = false;
};

animate();

window.addEventListener("mousemove", function (event) {
    var cameraDist = camera.position.z;

    if (model.sceneInteract.bPanStarted) {
        camera.position.x -= event.movementX * 0.0026 * cameraDist;
        camera.position.y += event.movementY * 0.0026 * cameraDist;

        // Notify the input system that the camera was moved.
        model.sceneInteract.bJustMovedCamera = true;
        model.sceneInteract.bMovedCameraSinceInteract = true;

    } else if (model.sceneInteract.bZoomStarted) {
        // Set the true float zoom level in the model but clamp to a
        // 'ratchet' system for the camera position.
        var oldDist = model.sceneInteract.trueCameraZ;
        var newDist = oldDist - event.movementX * 0.0018 * cameraDist;
        newDist = THREE.MathUtils.clamp(newDist, 2, 20);
        model.sceneInteract.trueCameraZ = newDist;

        // Clamp the camera to a 'grid' system.
        camera.position.z = Math.floor(newDist);

        // Notify the input system that the camera was moved.
        model.sceneInteract.bJustMovedCamera = true;
        model.sceneInteract.bMovedCameraSinceInteract = true;
    }
});

// Don't show the normal right click menu on the canvas.
towerCanvas.addEventListener('contextmenu', event => event.preventDefault());

towerCanvas.addEventListener("mousedown", function (event) {
    switch (event.which) {
    case 1: break;
    case 2:
        model.sceneInteract.bZoomStarted = true;
        model.sceneInteract.bMovedCameraSinceInteract = false;
        break;
    case 3:
        model.sceneInteract.bPanStarted = true;
        model.sceneInteract.bMovedCameraSinceInteract = false;
        break;
    };
});

// We want to know whenever the key was released over the entire window.
window.addEventListener("mouseup", function (event) {
    event.preventDefault();
    switch (event.which) {
    case 1: break;
    case 2:
        model.sceneInteract.bZoomStarted = false;
        break;
    case 3:
        model.sceneInteract.bPanStarted = false;
        model.sceneInteract.bJustReleasedPan = true;
        break;
    };
});

