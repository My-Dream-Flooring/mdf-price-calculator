# MDF Price Calculator

A flooring price calculator for the My Dream Flooring website. Customers add their rooms, choose a product and range for each, and get an estimated **supply-only** price plus a weekly or monthly payment. Fitting isn't included: the local rep prices it on the day.

It's plain JavaScript and CSS with no framework and no build step. It renders straight into the WordPress page (not an iframe), so Hotjar, GTM and the Meta pixel can see every interaction.

| File | What it is |
|---|---|
| `price-calculator.js` | The calculator. **All prices and wording are in `MDF_CONFIG` at the top.** |
| `price-calculator.css` | Styles. Everything is scoped under `#mdf-price-calculator`. |
| `index.html` | Demo/test page. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

**Live demo:** https://my-dream-flooring.github.io/mdf-price-calculator/

---

## Embedding it in Elementor

1. Edit the page in Elementor and drag an **HTML** widget where you want the calculator.
2. Paste in exactly this:

```html
<div id="mdf-price-calculator"></div>
<link rel="stylesheet" href="https://my-dream-flooring.github.io/mdf-price-calculator/price-calculator.css?v=1">
<script src="https://my-dream-flooring.github.io/mdf-price-calculator/price-calculator.js?v=1" defer></script>
```

3. Update the page and check it on your phone.

Notes:
- **Cache:** GitHub Pages and browsers cache files for a while. After you change prices, bump `?v=1` to `?v=2` (and so on) in both lines so visitors get the new version straight away.
- Use **one calculator per page**. It only looks for the element with `id="mdf-price-calculator"`.
- The script only changes things inside that `<div>`. The one exception: if the page hasn't already loaded the Montserrat font, it adds a Google Fonts link (weight 400 only) to the page `<head>`.
- If a caching or optimisation plugin (WP Rocket, Autoptimize, etc.) delays or combines JavaScript, exclude `price-calculator.js` from that.

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
| `wastePercent` | Extra material for cutting and waste. The high end of the estimate includes it. |
| `depositPerRoom` | Deposit in £ per room. |
| `minOrder` | If the high estimate is below this, customers see "Our minimum order is £…". |
| `termWeeks` | Number of weeks the customer pays over. |
| `minWeekly` | Lowest weekly payment shown (£). If the maths comes out lower, this figure is shown instead, with no message about it. |
| `minMonthly` | Lowest monthly payment shown (£). Works the same way as `minWeekly`. |
| `prefitPercent` | The "Paid before fitting" amount, as a percentage of the high total. It includes the deposit and is never less than the deposit. |
| `showPrefit` | `true` shows the "Paid before fitting" line on the results screen. `false` hides it completely. |
| `bookingUrl` | Where "Book my free home visit" goes. |
| `carpetPageUrl` | Where "Not sure? Browse our carpets first" goes. |
| `products` | Laminate, Vinyl, Carpet and their ranges (see below). |
| `roomPresets` | Room types and their Small / Medium / Large sizes in m². |
| `sizeLimits` | Smallest and largest length or width (metres) customers can type in. |
| `copy` | Every piece of text customers see. |

Each range looks like this:

```js
{ id: "westminster", name: "Westminster", tagline: "Hard wearing", pricePerM2: 29, image: "https://.../westminster.jpg", link: "https://.../westminster/" }
```

- `pricePerM2` is a plain number (no £, no quote marks), in £ per m², supply only.
- `image` should be a square photo, ideally at least 600×600px. Upload it to the WordPress Media Library and paste its full URL.
- `link` opens in a new tab. Use `null` (no quote marks) if there's no range page: tapping the swatch then opens a bigger version of the image instead.
- To add a range, copy a whole `{ ... },` line and change it. Every line except the last in the list needs a comma at the end.

### Turning the "Paid before fitting" line off

Find `showPrefit: true,` in `MDF_CONFIG` and change it to `showPrefit: false,` (no quote marks). Commit, then bump `?v=` in the Elementor widget. To turn it back on, change it to `true`. To change the amount, edit `prefitPercent` (for example `prefitPercent: 25,`).

### "TODO" values

If something isn't ready yet, write `"TODO"` and the calculator copes:

| TODO in… | What customers see |
|---|---|
| `tagline` | No tagline |
| `image` | A plain placeholder swatch |
| `link` | No "See the range" link |
| `pricePerM2` | That range is hidden |
| `bookingUrl` | No booking button |
| `carpetPageUrl` | No "Browse our carpets" link |

If every range in a product is hidden, the whole product is hidden.

### Checking your edit

Open the demo page after GitHub Pages updates. If the calculator doesn't appear, you've almost certainly lost a comma or quote mark. Undo your last change from the file's **History** on GitHub and try again.

---

## How the estimate works

- **Room area:** length × width, or the preset m².
- **Per room:** low = area × price; high = area × (1 + waste %) × price. Each is rounded to the nearest £5.
- **Total:** the sum of the rooms' lows and highs.
- **Deposit:** `depositPerRoom` × number of rooms, shown separately.
- **Base weekly:** (high total − deposit) ÷ `termWeeks`.
- **Weekly:** the higher of base weekly and `minWeekly`, rounded **up** to the nearest 50p.
- **Monthly:** the higher of (base weekly × 52 ÷ 12) and `minMonthly`, rounded **up** to the nearest £1.
- **Paid before fitting:** the higher of (high total × `prefitPercent` ÷ 100) and the deposit, rounded **up** to the nearest £1. It includes the deposit. Shown only if `showPrefit` is `true`.
- If a customer skips choosing a range, the cheapest range for that product is used and the result is labelled "From".

---

## Tracking

Each event is pushed to `window.dataLayer` as `{ event: "<name>", ...params }`, ready for GTM triggers. If Hotjar is on the page, `hj('event', '<name>')` is also called. Neither is required: the calculator works without them and never throws.

| Event | Params | Fires when |
|---|---|---|
| `calculator_start` | none | First click or typing in the calculator (again after a restart) |
| `room_added` | `room_type`, `size_method` (`exact` / `preset`) | Once per room, when they continue from the rooms step |
| `product_selected` | `product` | A product card is tapped |
| `range_selected` | `product`, `range` | A range is chosen (not fired on Skip) |
| `range_link_clicked` | `range` | "See the range" is clicked |
| `estimate_viewed` | `rooms`, `product_mix` (e.g. `carpet:2\|vinyl:1`), `total_low`, `total_high`, `prefit`, `payment_frequency` (`weekly` / `monthly`) | Results screen is shown |
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
