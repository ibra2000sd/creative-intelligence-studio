# Runtime ladder

Climb only when the rung below cannot express the motion.

| Need | Runtime | Why |
|---|---|---|
| Hover, press, colour, simple state change | CSS transition | No JavaScript, composited |
| One-shot reveal on entering the viewport | CSS + IntersectionObserver | A class flip is enough |
| Programmatic keyframes, data-driven values (no framework) | Web Animations API | No dependency |
| Route or state swap between DOM trees | View Transitions API | Native FLIP, degrades to an instant swap |
| Springs, exit animations, drag in React | Motion (`motion/react`, small feature set) | Interruptible, velocity-aware |
| Pinned, scrubbed, multi-element scroll sequence | GSAP ScrollTrigger | A timeline bound to scroll position |
| Camera, materials, 3D objects | Three.js render loop | Lives with the renderer |
| Anything gesture-driven in React Native | Reanimated + Gesture Handler | Runs on the UI thread |
| Stateful vector characters | Rive (needs a .riv asset and its runtime) | Not bundled; add when a project needs it |

Frequency rule of thumb: constant -> none; frequent -> only feedback, continuity or status, at `fast` or shorter; occasional -> up to `base`; rare or once -> up to `slow`, or `cinematic` for storytelling on marketing surfaces.

Licensing note: GSAP is free to use, including commercially, under GreenSock's standard no-charge licence, which is not an open-source licence and prohibits use in tools that compete with Webflow's visual animation builder. It is installed from npm by the generated project, not redistributed by this plugin. `creative-studio audit` flags it as a custom licence for a person to accept.
