/**
 * tower.js
 * A visual scripting system!
 */

// Imports
const uuid = require("uuid");

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

    export interface ArgParameters {
        name?: string;
        flowType: EArgFlowType;
        dataType: EArgDataType;
    }

    export class Arg {

        private _name: string;
        public get name(): string { return this._name; }

        private _guid: string;
        public get guid(): string { return this._guid };

        private _flowType: EArgFlowType;
        public get flowType(): EArgFlowType { return this._flowType; }

        private _dataType: EArgDataType;
        public get dataType(): EArgDataType { return this._dataType; }

        constructor(params: ArgParameters) {
            this._name = params.name ?? "";
            this._guid = uuid.v4();
            this._flowType = params.flowType;
            this._dataType = params.dataType;
        }

    }

    export interface NodeParameters {
        name: string;
        nodeType: ENodeType;
    }

    export class Node {

        private _nodeType: ENodeType;
        public get nodeType(): ENodeType { return this._nodeType; }

        private _name: string;
        public get name(): string { return this._name; }

        private _guid: string;
        public get guid(): string { return this._guid };

        private _args: Array<Arg>;
        public get args(): Array<Arg> { return this._args; }

        constructor(params: NodeParameters) {
            this._nodeType = params.nodeType;
            this._name = params.name;
            this._guid = uuid.v4();
            this._args = [];
        };

        public addArg(arg: Arg) {
            this._args.push(arg);
            // TODO: Register the arg as a pin for drawing and execution.
        }
    }

    const argFlowTypeParseMap = {
        "IN": EArgFlowType.IN,
        "OUT": EArgFlowType.OUT
    }
    const argDataTypeParseMap = {
        "EXEC": EArgDataType.EXEC,
        "STRING": EArgDataType.STRING
    };

    class Parser {
        public rawString: string;
        constructor(inString) {
            this.rawString = inString;
        }
        public parseLeft(parseMap): any {
            const raw = this.rawString.trimLeft();
            for (const key in parseMap)
                if (raw.startsWith(key)) {
                    // Remove what was just parsed.
                    this.rawString = raw.substr(key.length);
                    // Return the actual value.
                    return parseMap[key];
                }
            return null;
        }
    }

    function parseArg(argString: string): Arg {
        var argParser = new Parser(argString);

        // Parse the flow type.
        const argFlowType = argParser.parseLeft(argFlowTypeParseMap);
        if (argFlowType === null)
            throw "NodeDeclParseError: Arg must start with IN or OUT";

        // Parse the data type.
        const argDataType = argParser.parseLeft(argDataTypeParseMap);
        if (argDataType === null)
            throw "NodeDeclParseError: Arg datatype must be EXEC or STRING";

        // What's left should be the name.
        const name = argParser.rawString.trim();

        return new Arg({
            flowType: argFlowType,
            dataType: argDataType,
            name: name
        });
    }

    export function parseNode(nodeDecl: string): Node {
        var nodeType, nodeName;

        if (nodeDecl.startsWith("EVENT")) {
            nodeType = ENodeType.EVENT;
            nodeDecl = nodeDecl.substr(5);
        } else if (nodeDecl.startsWith("FUNCTION")) {
            nodeType = ENodeType.FUNCTION;
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

            nodeName = name;
        }

        var newNode = new Node({ nodeType: nodeType, name: nodeName });

        const args = nodeDecl.substring(openParenthesisIndex + 1, closeParenthesisIndex);
        args.split(",").forEach(function (argString) {
            const newArg = parseArg(argString);
            if (newArg !== null)
                newNode.addArg(newArg);
        });

        return newNode;
    }
}

namespace NodeDrawing {
    class CanvasHelper {
        public static roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
    }

    export class NodeActor {
        private _node: NodeDecl.Node;
        private alphaMap: THREE.Texture;
        private colorMap: THREE.Texture;

        constructor(node: NodeDecl.Node) {
            this._node = node;
            this.drawAlphaMap();
            this.drawColorMap();
            var material = new THREE.MeshBasicMaterial({
                transparent: true,
                map: this.colorMap,
                alphaMap: this.alphaMap
            })

            var cube = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), material);
            scene.add(cube);
        }

        /** Draw a pin path (IN/OUT) on the canvas at the top-left coordinates. */
        private static makePinPath(ctx: CanvasRenderingContext2D, x: number, y: number) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 30, y);
            ctx.lineTo(x + 45, y + 15);
            ctx.lineTo(x + 30, y + 30);
            ctx.lineTo(x, y + 30);
            ctx.closePath();
        };

        /** Create the alpha map for the rounded rectangle shape. */
        private drawAlphaMap() {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            // three.js expects textures to have POT dimensions.
            canvas.width = 256;
            canvas.height = 128;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            CanvasHelper.roundedRect(ctx, 0, 0, canvas.width, canvas.height, 15);
            ctx.fill();
            this.alphaMap = new THREE.CanvasTexture(canvas);
        }

        /** Create the color map. */
        private drawColorMap() {
            // TODO: investigate whether to create a whole new canvas each time?
            var canvas = document.createElement("canvas");
            var ctx = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 256;
            ctx = canvas.getContext('2d');
            ctx.fillStyle = "#efefef";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Top color strip.
            ctx.fillStyle = "#ea9999";
            ctx.fillRect(0, 0, canvas.width, 80);
            // Black outline around node.
            CanvasHelper.roundedRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, 30);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.stroke();
            // Event name as text.
            ctx.fillStyle = "#000000";
            ctx.textAlign = "left";
            ctx.font = "36px Arial";
            ctx.fillText("Event EventName", 40, 58);
            // Exec pin
            NodeActor.makePinPath(ctx, canvas.width - 70, 100);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.stroke();
            // String event param pin
            NodeActor.makePinPath(ctx, canvas.width - 70, 150);
            ctx.fillStyle = "#eb58d8";
            ctx.fill();
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.stroke();

            this.colorMap = new THREE.CanvasTexture(canvas);
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

var beginPlayDecl = NodeDecl.parseNode("EVENT BeginPlay(OUT EXEC)");
var printStringDecl = NodeDecl.parseNode("EVENT PrintString(IN EXEC, IN STRING Text, OUT EXEC)");
var literalStringGreetingDecl = NodeDecl.parseNode("FUNCTION LiteralStringGreeting(IN EXEC, OUT EXEC, OUT STRING HelloWorld)");

var nodeActor1 = new NodeDrawing.NodeActor(beginPlayDecl);

console.log(beginPlayDecl);
