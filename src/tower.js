var THREE = require("three");

var model = {
    sceneInteract: {
        bPanStarted: false,
        bZoomStarted: false,
        bSelectStarted: false,
        trueCameraZ: 5.,
        bJustMovedCamera: false,
        bJustReleasedPan: false,
        bMovedCameraSinceInteract: false,
        bAnyInteractStarted: 0,
        bJustZoomed: false,
        bMovementHadZoom: false
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

var gridHelper = new THREE.GridHelper(100, 100);
gridHelper.rotation.x = Math.PI / 2;
scene.add(gridHelper);

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

    if (!model.sceneInteract.bMovementHadZoom
        || !model.sceneInteract.bAnyInteractStarted
    ) {
        document.exitPointerLock();
    }

    // Reset per-frame state.
    model.sceneInteract.bJustMovedCamera = false;
    model.sceneInteract.bJustReleasedPan = false;
    model.sceneInteract.bJustZoomed = false;
};

animate();

window.addEventListener("mousemove", function (event) {
    var cameraDist = camera.position.z;
    function pan() {
        camera.position.x -= event.movementX * 0.0026 * cameraDist;
        camera.position.y += event.movementY * 0.0026 * cameraDist;
        model.sceneInteract.bMovementHadZoom = false;
    };

    function zoom() {
        // Set the true float zoom level in the model but clamp to a
        // 'ratchet' system for the camera position.
        var oldDist = model.sceneInteract.trueCameraZ;
        var newDist = oldDist - event.movementX * 0.0018 * cameraDist;
        newDist = THREE.MathUtils.clamp(newDist, 2, 20);
        model.sceneInteract.trueCameraZ = newDist;

        // Clamp the camera to a 'grid' system.
        camera.position.z = Math.floor(newDist);

        towerCanvas.requestPointerLock();
        model.sceneInteract.bJustZoomed = true;
        model.sceneInteract.bMovementHadZoom = true;
    };

    if (model.sceneInteract.bSelectStarted && model.sceneInteract.bPanStarted) {
        zoom()
    } else if (model.sceneInteract.bPanStarted) {
        pan()
    } else if (model.sceneInteract.bZoomStarted) {
        zoom()
    } else {
        return;
    }

    // Notify the input system that the camera was moved.
    model.sceneInteract.bJustMovedCamera = true;
    model.sceneInteract.bMovedCameraSinceInteract = true;
});

// Don't show the normal right click menu on the canvas.
towerCanvas.addEventListener('contextmenu', event => event.preventDefault());

towerCanvas.addEventListener("mousedown", function (event) {
    model.sceneInteract.bMovedCameraSinceInteract = false;
    switch (event.which) {
        case 1:
            model.sceneInteract.bAnyInteractStarted |= 1;
            model.sceneInteract.bSelectStarted = true;
            break;
        case 2:
            model.sceneInteract.bAnyInteractStarted |= 2;
            model.sceneInteract.bZoomStarted = true;
            break;
        case 3:
            model.sceneInteract.bAnyInteractStarted |= 4;
            model.sceneInteract.bPanStarted = true;
            break;
    };
});

// We want to know whenever the key was released over the entire window.
window.addEventListener("mouseup", function (event) {
    event.preventDefault();
    switch (event.which) {
        case 1:
            model.sceneInteract.bAnyInteractStarted &= ~1;
            model.sceneInteract.bSelectStarted = false;
            break;
        case 2:
            model.sceneInteract.bAnyInteractStarted &= ~2;
            model.sceneInteract.bZoomStarted = false;
            break;
        case 3:
            model.sceneInteract.bAnyInteractStarted &= ~4;
            model.sceneInteract.bPanStarted = false;
            model.sceneInteract.bJustReleasedPan = true;
            break;
    };
});

