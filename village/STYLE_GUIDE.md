# Kingdom Style Guide (Step 1: Build Your World)

One consistent look keeps the kingdom readable. The browser kingdom draws everything procedurally from the `STYLE` palette in `js/config.js`, so the map works with no image assets at all.

## Art direction
- **Genre:** cozy top-down 16-bit fantasy kingdom with a 3/4 view, warm daylight, and soft shadows.
- **Grid:** 16×16 px tiles; the map is 48×30 tiles. People are about 1 tile wide; dragons are about 2.
- **Outlines:** dark slate `#2b2b33`, 1 px at native scale.
- **Buildings by role:**
  - *Castles* (Great Hall, King's Keep): grey stone, battlements, two corner towers with conical roofs, an arched portcullis gate, and banners. The King's Keep has a gold crown over its gate.
  - *Wizard towers* (Time Tower, Owl Post): a tall stone tower with a starry wizard-hat roof, a crescent-moon finial, and a small study annex.
  - *Royal manors* (Queen's Tower, Herald's Hall, Hearth Manor, Quest Keep): a crenellated stone hall plus one round tower and a flag.
  - *Dragon's Hoard:* a snow-capped mountain with a cave that glows with dragon fire and has gold spilling out.
- **Mountains:** big overlapping snow-capped peaks in grey-brown, along the north and in the south-east, where a wild dragon circles.
- **People:** each member of the court wears their domain colour, which matches their roof.
  - The King has a crown, ermine collar, red cape and scepter.
  - The Queen has a tall crown and a purple gown.
  - The wizards have pointed hats, beards and glowing staves.
  - The princess has a tiara, the prince a small crown and cape, and the duchess a coronet.
  - Helpers are smaller: the owl and the whelp fly, squires wear helmets, and the jester wears a two-pointed hat.
- **Night:** a blue overlay that follows your local clock, with warm windows `#ffd77a`. A lit window in daytime means someone is working inside.

## Palette
| Use | Hex |
|---|---|
| Grass | `#5fae4e` `#58a548` `#64b553` |
| Road | `#d8b77a` |
| Castle stone | `#a9a39a` `#8a847b` |
| Mountains / snow | `#7d7368` `#8c8276` / `#f4f6fb` |
| Royal gold | `#ffd23f` |
| The King | `#7b1e3a` robe, `#b3132c` cape |
| Queen Elara | `#5b2a86` |
| Iris / Cal (wizards) | `#3a5bd9` / `#138a87` |
| Penny (dragon) | `#2e933c` |
| Princess Echo / Duchess Sage / Prince Dex | `#e05a9a` / `#d9822b` / `#2f4f8f` |

## Prompts for generated art (optional)
If you want painted art from an image generator, reuse the same prefix on every prompt so the pieces match:

> *cozy top-down 16-bit pixel art fantasy kingdom, 3/4 view, 16px tiles, warm daylight, soft shadows, dark slate outlines, limited palette, no text*

- Map: `… green valley with a grey stone castle at the top, a cobbled courtyard with a fountain, dirt roads, wizard towers on the west, small castles on the east, snow-capped mountains to the north and south-east, a lake bottom-left, 48x30 tiles`
- Castle: `… small stone castle, battlements, two towers with {roof colour} conical roofs, arched gate, banners, transparent background`
- Wizard tower: `… tall stone wizard tower with a starry {roof colour} pointed roof and crescent moon, transparent background`
- Character: `… chibi {king with crown and red cape | queen in purple gown | wizard with pointed hat and staff | green dragon}, sprite sheet, 4 directions x 2 walk frames, transparent background`
