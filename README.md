# How we built the Barbelo Agency website

*Barbelo Agency · reverse engineering, step by step*

Live site: https://www.barbeloagency.com
The idea: a dark, cinematic agency site that tells one idea per screen, moves like a film, and still loads fast.

## The recipe at a glance
| Piece | What it is | Tool |
|---|---|---|
| Opening | A mirror-kaleidoscope made from two photos, rendered live | Raw WebGL (one canvas) |
| Text | Words and letters that rise out of masks, never fade | GSAP + a tiny split helper |
| Scroll | Smooth, inertial scrolling that drives every animation | Lenis + ScrollTrigger |
| Work | A horizontal carousel that drifts on its own, then stops for you | Native scroll-snap + GSAP |
| Services | A white circle grows and takes over the screen, seven statements play on it | Pinned GSAP timeline |
| Process | A line that draws itself as you scroll | Pinned section, transform and opacity only |
| Proof | A strip of phones in 3D that tilts toward the center | CSS 3D, no WebGL |
| Contact | One huge vertical word and a WhatsApp page | CSS + one script |
| Languages | English, Portuguese, Spanish | One source file + a Python generator |

No framework and no build step: HTML, CSS and plain JavaScript. GSAP, ScrollTrigger and Lenis are copied into the project, so it runs offline. Hosted as a static site on Cloudflare Pages.

## Step 1 - Decide the mood before any code
All colors and fonts live in a handful of CSS variables at the top of one file, so the whole site can be re-skinned in a minute.
- Ink `#0A0A0B`, text `#EDEDEA`, one accent `#E5532D`, and a paper tone for the one light section.
- Blue `#1F86FF` and green `#12C48B` exist only inside the kaleidoscope. The rest of the page stays black and orange.
- Fonts: Bricolage Grotesque for headlines, Geist for text. Both are self-hosted variable fonts.
Rule: one accent, everything else quiet.

## Step 2 - The kaleidoscope (scene 01)
This is the part people ask about.
1. Two photos become WebGL textures.
2. The fragment shader reflects them over a tiling of mirrored equilateral triangles (the "p3m1" wallpaper group), so every seam is a real mirror and the image never breaks.
3. The grid slowly rotates and drifts while the "window" moves the opposite way over the image.
4. Every 7.3 seconds the facets fold closed for about 2 seconds and open again.
5. When the headline changes, the new image opens from the center in an iris, with a pale wave of light along the seams.
6. The word "Barbelo" is drawn into a canvas with the site's own font and fed to the shader as a texture, so the word shatters through the facets.
7. A shadow at the bottom left keeps the brand and the headline readable.
8. Safety: the canvas resolution drops up to three times if the device struggles, then the page falls back to a still image. Phones render at 60% scale. Reduced-motion visitors get a calm static version.

## Step 3 - Text that rises, never fades
Every word (or letter) is wrapped in a box with `overflow: hidden`, and the inner part moves up from below with a `transform`. No blur, no opacity games. The original text stays in the page for screen readers and the animated copies are `aria-hidden`.
The headline rotates through three phrases: each one leaves upward, the shader changes image, the next one rises in.

## Step 4 - One scroll engine
```js
lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```
Lenis smooths the scroll, ScrollTrigger reads it, and one GSAP ticker drives both. Everything else in the page is a ScrollTrigger on top of this.

## Step 5 - Work: a carousel that respects the visitor
Scenes 02 and 03 used to be one long horizontal track pinned to the vertical scroll. People tried to go back and it felt broken. Now:
- The title stays still in its own block.
- Below it, the sites sit in a native horizontal scroll-snap carousel: finger, trackpad, mouse drag and arrow keys all work. Mouse wheel over the carousel passes straight through to the page.
- When the section appears, the sites slide in from the right and drift slowly on their own until they stop at the closing line "Yours could be next". Any touch, drag or trackpad swipe stops the drift for good.
- Videos only play while on screen. One of the sites can be opened live, inside an iframe.

## Step 6 - Services: the white circle
A giant circle (145vmax wide) sits in the middle of a pinned screen and its `scale` goes from 0 to 1. Seven statements then appear one after the other on top of it, each one entering and leaving with the same masked-word animation, while a thin progress ring around the screen fills.
The circle is born while the section is still arriving: a separate scroll-scrubbed timeline starts as the section enters the screen, keeps the circle centered on the viewport, grows it until it covers everything and brings the first sentence in. By the time the section locks, the circle is full and the first line is already there, so there is never an empty black screen. The navigation bar changes color as soon as the circle covers it.

## Step 7 - Process: a line that draws itself
The section is pinned. Scroll moves a "light head" along a line; everything else (the lit stretch, each step's dot, the texts that enter, the closing glow) is decided from that single position. Only `transform` and `opacity` animate, and sizes are measured once per refresh, never per frame. On phones the line is vertical and the section is not pinned.

## Step 8 - Proof: phones in 3D without WebGL
A strip of phone panels scrolls sideways while pinned. On every update, each panel gets a transform from its distance to the center of the screen:
```js
p.style.transform = 'perspective(1500px) translate3d(0,' + (Math.sin(k*1.7) * -2.6) + 'svh,0) rotateY(' + (-k * maxTilt) + 'deg) rotateZ(' + (k*1.8) + 'deg) scale(' + (1 - a*0.13) + ')';
p.style.opacity = 1 - a * 0.42;
```
The center panel is in front, large and bright; the neighbors tilt away and dim. The panel in the middle cycles its screen layers every 4.2 seconds while it is in view.

## Step 9 - Contact
One huge vertical word, letter by letter, built from the translated string (with a straight apostrophe, because a curly one does not rotate with vertical text). An accent-colored circle grows to fill the footer. The button leads to a page where each option opens WhatsApp with the message already written, in the visitor's language.

## Step 10 - Three languages from one file
The English `index.html` is the single source of truth. A small Python script generates the Portuguese and Spanish pages from it, swapping paths, language tags and texts from one locale file each. A missing key falls back to English.

## Step 11 - Details that make it feel expensive
- Respect `prefers-reduced-motion`: every scene has a calm, fully readable version.
- Animate only `transform` and `opacity`. Never `top`, `left`, `width` or `height`.
- A visitor-chosen language is remembered for the visit; the loader waits for a click before the site opens.
- Security headers and a content-security policy are set in a `_headers` file, so nothing from outside the site can run.
- Test on a phone and a desktop before showing anyone.

## Step 12 - Publish
Upload the folder to any static host (we use Cloudflare Pages). Check every language, every link, and the contact page.

---
The `code/` folder holds the real source of the page structure, styles and scripts. The photos and videos are not included, and the code comments are in Portuguese.

## Want a site like this for your brand?
Barbelo Agency builds sites like this, from the idea to the live page: https://www.barbeloagency.com
