@echo off

REM Create the build directory if not already there.
if not exist build (mkdir build)

REM Bundle the javascript to include three.js and other modules
call browserify src/tower.js > build/bundle.js

REM Build the pug file
call pug src/ --out build/
