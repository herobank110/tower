// tower.js
// A visual scripting system!
//
// Author: David Kanekanian
// Email: dkanekanian1@gmail.com


// Imports
const uuid = require("uuid");

if (process.title != "browser") {
    // Must put in eval so Typescript doesn't get confused.
    eval('var THREE = require("../node_modules/three/build/three.js");');

    // Node.js does not have 'requestAnimationFrame' function. Make it call back immediately.
    // @ts-ignore
    function requestAnimationFrame(callback: FrameRequestCallback): number {
        callback(0);
        return 0;
    }
}


/** This will eventually have more game engine utilities. */
namespace GARDEN {
    /** Provides basic gameplay life cycle functionality. */
    export class Actor extends THREE.Group {
        private _bIsPendingKill: boolean;

        /** Whether this actor is currently pending kill. */
        public get isPendingKill() { return this._bIsPendingKill; }

        /** Called when gameplay ready. */
        public beginPlay(): void { };

        /** Called once every frame */
        public tick(deltaTime: number): void { };

        /** Called when destruction requested. */
        public beginDestroy(): void {
            this._bIsPendingKill = true;
        };

        /** Internally called by world when spawned. */
        public __spawn__(inWorld: World, position: THREE.Vector3) {
            this._world = inWorld;
            this.position.copy(position);
        }

        private _world: World;
        public get world(): World {
            return this._world;
        }
    }

    /** Facilitates actor creation and destruction. */
    export class World extends THREE.Scene {
        private masterActorList: Array<Actor>;
        private pendingKill: Array<Actor>;

        /** Time between each frame, assuming 60 fps. */
        private readonly frameTime = 1000 / 60;

        public constructor() {
            super();
            this.masterActorList = [];
            this.pendingKill = [];
        }

        /** Start the loop of rendering to make actors tick. */
        public mainLoop(gameOverCallback?) {
            this.masterTickActors();
            this.purgePendingKill();

            if (gameOverCallback !== undefined && this.masterActorList.length == 0) {
                // No more actors in world. Stop everything and call the callback.
                gameOverCallback();
                return;
            }

            var a = this;
            requestAnimationFrame(function () { a.mainLoop(gameOverCallback); });
        }

        private masterTickActors() {
            for (const actor of this.masterActorList) {
                actor.tick(this.frameTime);
            }
        }

        /** Create an actor an return when gameplay ready. */
        public spawnActor(actorClass, position: THREE.Vector3): Actor {
            return this.finishDeferredSpawnActor(this.deferredSpawnActor(actorClass, position));
        }

        public deferredSpawnActor(actorClass, position: THREE.Vector3): Actor {
            var newActor: Actor = new actorClass();
            newActor.__spawn__(this, position);
            return newActor;
        }

        public finishDeferredSpawnActor(actorObject): Actor {
            // Call gameplay ready function.
            actorObject.beginPlay();
            // Let it receive tick updates.
            this.masterActorList.push(actorObject);
            return actorObject;
        }

        public destroyActor(actor: Actor) {
            // Javascript garbage collector will not engage until removing all references!
            actor.beginDestroy();
            this.masterActorList.splice(this.masterActorList.indexOf(actor), 1);
            this.pendingKill.push(actor);
        }

        private purgePendingKill() {
            // Clear the pending kill array, hopefully removing the last reference to actors
            // pending destruction, letting them be garbage collected.
            this.pendingKill.splice(0, this.pendingKill.length);
        }
    }
}


/**
 * tower.js
 * 
 * A visual scripting system!
 */
namespace TOWER {

    /** Flags for scene interaction modes. */
    enum EInteractTypeFlags {
        /** Selecting nodes. */
        SELECT = 1 << 0,

        /** Zooming the camera (along Z axis.) */
        ZOOM = 1 << 1,

        /** Panning the camera (along XY plane.) */
        PAN = 1 << 2
    }

    /** Node declaration and parsing utilities. */
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

    /** Node rendering utilities. Relies on NodeDecl. */
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
                world.add(cube);
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
                switch (this._node.nodeType) {
                    case NodeDecl.ENodeType.EVENT:
                        ctx.fillStyle = "#ea9999";
                        break;
                    case NodeDecl.ENodeType.FUNCTION:
                        ctx.fillStyle = "#cfe2f3";
                        break;
                };
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
                ctx.fillText(`Event ${this._node.name}`, 40, 58);
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

    class RenderManager extends GARDEN.Actor {
        public tick(deltaTime: number) {
            if (!model.sceneInteract.bMovedCameraSinceInteract
                && model.sceneInteract.bJustReleasedPan
            ) {
                // Open the node palette.
                console.log("Opening node palette");
            }

            renderer.render(world, camera);

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
    }

    // Declare all 'global' TOWER namespace variables. TODO: move to model
    export var world: GARDEN.World,
        camera: THREE.Camera,
        towerCanvas: HTMLCanvasElement,
        renderer: THREE.WebGLRenderer,
        gridHelper: THREE.GridHelper;

    function bindInput() {
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
    }

    export function main() {
        const CANVAS_SIZE = new THREE.Vector2(800, 600);

        world = new GARDEN.World();
        camera = new THREE.PerspectiveCamera(75, CANVAS_SIZE.x / CANVAS_SIZE.y, 0.1, 1000);
        towerCanvas = document.querySelector("#tower-canvas");

        renderer = new THREE.WebGLRenderer({ canvas: towerCanvas, alpha: true });
        renderer.setSize(CANVAS_SIZE.x, CANVAS_SIZE.y);
        renderer.setClearColor(0xbbbbbb);

        gridHelper = new THREE.GridHelper(100, 100);
        gridHelper.rotation.x = Math.PI / 2;
        world.add(gridHelper);

        camera.position.z = Math.floor(model.sceneInteract.trueCameraZ);

        world.spawnActor(RenderManager, new THREE.Vector3(0, 0, 0));

        bindInput();

        var beginPlayDecl = NodeDecl.parseNode("EVENT BeginPlay(OUT EXEC)");
        var printStringDecl = NodeDecl.parseNode("EVENT PrintString(IN EXEC, IN STRING Text, OUT EXEC)");
        var literalStringGreetingDecl = NodeDecl.parseNode("FUNCTION LiteralStringGreeting(IN EXEC, OUT EXEC, OUT STRING HelloWorld)");

        var nodeActor1 = new NodeDrawing.NodeActor(beginPlayDecl);

        console.log(beginPlayDecl);

        world.mainLoop(); // Should be in GameplayUtilities
    }

    export namespace Testing {
        var testsToRun,
            testCount,
            results;

        /** Register the tests that should be run. */
        function registerAll() {
            // All test classes must be added manually.
            // TODO: Find a way to automate this.
            registerTest(TestActorLifeCycle);
        }

        export function runAll(): boolean {
            // Reset data before running tests.
            testsToRun = [];
            testCount = 0;
            results = {};

            registerAll();

            console.log("Starting Tower test suite");

            // Begin testing!
            testLoop(function () {
                console.log("Finished Tower test suite\n"
                    + `Ran ${testCount} test${testCount == 1 ? "" : "s"} in total\n`
                );

                // Format the results as a table with equal width columns.
                var maxNameLen = Math.max(
                    9,  // Must be at least wide enough for heading.
                    ...Object.keys(results)
                        .map(function (val) { return val.length })
                );

                function padName(name: string, fill = " ") {
                    return name.padEnd(maxNameLen, fill);
                }

                // Add columns to results for printing before running tests.
                var resultTable = `${padName("Test Name")} | Passed\n`
                    + `${"-".repeat(maxNameLen)}-|-${"-".repeat(6)}\n`;
                resultTable += Object.keys(results)
                    .map(function (name) { return `${padName(name)} | ${results[name]}`; })
                    .join("\n");
                console.log(resultTable + "\n");

                var allPassed = passedAllTests();
                console.log("Summary: "
                    + (allPassed ? "All tests passed" : "One or more tests failed")
                );
            });
            return passedAllTests();
        }

        /** Returns whether all tests were passed successfully.
         * 
         * Only valid after running tests using `runTests()`.
         */
        function passedAllTests(): boolean {
            return Object.values(results).every(val => val);
        }

        function testLoop(testsFinishedCallback) {
            var nextTest = testsToRun.pop();
            if (nextTest !== undefined) {
                console.log(`Running test '${nextTest.name}'`);
                runTest(nextTest, function (result) {
                    console.log(`Ended test '${nextTest.name}'`)
                    // Save the result in the results object.
                    results[nextTest.name] = result;
                    // Continue onto the next test.
                    testLoop(testsFinishedCallback);
                });
            } else {
                testsFinishedCallback()
            }
        }

        function registerTest(testClass) {
            testsToRun.push(testClass);
            testCount++;
        }

        function runTest(testClass, testOverCallback) {
            var testCase = new testClass();
            testCase.runTest(testOverCallback);
        }

        abstract class TestBase {
            public abstract runTest(testOverCallback): void;
        }

        function areArraysEqual(a: Array<any>, b: Array<any>): boolean {
            return a.every(function (val, idx) { return val === b[idx]; });
        }

        // Should log 1 to 10 then stop logging.
        class TestActorLifeCycle extends TestBase {
            public runTest(testOverCallback) {
                var tickCount: number;
                var activity = [];

                class TestDestroy extends GARDEN.Actor {
                    public constructor() {
                        super();
                        tickCount = -1;
                        activity.push("default constructed");
                    }
                    public beginPlay() {
                        super.beginPlay();
                        tickCount = 0;
                        activity.push("begun play");
                    }
                    public tick() {
                        console.log(++tickCount);
                        activity.push(`ticked ${tickCount}th time`);
                        if (tickCount >= 5)
                            // Destroy this actor. As it's the only
                            // one in the world, the world will be
                            // destroyed and end the test.
                            this.world.destroyActor(this);
                    }
                    public beginDestroy() {
                        super.beginDestroy();
                        activity.push("begun destruction");
                    }
                }
                var world = new GARDEN.World();
                world.spawnActor(TestDestroy, new THREE.Vector3(0, 0, 0));
                world.mainLoop(function () {
                    // World should be destroyed when actor ticked 5 times.
                    testOverCallback(
                        areArraysEqual(activity, [
                            "default constructed",
                            "begun play",
                            "ticked 1th time",
                            "ticked 2th time",
                            "ticked 3th time",
                            "ticked 4th time",
                            "ticked 5th time",
                            "begun destruction",
                        ])
                    );
                });
            }
        }
    }
}


if (process.argv.indexOf("test") !== -1) {
    // Test the main program.
    process.exit(TOWER.Testing.runAll() ? 0 : 1);
}
else {
    // Start the main program.
    TOWER.main();
}
