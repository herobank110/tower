/**
 * tower.js
 * A visual scripting system!
 */

//#region TowerTypes

/** Flags for scene interaction modes. */
enum EInteractTypeFlags {
    /** Selecting nodes. */
    SELECT = 1 << 0,

    /** Zooming the camera (along Z axis.) */
    ZOOM = 1 << 1,

    /** Panning the camera (along XY plane.) */
    PAN = 1 << 2
}

//#endregion

/** The entire data model during play. */
var model = {
    /** Scene interaction state based on human input. */
    sceneInteract: {
        /** Whether pan was started and not ended (is held.) */
        bPanStarted: false,
        /** Whether zoom was started and not ended (is held.) */
        bZoomStarted: false,
        /** Whether select was started and not ended (is held.) */
        bSelectStarted: false,
        /** Whether any interaction was started. Uses flags (@see EInteractTypeFlags ). */
        bAnyInteractStarted: 0,
        /** Floating point value of the camera's zoom, without flooring. */
        trueCameraZ: 5.,
        /** Whether camera was moved (pan or zoom) this frame. */
        bJustMovedCamera: false,
        /** Whether pan was released this frame. */
        bJustReleasedPan: false,
        /** Whether camera was moved since the most recent interact (pan, zoom, select) was started. */
        bMovedCameraSinceInteract: false,
        /** Whether any zoom occurred this frame. */
        bJustZoomed: false,
        /** Whether the most recent movement included zoom. */
        bMovementHadZoom: false
    }
};

const CANVAS_SIZE = new THREE.Vector2(800, 600);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, CANVAS_SIZE.x / CANVAS_SIZE.y, 0.1, 1000);
// var projector = new THREE.Projector();
var towerCanvas: HTMLCanvasElement = document.querySelector("#tower-canvas");

var renderer = new THREE.WebGLRenderer({ canvas: towerCanvas, alpha:true });
renderer.setSize(CANVAS_SIZE.x, CANVAS_SIZE.y);
renderer.setClearColor(0xbbbbbb);

var gridHelper = new THREE.GridHelper(100, 100);
gridHelper.rotation.x = Math.PI / 2;
scene.add(gridHelper);

camera.position.z = Math.floor(model.sceneInteract.trueCameraZ);


// Create the alpha map for the rounded rectangle shape.
var canvas = document.createElement('canvas'),
ctx = canvas.getContext('2d');
var roundRect = function (ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
}
canvas.width = 256;
canvas.height = 128;
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#fff';
roundRect(ctx, 0, 0, canvas.width, canvas.height, 20);
ctx.fill();	
var alphaTexture = new THREE.CanvasTexture(canvas);

// Create the color map.
var canvas = document.createElement("canvas");
canvas.width = 512;
canvas.height = 256;
// canvas.style.imageRendering = "pixelated";
ctx = canvas.getContext('2d');
ctx.fillStyle = "#efefef";
ctx.fillRect(0, 0, canvas.width, canvas.height);
// Top color strip.
ctx.fillStyle = "#ea9999";
ctx.fillRect(0,0, canvas.width, 80);
// Event name as text.
ctx.fillStyle = "#000000";
ctx.textAlign = "left";
ctx.font = "36px Arial";
ctx.fillText("Event EventName", 40, 58);
// Exec pin
ctx.beginPath();
ctx.moveTo(canvas.width - 80, 100);
ctx.lineTo(canvas.width - 40, 100);
ctx.lineTo(canvas.width - 20, 115);
ctx.lineTo(canvas.width - 40, 130);
ctx.lineTo(canvas.width - 80, 130);
ctx.closePath();
ctx.fillStyle = "#ffffff";
ctx.fill();
ctx.strokeStyle = "#000000";
ctx.stroke();

var colorTexture = new THREE.CanvasTexture(canvas);

var material = new THREE.MeshBasicMaterial({
    transparent: true,
    map: colorTexture,
    alphaMap: alphaTexture
})

var cube = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), material);
scene.add(cube);



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

//#region Input Handling

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
            model.sceneInteract.bAnyInteractStarted |= EInteractTypeFlags.SELECT;
            model.sceneInteract.bSelectStarted = true;
            break;
        case 2:
            model.sceneInteract.bAnyInteractStarted |= EInteractTypeFlags.ZOOM;
            model.sceneInteract.bZoomStarted = true;
            break;
        case 3:
            model.sceneInteract.bAnyInteractStarted |= EInteractTypeFlags.PAN;
            model.sceneInteract.bPanStarted = true;
            break;
    };
});

// We want to know whenever the key was released over the entire window.
window.addEventListener("mouseup", function (event) {
    event.preventDefault();
    switch (event.which) {
        case 1:
            model.sceneInteract.bAnyInteractStarted &= ~EInteractTypeFlags.SELECT;
            model.sceneInteract.bSelectStarted = false;
            break;
        case 2:
            model.sceneInteract.bAnyInteractStarted &= ~EInteractTypeFlags.ZOOM;
            model.sceneInteract.bZoomStarted = false;
            break;
        case 3:
            model.sceneInteract.bAnyInteractStarted &= ~EInteractTypeFlags.PAN;
            model.sceneInteract.bPanStarted = false;
            model.sceneInteract.bJustReleasedPan = true;
            break;
    };
});

//#endregion
