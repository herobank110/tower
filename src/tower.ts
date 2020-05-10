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

namespace NodeDecl {
    export enum ENodeType {
        EVENT,
        FUNCTION
    }

    export enum EArgFlowType {
        IN,
        OUT
    }

    export enum EArgDataType {
        EXEC,
        STRING
    }

    export class Node {

        private _nodeType: ENodeType;
        public get nodeType(): ENodeType {
            return this._nodeType;
        }

        private _name: string;
        public get name(): string {
            return this._name;
        }


        private _args: Array[NodeArg];
        public get args(): Array[NodeArg] {
            return this._args;
        }


        constructor(nodeDecl: string) {
            if (nodeDecl.startsWith("EVENT")) {
                this._nodeType = ENodeType.EVENT;
                nodeDecl = nodeDecl.substr(5);
            } else if (nodeDecl.startsWith("FUNCTION")) {
                this._nodeType = ENodeType.FUNCTION;
                nodeDecl = nodeDecl.substr(8);
            } else {
                throw "NodeDeclParseError: Must start with EVENT or FUNCTION";
            }

            var openParenthesisIndex = nodeDecl.indexOf('(');
            if (openParenthesisIndex == -1)
                throw "NodeDeclParseError: Missing opening parenthesis";

            var closeParenthesisIndex = nodeDecl.indexOf(')');
            if (closeParenthesisIndex == -1)
                throw "NodeDeclParseError: Missing closing parenthesis";

            {
                // Remove all spaces in name.
                let name = nodeDecl.substr(0, openParenthesisIndex);
                while (name.indexOf(" ") != -1)
                    name = name.replace(" ", "");
                if (name.length == 0)
                    throw "NodeDeclParseError: Missing node name - cannot be empty";

                this._name = name;
            }

            {
                let args = nodeDecl.substr(openParenthesisIndex + 1, closeParenthesisIndex);

            }
        }
    }
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

var renderer = new THREE.WebGLRenderer({ canvas: towerCanvas, alpha: true });
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
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
canvas.width = 256;
canvas.height = 128;
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#fff';
roundRect(ctx, 0, 0, canvas.width, canvas.height, 15);
ctx.fill();
var alphaTexture = new THREE.CanvasTexture(canvas);

// Create the color map.
var canvas = document.createElement("canvas");
canvas.width = 512;
canvas.height = 256;
ctx = canvas.getContext('2d');
ctx.fillStyle = "#efefef";
ctx.fillRect(0, 0, canvas.width, canvas.height);
// Top color strip.
ctx.fillStyle = "#ea9999";
ctx.fillRect(0, 0, canvas.width, 80);
// Black outline around node.
roundRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, 30);
ctx.strokeStyle = "#000";
ctx.lineWidth = 2;
ctx.stroke();
// Event name as text.
ctx.fillStyle = "#000000";
ctx.textAlign = "left";
ctx.font = "36px Arial";
ctx.fillText("Event EventName", 40, 58);
// Exec pin
var makePinPath = function (ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 30, y);
    ctx.lineTo(x + 45, y + 15);
    ctx.lineTo(x + 30, y + 30);
    ctx.lineTo(x, y + 30);
    ctx.closePath();
};
makePinPath(ctx, canvas.width - 70, 100);
ctx.fillStyle = "#ffffff";
ctx.fill();
ctx.strokeStyle = "#000000";
ctx.lineWidth = 1;
ctx.stroke();
// String event param pin
makePinPath(ctx, canvas.width - 70, 150);
ctx.fillStyle = "#eb58d8";
ctx.fill();
ctx.strokeStyle = "#000000";
ctx.lineWidth = 1;
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

// var myNode = new NodeDecl.Node("EVENT Dog()");
console.log(new NodeDecl.Node("EVENT Dog()"));
