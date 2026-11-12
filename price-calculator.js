/*!
 * My Dream Flooring – Price Calculator
 * Renders inside <div id="mdf-price-calculator"></div> and nowhere else.
 * No framework, no build step. Edit MDF_CONFIG below to change prices and copy.
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
   *      tagline "TODO"    -> tagline is hidden
   *      image "TODO"      -> a plain placeholder swatch is shown
   *      link "TODO"       -> the "See the range" link is hidden
   *      pricePerM2 "TODO" -> that range is hidden from customers
   *      bookingUrl / carpetPageUrl "TODO" -> that button/link is hidden
   *  - link: null means "no range page". Tapping the swatch then opens a
   *    bigger version of the image instead.
   *  - All prices are £ per square metre, SUPPLY ONLY (no fitting).
   * ========================================================================= */
  const MDF_CONFIG = {
    // Extra material added for cutting and waste, as a percentage.
    // The HIGH end of every estimate includes this.
    wastePercent: 10,

    // Deposit charged per room (£). Shown separately on the results.
    depositPerRoom: 40,

    // Minimum order (£). If the high estimate is below this, we show a notice.
    minOrder: 300,

    // Number of weeks the customer pays over.
    termWeeks: 36,

    // Where the "Book my free home visit" button goes.
    bookingUrl: "TODO",

    // Where "Not sure? Browse our carpets first" goes (opens in a new tab).
    carpetPageUrl: "TODO",

    // Products and their ranges. Each range:
    //   id         – short unique code, lowercase, no spaces (used in tracking)
    //   name       – shown to customers
    //   tagline    – short description under the name
    //   pricePerM2 – £ per m², supply only
    //   image      – full web address of a square swatch image
    //   link       – web address of the range page (opens in a new tab), or null
    products: {
      laminate: {
        label: "Laminate",
        ranges: [
          { id: "laminate", name: "Laminate", tagline: "TODO", pricePerM2: 35, image: "TODO", link: "TODO" }
        ]
      },
      vinyl: {
        label: "Vinyl",
        ranges: [
          { id: "expressions", name: "Expressions", tagline: "Wood effect", pricePerM2: 28, image: "TODO", link: "TODO" },
          { id: "balmoral", name: "Balmoral", tagline: "Patterned", pricePerM2: 35, image: "TODO", link: "TODO" }
        ]
      },
      carpet: {
        label: "Carpet",
        // Shown above the carpet ranges.
        includedNote: "10mm underlay, gripper and door bars included",
        ranges: [
          { id: "westminster", name: "Westminster", tagline: "TODO", pricePerM2: 29, image: "TODO", link: "TODO" },
          { id: "buckingham", name: "Buckingham", tagline: "Premium", pricePerM2: 35, image: "TODO", link: "TODO" },
          { id: "sandringham", name: "Sandringham Chile", tagline: "Patterned loop", pricePerM2: 29, image: "TODO", link: null }
        ]
      }
    },

    // Room types and their Small / Medium / Large sizes in m².
    // Add a room type by copying a line. Order here = order in the dropdown.
    roomPresets: {
      "Bedroom": { small: 7, medium: 10, large: 14 },
      "Living room": { small: 12, medium: 16, large: 22 },
      "Dining room": { small: 9, medium: 12, large: 16 },
      "Hallway": { small: 3, medium: 5, large: 8 },
      "Kitchen": { small: 6, medium: 10, large: 14 },
      "Bathroom": { small: 3, medium: 5, large: 7 }
    },

    // Smallest and largest length/width (metres) a customer can type in.
    sizeLimits: { min: 0.5, max: 30 },

    // All wording shown to customers. {curly} words are filled in automatically.
    copy: {
      eyebrow: "Flooring price calculator",
      steps: ["Rooms", "Flooring", "Range", "Estimate"],
      back: "Back",
      continue: "Continue",

      roomsHeading: "Which rooms are you doing?",
      roomsIntro: "Add each room you'd like new flooring in. Prices are supply only.",
      roomLabel: "Room {n}",
      roomTypeLabel: "Room type",
      roomTypePlaceholder: "Choose a room",
      sizeLabel: "Room size",
      sizeHelp: "Not sure? Pick a size and your rep will measure properly.",
      methodExact: "Measurements",
      methodPreset: "Pick a size",
      lengthLabel: "Length (m)",
      widthLabel: "Width (m)",
      areaReadout: "That's {area}",
      sizeNames: { small: "Small", medium: "Medium", large: "Large" },
      presetNeedsType: "Choose a room type to see sizes.",
      addRoom: "Add another room",
      removeRoom: "Remove",
      errorType: "Please choose a room type.",
      errorExact: "Enter a length and width in metres, between {min} and {max}.",
      errorPreset: "Please pick a size.",
      errorSummary: "Please check the highlighted rooms.",

      roomOf: "Room {n} of {total}",
      productHeading: "What flooring would you like in your {room}?",
      productFrom: "from {price} per m²",

      rangeHeading: "Choose a {product} range",
      perM2: "per m²",
      chooseRange: "Choose this range",
      selectedRange: "Selected",
      seeRange: "See the range",
      enlargeImage: "View larger image of {range}",
      browseCarpets: "Not sure? Browse our carpets first",
      skipRange: "Not sure yet? Skip this and show prices from our cheapest range",
      noImage: "No image yet for {range}",
      newTab: "(opens in a new tab)",
      closeLightbox: "Close",

      resultsHeading: "Your estimate",
      supplyLabel: "Estimated supply cost",
      priceRange: "{low} to {high}",
      fromPrefix: "From",
      cheapestRangeNote: "from our cheapest {product} range",
      minOrderNote: "Our minimum order is {minOrder}",
      paymentLabel: "How would you like to see payments?",
      weekly: "Weekly",
      monthly: "Monthly",
      perWeek: "a week",
      perMonth: "a month",
      overTerm: "over {weeks} weeks",
      afterDeposit: "after your {deposit} deposit",
      breakdownHeading: "Your rooms",
      depositLabel: "Deposit",
      depositDetail: "{perRoom} per room",
      fittingNote: "Fitting is priced by your local rep on the day.",
      smallPrint: "This is an estimate based on the sizes you entered. Your rep will measure up and confirm your price.",
      bookCta: "Book my free home visit",
      startAgain: "Start again",
      editRooms: "Edit rooms"
    }
  };
  /* ======================= END OF CONFIG — no prices below ================= */

  const ROOT_ID = "mdf-price-calculator";
  const C = MDF_CONFIG;
  const T = C.copy;
  const SIZE_KEYS = ["small", "medium", "large"];

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
  function area(n) {
    return (Math.round(n * 100) / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 }) + " m²";
  }
  function round5(n) { return Math.round(n / 5) * 5; }
  function ceilHalf(n) { return Math.ceil(n * 2 - 1e-9) / 2; }
  function ceilPound(n) { return Math.ceil(n - 1e-9); }
  function parseNum(s) {
    if (typeof s !== "string") return NaN;
    const t = s.replace(",", ".").replace(/[^\d.]/g, "");
    return t === "" ? NaN : parseFloat(t);
  }

  /* ---------- Catalogue (reads config, hides incomplete items) ---------- */
  function visibleRanges(pk) {
    const p = C.products && C.products[pk];
    if (!p || !Array.isArray(p.ranges)) return [];
    return p.ranges.filter(function (r) {
      return r && hasText(r.id) && hasText(r.name) && validNum(r.pricePerM2);
    });
  }
  function productKeys() {
    return Object.keys(C.products || {}).filter(function (k) { return visibleRanges(k).length > 0; });
  }
  function productLabel(pk) {
    const p = C.products[pk];
    return p && hasText(p.label) ? p.label : pk;
  }
  function cheapestRange(pk) {
    return visibleRanges(pk).reduce(function (a, b) { return b.pricePerM2 < a.pricePerM2 ? b : a; });
  }
  function findRange(pk, id) {
    return visibleRanges(pk).filter(function (r) { return r.id === id; })[0] || null;
  }
  function roomTypes() { return Object.keys(C.roomPresets || {}); }
  function presetSizes(type) {
    const p = (C.roomPresets || {})[type] || {};
    return SIZE_KEYS.filter(function (k) { return validNum(p[k]); })
      .map(function (k) { return { key: k, m2: p[k] }; });
  }

  /* ---------- State ---------- */
  let uid = 0;
  function newRoom() {
    return { id: "r" + (++uid), type: "", method: "exact", length: "", width: "", preset: "",
      product: "", range: "", skipped: false, tracked: false };
  }
  const state = { rooms: [newRoom()], pos: 0, payment: "weekly", started: false, showErrors: false };

  function validDim(n) {
    const lim = C.sizeLimits || { min: 0.5, max: 30 };
    return validNum(n) && n >= lim.min && n <= lim.max;
  }
  function roomArea(r) {
    if (r.method === "exact") {
      const l = parseNum(r.length), w = parseNum(r.width);
      return validDim(l) && validDim(w) ? Math.round(l * w * 100) / 100 : null;
    }
    const s = presetSizes(r.type).filter(function (x) { return x.key === r.preset; })[0];
    return s ? s.m2 : null;
  }
  function roomErrors(r) {
    const e = {};
    if (!r.type || roomTypes().indexOf(r.type) === -1) e.type = T.errorType;
    if (r.method === "exact") {
      if (roomArea(r) === null) {
        const lim = C.sizeLimits || { min: 0.5, max: 30 };
        e.size = fmt(T.errorExact, { min: lim.min + "m", max: lim.max + "m" });
      }
    } else if (!e.type && roomArea(r) === null) {
      e.size = T.errorPreset;
    }
    return e;
  }
  function roomName(i) {
    const r = state.rooms[i];
    const t = r.type || fmt(T.roomLabel, { n: i + 1 });
    const same = state.rooms.filter(function (x) { return x.type && x.type === r.type; });
    if (r.type && same.length > 1) return t + " " + (same.indexOf(r) + 1);
    return t;
  }

  /* Step sequence: rooms → (product, range) per room → results */
  function steps() {
    const s = [{ kind: "rooms" }];
    state.rooms.forEach(function (r, i) { s.push({ kind: "product", i: i }); s.push({ kind: "range", i: i }); });
    s.push({ kind: "results" });
    return s;
  }
  function posOf(kind, i) {
    return steps().findIndex(function (s) { return s.kind === kind && (i === undefined || s.i === i); });
  }
  function nextIncompletePos() {
    const keys = productKeys();
    for (let i = 0; i < state.rooms.length; i++) {
      const r = state.rooms[i];
      if (!r.product || keys.indexOf(r.product) === -1) return posOf("product", i);
      if (!findRange(r.product, r.range)) return posOf("range", i);
    }
    return posOf("results");
  }

  /* ---------- Maths ---------- */
  function estimate() {
    const waste = 1 + (Number(C.wastePercent) || 0) / 100;
    const lines = state.rooms.map(function (r, i) {
      const a = roomArea(r) || 0;
      const rg = findRange(r.product, r.range);
      const price = rg ? rg.pricePerM2 : 0;
      return {
        name: roomName(i), area: a, product: r.product, range: rg, skipped: r.skipped,
        low: round5(a * price), high: round5(a * waste * price)
      };
    });
    const low = lines.reduce(function (s, l) { return s + l.low; }, 0);
    const high = lines.reduce(function (s, l) { return s + l.high; }, 0);
    const deposit = (Number(C.depositPerRoom) || 0) * lines.length;
    const term = Number(C.termWeeks) || 1;
    const weekly = ceilHalf(Math.max(0, high - deposit) / term);
    const monthly = ceilPound(weekly * 52 / 12);
    return {
      lines: lines, low: low, high: high, deposit: deposit, weekly: weekly, monthly: monthly,
      from: lines.some(function (l) { return l.skipped; }),
      belowMin: high < (Number(C.minOrder) || 0)
    };
  }

  /* ---------- Icons ---------- */
  const ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 11v6M12 7.5v.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    laminate: '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="6" y="8" width="36" height="32" rx="3"/><path d="M6 18.7h36M6 29.3h36M20 8v10.7M32 18.7v10.6M16 29.3V40"/></g></svg>',
    vinyl: '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="6" y="8" width="36" height="32" rx="3"/><path d="M18 8v32M30 8v32M6 18.7h36M6 29.3h36"/></g></svg>',
    carpet: '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="6" y="8" width="36" height="32" rx="3"/><path d="M11 17c3-3 5 3 8 0s5 3 8 0 5 3 8 0M11 24c3-3 5 3 8 0s5 3 8 0 5 3 8 0M11 31c3-3 5 3 8 0s5 3 8 0 5 3 8 0"/></g></svg>',
    swatch: '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="8" y="8" width="32" height="32" rx="4"/><path d="M8 30l9-9 8 8 5-5 10 10"/><circle cx="31" cy="17" r="3"/></g></svg>'
  };

  /* ---------- Rendering ---------- */
  let root, app, view, live, lightboxTrigger = null;

  function renderTop(step) {
    const stage = { rooms: 0, product: 1, range: 2, results: 3 }[step.kind];
    const items = T.steps.map(function (label, i) {
      const cls = i < stage ? "is-done" : i === stage ? "is-current" : "";
      return '<li class="mdfc-progress-item ' + cls + '"' + (i === stage ? ' aria-current="step"' : "") + '>' +
        '<span class="mdfc-progress-bar" aria-hidden="true"></span>' +
        '<span class="mdfc-progress-label">' + esc(label) + "</span></li>";
    }).join("");
    return '<div class="mdfc-top">' +
      (state.pos > 0
        ? '<button type="button" class="mdfc-back" data-action="back">' + ICON.back + "<span>" + esc(T.back) + "</span></button>"
        : '<p class="mdfc-eyebrow">' + esc(T.eyebrow) + "</p>") +
      '<ol class="mdfc-progress" aria-label="Progress">' + items + "</ol></div>";
  }

  function renderRoomsStep() {
    const types = roomTypes();
    const lim = C.sizeLimits || { min: 0.5, max: 30 };
    const many = state.rooms.length > 1;
    const roomsHtml = state.rooms.map(function (r, i) {
      const id = "mdfc-" + r.id;
      const err = state.showErrors ? roomErrors(r) : {};
      const a = roomArea(r);
      const opts = '<option value="">' + esc(T.roomTypePlaceholder) + "</option>" + types.map(function (t) {
        return '<option value="' + esc(t) + '"' + (t === r.type ? " selected" : "") + ">" + esc(t) + "</option>";
      }).join("");

      let sizeBody;
      if (r.method === "exact") {
        sizeBody =
          '<div class="mdfc-dims">' +
            dimField(id + "-length", r, "length", T.lengthLabel, err.size) +
            '<span class="mdfc-times" aria-hidden="true">×</span>' +
            dimField(id + "-width", r, "width", T.widthLabel, err.size) +
          "</div>" +
          '<p class="mdfc-area" id="' + id + '-area" aria-live="polite">' +
            (a ? esc(fmt(T.areaReadout, { area: area(a) })) : "") + "</p>";
      } else if (!r.type) {
        sizeBody = '<p class="mdfc-muted">' + esc(T.presetNeedsType) + "</p>";
      } else {
        sizeBody = '<div class="mdfc-presets" role="radiogroup" aria-labelledby="' + id + '-size-label">' +
          presetSizes(r.type).map(function (s) {
            const pid = id + "-preset-" + s.key;
            return '<label class="mdfc-preset' + (r.preset === s.key ? " is-selected" : "") + '" for="' + pid + '">' +
              '<input class="mdfc-visually-hidden" type="radio" id="' + pid + '" name="' + id + '-preset" value="' + s.key + '"' +
                (r.preset === s.key ? " checked" : "") + ' data-room="' + r.id + '" data-field="preset"' +
                (err.size ? ' aria-describedby="' + id + '-size-err"' : "") + ">" +
              '<span class="mdfc-preset-name">' + esc(T.sizeNames[s.key] || s.key) + "</span>" +
              '<span class="mdfc-preset-m2">' + esc(area(s.m2)) + "</span></label>";
          }).join("") + "</div>";
      }

      return '<section class="mdfc-card mdfc-room' + (err.type || err.size ? " has-error" : "") + '" aria-labelledby="' + id + '-title">' +
        '<div class="mdfc-room-head">' +
          '<h3 class="mdfc-room-title" id="' + id + '-title" tabindex="-1">' + esc(fmt(T.roomLabel, { n: i + 1 })) + "</h3>" +
          (many ? '<button type="button" class="mdfc-text-btn" data-action="remove-room" data-room="' + r.id + '" aria-label="' +
            esc(T.removeRoom + " " + fmt(T.roomLabel, { n: i + 1 })) + '">' + esc(T.removeRoom) + "</button>" : "") +
        "</div>" +
        '<div class="mdfc-field">' +
          '<label class="mdfc-label" for="' + id + '-type">' + esc(T.roomTypeLabel) + "</label>" +
          '<div class="mdfc-select-wrap"><select class="mdfc-select" id="' + id + '-type" data-room="' + r.id + '" data-field="type"' +
            (err.type ? ' aria-invalid="true" aria-describedby="' + id + '-type-err"' : "") + ">" + opts + "</select></div>" +
          (err.type ? '<p class="mdfc-error" id="' + id + '-type-err">' + esc(err.type) + "</p>" : "") +
        "</div>" +
        '<div class="mdfc-field" role="group" aria-labelledby="' + id + '-size-label" aria-describedby="' + id + '-size-help">' +
          '<p class="mdfc-label" id="' + id + '-size-label">' + esc(T.sizeLabel) + "</p>" +
          '<p class="mdfc-help" id="' + id + '-size-help">' + esc(T.sizeHelp) + "</p>" +
          '<div class="mdfc-seg" role="radiogroup" aria-label="' + esc(T.sizeLabel) + '">' +
            segOption(id + "-m-exact", id + "-method", "exact", T.methodExact, r) +
            segOption(id + "-m-preset", id + "-method", "preset", T.methodPreset, r) +
          "</div>" +
          sizeBody +
          '<p class="mdfc-error" id="' + id + '-size-err"' + (err.size ? "" : " hidden") + ">" + esc(err.size || "") + "</p>" +
        "</div>" +
      "</section>";
    }).join("");

    function dimField(fid, r, field, label, hasErr) {
      return '<div class="mdfc-dim"><label class="mdfc-label mdfc-label--small" for="' + fid + '">' + esc(label) + "</label>" +
        '<input class="mdfc-input" type="text" inputmode="decimal" autocomplete="off" id="' + fid + '" value="' + esc(r[field]) +
        '" data-room="' + r.id + '" data-field="' + field + '" placeholder="e.g. 3.5"' +
        ' aria-describedby="mdfc-' + r.id + '-size-err"' + (hasErr ? ' aria-invalid="true"' : "") +
        ' data-min="' + lim.min + '" data-max="' + lim.max + '"></div>';
    }
    function segOption(oid, name, value, label, r) {
      return '<label class="mdfc-seg-opt' + (r.method === value ? " is-selected" : "") + '" for="' + oid + '">' +
        '<input class="mdfc-visually-hidden" type="radio" id="' + oid + '" name="' + name + '" value="' + value + '"' +
        (r.method === value ? " checked" : "") + ' data-room="' + r.id + '" data-field="method"><span>' + esc(label) + "</span></label>";
    }

    return '<h2 class="mdfc-h" tabindex="-1">' + esc(T.roomsHeading) + "</h2>" +
      '<p class="mdfc-lead">' + esc(T.roomsIntro) + "</p>" +
      '<div class="mdfc-stack">' + roomsHtml + "</div>" +
      '<button type="button" class="mdfc-btn mdfc-btn--ghost" data-action="add-room">' + ICON.plus + "<span>" + esc(T.addRoom) + "</span></button>" +
      '<button type="button" class="mdfc-btn mdfc-btn--primary" data-action="continue-rooms">' + esc(T.continue) + "</button>";
  }

  function roomEyebrow(i) {
    const r = state.rooms[i];
    const a = roomArea(r);
    return '<p class="mdfc-eyebrow">' +
      (state.rooms.length > 1 ? esc(fmt(T.roomOf, { n: i + 1, total: state.rooms.length })) + " · " : "") +
      esc(roomName(i)) + (a ? " · " + esc(area(a)) : "") + "</p>";
  }

  function renderProductStep(i) {
    const r = state.rooms[i];
    const cards = productKeys().map(function (pk) {
      const sel = r.product === pk;
      return '<li><button type="button" class="mdfc-product' + (sel ? " is-selected" : "") + '" data-action="select-product" data-product="' +
        esc(pk) + '" aria-pressed="' + sel + '">' +
        '<span class="mdfc-product-icon">' + (ICON[pk] || ICON.swatch) + "</span>" +
        '<span class="mdfc-product-text"><span class="mdfc-product-name">' + esc(productLabel(pk)) + "</span>" +
        '<span class="mdfc-product-from">' + esc(fmt(T.productFrom, { price: money(cheapestRange(pk).pricePerM2) })) + "</span></span>" +
        (sel ? '<span class="mdfc-tick">' + ICON.check + "</span>" : "") +
        "</button></li>";
    }).join("");
    return roomEyebrow(i) +
      '<h2 class="mdfc-h" tabindex="-1">' + esc(fmt(T.productHeading, { room: (r.type || "room").toLowerCase() })) + "</h2>" +
      '<ul class="mdfc-products" role="list">' + cards + "</ul>";
  }

  function renderRangeStep(i) {
    const r = state.rooms[i];
    const pk = r.product;
    const p = C.products[pk] || {};
    const cards = visibleRanges(pk).map(function (rg) {
      const sel = r.range === rg.id && !r.skipped;
      const hasLink = hasText(rg.link);
      const hasImg = hasText(rg.image);
      let media;
      if (!hasImg) {
        media = '<div class="mdfc-swatch mdfc-swatch--empty" role="img" aria-label="' + esc(fmt(T.noImage, { range: rg.name })) + '">' + ICON.swatch + "</div>";
      } else if (!hasLink) {
        media = '<button type="button" class="mdfc-swatch mdfc-swatch--zoom" data-action="lightbox" data-src="' + esc(rg.image) +
          '" data-alt="' + esc(rg.name + " " + productLabel(pk)) + '" aria-label="' + esc(fmt(T.enlargeImage, { range: rg.name })) + '">' +
          '<img src="' + esc(rg.image) + '" alt="' + esc(rg.name + " " + productLabel(pk) + " swatch") + '" loading="lazy"></button>';
      } else {
        media = '<div class="mdfc-swatch"><img src="' + esc(rg.image) + '" alt="' + esc(rg.name + " " + productLabel(pk) + " swatch") + '" loading="lazy"></div>';
      }
      return '<li class="mdfc-card mdfc-range' + (sel ? " is-selected" : "") + '">' +
        '<div class="mdfc-range-main">' + media +
          '<div class="mdfc-range-body">' +
            '<h3 class="mdfc-range-name">' + esc(rg.name) + "</h3>" +
            (hasText(rg.tagline) ? '<p class="mdfc-range-tagline">' + esc(rg.tagline) + "</p>" : "") +
            '<p class="mdfc-range-price"><span class="mdfc-price">' + esc(money(rg.pricePerM2)) + "</span> " + esc(T.perM2) + "</p>" +
            (hasLink ? '<a class="mdfc-link" href="' + esc(rg.link) + '" target="_blank" rel="noopener" data-action="range-link" data-range="' +
              esc(rg.id) + '">' + esc(T.seeRange) + ICON.ext + '<span class="mdfc-visually-hidden"> ' + esc(rg.name + " " + T.newTab) + "</span></a>" : "") +
          "</div>" +
        "</div>" +
        '<button type="button" class="mdfc-btn ' + (sel ? "mdfc-btn--selected" : "mdfc-btn--outline") + '" data-action="select-range" data-range="' +
          esc(rg.id) + '" aria-pressed="' + sel + '" aria-label="' + esc(T.chooseRange + ": " + rg.name) + '">' +
          (sel ? ICON.check + "<span>" + esc(T.selectedRange) + "</span>" : "<span>" + esc(T.chooseRange) + "</span>") +
        "</button></li>";
    }).join("");

    const note = hasText(p.includedNote)
      ? '<p class="mdfc-note">' + ICON.check + "<span>" + esc(p.includedNote) + "</span></p>" : "";
    const browse = pk === "carpet" && hasText(C.carpetPageUrl)
      ? '<p class="mdfc-browse"><a class="mdfc-link" href="' + esc(C.carpetPageUrl) + '" target="_blank" rel="noopener">' +
        esc(T.browseCarpets) + ICON.ext + '<span class="mdfc-visually-hidden"> ' + esc(T.newTab) + "</span></a></p>" : "";

    return roomEyebrow(i) +
      '<h2 class="mdfc-h" tabindex="-1">' + esc(fmt(T.rangeHeading, { product: productLabel(pk).toLowerCase() })) + "</h2>" +
      note +
      '<ul class="mdfc-ranges" role="list">' + cards + "</ul>" +
      browse +
      '<button type="button" class="mdfc-text-btn mdfc-skip" data-action="skip-range">' + esc(T.skipRange) + "</button>";
  }

  function renderResults() {
    const e = estimate();
    const weekly = state.payment === "weekly";
    const termTxt = fmt(T.overTerm, { weeks: C.termWeeks });
    const nw = function (v) { return '<span class="mdfc-nowrap">' + esc(money(v)) + "</span>"; };
    const headline = fmt(esc(T.priceRange), { low: nw(e.low), high: nw(e.high) });

    const lines = e.lines.map(function (l) {
      const rangeTxt = l.skipped
        ? fmt(T.cheapestRangeNote, { product: productLabel(l.product).toLowerCase() })
        : (l.range ? l.range.name : "") + " " + productLabel(l.product).toLowerCase();
      return '<li class="mdfc-line"><div class="mdfc-line-main"><span class="mdfc-line-title">' + esc(l.name) + "</span>" +
        '<span class="mdfc-line-meta">' + esc(area(l.area)) + " · " + esc(rangeTxt) + "</span></div>" +
        '<span class="mdfc-line-amount">' + (l.skipped ? esc(T.fromPrefix) + " " : "") +
        esc(fmt(T.priceRange, { low: money(l.low), high: money(l.high) })) + "</span></li>";
    }).join("");

    const book = hasText(C.bookingUrl)
      ? '<a class="mdfc-btn mdfc-btn--primary mdfc-btn--big" href="' + esc(C.bookingUrl) + '" data-action="book">' + esc(T.bookCta) + "</a>" : "";

    return '<h2 class="mdfc-h" tabindex="-1">' + esc(T.resultsHeading) + "</h2>" +
      '<div class="mdfc-card mdfc-hero">' +
        '<p class="mdfc-hero-label">' + esc(T.supplyLabel) + "</p>" +
        '<p class="mdfc-hero-figure">' + (e.from ? '<span class="mdfc-from">' + esc(T.fromPrefix) + "</span> " : "") + headline + "</p>" +
        (e.belowMin ? '<p class="mdfc-notice">' + ICON.info + "<span>" + esc(fmt(T.minOrderNote, { minOrder: money(C.minOrder) })) + "</span></p>" : "") +
        '<p class="mdfc-fitting">' + ICON.info + "<span>" + esc(T.fittingNote) + "</span></p>" +
      "</div>" +

      '<div class="mdfc-card mdfc-pay">' +
        '<div class="mdfc-seg mdfc-seg--pay" role="radiogroup" aria-label="' + esc(T.paymentLabel) + '">' +
          payOpt("weekly", T.weekly) + payOpt("monthly", T.monthly) +
        "</div>" +
        '<p class="mdfc-pay-figure" aria-live="polite"><span class="mdfc-pay-amount">' +
          esc(money(weekly ? e.weekly : e.monthly)) + "</span> " + esc(weekly ? T.perWeek : T.perMonth) + "</p>" +
        '<p class="mdfc-muted">' + esc(termTxt) + ", " + esc(fmt(T.afterDeposit, { deposit: money(e.deposit) })) + "</p>" +
      "</div>" +

      '<div class="mdfc-card">' +
        '<h3 class="mdfc-h3">' + esc(T.breakdownHeading) + "</h3>" +
        '<ul class="mdfc-lines" role="list">' + lines +
          '<li class="mdfc-line mdfc-line--deposit"><div class="mdfc-line-main"><span class="mdfc-line-title">' + esc(T.depositLabel) + "</span>" +
          '<span class="mdfc-line-meta">' + esc(fmt(T.depositDetail, { perRoom: money(C.depositPerRoom) })) + " × " + e.lines.length + "</span></div>" +
          '<span class="mdfc-line-amount">' + esc(money(e.deposit)) + "</span></li>" +
        "</ul>" +
      "</div>" +

      '<p class="mdfc-smallprint">' + esc(T.smallPrint) + "</p>" +
      book +
      '<div class="mdfc-actions">' +
        '<button type="button" class="mdfc-btn mdfc-btn--outline" data-action="edit-rooms">' + esc(T.editRooms) + "</button>" +
        '<button type="button" class="mdfc-btn mdfc-btn--outline" data-action="restart">' + esc(T.startAgain) + "</button>" +
      "</div>";

    function payOpt(v, label) {
      const id = "mdfc-pay-" + v;
      return '<label class="mdfc-seg-opt' + (state.payment === v ? " is-selected" : "") + '" for="' + id + '">' +
        '<input class="mdfc-visually-hidden" type="radio" id="' + id + '" name="mdfc-pay" value="' + v + '"' +
        (state.payment === v ? " checked" : "") + ' data-field="payment"><span>' + esc(label) + "</span></label>";
    }
  }

  function render() {
    const all = steps();
    if (state.pos < 0 || state.pos >= all.length) state.pos = 0;
    const step = all[state.pos];
    let body;
    if (step.kind === "rooms") body = renderRoomsStep();
    else if (step.kind === "product") body = renderProductStep(step.i);
    else if (step.kind === "range") body = renderRangeStep(step.i);
    else body = renderResults();
    view.innerHTML = renderTop(step) + '<div class="mdfc-step mdfc-step--' + step.kind + '">' + body + "</div>";
  }

  function rerenderKeepFocus() {
    const active = document.activeElement;
    const id = active && root.contains(active) ? active.id : "";
    render();
    if (id) focusById(id);
  }
  function focusById(id) {
    const el = id && view.querySelector("#" + id);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
    return !!el;
  }
  function focusHeading() {
    const h = view.querySelector(".mdfc-h");
    if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
    const top = root.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      try { root.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { root.scrollIntoView(); }
    }
  }
  function announce(msg) {
    live.textContent = "";
    setTimeout(function () { live.textContent = msg; }, 50);
  }
  function goTo(pos) {
    state.pos = pos;
    render();
    focusHeading();
    const step = steps()[pos];
    if (step && step.kind === "results") {
      const e = estimate();
      const mix = {};
      e.lines.forEach(function (l) { mix[l.product] = (mix[l.product] || 0) + 1; });
      track("estimate_viewed", {
        rooms: e.lines.length,
        product_mix: Object.keys(mix).sort().map(function (k) { return k + ":" + mix[k]; }).join("|"),
        total_low: e.low,
        total_high: e.high
      });
    }
  }

  /* ---------- Live updates while typing (no re-render, keeps cursor) ---------- */
  function updateRoomLive(r) {
    const id = "mdfc-" + r.id;
    const a = roomArea(r);
    const out = view.querySelector("#" + id + "-area");
    if (out) out.textContent = a ? fmt(T.areaReadout, { area: area(a) }) : "";
    if (!state.showErrors) return;
    const err = roomErrors(r);
    const box = view.querySelector("#" + id + "-size-err");
    if (box) { box.textContent = err.size || ""; box.hidden = !err.size; }
    ["length", "width"].forEach(function (f) {
      const inp = view.querySelector("#" + id + "-" + f);
      if (inp) { if (err.size) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid"); }
    });
    const card = box && box.closest(".mdfc-room");
    if (card) card.classList.toggle("has-error", !!(err.size || err.type));
  }

  /* ---------- Actions ---------- */
  function roomById(id) { return state.rooms.filter(function (r) { return r.id === id; })[0]; }

  function continueRooms() {
    const bad = state.rooms.filter(function (r) { const e = roomErrors(r); return e.type || e.size; });
    if (bad.length) {
      state.showErrors = true;
      render();
      const r = bad[0];
      const e = roomErrors(r);
      const id = "mdfc-" + r.id;
      if (e.type) focusById(id + "-type");
      else if (r.method === "exact") focusById(parseNum(r.length) && validDim(parseNum(r.length)) ? id + "-width" : id + "-length");
      else focusById(id + "-preset-" + (presetSizes(r.type)[0] || { key: "" }).key) || focusById(id + "-title");
      announce(T.errorSummary);
      return;
    }
    state.showErrors = false;
    state.rooms.forEach(function (r) {
      if (!r.tracked) {
        r.tracked = true;
        track("room_added", { room_type: r.type, size_method: r.method === "exact" ? "exact" : "preset" });
      }
    });
    goTo(nextIncompletePos());
  }

  function restart() {
    track("calculator_restart", {});
    closeLightbox();
    state.rooms = [newRoom()];
    state.payment = "weekly";
    state.showErrors = false;
    state.started = false;
    goTo(0);
  }

  function openLightbox(src, alt, trigger) {
    closeLightbox();
    lightboxTrigger = trigger || null;
    const lb = document.createElement("div");
    lb.className = "mdfc-lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", alt);
    lb.innerHTML = '<div class="mdfc-lightbox-inner"><img src="' + esc(src) + '" alt="' + esc(alt) + '">' +
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

  function markStarted() {
    if (state.started) return;
    state.started = true;
    track("calculator_start", {});
  }

  function onClick(ev) {
    const lb = ev.target.closest && ev.target.closest(".mdfc-lightbox");
    if (lb && ev.target === lb) { closeLightbox(); return; }
    const el = ev.target.closest && ev.target.closest("[data-action]");
    if (!el || !root.contains(el)) return;
    markStarted();
    const action = el.getAttribute("data-action");
    const step = steps()[state.pos];

    switch (action) {
      case "back":
        goTo(Math.max(0, state.pos - 1));
        break;
      case "add-room": {
        const r = newRoom();
        state.rooms.push(r);
        render();
        focusById("mdfc-" + r.id + "-type");
        break;
      }
      case "remove-room": {
        if (state.rooms.length < 2) return;
        const idx = state.rooms.findIndex(function (r) { return r.id === el.getAttribute("data-room"); });
        if (idx < 0) return;
        state.rooms.splice(idx, 1);
        render();
        focusById("mdfc-" + state.rooms[Math.max(0, idx - 1)].id + "-title");
        break;
      }
      case "continue-rooms":
        continueRooms();
        break;
      case "select-product": {
        const r = state.rooms[step.i];
        const pk = el.getAttribute("data-product");
        if (r.product !== pk) { r.product = pk; r.range = ""; r.skipped = false; }
        track("product_selected", { product: pk });
        goTo(posOf("range", step.i));
        break;
      }
      case "select-range": {
        const r = state.rooms[step.i];
        r.range = el.getAttribute("data-range");
        r.skipped = false;
        track("range_selected", { product: r.product, range: r.range });
        goTo(nextIncompletePos());
        break;
      }
      case "skip-range": {
        const r = state.rooms[step.i];
        r.range = cheapestRange(r.product).id;
        r.skipped = true;
        goTo(nextIncompletePos());
        break;
      }
      case "range-link":
        track("range_link_clicked", { range: el.getAttribute("data-range") });
        break;
      case "lightbox":
        openLightbox(el.getAttribute("data-src"), el.getAttribute("data-alt"), el);
        break;
      case "close-lightbox":
        closeLightbox();
        break;
      case "book":
        track("book_visit_clicked", { total_high: estimate().high });
        break;
      case "edit-rooms":
        goTo(0);
        break;
      case "restart":
        restart();
        break;
    }
  }

  function onChange(ev) {
    const el = ev.target;
    const field = el.getAttribute && el.getAttribute("data-field");
    if (!field) return;
    markStarted();
    if (field === "payment") {
      if (state.payment === el.value) return;
      state.payment = el.value;
      track("payment_toggle", { payment_period: el.value });
      rerenderKeepFocus();
      return;
    }
    const r = roomById(el.getAttribute("data-room"));
    if (!r) return;
    if (field === "type") {
      r.type = el.value;
      if (!presetSizes(r.type).some(function (s) { return s.key === r.preset; })) r.preset = "";
      rerenderKeepFocus();
    } else if (field === "method") {
      r.method = el.value === "preset" ? "preset" : "exact";
      rerenderKeepFocus();
    } else if (field === "preset") {
      r.preset = el.value;
      rerenderKeepFocus();
    } else if (field === "length" || field === "width") {
      r[field] = el.value;
      updateRoomLive(r);
    }
  }

  function onInput(ev) {
    const el = ev.target;
    const field = el.getAttribute && el.getAttribute("data-field");
    if (field !== "length" && field !== "width") return;
    markStarted();
    const r = roomById(el.getAttribute("data-room"));
    if (!r) return;
    r[field] = el.value;
    updateRoomLive(r);
  }

  function onKeydown(ev) {
    const lb = app.querySelector(".mdfc-lightbox");
    if (lb) {
      if (ev.key === "Escape" || ev.key === "Esc") { ev.preventDefault(); closeLightbox(); }
      else if (ev.key === "Tab") { ev.preventDefault(); lb.querySelector("button").focus(); }
      return;
    }
    // Enter in a size box acts like Continue
    if (ev.key === "Enter" && ev.target.classList && ev.target.classList.contains("mdfc-input")) {
      ev.preventDefault();
      continueRooms();
    }
  }

  // Broken image URL -> swap in the neutral placeholder swatch
  function onImgError(ev) {
    const img = ev.target;
    if (!img || img.tagName !== "IMG" || !root.contains(img)) return;
    const holder = img.closest(".mdfc-swatch");
    if (holder && !holder.classList.contains("mdfc-swatch--empty")) {
      const ph = document.createElement("div");
      ph.className = "mdfc-swatch mdfc-swatch--empty";
      ph.setAttribute("role", "img");
      ph.setAttribute("aria-label", img.alt || "");
      ph.innerHTML = ICON.swatch;
      holder.parentNode.replaceChild(ph, holder);
    }
  }

  /* ---------- Font: load Montserrat 400 only if the page hasn't already ---------- */
  function ensureFont() {
    try {
      const links = document.querySelectorAll("link[href]");
      for (let i = 0; i < links.length; i++) {
        if (/montserrat/i.test(links[i].getAttribute("href") || "")) return;
      }
      if (document.fonts && typeof document.fonts.forEach === "function") {
        let found = false;
        document.fonts.forEach(function (f) { if (/montserrat/i.test(f.family)) found = true; });
        if (found) return;
      }
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400&display=swap";
      l.setAttribute("data-mdfc-font", "");
      document.head.appendChild(l);
    } catch (e) { /* font is a nice-to-have */ }
  }

  /* ---------- Boot ---------- */
  function init() {
    try {
      root = document.getElementById(ROOT_ID);
      if (!root || root.getAttribute("data-mdfc-ready")) return;
      root.setAttribute("data-mdfc-ready", "1");
      ensureFont();
      root.innerHTML = '<div class="mdfc-app"><div class="mdfc-view"></div>' +
        '<div class="mdfc-visually-hidden" role="status" aria-live="polite"></div></div>';
      app = root.querySelector(".mdfc-app");
      view = root.querySelector(".mdfc-view");
      live = root.querySelector('[role="status"]');
      if (!productKeys().length || !roomTypes().length) return;
      root.addEventListener("click", onClick);
      root.addEventListener("change", onChange);
      root.addEventListener("input", onInput);
      root.addEventListener("keydown", onKeydown);
      root.addEventListener("error", onImgError, true);
      render();
    } catch (e) {
      if (window.console && console.warn) console.warn("[MDF calculator]", e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
