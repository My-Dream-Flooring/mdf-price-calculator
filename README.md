# MDF Price Calculator

A flooring price calculator for the My Dream Flooring website, with a live 3D preview of the room. Customers add their rooms (or stairs), pick a size, choose carpet, vinyl or laminate and a range, and see the floor change in 3D while a price bar shows the estimated **supply-only** cost and the weekly or monthly payment. Prices per m² are never shown: every range card shows what that range would cost a week (or a month) for the room being edited. Fitting isn't included: the local rep prices it on the day.

It's plain JavaScript and CSS with no framework and no build step. It renders straight into the WordPress page (not an iframe), so Hotjar, GTM and the Meta pixel can see every interaction. The visual and interaction design follows the approved prototype in `reference/prototype-carpet-configurator.html`.

| File / folder | What it is |
|---|---|
| `price-calculator.js` | The calculator. **All prices, ranges, sizes and wording are in `MDF_CONFIG` at the top.** |
| `price-calculator.css` | Styles. Everything is scoped under `#mdf-price-calculator`. |
| `index.html` | Demo/test page. |
| `textures/` | Seamless floor tiles (1024px) and 160px thumbnails used by the demo, and on the live site until the media-library URLs are filled in. |
| `textures/source/` | The original product photos the tiles were made from. |
| `tools/make_textures.py` | Rebuilds the tiles and thumbnails from `textures/source/` (Python 3 with Pillow and numpy). |
| `vendor/three.min.js` | three.js r128 (MIT licence), used for the 3D preview. |
| `reference/` | The approved prototype. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

**Live demo:** https://my-dream-flooring.github.io/mdf-price-calculator/

---

## Embedding it in Elementor

1. Edit the page in Elementor and drag an **HTML** widget where you want the calculator. A full-width section works best: at 820px wide or more it shows the 3D preview and the controls side by side.
2. Paste in exactly this:

```html
<div id="mdf-price-calculator"></div>
<link rel="stylesheet" href="https://my-dream-flooring.github.io/mdf-price-calculator/price-calculator.css?v=4">
<script src="https://my-dream-flooring.github.io/mdf-price-calculator/price-calculator.js?v=4" defer></script>
```

3. Update the page and check it on your phone.

Notes:
- **Cache:** GitHub Pages and browsers cache files for a while. After any change, bump `?v=4` to `?v=5` (and so on) in both lines so visitors get the new version straight away.
- Use **one calculator per page**. It only looks for the element with `id="mdf-price-calculator"`.
- Everything the script adds goes inside that `<div>`, including the three.js script and, if the page hasn't already loaded it, the Montserrat font link (weight 400 only).
- three.js loads from the same place as `price-calculator.js` (`vendor/three.min.js`). If the page already has three.js, that copy is used instead.
- If WebGL isn't available, the preview shows a swatch with a short message and the price still works.
- If a caching or optimisation plugin (WP Rocket, Autoptimize, etc.) delays or combines JavaScript, exclude `price-calculator.js` and `three.min.js` from that.
- The price bar sticks to the bottom of the screen while the calculator is in view. If an Elementor section around it has **Overflow: Hidden**, the bar won't stick (it still shows, just not pinned). Set overflow back to Default on that section if you want it pinned.

---

## Textures

On **mydreamflooring.co.uk** the calculator loads each range's `textureUrl` and `thumbUrl` from the WordPress media library, which is the same site as the page, so WebGL can use them. Anywhere else (GitHub Pages, local testing), or while a live URL is still `"TODO"`, it uses the copies in this repo (`textureLocal` / `thumbLocal`). The repo copies are served with the headers WebGL needs, so the live site works on the fallback too.

### Files to upload to the media library

Upload these from `textures/` and paste each file's URL into the matching range in `MDF_CONFIG`:

| Range | `textureUrl` | `thumbUrl` |
|---|---|---|
| Westminster | `westminster.jpg` | `westminster-thumb.jpg` |
| Buckingham | `buckingham.jpg` | `buckingham-thumb.jpg` |
| Expressions | `expressions.jpg` | `expressions-thumb.jpg` |
| Balmoral | `balmoral.jpg` | `balmoral-thumb.jpg` |
| Laminate | `laminate.jpg` | `laminate-thumb.jpg` |
| Sandringham Chile | `sandringham.jpg` | `sandringham-thumb.jpg` |

If a range has no texture at all, it shows a plain colour (`previewColour`) in the 3D preview with "Colour preview only for this range", and a placeholder swatch on its card.

### Example colours

The photos show one colour or design from each range. Each range's `shownAs` is displayed as "Shown in Mid Grey" under the card's thumbnail, "Shown in Mid Grey. More colours in the range." in the 3D preview, and "Shown in Mid Grey. Your rep brings samples of the full range." under the room in the rooms list.

### Real-world scale

So floors look the right size in the room, each range says how much floor one tile covers:

| Range | Setting | Source |
|---|---|---|
| Balmoral | `tileSize: [0.332, 0.332]` | 166mm squares, two each way |
| Laminate | `planks: [0.191, 1.9]` | 191 × 1900mm planks. The preview lays them in staggered rows with joints, using the grain photo |
| Expressions | `tileSize: [0.68, 0.68]` | Estimated (about 85mm wide herringbone blocks). Update if you have the block size |
| Westminster | `tileSize: [0.25, 0.25]` | Estimated from the pile in the photo |
| Buckingham | `tileSize: [0.3, 0.3]` | Estimated from the pile in the photo |
| Sandringham Chile | `tileSize: [0.11, 0.105]` | Estimated (two chevrons across, about 1.3cm per tuft row). Update if you have the pattern size |

### Remaking the tiles

Replace a photo in `textures/source/`, then from the repo folder run `python3 tools/make_textures.py`. How each tile is made, and why, is described at the top of that file. Mirrored tiles were tried first and broke every pattern, so carpets use a best-match seam, herringbone and the Balmoral checkerboard are cut on an exact pattern repeat, and laminate is offset-and-blended.

---

## Editing prices and wording

Everything you'd want to change is in the `MDF_CONFIG` block at the very top of `price-calculator.js`. Nothing price-related lives anywhere else.

The easy way to edit, straight on GitHub:

1. Open `price-calculator.js` in the repo and click the pencil icon (Edit).
2. Change the values inside `MDF_CONFIG` (see below).
3. Click **Commit changes** on the `main` branch. GitHub Pages updates within a few minutes.
4. Bump `?v=` in the Elementor widget (see Cache above).

### What you can change

| Setting | Meaning |
|---|---|
| `wastePercent` | Extra material for cutting and waste. Currently `0`, so customers see a single figure. Raise it (e.g. `10`) to show a range ("£450 to £495"). |
| `depositPerRoom` | Deposit in £ per room. Stairs count as a room. |
| `minOrder` | Minimum order value (£) for the whole order (see "How the estimate works"). |
| `termWeeks` | Number of weeks the customer pays over. Monthly shows "over N months", rounded up (36 weeks = 9 months). |
| `minWeekly` / `minMonthly` | Lowest weekly / monthly payment shown (£). Applied silently. |
| `prefitPercent` | "Paid before fitting" as a percentage of the total. It includes the deposit and is never less than the deposit. |
| `showPrefit` | `true` shows "paid before fitting" in the price bar and small print. `false` hides it. |
| `financeBadge` | The finance claims, e.g. `["0% interest", "No credit checks"]`. Shown as a strip at the top and as chips in the price bar. Use `[]` to hide both. |
| `bookingUrl` | Where "Book my free home visit" goes. |
| `carpetPageUrl` | Where "Browse every carpet and colour" goes. |
| `maxRooms` | Most rooms a customer can add. |
| `products` | Carpet, Vinyl, Laminate and their ranges (see below). |
| `roomPresets` | Room types and their Small / Medium / Large sizes as `[length, width]` in metres. |
| `stairs` | Stairs option: which products are allowed (`products: ["carpet"]`), m² for a straight flight, a flight with a turn, and the landing. `enabled: false` removes it. |
| `defaultRoom` / `defaultProduct` | What the calculator starts on. |
| `sizeLimits` | Range of the "I know my measurements" sliders, in metres. |
| `comparisonsWeekly` / `comparisonsMonthly` | The everyday comparison after the daily price, e.g. "That's £2.14 a day · less than four coffees on the go". Each entry applies when the weekly (or monthly) payment is at or below `max`; the first match wins and nothing shows above the last entry. The daily figure is weekly ÷ 7, or monthly × 12 ÷ 365. Use `[]` to turn one off. |
| `copy` | Every piece of text customers see. |

Each range looks like this:

```js
{ id: "westminster", name: "Westminster", tagline: "Hard-wearing Saxony", shownAs: "Mid Grey", pricePerM2: 29,
  coloursUrl: "https://mydreamflooring.co.uk/carpets/?e-filter-101e477-flooring_tier=classic",
  textureUrl: "https://mydreamflooring.co.uk/wp-content/uploads/.../westminster.jpg",
  thumbUrl: "https://mydreamflooring.co.uk/wp-content/uploads/.../westminster-thumb.jpg",
  textureLocal: "textures/westminster.jpg", thumbLocal: "textures/westminster-thumb.jpg", tileSize: [0.25, 0.25] },
```

- `pricePerM2` is a plain number (no £, no quote marks), in £ per m², supply only. It's used for the maths only and never shown. Customers see the range's weekly or monthly cost for their room instead.
- `shownAs` is the colour or design in the photos (see "Example colours" above).
- `coloursUrl` opens in a new tab as "Explore the full range". Use `null` (no quote marks) if there's no range page: the card then offers "View a larger swatch" instead, when there's an image.
- To add a range, copy a whole `{ ... },` block and change it. Every block except the last in the list needs a comma at the end.

### Turning the "Paid before fitting" line off

Find `showPrefit: true,` in `MDF_CONFIG` and change it to `showPrefit: false,` (no quote marks). Commit, then bump `?v=` in the Elementor widget. To change the amount, edit `prefitPercent` (for example `prefitPercent: 25,`).

### "TODO" values

If something isn't ready yet, write `"TODO"` and the calculator copes:

| TODO in… | What customers see |
|---|---|
| `tagline` | No tagline |
| `coloursUrl` | No "Explore the full range" link |
| `pricePerM2` | That range is hidden |
| `textureUrl` / `thumbUrl` | The repo copy is used instead |
| `bookingUrl` | No booking button |
| `carpetPageUrl` | No "Browse every carpet and colour" link |

If every range in a product is hidden, the whole product is hidden.

### Checking your edit

Open the demo page after GitHub Pages updates. If the calculator doesn't appear, you've almost certainly lost a comma or quote mark. Undo your last change from the file's **History** on GitHub and try again.

---

## How the estimate works

- **Room area:** length × width (preset or slider). Stairs: the flight's m² plus the landing if included.
- **Per room:** area × price, rounded to the nearest £5 (with `wastePercent` above 0, the high end also adds waste).
- **Total:** the sum of the rooms.
- **Minimum order:** if the total is below `minOrder`, `minOrder` is used as the total for everything: the price, payments and pre-fit. The price bar shows "Our minimum order is £300", and the rooms list offers "Got another room in mind? Add it and it's still one order" with an "Add a room" button. Each room still shows its real price.
- **Deposit:** `depositPerRoom` × number of rooms.
- **Base weekly:** (total − deposit) ÷ `termWeeks`.
- **Weekly:** the higher of base weekly and `minWeekly`, rounded **up** to the nearest 50p.
- **Monthly:** the higher of (base weekly × 52 ÷ 12) and `minMonthly`, rounded **up** to the nearest £1.
- **Paid before fitting:** the higher of (total × `prefitPercent` ÷ 100) and the deposit, rounded **up** to the nearest £1.
- **Range cards:** each card shows the weekly (or monthly) payment for the whole order as if that range were chosen for the room being edited, with the other rooms unchanged. The product buttons show the lowest of those ("from £15 a week"). They update live as the size, room or stairs options change.
- **Daily figure:** weekly ÷ 7, or monthly × 12 ÷ 365, to the penny.

---

## Tracking

Each event is pushed to `window.dataLayer` as `{ event: "<name>", ...params }`, ready for GTM triggers. If Hotjar is on the page, `hj('event', '<name>')` is also called. Neither is required: the calculator works without them and never throws.

| Event | Params | Fires when |
|---|---|---|
| `calculator_start` | none | First interaction (again after a restart) |
| `room_added` | `room_type`, `rooms` | A room is added |
| `room_removed` | `rooms` | A room is removed |
| `room_type_selected` | `room_type` | A room type pill (or Stairs) is tapped |
| `size_selected` | `size_method` (`preset` / `exact` / `stairs`), `size` | A size is picked, or the sliders are first used |
| `product_selected` | `product` | Carpet / Vinyl / Laminate is tapped |
| `range_selected` | `product`, `range` | A range card is tapped |
| `range_link_clicked` | `range` | "Explore the full range" is clicked |
| `preview_rotated` | none | The 3D preview is first dragged |
| `estimate_viewed` | `rooms`, `product_mix` (e.g. `carpet:2\|vinyl:1`), `total_low`, `total_high`, `prefit`, `payment_frequency` | The price settles (about a second after a change), once per new price |
| `min_order_applied` | `total_high_before_floor` | Alongside `estimate_viewed`, when the minimum order applies |
| `add_room_from_min_order` | none | "Add a room" under the minimum order notice is clicked |
| `payment_toggle` | `payment_period` (`weekly` / `monthly`) | Payment toggle changes |
| `book_visit_clicked` | `total_high` | "Book my free home visit" is clicked |
| `calculator_restart` | none | "Start again" is clicked |

For the Meta pixel, create GTM tags that fire on these dataLayer events (for example, `book_visit_clicked` → Lead).

---

## GitHub Pages setup (one time)

1. Repo **Settings → Pages**.
2. **Source:** Deploy from a branch. **Branch:** `main`, folder `/ (root)`. Save.
3. After a minute or two the demo is live at https://my-dream-flooring.github.io/mdf-price-calculator/

## Testing locally

From the repo folder, run `python3 -m http.server 8000` and open http://localhost:8000/. The demo page shows the dataLayer events underneath the calculator. It also includes some deliberately clashing "theme" styles, to show they don't leak in.
