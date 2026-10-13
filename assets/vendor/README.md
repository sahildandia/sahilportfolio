# Three.js

The portfolio uses **Three.js 0.180.0**, distributed under the MIT license
included in `three.LICENSE.txt`. `three.module.min.js` imports the adjacent
`three.core.min.js`; keep both files when publishing the static site.

Source: https://registry.npmjs.org/three/-/three-0.180.0.tgz

The npm package was downloaded using `npm pack three@0.180.0 --ignore-scripts`
from the official npm registry with normal TLS and package integrity checks.
The tarball was independently verified against the registry's SHA-512
integrity value before extracting these unmodified distribution files:

```text
sha512-o+qycAMZrh+TsE01GqWUxUIKR1AL0S8pq7zDkYOQw8GqfX8b8VoCKYUoHbhiX5j+7hr8XsuHDVU6+gkQJQKg9w==
```

`../hero-scene.js` imports Three.js only when the hero approaches the viewport.
The library, procedural artwork, and environment lighting are all served
locally; no CDN, API key, npm install, or build step is needed at runtime.
