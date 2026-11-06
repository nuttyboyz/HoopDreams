#!/bin/sh
# Builds dist/hoop-dreams.html (offline, three.js inlined from three.min.js) and dist/artifact.html (CDN three.js, for claude.ai)
cd "$(dirname "$0")"
mkdir -p dist
GAME=$(cat $(ls src/*.js | grep -v '/vox.js$'))   # every src/*.js in name order (a_core, b_input, b_talk, c_fx, c_world, d_game, e_fight, e_play, e_rules, f_ui), vox.js apart
JS="$(cat $(ls src/vox.js 2>/dev/null))
$GAME"   # the offline file carries the voice clips inline
{ printf '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'; cat src/head.html; printf '<script>'; cat three.min.js; printf '</script><script>'; printf '%s' "$JS"; printf '</script></body></html>'; } > dist/hoop-dreams.html
{ cat src/head.html; printf '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script><script>'; printf '%s' "$GAME"; printf '</script><script src="vox.js" async></script><script src="vox2.js" async></script>'; } > dist/artifact.html
node tools/split_vox.js   # artifact: the page is small and starts at once, the voice clips (src/vox.js split into vox.js + vox2.js, published beside it) load in the background
ls -la dist
# GitHub Pages page (nuttyboyz/HoopDreams): the artifact build as a full document, with vox.js + vox2.js beside it
{ printf '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'; sed 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#three.min.js#' dist/artifact.html; printf '</body></html>'; } > dist/index.html   # three.js served from the repo itself
