# Village Style Guide (Step 1: Build Your World)

One consistent look keeps the village readable. The browser village draws everything procedurally from the `STYLE` palette in `js/config.js`, so the map works with no image assets at all.

## Art direction
- **Genre:** cozy top-down 16-bit village with a 3/4 view, warm daylight, soft shadows to the bottom-right.
- **Grid:** 16×16 px tiles; the map is 48×30 tiles; characters are about 1 tile wide and 1.3 tiles tall.
- **Outlines:** dark slate `#2b2b33`, 1 px at native scale.
- **Buildings:** cream walls `#f3e6cc`, a pitched roof in the owner's colour, a brown door facing the road, and a wooden name sign.
- **People:** chunky pixel villagers with big heads; the shirt colour matches the director's roof colour so you can tell who lives where. The Mayor wears a gold crown and the Chief of Staff wears a red tie. Interns are drawn smaller.
- **Night:** a blue overlay that follows your local clock, with warm windows `#ffd77a`. A lit window in daytime means someone is working inside.

## Palette
| Use | Hex |
|---|---|
| Grass | `#5fae4e` `#58a548` `#64b553` |
| Road | `#d8b77a` |
| Plaza stone | `#c9c2b4` |
| Water | `#4aa3df` |
| Trees | `#2f7d3a` `#3a8f45` |
| Mayor | `#ffd23f` |
| Chief of Staff | `#2d3047` |
| Inbox / Calendar / Money | `#e4572e` / `#17bebb` / `#2e933c` |
| Content / Health / Projects | `#9c51b6` / `#f4a259` / `#3d5a80` |

## Prompts for generated art (optional)
If you want painted art from an image generator, reuse the same prefix on every prompt so the pieces match:

> *cozy top-down 16-bit pixel art village, 3/4 view, 16px tiles, warm daylight, soft shadows to bottom-right, dark slate outlines, limited palette, no text*

- Map: `… lush green village with a central stone plaza and fountain, a red-roofed town hall at the top, dirt roads, small pond bottom-left, tree border, 48x30 tiles`
- House: `… single small cottage, cream walls, {roof colour} pitched roof, brown door facing down, transparent background`
- Villager: `… chibi villager sprite sheet, 4 directions x 2 walk frames, {shirt colour} shirt, transparent background`
