@echo off

REM Create the build directory if not already there.
if not exist build (mkdir build)

REM Bundle the javascript to include three.js and other modules
call ./node_modules/.bin/browserify src/tower.js > build/bundle.js

REM Build the pug to html files
call ./node_modules/.bin/pug src/ --out build/

REM Build the sass to css files
call ./node_modules/.bin/sass src/:build/
