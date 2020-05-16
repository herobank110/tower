# Create the build directory if not already there.
if (!(Test-Path build)) {
    New-Item build
}

# Compile typescript files and combine into one file
npx tsc

# Bundle the javascript to include three.js and other modules
npx browserify build/tower.js > build/towerBundle.js
# Delete intermediate file.
Remove-Item build\tower.js

# Build the pug to html files
npx pug src/ --out build/

# Build the sass to css files
npx sass src/:build/
