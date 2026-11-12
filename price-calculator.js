/*!
 * My Dream Flooring – Price Calculator (3D room preview)
 * Renders inside <div id="mdf-price-calculator"></div> and nowhere else.
 * No framework, no build step. Edit MDF_CONFIG below to change prices and copy.
 * The 3D preview uses three.js r128 (MIT), loaded from vendor/three.min.js next
 * to this file unless the page already has window.THREE.
 */
(function () {
  "use strict";

  /* =========================================================================
   *  MDF_CONFIG — EDIT PRICES, RANGES, ROOM SIZES AND WORDING HERE
   * =========================================================================
   *  Rules for editing:
   *  - Numbers have no quote marks:   pricePerM2: 35
   *  - Text goes inside quote marks:  tagline: "Wood effect"
   *  - Every line inside { } ends with a comma.
   *  - Not ready yet? Write "TODO". The calculator copes:
   *      tagline "TODO"      -> tagline is hidden
   *      coloursUrl "TODO"   -> the "Explore the full range" link is hidden
   *      pricePerM2 "TODO"   -> that range is hidden from customers
   *      textureUrl / thumbUrl / nimbusUrl "TODO" -> the copy in this repo's
   *                          /upload-to-wordpress folder is used
   *      bookingUrl / browseUrl "TODO" -> that button/link is hidden
   *  - Images: on mydreamflooring.co.uk the live (media library) URL is used;
   *    if it fails to load, the repo copy is used instead. Elsewhere (GitHub
   *    Pages, testing) the repo copy is used.
   *  - All prices are £ per square metre, SUPPLY ONLY (no fitting).
   * ========================================================================= */
  const MDF_CONFIG = {
    // Extra material added for cutting and waste, as a percentage.
    // At 0, customers see a single figure instead of a range.
    wastePercent: 0,

    // Deposit charged per room (£). Stairs count as a room.
    depositPerRoom: 40,

    // Minimum order value (£) for the whole order. If the estimate is below
    // this, this figure is used as the total for everything (price, payments,
    // pre-fit). Each room still shows its real price.
    minOrder: 300,

    // Number of weeks the customer pays over.
    termWeeks: 36,

    // Lowest weekly / monthly payment we show (£). Applied silently.
    minWeekly: 15,
    minMonthly: 65,

    // "Paid before fitting" = the higher of (total x prefitPercent / 100) and
    // the deposit, rounded up to the nearest £1. It INCLUDES the deposit.
    // Set showPrefit to false to hide it.
    prefitPercent: 20,
    showPrefit: true,

    // Font for headings, range names and the big weekly/monthly figure. The
    // live site already loads Tan Nimbus; elsewhere it falls back to Montserrat.
    displayFont: "'Tan Nimbus', 'Montserrat', sans-serif",

    // Nimbus, the guide character. nimbusUrl / nimbusUrl2x are the images in
    // the WordPress media library (live site); local / local2x are the copies
    // in this repo, used elsewhere or if a live image fails to load.
    nimbus: {
      wave: {
        nimbusUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-nimbus-wave.webp", nimbusUrl2x: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-nimbus-wave-2x.webp",
        local: "upload-to-wordpress/mdfc-nimbus-wave.webp", local2x: "upload-to-wordpress/mdfc-nimbus-wave-2x.webp" },
      think: {
        nimbusUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-nimbus-think.webp", nimbusUrl2x: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-nimbus-think-2x.webp",
        local: "upload-to-wordpress/mdfc-nimbus-think.webp", local2x: "upload-to-wordpress/mdfc-nimbus-think-2x.webp" },
      point: {
        nimbusUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-nimbus-point.webp", nimbusUrl2x: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-nimbus-point-2x.webp",
        local: "upload-to-wordpress/mdfc-nimbus-point.webp", local2x: "upload-to-wordpress/mdfc-nimbus-point-2x.webp" },
      celebrate: {
        nimbusUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-nimbus-celebrate.webp", nimbusUrl2x: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-nimbus-celebrate-2x.webp",
        local: "upload-to-wordpress/mdfc-nimbus-celebrate.webp", local2x: "upload-to-wordpress/mdfc-nimbus-celebrate-2x.webp" }
    },

    // Finance claims. Shown as a strip at the top and as chips in the price
    // bar. Use [] to hide both.
    financeBadge: ["0% interest", "No credit checks"],

    // Where the "Book my free home visit" button goes. "#something" scrolls to
    // the element with that CSS ID on the same page (the inline booking form);
    // a full web address opens that page instead.
    bookingUrl: "#mdfc-booking",

    // Most rooms a customer can add.
    maxRooms: 10,

    // Products and their ranges. Each range:
    //   id            – short unique code, lowercase, no spaces (used in tracking)
    //   name          – shown to customers
    //   tagline       – short description under the name
    //   shownAs       – the colour/design in the photos, e.g. "Mid Grey"
    //                   (shown as "Shown in Mid Grey")
    //   pricePerM2    – £ per m², supply only. Used for the maths only; customers
    //                   see what the range costs a week/month for their room
    //   coloursUrl    – page showing the full range (opens in a new tab as
    //                   "Explore the full range"), or null for none
    //   textureUrl    – seamless tile in the WordPress media library (live site)
    //   thumbUrl      – 160px swatch in the WordPress media library (live site)
    //   textureLocal / thumbLocal – the same files in this repo (used on GitHub
    //                   Pages, and on the live site if a live image fails)
    //   tileSize      – real size in metres that one texture tile covers [across, along]
    //   planks        – laminate only: real plank size in metres [width, length]
    //   previewColour – floor colour in the 3D preview when there's no texture
    products: {
      carpet: {
        label: "Carpet",
        browseUrl: "https://mydreamflooring.co.uk/carpets/",
        browseLabel: "Browse every carpet and colour",
        includedNote: "10mm underlay, gripper and door bars included on all carpets.",
        ranges: [
          { id: "westminster", name: "Westminster", tagline: "Hard-wearing Saxony", shownAs: "Mid Grey", pricePerM2: 29,
            coloursUrl: "https://mydreamflooring.co.uk/carpets/?e-filter-101e477-flooring_tier=classic",
            textureUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-westminster.jpg",
            thumbUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-westminster-thumb.jpg",
            textureLocal: "upload-to-wordpress/mdfc-westminster.jpg", thumbLocal: "upload-to-wordpress/mdfc-westminster-thumb.jpg", tileSize: [0.25, 0.25] },
          { id: "buckingham", name: "Buckingham", tagline: "Tufted cut pile, thick and cosy underfoot", shownAs: "Mist", pricePerM2: 35,
            coloursUrl: "https://mydreamflooring.co.uk/carpets/?e-filter-101e477-flooring_tier=luxury",
            textureUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-buckingham.jpg",
            thumbUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-buckingham-thumb.jpg",
            textureLocal: "upload-to-wordpress/mdfc-buckingham.jpg", thumbLocal: "upload-to-wordpress/mdfc-buckingham-thumb.jpg", tileSize: [0.3, 0.3] },
          { id: "sandringham", name: "Sandringham Chile", tagline: "Patterned loop", shownAs: "Chile", pricePerM2: 29,
            coloursUrl: null,
            textureUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-sandringham.jpg",
            thumbUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-sandringham-thumb.jpg",
            textureLocal: "upload-to-wordpress/mdfc-sandringham.jpg", thumbLocal: "upload-to-wordpress/mdfc-sandringham-thumb.jpg", tileSize: [0.11, 0.105] }
        ]
      },
      vinyl: {
        label: "Vinyl",
        browseUrl: "https://mydreamflooring.co.uk/vinyl-flooring/",
        browseLabel: "Browse all our vinyl flooring",
        ranges: [
          { id: "expressions", name: "Expressions", tagline: "Wood and stone effect", shownAs: "Cedar Grey Herringbone", pricePerM2: 28,
            coloursUrl: "https://mydreamflooring.co.uk/vinyl-flooring/",
            textureUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-expressions.jpg",
            thumbUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-expressions-thumb.jpg",
            textureLocal: "upload-to-wordpress/mdfc-expressions.jpg", thumbLocal: "upload-to-wordpress/mdfc-expressions-thumb.jpg", tileSize: [0.68, 0.68] },
          { id: "balmoral", name: "Balmoral", tagline: "Patterned", shownAs: "Pop Art", pricePerM2: 35,
            coloursUrl: "https://mydreamflooring.co.uk/vinyl-flooring/",
            textureUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-balmoral.jpg",
            thumbUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-balmoral-thumb.jpg",
            textureLocal: "upload-to-wordpress/mdfc-balmoral.jpg", thumbLocal: "upload-to-wordpress/mdfc-balmoral-thumb.jpg", tileSize: [0.332, 0.332] }
        ]
      },
      laminate: {
        label: "Laminate",
        browseUrl: "https://mydreamflooring.co.uk/laminate-range/",
        browseLabel: "Browse all our laminate",
        ranges: [
          { id: "laminate", name: "Laminate", tagline: "8mm, pet-proof and easy to clean", shownAs: "Atlas", pricePerM2: 35,
            coloursUrl: "https://mydreamflooring.co.uk/laminate-range/",
            textureUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-laminate.jpg",
            thumbUrl: "https://mydreamflooring.co.uk/wp-content/uploads/2026/11/mdfc-laminate-thumb.jpg",
            textureLocal: "upload-to-wordpress/mdfc-laminate.jpg", thumbLocal: "upload-to-wordpress/mdfc-laminate-thumb.jpg", planks: [0.191, 1.9] }
        ]
      }
    },

    // Room types and their Small / Medium / Large sizes as [length, width] in
    // metres. The m² is length x width. Order here = order of the buttons.
    roomPresets: {
      "Bedroom": { small: [2.7, 2.6], medium: [3.2, 3.1], large: [3.8, 3.7] },
      "Living room": { small: [3.5, 3.4], medium: [4.0, 4.0], large: [4.8, 4.6] },
      "Dining room": { small: [3.0, 3.0], medium: [3.5, 3.4], large: [4.0, 4.0] },
      "Hallway": { small: [3.0, 1.0], medium: [4.2, 1.2], large: [5.0, 1.6] },
      "Kitchen": { small: [3.0, 2.0], medium: [3.4, 2.9], large: [4.0, 3.5] },
      "Bathroom": { small: [2.0, 1.5], medium: [2.5, 2.0], large: [2.8, 2.5] }
    },

    // Stairs: m² of flooring per flight (13 steps x ~0.48m x 0.9m wide, plus
    // cutting). Set enabled: false to remove the Stairs option.
    stairs: {
      enabled: true,
      label: "Stairs",
      products: ["carpet"], // which products can go on stairs
      straight: 6,
      turn: 7.5,
      landing: 2
    },

    // Room the calculator starts on, and its flooring.
    defaultRoom: "Living room",
    defaultProduct: "carpet",

    // "I know my measurements" sliders (metres).
    sizeLimits: { min: 0.8, max: 10, step: 0.1 },

    // Everyday comparisons after the daily price. Each applies when the
    // weekly (or monthly) payment is at or below max; the first match is used
    // and nothing is shown above the last entry. Use [] to turn one off.
    comparisonsWeekly: [
      { max: 15, text: "less than four coffees on the go" },
      { max: 20, text: "about the same as a Friday night takeaway" },
      { max: 25, text: "less than a pizza night in for the family" },
      { max: 30, text: "less than a cinema trip for two with snacks" },
      { max: 35, text: "less than a family trip to the cinema" },
      { max: 40, text: "less than a family Sunday carvery" },
      { max: 45, text: "less than a meal out for two" }
    ],
    comparisonsMonthly: [
      { max: 65,  text: "less than a takeaway coffee every weekday" },
      { max: 80,  text: "about the same as a Friday takeaway every week" },
      { max: 100, text: "less than a family pizza night every week" },
      { max: 125, text: "less than a cinema trip for two every week" },
      { max: 150, text: "less than a family Sunday carvery every week" },
      { max: 180, text: "less than a meal out for two every week" }
    ],

    // All wording shown to customers. {curly} words are filled in automatically.
    copy: {
      title: "What will my new floor cost?",
      headSub: "Pick your floor and see your weekly price.",
      guideWave: "Pick your floor and I'll work out your weekly price. Takes about 30 seconds.",
      guideThink: "Just setting up your room...",
      guideCelebrateOne: "Your new {room}'s sorted.",
      guideCelebrateStairs: "Your new stairs are sorted.",
      guideCelebrateMany: "Your new floors are sorted.",
      roomsHeading: "Your rooms",
      roomTab: "{n}. {room}",
      addRoom: "Add another room",
      removeRoom: "Remove {room}",
      roomTypeHeading: "Which room?",
      sizeHeading: "How big is it?",
      sizeHelp: "Not sure? Pick a size and your rep will measure properly.",
      sizeNames: { small: "Small", medium: "Medium", large: "Large" },
      aboutM2: "about {m2} m²",
      measureOpen: "I know my measurements",
      measureClose: "Hide measurements",
      lengthLabel: "Length",
      widthLabel: "Width",
      stairsStraight: "Straight flight",
      stairsTurn: "With a turn",
      stairsLandingAdd: "Add the landing",
      stairsLandingOn: "Landing included",
      stairsOnly: "Stairs are carpet only.",
      flooringHeading: "Pick your flooring",
      productFrom: "from {price} {per}",
      rangeHeading: "Pick your {product}",
      seeColours: "Explore the full range",
      shownIn: "Shown in {colour}",
      stageShownIn: "Shown in {colour}. More colours in the range.",
      roomShownIn: "Shown in {colour}. Your rep brings samples of the full range.",
      rangeCost: "{price} {per}",
      viewLarger: "View a larger swatch",
      newTab: "(opens in a new tab)",
      closeLightbox: "Close",
      noImage: "No image yet for {range}",
      stageAria: "3D preview of your room with the chosen flooring",
      stageHint: "Drag to look around",
      stageFallback: "The 3D preview can't load on this device, but your price below still works.",
      previewColourOnly: "Colour preview only for this range",
      stairsLabel: "Stairs",
      stairsTurnLabel: "Stairs with a turn",
      stairsLandingLabel: "+ landing",
      weekly: "Weekly",
      monthly: "Monthly",
      paymentLabel: "Show payments",
      perWeek: "a week",
      perMonth: "a month",
      overTerm: "over {weeks} weeks",
      overTermMonthly: "over {months} months",
      daily: "That's {daily} a day",
      supplyLabel: "Estimated supply cost {total}",
      priceRange: "{low} to {high}",
      minOrderNote: "Our minimum order is {minOrder}",
      minOrderAddPrompt: "Got another room in mind? Add it and it's still one order.",
      minOrderAddButton: "Add a room",
      depositLine: "{deposit} deposit",
      prefitLine: "{prefit} paid before fitting",
      prefitDetail: "Paid before fitting includes your {deposit} deposit. Your rep will talk you through it.",
      fittingNote: "Fitting is priced by your local rep on the day.",
      smallPrint: "This is a supply-only estimate based on the sizes you entered. Your rep will measure up and confirm your price.",
      bookCta: "Book my free home visit",
      barDetails: "Details",
      barHide: "Hide details",
      startAgain: "Start again"
    }
  };
  /* ======================= END OF CONFIG — no prices below ================= */

  const ROOT_ID = "mdf-price-calculator";
  const C = MDF_CONFIG;
  const T = C.copy;
  const SIZE_KEYS = ["small", "medium", "large"];
  const STAIRS = "__stairs__";
  const LIVE_HOST = "mydreamflooring.co.uk";

  // Folder this script was loaded from, for local textures and vendor/three.
  const BASE = (function () {
    try {
      let s = document.currentScript;
      if (!s || !s.src) s = document.querySelector('script[src*="price-calculator.js"]');
      return s && s.src ? s.src.replace(/[^/]*(\?.*)?$/, "") : "";
    } catch (e) { return ""; }
  })();

  /* ---------- Tracking ---------- */
  function track(eventName, params) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
    } catch (e) { /* never throw */ }
    try {
      if (typeof window.hj === "function") window.hj("event", eventName);
    } catch (e) { /* never throw */ }
  }

  /* ---------- Small helpers ---------- */
  function isTodo(v) {
    return v === undefined || v === null ||
      (typeof v === "string" && (v.trim() === "" || v.trim().toUpperCase() === "TODO"));
  }
  function hasText(v) { return typeof v === "string" && !isTodo(v); }
  function validNum(n) { return typeof n === "number" && isFinite(n) && n > 0; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmt(tpl, vars) {
    return String(tpl == null ? "" : tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m;
    });
  }
  function money(n) {
    const whole = Math.abs(n - Math.round(n)) < 1e-9;
    return "£" + (whole
      ? Math.round(n).toLocaleString("en-GB")
      : n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }
  function m2(n, dp) {
    return (Math.round(n * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp == null ? 1 : dp }) + " m²";
  }
  function round5(n) { return Math.round(n / 5) * 5; }
  function ceilHalf(n) { return Math.ceil(n * 2 - 1e-9) / 2; }
  function ceilPound(n) { return Math.ceil(n - 1e-9); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function priceText(low, high) {
    return low === high ? money(high) : fmt(T.priceRange, { low: money(low), high: money(high) });
  }
  function financeItems() {
    return (Array.isArray(C.financeBadge) ? C.financeBadge : []).filter(hasText);
  }
  function isLiveSite() {
    try {
      const h = location.hostname;
      return h === LIVE_HOST || h.slice(-(LIVE_HOST.length + 1)) === "." + LIVE_HOST;
    } catch (e) { return false; }
  }
  // On mydreamflooring.co.uk: the live media-library URL, with the repo copy as
  // a fallback if it fails to load. Anywhere else: the repo copy.
  const failedLive = {};
  function localUrl(local) {
    if (!hasText(local)) return "";
    return /^(https?:)?\/\//.test(local) ? local : BASE + local;
  }
  function assetPair(live, local) {
    const loc = localUrl(local);
    if (isLiveSite() && hasText(live) && !failedLive[live]) return { src: live, fallback: loc && loc !== live ? loc : "" };
    return { src: loc, fallback: "" };
  }
  function assetUrl(live, local) { return assetPair(live, local).src; }
  // <img> attributes: src plus the fallback onImgError switches to if it fails
  function imgSrcAttrs(live, local) {
    const a = assetPair(live, local);
    return 'src="' + esc(a.src) + '"' + (a.fallback ? ' data-fallback="' + esc(a.fallback) + '"' : "");
  }

  /* ---------- Catalogue (reads config, hides incomplete items) ---------- */
  function visibleRanges(pk) {
    const p = C.products && C.products[pk];
    if (!p || !Array.isArray(p.ranges)) return [];
    return p.ranges.filter(function (r) { return r && hasText(r.id) && hasText(r.name) && validNum(r.pricePerM2); });
  }
  function productKeys(forStairs) {
    return Object.keys(C.products || {}).filter(function (k) {
      if (!visibleRanges(k).length) return false;
      return !forStairs || ((C.stairs && C.stairs.products) || []).indexOf(k) !== -1;
    });
  }
  function productLabel(pk) { const p = C.products[pk]; return p && hasText(p.label) ? p.label : pk; }
  function findRange(pk, id) { return visibleRanges(pk).filter(function (r) { return r.id === id; })[0] || null; }
  function presetSizes(type) {
    const p = (C.roomPresets || {})[type] || {};
    return SIZE_KEYS.filter(function (k) { return Array.isArray(p[k]) && validNum(p[k][0]) && validNum(p[k][1]); })
      .map(function (k) { return { key: k, L: p[k][0], W: p[k][1] }; });
  }
  function roomTypes() {
    const t = Object.keys(C.roomPresets || {}).filter(function (k) { return presetSizes(k).length; });
    if (C.stairs && C.stairs.enabled && productKeys(true).length) t.push(STAIRS);
    return t;
  }
  function typeLabel(type) { return type === STAIRS ? (C.stairs.label || "Stairs") : type; }

  /* ---------- State ---------- */
  let state = null;
  let uid = 0;
  function newRoom(from) {
    const types = roomTypes().filter(function (t) { return t !== STAIRS; });
    let type;
    if (!state || !state.rooms.length) {
      type = types.indexOf(C.defaultRoom) !== -1 ? C.defaultRoom : types[0];
    } else {
      const used = state.rooms.map(function (r) { return r.type; });
      type = types.filter(function (t) { return used.indexOf(t) === -1; })[0] || types[0];
    }
    const r = { id: "r" + (++uid), type: type, size: "medium", L: 4, W: 4, stairs: "straight", landing: true, product: "", range: "" };
    applyPreset(r);
    const keys = productKeys();
    const pk = from && keys.indexOf(from.product) !== -1 ? from.product
      : (keys.indexOf(C.defaultProduct) !== -1 ? C.defaultProduct : keys[0]);
    setProduct(r, pk, from && from.product === pk ? from.range : "");
    return r;
  }
  function applyPreset(r) {
    if (r.type === STAIRS) return;
    const sizes = presetSizes(r.type);
    const s = sizes.filter(function (x) { return x.key === r.size; })[0] ||
      sizes.filter(function (x) { return x.key === "medium"; })[0] || sizes[0];
    if (!s) return;
    r.size = s.key; r.L = s.L; r.W = s.W;
  }
  function setProduct(r, pk, rangeId) {
    r.product = pk;
    r.range = (findRange(pk, rangeId) || visibleRanges(pk)[0] || {}).id || "";
  }
  function roomArea(r) {
    if (r.type === STAIRS) return (Number(C.stairs[r.stairs]) || 0) + (r.landing ? (Number(C.stairs.landing) || 0) : 0);
    return Math.round(r.L * r.W * 100) / 100;
  }
  function roomName(i) {
    const r = state.rooms[i];
    const same = state.rooms.filter(function (x) { return x.type === r.type; });
    return typeLabel(r.type) + (same.length > 1 ? " " + (same.indexOf(r) + 1) : "");
  }
  function freshState() {
    state = { rooms: [], active: 0, payment: "weekly", measureOpen: false, started: false, barOpen: false };
    state.rooms.push(newRoom());
  }
  freshState();
  function activeRoom() { return state.rooms[state.active]; }

  /* ---------- Maths ---------- */
  function estimate(roomsList) {
    const rooms = roomsList || state.rooms;
    const waste = 1 + (Number(C.wastePercent) || 0) / 100;
    const lines = rooms.map(function (r, i) {
      const a = roomArea(r);
      const rg = findRange(r.product, r.range);
      const price = rg ? rg.pricePerM2 : 0;
      return { name: roomName(i), area: a, product: r.product, range: rg, low: round5(a * price), high: round5(a * waste * price) };
    });
    const rawLow = lines.reduce(function (s, l) { return s + l.low; }, 0);
    const rawHigh = lines.reduce(function (s, l) { return s + l.high; }, 0);
    const minOrder = Number(C.minOrder) || 0;
    const belowMin = rawHigh < minOrder;
    const low = belowMin ? minOrder : rawLow;
    const high = belowMin ? minOrder : rawHigh;
    const deposit = (Number(C.depositPerRoom) || 0) * lines.length;
    const term = Number(C.termWeeks) || 1;
    const baseWeekly = Math.max(0, high - deposit) / term;
    const weekly = ceilHalf(Math.max(baseWeekly, Number(C.minWeekly) || 0));
    const monthly = ceilPound(Math.max(baseWeekly * 52 / 12, Number(C.minMonthly) || 0));
    const prefit = ceilPound(Math.max(high * (Number(C.prefitPercent) || 0) / 100, deposit));
    return { lines: lines, low: low, high: high, rawHigh: rawHigh, belowMin: belowMin, deposit: deposit, weekly: weekly, monthly: monthly, prefit: prefit };
  }
  // Weekly or monthly payment (per the toggle) if the active room used this range,
  // with every other room in the order unchanged.
  function paymentWith(pk, rangeId) {
    const rooms = state.rooms.map(function (r, i) {
      return i === state.active ? Object.assign({}, r, { product: pk, range: rangeId }) : r;
    });
    const e = estimate(rooms);
    return state.payment === "weekly" ? e.weekly : e.monthly;
  }
  function perText() { return state.payment === "weekly" ? T.perWeek : T.perMonth; }
  function rangeCostText(pk, rangeId) { return fmt(T.rangeCost, { price: money(paymentWith(pk, rangeId)), per: perText() }); }
  function productFromText(pk) {
    const lowest = visibleRanges(pk).reduce(function (m, rg) { return Math.min(m, paymentWith(pk, rg.id)); }, Infinity);
    return fmt(T.productFrom, { price: money(lowest), per: perText() });
  }
  // "That's £2.14 a day · less than four coffees on the go"
  function dailyLine(e) {
    const weekly = state.payment === "weekly";
    const amount = weekly ? e.weekly : e.monthly;
    const perDay = Math.round((weekly ? e.weekly / 7 : e.monthly * 12 / 365) * 100) / 100;
    let comp = "";
    ((weekly ? C.comparisonsWeekly : C.comparisonsMonthly) || []).some(function (c) {
      if (c && amount <= c.max && hasText(c.text)) { comp = " · " + c.text; return true; }
      return false;
    });
    return fmt(T.daily, { daily: money(perDay) }) + comp;
  }
  // Refresh every range/product figure in place (keeps focus, e.g. while sliding)
  function updateCosts() {
    const r = activeRoom();
    app.querySelectorAll("[data-cost-range]").forEach(function (el) { el.textContent = rangeCostText(r.product, el.getAttribute("data-cost-range")); });
    app.querySelectorAll("[data-cost-product]").forEach(function (el) { el.textContent = productFromText(el.getAttribute("data-cost-product")); });
  }

  /* ---------- Icons ---------- */
  const ICON = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tick: '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="7" fill="#fff"/><path d="M4 7.2l2 2 4-4.2" fill="none" stroke="#10888c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    swatch: '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="8" y="8" width="32" height="32" rx="4"/><path d="M8 30l9-9 8 8 5-5 10 10"/><circle cx="31" cy="17" r="3"/></g></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 11v6M12 7.5v.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };

  /* ---------- Nimbus guide ---------- */
  const REDUCE = (function () { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
  const guideSeen = {}, guideImgFailed = {};
  // Nimbus + speech bubble. It bobs in the first time it appears (not on re-renders).
  function guideHtml(key, role, text, countAsSeen) {
    const n = (C.nimbus || {})[role] || {};
    const one = assetPair(n.nimbusUrl, n.local), two = assetPair(n.nimbusUrl2x, n.local2x);
    const src = guideImgFailed[role] ? "" : one.src;
    const src2 = guideImgFailed[role] ? "" : two.src;
    const isNew = !guideSeen[key] && !REDUCE;
    if (countAsSeen !== false) guideSeen[key] = true;
    return '<div class="mdfc-guide mdfc-guide--' + role + (isNew ? " is-new" : "") + (src ? "" : " no-img") + '">' +
      (src ? '<img class="mdfc-guide-img" data-role="' + role + '" src="' + esc(src) + '"' +
        (src2 ? ' srcset="' + esc(src) + " 1x, " + esc(src2) + ' 2x"' : "") +
        (one.fallback ? ' data-fallback="' + esc(one.fallback) + '"' +
          (two.fallback ? ' data-fallback-srcset="' + esc(one.fallback) + " 1x, " + esc(two.fallback) + ' 2x"' : "") : "") +
        ' alt="" decoding="async">' : "") +
      '<p class="mdfc-bubble">' + esc(text) + "</p></div>";
  }
  function guideGone(key) { guideSeen[key] = false; }

  /* ---------- Rendering ---------- */
  let root, app, panel, bar, stageEl, stageLabel, stageNote, live;

  function renderShell() {
    const fin = financeItems();
    const wave = (C.nimbus || {}).wave || {};
    const head = assetPair(wave.nimbusUrl, wave.local);
    const head2 = assetPair(wave.nimbusUrl2x, wave.local2x);
    app.innerHTML =
      (fin.length ? '<p class="mdfc-finance-slim">' + esc(fin.join(" · ")) + "</p>" : "") +
      // Header. On phones (under 600px) it becomes one compact block: Nimbus,
      // a smaller headline and one line under it.
      '<div class="mdfc-head">' +
        (head.src ? '<img class="mdfc-head-nimbus" src="' + esc(head.src) + '"' +
          (head2.src ? ' srcset="' + esc(head.src) + " 1x, " + esc(head2.src) + ' 2x"' : "") +
          (head.fallback ? ' data-fallback="' + esc(head.fallback) + '"' +
            (head2.fallback ? ' data-fallback-srcset="' + esc(head.fallback) + " 1x, " + esc(head2.fallback) + ' 2x"' : "") : "") +
          ' alt="" decoding="async">' : "") +
        '<div class="mdfc-head-text"><h2 class="mdfc-title">' + esc(T.title) + "</h2>" +
          '<p class="mdfc-head-sub">' + esc(T.headSub) + "</p></div>" +
      "</div>" +
      '<div class="mdfc-main">' +
        '<div class="mdfc-stage-col">' +
          '<div class="mdfc-stage" role="img" aria-label="' + esc(T.stageAria) + '">' +
            '<div class="mdfc-stage-label" aria-hidden="true"></div>' +
            '<div class="mdfc-stage-foot">' +
              '<div class="mdfc-stage-note" hidden></div>' +
              '<div class="mdfc-stage-hint" aria-hidden="true">' + esc(T.stageHint) + "</div>" +
            "</div>" +
            '<div class="mdfc-stage-loading">' + guideHtml("think", "think", T.guideThink) + "</div>" +
            '<div class="mdfc-stage-fallback" hidden><div class="mdfc-stage-swatch"></div><p>' + esc(T.stageFallback) + "</p></div>" +
          "</div>" +
        "</div>" +
        '<div class="mdfc-panel"></div>' +
      "</div>" +
      '<div class="mdfc-notes"></div>' +
      '<div class="mdfc-bar" role="region" aria-label="Your price"></div>' +
      '<div class="mdfc-visually-hidden" role="status" aria-live="polite"></div>';
    panel = app.querySelector(".mdfc-panel");
    bar = app.querySelector(".mdfc-bar");
    stageEl = app.querySelector(".mdfc-stage");
    stageLabel = app.querySelector(".mdfc-stage-label");
    stageNote = app.querySelector(".mdfc-stage-note");
    live = app.querySelector('[role="status"]');
  }

  function thumbHtml(rg) {
    const src = assetUrl(rg.thumbUrl, rg.thumbLocal);
    return src
      ? '<img ' + imgSrcAttrs(rg.thumbUrl, rg.thumbLocal) + ' alt="' + esc(rg.name + " swatch") + '" loading="lazy">'
      : '<span class="mdfc-thumb-empty" role="img" aria-label="' + esc(fmt(T.noImage, { range: rg.name })) + '">' + ICON.swatch + "</span>";
  }

  // Rows of choices that scroll sideways on phones keep their scroll position
  // across re-renders, and show a fade on the right while there's more to see.
  function rememberScroll() {
    const pos = {};
    panel.querySelectorAll("[data-scroll-key]").forEach(function (el) { pos[el.getAttribute("data-scroll-key")] = el.scrollLeft; });
    return pos;
  }
  function restoreScroll(pos) {
    panel.querySelectorAll("[data-scroll-key]").forEach(function (el) {
      const k = el.getAttribute("data-scroll-key");
      if (pos[k]) el.scrollLeft = pos[k];
    });
    updateScrollers();
  }
  function updateScrollers() {
    if (!panel) return;
    panel.querySelectorAll(".mdfc-scroller").forEach(function (el) {
      el.classList.toggle("has-more", el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    });
  }

  function renderPanel() {
    const r = activeRoom();
    const e = estimate();
    const isStairs = r.type === STAIRS;
    const many = state.rooms.length > 1;
    const canAdd = state.rooms.length < (Number(C.maxRooms) || 10);
    const showPoint = e.belowMin && canAdd;
    if (!showPoint) guideGone("point");
    const scroll = rememberScroll();

    let html = '<div class="mdfc-wave">' + guideHtml("wave", "wave", T.guideWave) + "</div>";

    // Your rooms: only once there's more than one
    if (many) {
      html += '<div class="mdfc-group"><h3 class="mdfc-h">' + esc(T.roomsHeading) + "</h3>" +
        '<ul class="mdfc-roomtabs" role="list">' +
        state.rooms.map(function (room, i) {
          const on = i === state.active;
          const line = e.lines[i];
          return '<li class="mdfc-roomtab' + (on ? " is-on" : "") + '">' +
            '<button type="button" class="mdfc-roomtab-btn" id="mdfc-tab-' + room.id + '" data-action="select-room" data-i="' + i + '" aria-pressed="' + on + '">' +
              '<span class="mdfc-roomtab-name">' + esc(fmt(T.roomTab, { n: i + 1, room: roomName(i) })) + "</span>" +
              '<span class="mdfc-roomtab-meta">' + roomMeta(line) + "</span>" +
              (line.range && hasText(line.range.shownAs) ? '<span class="mdfc-roomtab-shown">' + esc(fmt(T.roomShownIn, { colour: line.range.shownAs })) + "</span>" : "") +
            "</button>" +
            '<button type="button" class="mdfc-roomtab-x" data-action="remove-room" data-i="' + i + '" aria-label="' +
              esc(fmt(T.removeRoom, { room: roomName(i) })) + '">' + ICON.close + "</button>" +
            "</li>";
        }).join("") + "</ul></div>";
    }

    // Pick your flooring
    const pks = productKeys(isStairs);
    html += '<div class="mdfc-group"><h3 class="mdfc-h" id="mdfc-prod-h">' + esc(T.flooringHeading) + "</h3>" +
      '<div class="mdfc-products mdfc-scroller" data-scroll-key="products" role="group" aria-labelledby="mdfc-prod-h">' +
      pks.map(function (pk) {
        const first = visibleRanges(pk)[0];
        const sw = first ? assetUrl(first.thumbUrl, first.thumbLocal) : "";
        return '<button type="button" class="mdfc-product" id="mdfc-prod-' + esc(pk) + '" data-action="product" data-product="' + esc(pk) + '" aria-pressed="' + (r.product === pk) + '">' +
          '<span class="mdfc-product-swatch">' + (sw ? '<img ' + imgSrcAttrs(first.thumbUrl, first.thumbLocal) + ' alt="" loading="lazy">' : "") + "</span>" +
          '<span class="mdfc-product-text"><span class="mdfc-product-name">' + esc(productLabel(pk)) + "</span>" +
          '<span class="mdfc-product-from" data-cost-product="' + esc(pk) + '">' + esc(productFromText(pk)) + "</span></span></button>";
      }).join("") + "</div>" +
      (isStairs && pks.length === 1 && hasText(T.stairsOnly) ? '<p class="mdfc-help">' + esc(T.stairsOnly) + "</p>" : "") +
      "</div>";

    // Which room?
    html += '<div class="mdfc-group"><h3 class="mdfc-h" id="mdfc-type-h">' + esc(T.roomTypeHeading) + "</h3>" +
      '<div class="mdfc-pills mdfc-scroller" data-scroll-key="types" role="group" aria-labelledby="mdfc-type-h">' +
      roomTypes().map(function (t, i) {
        return '<button type="button" class="mdfc-pill" id="mdfc-type-' + i + '" data-action="room-type" data-type="' + esc(t) + '" aria-pressed="' + (r.type === t) + '">' + esc(typeLabel(t)) + "</button>";
      }).join("") + "</div></div>";

    // How big is it?
    html += '<div class="mdfc-group"><h3 class="mdfc-h" id="mdfc-size-h">' + esc(T.sizeHeading) + "</h3>";
    if (isStairs) {
      html += '<div class="mdfc-sizes mdfc-scroller" data-scroll-key="sizes" role="group" aria-labelledby="mdfc-size-h">' +
        sizeBtn("mdfc-st-straight", "stairs", "straight", T.stairsStraight, fmt(T.aboutM2, { m2: C.stairs.straight }), r.stairs === "straight") +
        sizeBtn("mdfc-st-turn", "stairs", "turn", T.stairsTurn, fmt(T.aboutM2, { m2: C.stairs.turn }), r.stairs === "turn") +
        sizeBtn("mdfc-st-landing", "landing", "", r.landing ? T.stairsLandingOn : T.stairsLandingAdd, "+" + C.stairs.landing + " m²", r.landing) +
        "</div>";
    } else {
      html += '<p class="mdfc-help">' + esc(T.sizeHelp) + "</p>" +
        '<div class="mdfc-sizes mdfc-scroller" data-scroll-key="sizes" role="group" aria-labelledby="mdfc-size-h">' +
        presetSizes(r.type).map(function (s) {
          return sizeBtn("mdfc-size-" + s.key, "size", s.key, T.sizeNames[s.key] || s.key, fmt(T.aboutM2, { m2: Math.round(s.L * s.W) }), r.size === s.key);
        }).join("") + "</div>" +
        '<button type="button" class="mdfc-linkbtn" id="mdfc-measure-toggle" data-action="toggle-measure" aria-expanded="' + state.measureOpen + '" aria-controls="mdfc-measure">' +
          esc(state.measureOpen ? T.measureClose : T.measureOpen) + "</button>" +
        '<div class="mdfc-measure" id="mdfc-measure"' + (state.measureOpen ? "" : " hidden") + ">" +
          slider("len", T.lengthLabel, r.L) + slider("wid", T.widthLabel, r.W) +
        "</div>";
    }
    html += "</div>";

    // Ranges: each card is a radio option. Line 1: name and weekly price;
    // line 2: tagline; line 3: "Shown in …" and "Explore the full range".
    const p = C.products[r.product] || {};
    html += '<div class="mdfc-group"><h3 class="mdfc-h" id="mdfc-range-h">' + esc(fmt(T.rangeHeading, { product: productLabel(r.product).toLowerCase() })) + "</h3>" +
      '<ul class="mdfc-ranges" role="radiogroup" aria-labelledby="mdfc-range-h">' +
      visibleRanges(r.product).map(function (rg) {
        const on = r.range === rg.id;
        const link = hasText(rg.coloursUrl);
        const shown = hasText(rg.shownAs) ? fmt(T.shownIn, { colour: rg.shownAs }) : "";
        return '<li class="mdfc-card' + (on ? " is-on" : "") + '">' +
          '<label class="mdfc-range' + (on ? " is-on" : "") + '" for="mdfc-range-' + esc(rg.id) + '">' +
            '<input class="mdfc-visually-hidden" type="radio" name="mdfc-range" id="mdfc-range-' + esc(rg.id) + '" value="' + esc(rg.id) + '" data-field="range"' + (on ? " checked" : "") + ">" +
            '<span class="mdfc-thumb">' + thumbHtml(rg) + "</span>" +
            '<span class="mdfc-range-body">' +
              '<span class="mdfc-range-l1"><span class="mdfc-range-name">' + esc(rg.name) + "</span>" +
                '<span class="mdfc-range-ppm" data-cost-range="' + esc(rg.id) + '">' + esc(rangeCostText(r.product, rg.id)) + "</span></span>" +
              (hasText(rg.tagline) ? '<span class="mdfc-range-sub">' + esc(rg.tagline) + "</span>" : "") +
              (shown || link ? '<span class="mdfc-range-l3">' +
                (shown ? '<span class="mdfc-shown" title="' + esc(shown) + '">' + esc(shown) + "</span>" : "") +
                (link ? '<a class="mdfc-colours" href="' + esc(rg.coloursUrl) + '" target="_blank" rel="noopener" data-action="range-link" data-range="' + esc(rg.id) + '">' +
                  esc(T.seeColours) + '<span class="mdfc-visually-hidden"> ' + esc(rg.name + " " + T.newTab) + "</span></a>" : "") +
              "</span>" : "") +
            "</span>" +
          "</label></li>";
      }).join("") + "</ul>" +
      // Add another room: directly under the range cards
      (showPoint
        ? '<div class="mdfc-minorder">' + guideHtml("point", "point", T.minOrderAddPrompt) +
          '<p class="mdfc-minorder-note">' + esc(fmt(T.minOrderNote, { minOrder: money(C.minOrder) })) + ".</p>" +
          '<button type="button" class="mdfc-btn mdfc-btn--outline" id="mdfc-addroom-min" data-action="add-room-min">' + ICON.plus + "<span>" + esc(T.minOrderAddButton) + "</span></button></div>"
        : (canAdd ? '<button type="button" class="mdfc-addroom" id="mdfc-addroom" data-action="add-room">' + ICON.plus + "<span>" + esc(T.addRoom) + "</span></button>" : "")) +
      (hasText(p.includedNote) ? '<p class="mdfc-included">' + esc(p.includedNote) + "</p>" : "") +
      (hasText(p.browseUrl) && hasText(p.browseLabel) ? '<a class="mdfc-browse" href="' + esc(p.browseUrl) + '" target="_blank" rel="noopener">' +
        esc(p.browseLabel) + '<span class="mdfc-visually-hidden"> ' + esc(T.newTab) + "</span></a>" : "") +
      "</div>";

    panel.innerHTML = html;
    restoreScroll(scroll);

    function sizeBtn(id, action, val, title, sub, on) {
      return '<button type="button" class="mdfc-sizebtn" id="' + id + '" data-action="' + action + '" data-val="' + val + '" aria-pressed="' + on + '">' +
        '<span class="mdfc-s1">' + esc(title) + '</span><span class="mdfc-s2">' + esc(sub) + "</span></button>";
    }
    function slider(key, label, v) {
      const lim = C.sizeLimits;
      return '<div class="mdfc-slider"><div class="mdfc-slider-head"><label for="mdfc-' + key + '">' + esc(label) + "</label>" +
        '<output id="mdfc-' + key + '-out" for="mdfc-' + key + '">' + v.toFixed(1) + " m</output></div>" +
        '<input type="range" id="mdfc-' + key + '" data-field="' + key + '" min="' + lim.min + '" max="' + lim.max + '" step="' + lim.step + '" value="' + v + '"></div>';
    }
  }
  function roomMeta(line) {
    return esc(m2(line.area)) + (line.range ? " · " + esc(line.range.name) : "") + " · " + esc(priceText(line.low, line.high));
  }

  function renderBar() {
    const e = estimate();
    const weekly = state.payment === "weekly";
    const months = Math.ceil((Number(C.termWeeks) || 0) * 12 / 52 - 1e-9);
    const fin = financeItems();
    bar.classList.toggle("is-open", !!state.barOpen);
    bar.innerHTML = '<div class="mdfc-bar-in">' +
      '<div class="mdfc-pay">' +
        '<div class="mdfc-more mdfc-celebrate">' + guideHtml("celebrate", "celebrate", celebrateText(), app.classList.contains("is-wide") || !!state.barOpen) + "</div>" +
        '<div class="mdfc-paytoggle mdfc-more" role="radiogroup" aria-label="' + esc(T.paymentLabel) + '">' + payOpt("weekly", T.weekly) + payOpt("monthly", T.monthly) + "</div>" +
        '<div class="mdfc-weekly"><span class="mdfc-big">' + esc(money(weekly ? e.weekly : e.monthly)) + '</span><span class="mdfc-per">' + esc(weekly ? T.perWeek : T.perMonth) + "</span></div>" +
        '<div class="mdfc-daily mdfc-more">' + esc((weekly
          ? fmt(T.overTerm, { weeks: C.termWeeks })
          : fmt(T.overTermMonthly, { months: months })) + " · " + dailyLine(e)) + "</div>" +
        '<div class="mdfc-compact-sub">' + esc(fmt(T.supplyLabel, { total: priceText(e.low, e.high) })) + "</div>" +
      "</div>" +
      '<div class="mdfc-facts mdfc-more" id="mdfc-bar-more">' +
        "<span>" + esc(fmt(T.supplyLabel, { total: priceText(e.low, e.high) })) + "</span>" +
        (e.belowMin ? "<span>" + esc(fmt(T.minOrderNote, { minOrder: money(C.minOrder) })) + "</span>" : "") +
        "<span>" + esc(fmt(T.depositLine, { deposit: money(e.deposit) })) +
          (C.showPrefit === true ? " · " + esc(fmt(T.prefitLine, { prefit: money(e.prefit) })) : "") + "</span>" +
        (fin.length ? '<ul class="mdfc-chips" role="list">' + fin.map(function (t) { return '<li class="mdfc-chip">' + ICON.tick + "<span>" + esc(t) + "</span></li>"; }).join("") + "</ul>" : "") +
      "</div>" +
      '<button type="button" class="mdfc-bar-toggle" id="mdfc-bar-toggle" data-action="toggle-bar" aria-expanded="' + !!state.barOpen + '" aria-controls="mdfc-bar-more">' +
        esc(state.barOpen ? T.barHide : T.barDetails) + ICON.chev + "</button>" +
      (hasText(C.bookingUrl) ? '<a class="mdfc-cta" href="' + esc(C.bookingUrl) + '" data-action="book">' + esc(T.bookCta) + "</a>" : "") +
      "</div>";

    app.querySelector(".mdfc-notes").innerHTML =
      '<p class="mdfc-fitting">' + ICON.info + "<span>" + esc(T.fittingNote) + "</span></p>" +
      '<p class="mdfc-smallprint">' + esc(T.smallPrint) + (C.showPrefit === true ? " " + esc(fmt(T.prefitDetail, { deposit: money(e.deposit) })) : "") + "</p>" +
      '<button type="button" class="mdfc-linkbtn mdfc-restart" data-action="restart">' + esc(T.startAgain) + "</button>";

    setFigure(weekly ? e.weekly : e.monthly);

    function payOpt(v, label) {
      const id = "mdfc-pay-" + v;
      return '<label class="mdfc-payopt' + (state.payment === v ? " is-on" : "") + '" for="' + id + '">' +
        '<input class="mdfc-visually-hidden" type="radio" id="' + id + '" name="mdfc-pay" value="' + v + '"' +
        (state.payment === v ? " checked" : "") + ' data-field="payment"><span>' + esc(label) + "</span></label>";
    }
  }

  function celebrateText() {
    if (state.rooms.length > 1) return T.guideCelebrateMany;
    const r = state.rooms[0];
    return r.type === STAIRS ? T.guideCelebrateStairs : fmt(T.guideCelebrateOne, { room: typeLabel(r.type).toLowerCase() });
  }

  // The big weekly/monthly figure counts to its new value over 400ms
  let shownFigure = null, figureRaf = 0;
  function setFigure(target) {
    const from = shownFigure;
    cancelAnimationFrame(figureRaf);
    const put = function (v) { const el = bar.querySelector(".mdfc-big"); if (el) el.textContent = money(v); };
    if (from === null || from === target || REDUCE) { shownFigure = target; put(target); return; }
    put(from);
    const t0 = performance.now();
    const step = function (now) {
      const k = Math.min(1, (now - t0) / 400);
      if (k >= 1) { shownFigure = target; put(target); return; }
      const eased = 1 - Math.pow(1 - k, 3);
      shownFigure = from + (target - from) * eased;
      put(Math.round(shownFigure));
      figureRaf = requestAnimationFrame(step);
    };
    figureRaf = requestAnimationFrame(step);
  }

  // Room tabs: the controls slide in from the right (later room) or left (earlier)
  function slidePanel(dir) {
    if (REDUCE || !panel) return;
    panel.classList.remove("mdfc-slide-l", "mdfc-slide-r");
    void panel.offsetWidth;
    panel.classList.add(dir === "l" ? "mdfc-slide-l" : "mdfc-slide-r");
  }

  function renderStageLabel() {
    const r = activeRoom();
    const rg = findRange(r.product, r.range);
    const where = r.type === STAIRS
      ? (r.stairs === "turn" ? T.stairsTurnLabel : T.stairsLabel) + (r.landing ? " " + T.stairsLandingLabel : "")
      : roomName(state.active);
    stageLabel.textContent = where + " · " + m2(roomArea(r), 1) + (rg ? " · " + rg.name : "");
    // Caption: the photo is one example colour, not the whole range
    let note = "";
    if (rg && !assetUrl(rg.textureUrl, rg.textureLocal)) note = T.previewColourOnly;
    else if (rg && hasText(rg.shownAs)) note = fmt(T.stageShownIn, { colour: rg.shownAs });
    stageNote.textContent = note;
    stageNote.hidden = !note;
    stageEl.classList.toggle("has-note", !!note);
    const sw = app.querySelector(".mdfc-stage-swatch");
    if (sw && rg) {
      const pair = assetPair(rg.thumbUrl, rg.thumbLocal);
      const setBg = function (u) { sw.style.backgroundImage = u ? 'url("' + u.replace(/"/g, "%22") + '")' : "none"; };
      setBg(pair.src);
      if (pair.fallback) {
        const probe = new Image();
        probe.onerror = function () { failedLive[rg.thumbUrl] = true; setBg(pair.fallback); };
        probe.src = pair.src;
      }
      sw.style.backgroundColor = rg.previewColour || "#d9d2c6";
    }
  }

  function renderAll(focusId) {
    const active = document.activeElement;
    const keep = focusId || (active && root.contains(active) ? active.id : "");
    renderPanel();
    renderBar();
    renderStageLabel();
    scene3d.update();
    scheduleEstimateEvent();
    if (keep) {
      const el = app.querySelector("#" + keep);
      if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
    }
  }

  function focusIn(id) {
    const el = app.querySelector("#" + id);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }

  // Live update while dragging a slider (no re-render, keeps focus)
  function renderLiveSize() {
    const r = activeRoom();
    ["len", "wid"].forEach(function (k) {
      const out = app.querySelector("#mdfc-" + k + "-out");
      if (out) out.textContent = (k === "len" ? r.L : r.W).toFixed(1) + " m";
    });
    app.querySelectorAll(".mdfc-sizebtn").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    const meta = app.querySelector("#mdfc-tab-" + r.id + " .mdfc-roomtab-meta");
    if (meta) meta.innerHTML = roomMeta(estimate().lines[state.active]);
    updateCosts();
    renderBar();
    renderStageLabel();
    scene3d.update();
    scheduleEstimateEvent();
  }

  /* ---------- estimate_viewed: fired once the price settles ---------- */
  let estTimer = null, lastEstKey = "";
  function scheduleEstimateEvent() {
    if (!state.started) return;
    clearTimeout(estTimer);
    estTimer = setTimeout(function () {
      const e = estimate();
      const mix = {};
      e.lines.forEach(function (l) { mix[l.product] = (mix[l.product] || 0) + 1; });
      const params = {
        rooms: e.lines.length,
        product_mix: Object.keys(mix).sort().map(function (k) { return k + ":" + mix[k]; }).join("|"),
        total_low: e.low, total_high: e.high, prefit: e.prefit, payment_frequency: state.payment
      };
      const key = JSON.stringify(params) + "|" + e.rawHigh;
      if (key === lastEstKey) return;
      lastEstKey = key;
      if (e.belowMin) track("min_order_applied", { total_high_before_floor: e.rawHigh });
      track("estimate_viewed", params);
      if (live) {
        live.textContent = fmt(T.supplyLabel, { total: priceText(e.low, e.high) }) + ". " +
          money(state.payment === "weekly" ? e.weekly : e.monthly) + " " + (state.payment === "weekly" ? T.perWeek : T.perMonth) + ".";
      }
    }, 1200);
  }

  /* ---------- Actions ---------- */
  function markStarted() {
    if (state.started) return;
    state.started = true;
    track("calculator_start", {});
  }
  function addRoom(fromMinOrder) {
    if (state.rooms.length >= (Number(C.maxRooms) || 10)) return;
    const from = activeRoom();
    const r = newRoom(from.type === STAIRS ? null : from);
    state.rooms.push(r);
    state.active = state.rooms.length - 1;
    if (fromMinOrder) track("add_room_from_min_order", {});
    track("room_added", { room_type: r.type, rooms: state.rooms.length });
    renderAll("mdfc-tab-" + r.id);
    slidePanel("r");
  }

  function onClick(ev) {
    const lb = ev.target.closest && ev.target.closest(".mdfc-lightbox");
    if (lb && ev.target === lb) { closeLightbox(); return; }
    const el = ev.target.closest && ev.target.closest("[data-action]");
    if (!el || !root.contains(el)) return;
    markStarted();
    const r = activeRoom();
    switch (el.getAttribute("data-action")) {
      case "select-room": {
        const to = Number(el.getAttribute("data-i")) || 0;
        if (to === state.active) return;
        const dir = to > state.active ? "r" : "l";
        state.active = to;
        renderAll();
        slidePanel(dir);
        break;
      }
      case "remove-room": {
        if (state.rooms.length < 2) return;
        const i = Number(el.getAttribute("data-i"));
        state.rooms.splice(i, 1);
        if (state.active > i || state.active >= state.rooms.length) state.active = Math.max(0, state.active - 1);
        track("room_removed", { rooms: state.rooms.length });
        renderAll("mdfc-tab-" + activeRoom().id);
        slidePanel("l");
        break;
      }
      case "add-room": addRoom(false); break;
      case "add-room-min": addRoom(true); break;
      case "room-type": {
        const t = el.getAttribute("data-type");
        if (t === r.type) return;
        r.type = t;
        if (t === STAIRS) {
          const ok = productKeys(true);
          if (ok.indexOf(r.product) === -1 && ok.length) setProduct(r, ok[0]);
        } else {
          if (r.size === "custom") r.size = "medium";
          applyPreset(r);
        }
        track("room_type_selected", { room_type: typeLabel(t) });
        renderAll();
        break;
      }
      case "size":
        r.size = el.getAttribute("data-val");
        applyPreset(r);
        track("size_selected", { size_method: "preset", size: r.size });
        renderAll();
        break;
      case "stairs":
        r.stairs = el.getAttribute("data-val") === "turn" ? "turn" : "straight";
        track("size_selected", { size_method: "stairs", size: r.stairs });
        renderAll();
        break;
      case "landing":
        r.landing = !r.landing;
        track("size_selected", { size_method: "stairs", size: r.landing ? "landing_on" : "landing_off" });
        renderAll();
        break;
      case "toggle-bar":
        state.barOpen = !state.barOpen;
        renderBar();
        focusIn("mdfc-bar-toggle");
        break;
      case "toggle-measure":
        state.measureOpen = !state.measureOpen;
        renderAll();
        break;
      case "product": {
        const pk = el.getAttribute("data-product");
        if (pk !== r.product) setProduct(r, pk);
        track("product_selected", { product: pk });
        renderAll();
        break;
      }
      case "range-link":
        track("range_link_clicked", { range: el.getAttribute("data-range") });
        break;
      case "lightbox":
        openLightbox(el.getAttribute("data-src"), el.getAttribute("data-alt"), el, el.getAttribute("data-fallback"));
        break;
      case "close-lightbox":
        closeLightbox();
        break;
      case "book": {
        track("book_visit_clicked", { total_high: estimate().high });
        // Same-page form: scroll to it smoothly and put the cursor in its first field
        const href = el.getAttribute("href") || "";
        let target = null;
        if (href.charAt(0) === "#" && href.length > 1) {
          try { target = document.getElementById(decodeURIComponent(href.slice(1))); } catch (e) { target = null; }
        }
        if (target) {
          ev.preventDefault();
          try { target.scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "start" }); } catch (e) { target.scrollIntoView(); }
          const field = target.querySelector("input:not([type=hidden]), select, textarea");
          if (field) setTimeout(function () { try { field.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, REDUCE ? 0 : 500);
          try { if (history.replaceState) history.replaceState(null, "", href); } catch (e) { /* ignore */ }
        }
        break;
      }
      case "restart":
        track("calculator_restart", {});
        closeLightbox();
        freshState();
        lastEstKey = "";
        renderAll();
        scene3d.update(true);
        try { root.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { root.scrollIntoView(); }
        break;
    }
  }

  let sliderTracked = false;
  function onInput(ev) {
    const el = ev.target;
    const f = el.getAttribute && el.getAttribute("data-field");
    if (f !== "len" && f !== "wid") return;
    markStarted();
    const r = activeRoom();
    const v = clamp(parseFloat(el.value) || 0, C.sizeLimits.min, C.sizeLimits.max);
    if (f === "len") r.L = v; else r.W = v;
    r.size = "custom";
    renderLiveSize();
  }
  function onChange(ev) {
    const el = ev.target;
    const f = el.getAttribute && el.getAttribute("data-field");
    if (f === "len" || f === "wid") {
      if (!sliderTracked) { sliderTracked = true; track("size_selected", { size_method: "exact" }); }
      return;
    }
    if (f === "range") {
      markStarted();
      const r = activeRoom();
      r.range = el.value;
      track("range_selected", { product: r.product, range: r.range });
      renderAll(el.id);
      return;
    }
    if (f !== "payment") return;
    markStarted();
    if (state.payment === el.value) return;
    state.payment = el.value;
    track("payment_toggle", { payment_period: el.value });
    updateCosts();
    renderBar();
    focusIn("mdfc-pay-" + state.payment);
    scheduleEstimateEvent();
  }

  /* ---------- Lightbox (stays inside the container) ---------- */
  let lightboxTrigger = null;
  function openLightbox(src, alt, trigger, fallback) {
    closeLightbox();
    lightboxTrigger = trigger || null;
    const lb = document.createElement("div");
    lb.className = "mdfc-lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", alt);
    lb.innerHTML = '<div class="mdfc-lightbox-inner"><img src="' + esc(src) + '"' + (fallback ? ' data-fallback="' + esc(fallback) + '"' : "") + ' alt="' + esc(alt) + '">' +
      '<button type="button" class="mdfc-lightbox-close" data-action="close-lightbox" aria-label="' + esc(T.closeLightbox) + '">' + ICON.close + "</button></div>";
    app.appendChild(lb);
    lb.querySelector("button").focus();
  }
  function closeLightbox() {
    const lb = app && app.querySelector(".mdfc-lightbox");
    if (!lb) return;
    lb.parentNode.removeChild(lb);
    if (lightboxTrigger && root.contains(lightboxTrigger)) lightboxTrigger.focus();
    lightboxTrigger = null;
  }
  function onKeydown(ev) {
    const lb = app.querySelector(".mdfc-lightbox");
    if (!lb) return;
    if (ev.key === "Escape" || ev.key === "Esc") { ev.preventDefault(); closeLightbox(); }
    else if (ev.key === "Tab") { ev.preventDefault(); lb.querySelector("button").focus(); }
  }
  function onImgError(ev) {
    const img = ev.target;
    if (!img || img.tagName !== "IMG" || !root.contains(img)) return;
    const fb = img.getAttribute("data-fallback");
    if (fb) {
      // Live image failed: remember it, and switch to the repo copy
      failedLive[img.getAttribute("src")] = true;
      (img.getAttribute("srcset") || "").split(",").forEach(function (part) {
        const u = part.trim().split(/\s+/)[0];
        if (u) failedLive[u] = true;
      });
      img.removeAttribute("data-fallback");
      const fbSet = img.getAttribute("data-fallback-srcset");
      img.removeAttribute("data-fallback-srcset");
      if (fbSet) img.setAttribute("srcset", fbSet); else img.removeAttribute("srcset");
      img.setAttribute("src", fb);
      return;
    }
    if (img.classList.contains("mdfc-guide-img")) {
      guideImgFailed[img.getAttribute("data-role")] = true;
      const g = img.closest(".mdfc-guide");
      if (g) g.classList.add("no-img");
      img.parentNode.removeChild(img);
      return;
    }
    if (img.closest(".mdfc-product-swatch") || img.classList.contains("mdfc-head-nimbus")) { img.parentNode.removeChild(img); return; }
    const holder = img.closest(".mdfc-thumb");
    if (holder) holder.innerHTML = '<span class="mdfc-thumb-empty" role="img" aria-label="' + esc(img.alt || "") + '">' + ICON.swatch + "</span>";
  }

  /* =========================================================================
   *  3D preview (three.js). Optional: if WebGL or the library is unavailable,
   *  the stage shows a swatch and the price still works.
   * ========================================================================= */
  const scene3d = (function () {
    let THREE, renderer, scene, camera, ready = false, failed = false;
    let floorBase, floorFade, roomParts = [], stairsGroup, stairMeshes = [], landingMesh, stairsBack;
    let backWall, leftWall, backSkirt, leftSkirt, plinth, win, door;
    const mats = {};              // range id -> { base, fade, tex, tile, hasTexture }
    const shown = { L: 4, W: 4 };
    const orbit = { yaw: 0.62, pitch: 0.5 };
    const H = 2.4, TH = 0.08;
    let drag = null, fadeTo = null, fadeT = 1, currentId = "", rafId = 0, visible = true, interacted = false, last = 0;
    const reduce = REDUCE;

    function hasWebGL() {
      try {
        const c = document.createElement("canvas");
        return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
      } catch (e) { return false; }
    }
    function loaded() {
      const l = app.querySelector(".mdfc-stage-loading");
      if (l) l.hidden = true;
    }
    function fail() {
      failed = true;
      loaded();
      const fb = app.querySelector(".mdfc-stage-fallback");
      if (fb) fb.hidden = false;
      const hint = app.querySelector(".mdfc-stage-hint");
      if (hint) hint.hidden = true;
      stageEl.classList.add("is-fallback");
    }

    function load() {
      if (!hasWebGL()) { fail(); return; }
      setTimeout(loaded, 12000); // never leave Nimbus waiting forever
      if (window.THREE && window.THREE.WebGLRenderer) { start(window.THREE); return; }
      const s = document.createElement("script");
      s.src = BASE + "vendor/three.min.js";
      s.async = true;
      s.onload = function () { if (window.THREE) start(window.THREE); else fail(); };
      s.onerror = fail;
      root.appendChild(s); // stays inside the calculator element
    }

    function start(lib) {
      try {
        THREE = lib;
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.domElement.className = "mdfc-canvas";
        stageEl.insertBefore(renderer.domElement, stageEl.firstChild);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 100);
        scene.add(new THREE.HemisphereLight(0xffffff, 0xcbbfa8, 0.75));
        const sun = new THREE.DirectionalLight(0xfff4e2, 0.55); sun.position.set(3, 6, 4); scene.add(sun);
        const fill = new THREE.DirectionalLight(0xdff3ff, 0.25); fill.position.set(-4, 3, 2); scene.add(fill);
        buildRoom();
        buildStairs();
        bindOrbit();
        try { new ResizeObserver(function () { resize(); kick(); }).observe(stageEl); }
        catch (e) { window.addEventListener("resize", function () { resize(); kick(); }); }
        try { new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); }).observe(stageEl); }
        catch (e) { /* treat as always visible */ }
        resize();
        ready = true;
        update(true);
      } catch (e) {
        if (window.console && console.warn) console.warn("[MDF calculator] 3D preview unavailable", e);
        fail();
      }
    }

    function buildRoom() {
      const floorGeo = new THREE.PlaneGeometry(1, 1);
      const neutral = new THREE.MeshStandardMaterial({ color: 0xd9d2c6, roughness: 1 });
      floorBase = new THREE.Mesh(floorGeo, neutral); floorBase.rotation.x = -Math.PI / 2; scene.add(floorBase);
      floorFade = new THREE.Mesh(floorGeo, neutral); floorFade.rotation.x = -Math.PI / 2; floorFade.position.y = 0.002; floorFade.visible = false; scene.add(floorFade);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.95 });
      const wallMat2 = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.95 });
      const skirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
      const box = new THREE.BoxGeometry(1, 1, 1);
      backWall = new THREE.Mesh(box, wallMat); leftWall = new THREE.Mesh(box, wallMat2);
      backSkirt = new THREE.Mesh(box, skirtMat); leftSkirt = new THREE.Mesh(box, skirtMat);
      plinth = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xd7d3cb, roughness: 1 }));
      [backWall, leftWall, backSkirt, leftSkirt, plinth].forEach(function (m) { scene.add(m); });
      win = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      [[0, 0.58, 1.3, 0.07], [0, -0.58, 1.3, 0.07], [-0.63, 0, 0.07, 1.23], [0.63, 0, 0.07, 1.23], [0, 0, 0.04, 1.1]].forEach(function (f) {
        const m = new THREE.Mesh(box, frameMat); m.position.set(f[0], f[1], 0.02); m.scale.set(f[2], f[3], 0.04); win.add(m);
      });
      win.add(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), new THREE.MeshBasicMaterial({ color: 0xcfeefa })));
      scene.add(win);
      door = new THREE.Group();
      const panelM = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 2.0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
      panelM.position.y = 1.0; door.add(panelM);
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.6, roughness: 0.35 }));
      handle.position.set(0.32, 1.0, 0.03); door.add(handle);
      door.rotation.y = Math.PI / 2; scene.add(door);
      roomParts = [floorBase, floorFade, backWall, leftWall, backSkirt, leftSkirt, plinth, win, door];
    }

    // UVs in metres so textures tile at real scale on the stairs
    function mplane(w, h) {
      const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
      return g;
    }
    function buildStairs() {
      const box = new THREE.BoxGeometry(1, 1, 1);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.95 });
      const wallMat2 = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.95 });
      const skirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
      const neutral = floorBase.material;
      stairsGroup = new THREE.Group();
      const N = 13, RISE = 0.2, GO = 0.25, SW = 0.9, z0 = (N * GO) / 2;
      for (let i = 0; i < N; i++) {
        const tread = new THREE.Mesh(mplane(SW, GO), neutral);
        tread.rotation.x = -Math.PI / 2; tread.position.set(0, (i + 1) * RISE, z0 - i * GO - GO / 2);
        const riser = new THREE.Mesh(mplane(SW, RISE), neutral);
        riser.position.set(0, i * RISE + RISE / 2, z0 - i * GO);
        stairsGroup.add(tread, riser); stairMeshes.push(tread, riser);
      }
      landingMesh = new THREE.Mesh(mplane(2.0, 1.0), neutral);
      landingMesh.rotation.x = -Math.PI / 2; landingMesh.position.set(0.55, N * RISE + 0.001, -z0 - 0.5);
      stairsGroup.add(landingMesh); stairMeshes.push(landingMesh);
      const sWall = new THREE.Mesh(box, wallMat2); sWall.scale.set(TH, N * RISE + 2.4, N * GO + 1.2); sWall.position.set(-SW / 2 - TH / 2, (N * RISE + 2.4) / 2 - 0.2, -0.5); stairsGroup.add(sWall);
      stairsBack = new THREE.Mesh(box, wallMat); stairsBack.scale.set(2.1, 2.4, TH); stairsBack.position.set(0.55, N * RISE + 1.2, -z0 - 1.0 - TH / 2); stairsGroup.add(stairsBack);
      const stringer = new THREE.Mesh(box, skirtMat); stringer.scale.set(0.04, 0.3, N * GO); stringer.position.set(SW / 2 + 0.02, (N * RISE) / 2 + 0.05, 0); stringer.rotation.x = Math.atan2(N * RISE, N * GO); stairsGroup.add(stringer);
      const sBase = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xd7d3cb, roughness: 1 })); sBase.scale.set(SW, 0.04, 0.8); sBase.position.set(0, -0.02, z0 + 0.4); stairsGroup.add(sBase);
      stairsGroup.visible = false; scene.add(stairsGroup);
    }

    /* Materials: photo tile, or a plank layout built from the laminate grain */
    function materialFor(pk, rg) {
      if (mats[rg.id]) return mats[rg.id];
      const look = pk === "carpet" ? { roughness: 1, bump: 0.012 } : pk === "vinyl" ? { roughness: 0.55, bump: 0.002 } : { roughness: 0.6, bump: 0.003 };
      const base = new THREE.MeshStandardMaterial({ color: new THREE.Color(rg.previewColour || "#d9d2c6"), roughness: look.roughness, metalness: 0 });
      const fade = base.clone(); fade.transparent = true; fade.opacity = 0;
      const entry = { base: base, fade: fade, tex: null, tile: rg.tileSize || [0.5, 0.5], hasTexture: false };
      mats[rg.id] = entry;
      const pair = assetPair(rg.textureUrl, rg.textureLocal);
      const src = pair.src;
      if (!src) { loaded(); return entry; }
      const img = new Image();
      img.onerror = function () {
        // Live image missing? Use the repo copy instead.
        if (pair.fallback && img.src !== pair.fallback) { failedLive[rg.textureUrl] = true; img.src = pair.fallback; }
        else loaded();
      };
      img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          let source = img;
          if (Array.isArray(rg.planks) && validNum(rg.planks[0]) && validNum(rg.planks[1])) {
            const pl = plankCanvas(img, rg.planks[0], rg.planks[1], rg.id);
            source = pl.canvas; entry.tile = pl.tile;
          }
          const tex = new THREE.Texture(source);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.encoding = THREE.sRGBEncoding;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tex.needsUpdate = true;
          entry.tex = tex; entry.hasTexture = true;
          [base, fade].forEach(function (m) { m.map = tex; m.bumpMap = tex; m.bumpScale = look.bump; m.color.set(0xffffff); m.needsUpdate = true; });
          applyRepeat();
          loaded();
          kick();
        } catch (e) { loaded(); }
      };
      img.src = src;
      return entry;
    }

    // Laminate: 4 staggered planks wide x 1 plank long, built from the grain tile.
    function plankCanvas(img, pw, pl, seedStr) {
      const PX = 800; // pixels per metre
      const cols = 4, cw = Math.round(pw * PX), ch = Math.round(pl * PX);
      const c = document.createElement("canvas"); c.width = cw * cols; c.height = ch;
      const g = c.getContext("2d");
      let seed = 7; for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
      const rnd = function () { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const stagger = [0, 0.5, 0.2, 0.72];
      const segH = Math.round(cw * 2.6); // the grain tile is stretched along the plank
      for (let col = 0; col < cols; col++) {
        const x = col * cw, joint = Math.round(stagger[col] * ch);
        // two planks per column, so the end joint can sit anywhere and still wrap
        [joint - ch, joint].forEach(function (y0) {
          const top = Math.max(0, y0), bottom = Math.min(ch, y0 + ch);
          if (bottom <= top) return;
          g.save(); g.beginPath(); g.rect(x, top, cw, bottom - top); g.clip();
          const sw = img.width * 0.55, sx = rnd() * (img.width - sw), shift = rnd() * segH;
          for (let y = y0 - segH + shift; y < y0 + ch; y += segH) g.drawImage(img, sx, 0, sw, img.height, x, y, cw, segH);
          const tone = (rnd() - 0.5) * 0.12;
          g.fillStyle = tone > 0 ? "rgba(255,240,220," + tone.toFixed(3) + ")" : "rgba(40,25,10," + (-tone).toFixed(3) + ")";
          g.fillRect(x, top, cw, bottom - top);
          g.restore();
        });
        g.fillStyle = "rgba(30,20,10,0.45)";
        g.fillRect(x, joint, cw, 2);      // end joint
        g.fillStyle = "rgba(30,20,10,0.4)";
        g.fillRect(x, 0, 2, ch);          // long edge
      }
      return { canvas: c, tile: [pw * cols, pl] };
    }

    function current() {
      const r = activeRoom();
      const rg = findRange(r.product, r.range);
      return rg ? { r: r, rg: rg, m: materialFor(r.product, rg) } : null;
    }
    function applyRepeat() {
      const r = activeRoom();
      Object.keys(mats).forEach(function (id) {
        const e = mats[id];
        if (!e.tex) return;
        if (r.type === STAIRS) e.tex.repeat.set(1 / e.tile[0], 1 / e.tile[1]);
        else e.tex.repeat.set(shown.L / e.tile[0], shown.W / e.tile[1]);
      });
    }

    function update(instant) {
      if (!ready) return;
      const cur = current();
      if (!cur) return;
      const r = cur.r;
      const isStairs = r.type === STAIRS;
      stairsGroup.visible = isStairs;
      roomParts.forEach(function (p) { p.visible = !isStairs && (p !== floorFade || !!fadeTo); });
      landingMesh.visible = r.landing; stairsBack.visible = r.landing;
      stairMeshes.forEach(function (m) { m.material = cur.m.base; });
      if (cur.rg.id !== currentId) {
        const first = !currentId;
        currentId = cur.rg.id;
        if (first || reduce || instant || isStairs) { floorBase.material = cur.m.base; fadeTo = null; floorFade.visible = false; }
        else { fadeTo = cur.m; fadeT = 0; cur.m.fade.opacity = 0; floorFade.material = cur.m.fade; floorFade.visible = true; }
      }
      if (instant || reduce) { shown.L = r.L; shown.W = r.W; }
      kick();
    }

    function layout(L, W) {
      floorBase.scale.set(L, W, 1); floorFade.scale.set(L, W, 1);
      backWall.scale.set(L + 2 * TH, H, TH); backWall.position.set(-TH / 2, H / 2, -W / 2 - TH / 2);
      leftWall.scale.set(TH, H, W + TH); leftWall.position.set(-L / 2 - TH / 2, H / 2, -TH / 2);
      backSkirt.scale.set(L, 0.1, 0.02); backSkirt.position.set(0, 0.05, -W / 2 + 0.01);
      leftSkirt.scale.set(0.02, 0.1, W); leftSkirt.position.set(-L / 2 + 0.01, 0.05, 0);
      plinth.scale.set(L + 2 * TH, 0.06, W + 2 * TH); plinth.position.set(-TH / 2, -0.031, -TH / 2);
      win.visible = L >= 1.6; win.position.set(L * 0.12, 1.45, -W / 2 + 0.005);
      door.visible = W >= 1.1; door.position.set(-L / 2 + 0.005, 0, clamp(W * 0.18, -W / 2 + 0.45, W / 2 - 0.45));
      applyRepeat();
    }

    function bindOrbit() {
      stageEl.addEventListener("pointerdown", function (e) {
        drag = { x: e.clientX, y: e.clientY, yaw: orbit.yaw, pitch: orbit.pitch, touch: e.pointerType === "touch" };
        try { stageEl.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      });
      stageEl.addEventListener("pointermove", function (e) {
        if (!drag) return;
        orbit.yaw = clamp(drag.yaw - (e.clientX - drag.x) * 0.006, 0.12, 1.42);
        // On touch, vertical swipes scroll the page instead of tilting
        if (!drag.touch) orbit.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.004, 0.28, 1.0);
        if (!interacted && Math.abs(e.clientX - drag.x) > 8) { interacted = true; markStarted(); track("preview_rotated", {}); }
        kick();
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (n) { stageEl.addEventListener(n, function () { drag = null; }); });
    }

    function placeCamera(L, W) {
      const span = Math.max(L, W), rad = span * (camera.aspect < 1.1 ? 1.75 : 1.45) + 2.2;
      camera.position.set(Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * rad, Math.sin(orbit.pitch) * rad + 0.4, Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * rad);
      camera.lookAt(0, 0.5, 0);
    }
    function placeStairsCamera() {
      const rad = camera.aspect < 1.1 ? 8.2 : 6.8;
      camera.position.set(Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * rad + 0.3, Math.sin(orbit.pitch) * rad + 1.3, Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * rad);
      camera.lookAt(0.3, 1.4, 0);
    }
    function resize() {
      if (!renderer) return;
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }

    // Render on demand: the loop only runs while something is changing
    function kick() {
      if (!ready || rafId || !visible) return;
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    }
    function tick(now) {
      rafId = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      const r = activeRoom();
      const isStairs = r.type === STAIRS;
      let moving = !!drag;
      if (!isStairs) {
        const k = reduce ? 1 : 1 - Math.pow(0.0005, dt);
        shown.L += (r.L - shown.L) * k; shown.W += (r.W - shown.W) * k;
        if (Math.abs(r.L - shown.L) > 0.002 || Math.abs(r.W - shown.W) > 0.002) moving = true;
        else { shown.L = r.L; shown.W = r.W; }
        layout(shown.L, shown.W);
      } else applyRepeat();
      if (fadeTo) {
        fadeT = Math.min(1, fadeT + dt / 0.45);
        fadeTo.fade.opacity = fadeT * fadeT * (3 - 2 * fadeT);
        if (fadeT >= 1) { floorBase.material = fadeTo.base; floorFade.visible = false; fadeTo = null; }
        else moving = true;
      }
      if (isStairs) placeStairsCamera(); else placeCamera(shown.L, shown.W);
      renderer.render(scene, camera);
      if (moving && visible) rafId = requestAnimationFrame(tick);
    }

    return {
      load: load,
      update: function (instant) { if (!failed) update(instant); }
    };
  })();

  /* ---------- Font: load Montserrat 400 only if the page hasn't already ---------- */
  function ensureFont() {
    try {
      const links = document.querySelectorAll("link[href]");
      for (let i = 0; i < links.length; i++) if (/montserrat/i.test(links[i].getAttribute("href") || "")) return;
      if (document.fonts && typeof document.fonts.forEach === "function") {
        let found = false;
        document.fonts.forEach(function (f) { if (/montserrat/i.test(f.family)) found = true; });
        if (found) return;
      }
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400&display=swap";
      root.appendChild(l); // stays inside the calculator element
    } catch (e) { /* the font is a nice-to-have */ }
  }

  /* ---------- Fixed price bar ----------
   * Pinned to the bottom of the screen from page load. The calculator gets
   * bottom padding equal to the bar's height so nothing sits behind it. The
   * bar slides away only while the booking form (bookingUrl "#id") is on screen. */
  function fixPriceBar() {
    const pad = function () { app.style.paddingBottom = (bar.offsetHeight + 16) + "px"; };
    try { new ResizeObserver(pad).observe(bar); } catch (e) { window.addEventListener("resize", pad); }
    pad();
    const watchForm = function () {
      const href = hasText(C.bookingUrl) ? C.bookingUrl : "";
      if (href.charAt(0) !== "#" || href.length < 2) return true;
      let form = null;
      try { form = document.getElementById(decodeURIComponent(href.slice(1))); } catch (e) { form = null; }
      if (!form || !("IntersectionObserver" in window)) return false;
      new IntersectionObserver(function (en) { bar.classList.toggle("is-away", en[0].isIntersecting); }).observe(form);
      return true;
    };
    // The form may be added to the page after the calculator; try again once it's loaded
    if (!watchForm()) window.addEventListener("load", watchForm);
  }

  /* ---------- Boot ---------- */
  function init() {
    try {
      root = document.getElementById(ROOT_ID);
      if (!root || root.getAttribute("data-mdfc-ready")) return;
      root.setAttribute("data-mdfc-ready", "1");
      if (!productKeys().length || !roomTypes().length) return;
      ensureFont();
      if (hasText(C.displayFont)) root.style.setProperty("--mdfc-display", C.displayFont);
      app = document.createElement("div");
      app.className = "mdfc-app";
      root.appendChild(app);
      renderShell();
      // Layout follows the calculator's own width (not the screen):
      // two columns from 820px, compact phone layout under 600px.
      const setWide = function () {
        const w = root.clientWidth;
        app.classList.toggle("is-wide", w >= 820);
        app.classList.toggle("is-narrow", w < 600);
        updateScrollers();
      };
      try { new ResizeObserver(setWide).observe(root); } catch (e) { window.addEventListener("resize", setWide); }
      setWide();
      root.addEventListener("click", onClick);
      root.addEventListener("input", onInput);
      root.addEventListener("change", onChange);
      root.addEventListener("keydown", onKeydown);
      root.addEventListener("error", onImgError, true);
      root.addEventListener("scroll", function (ev) { if (ev.target.classList && ev.target.classList.contains("mdfc-scroller")) updateScrollers(); }, true);
      renderAll();
      scene3d.load();
      fixPriceBar();
    } catch (e) {
      if (window.console && console.warn) console.warn("[MDF calculator]", e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
