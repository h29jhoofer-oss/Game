(() => {
  "use strict";

  const PRODUCTS = window.PRODUCTS;
  const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const FREE_SHIP = 7500;      // cents
  const TAX_RATE = 0.08;       // estimated sales tax
  const SHIPPING = { standard: { label: "Standard (5–7 days)", price: 600 }, express: { label: "Express (2–3 days)", price: 1800 } };
  const PROMOS = { WELCOME10: { pct: 10, label: "10% off your first order" } };
  const STORE_KEY = "umet-cart-v1";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = c => "$" + (c / 100).toFixed(2).replace(/\.00$/, "");
  const money2 = c => "$" + (c / 100).toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  /* ---------- Product illustrations (inline SVG, no image files needed) ---------- */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v + amt * 255))));
    return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  }
  const shadow = `<ellipse cx="200" cy="330" rx="120" ry="14" fill="#16324a" opacity=".08"/>`;
  const SHAPES = {
    mug: c => `${shadow}<path d="M262 190c40 0 44 70 0 78" fill="none" stroke="${shade(c,-.12)}" stroke-width="18" stroke-linecap="round"/>
      <path d="M125 150h145v150a28 28 0 0 1-28 28h-89a28 28 0 0 1-28-28Z" fill="${c}"/>
      <ellipse cx="197" cy="150" rx="72" ry="14" fill="${shade(c,-.18)}"/>
      <g fill="${shade(c,-.35)}" opacity=".5"><circle cx="150" cy="200" r="2"/><circle cx="180" cy="240" r="2.5"/><circle cx="230" cy="190" r="2"/><circle cx="210" cy="280" r="2"/><circle cx="160" cy="290" r="1.8"/><circle cx="245" cy="250" r="2.2"/></g>`,
    vase: c => `${shadow}<path d="M170 70h60v30c0 20 50 50 50 120s-25 110-80 110-80-40-80-110 50-100 50-120Z" fill="${c}"/>
      <g stroke="${shade(c,-.12)}" stroke-width="3" opacity=".8">${[150,170,190,210,230,250].map(x=>`<path d="M${x} ${x<200?140:140}Q${x+(x-200)*.35} 240 ${x} 325" fill="none"/>`).join("")}</g>
      <ellipse cx="200" cy="70" rx="30" ry="7" fill="${shade(c,-.25)}"/>`,
    bowls: c => `${shadow}<path d="M90 240h220a110 90 0 0 1-220 0Z" fill="${c}"/><ellipse cx="200" cy="240" rx="110" ry="16" fill="${shade(c,-.15)}"/>
      <path d="M125 205h150a75 60 0 0 1-150 0Z" fill="${shade(c,.06)}"/><ellipse cx="200" cy="205" rx="75" ry="11" fill="${shade(c,-.1)}"/>
      <path d="M155 175h90a45 36 0 0 1-90 0Z" fill="${shade(c,.12)}"/><ellipse cx="200" cy="175" rx="45" ry="7" fill="${shade(c,-.05)}"/>`,
    plate: c => `<ellipse cx="200" cy="215" rx="150" ry="100" fill="#16324a" opacity=".06"/><ellipse cx="200" cy="200" rx="150" ry="100" fill="${shade(c,-.2)}"/>
      <ellipse cx="200" cy="196" rx="140" ry="92" fill="${c}"/><ellipse cx="200" cy="200" rx="95" ry="60" fill="${shade(c,-.05)}"/>`,
    budvase: c => `${shadow}<path d="M110 200c-30 20-30 120 20 125s50-105 20-125v-40h-40Z" fill="${c}"/>
      <path d="M185 160c-40 30-40 165 15 167s55-137 15-167v-55h-30Z" fill="#7fb6e0"/>
      <path d="M270 220c-25 10-25 105 15 107s40-97 15-107v-30h-30Z" fill="#e8dcc4"/>
      <path d="M200 105C198 70 210 50 225 35M200 105c-6-30-22-45-40-50" stroke="#5f8a5a" stroke-width="3" fill="none"/><circle cx="226" cy="34" r="8" fill="#f4b6a4"/>`,
    blanket: c => `${shadow}<rect x="70" y="150" width="260" height="170" rx="24" fill="${c}"/><rect x="70" y="150" width="260" height="60" rx="24" fill="${shade(c,.06)}"/>
      <g stroke="${shade(c,-.12)}" stroke-width="2" opacity=".7">${Array.from({length:12},(_,i)=>`<path d="M${90+i*20} 160v150"/>`).join("")}${Array.from({length:8},(_,i)=>`<path d="M80 ${165+i*20}h240"/>`).join("")}</g>
      <path d="M70 210h260" stroke="${shade(c,-.2)}" stroke-width="4"/>`,
    towel: c => `${shadow}<path d="M200 60v28" stroke="#16324a" stroke-width="3"/><rect x="120" y="85" width="160" height="235" rx="6" fill="#f5f1e8"/>
      ${c==="#b5653f"?[0,1,2].map(i=>`<rect x="120" y="${110+i*14}" width="160" height="6" fill="${c}"/>`).join(""):Array.from({length:8},(_,i)=>`<rect x="${120+i*20}" y="85" width="10" height="235" fill="${c}" opacity=".35"/><rect x="120" y="${95+i*30}" width="160" height="10" fill="${c}" opacity=".35"/>`).join("")}
      <path d="M120 300h160" stroke="#16324a" stroke-opacity=".1" stroke-width="2"/>`,
    tote: c => `${shadow}<path d="M155 150c0-80 90-80 90 0" fill="none" stroke="${shade(c,-.15)}" stroke-width="12"/>
      <path d="M100 150h200l-15 175H115Z" fill="${c}"/><rect x="155" y="200" width="90" height="60" rx="4" fill="none" stroke="${shade(c,-.15)}" stroke-width="3" stroke-dasharray="6 5"/>
      <text x="200" y="237" text-anchor="middle" font-family="Fraunces,serif" font-size="20" letter-spacing="3" fill="${shade(c,-.3)}" opacity=".7">UMET</text>`,
    scarf: c => `${shadow}<path d="M130 70c40 30 100 30 140 0l10 30c-45 35-115 35-160 0Z" fill="${shade(c,-.1)}"/>
      <path d="M160 100h45v190h-45Z" fill="${c}"/><path d="M215 100h40l-10 170h-40Z" fill="${shade(c,.06)}"/>
      <g stroke="${c}" stroke-width="3">${Array.from({length:7},(_,i)=>`<path d="M${163+i*7} 290v20"/>`).join("")}${Array.from({length:6},(_,i)=>`<path d="M${208+i*7} 270v20"/>`).join("")}</g>
      <g stroke="${shade(c,-.15)}" stroke-width="2" opacity=".6"><path d="M160 150h45M160 200h45M160 250h45"/></g>`,
    candle: c => `${shadow}<path d="M130 180h140v120a25 25 0 0 1-25 25h-90a25 25 0 0 1-25-25Z" fill="#f5f1e8"/>
      <rect x="130" y="230" width="140" height="45" fill="${c}"/><ellipse cx="200" cy="180" rx="70" ry="12" fill="#ede6d6"/>
      <path d="M200 178v-18" stroke="#16324a" stroke-width="3"/><path d="M200 112c14 18 14 36 0 46-14-10-14-28 0-46Z" fill="#f6b84a"/><path d="M200 132c6 8 6 18 0 22-6-4-6-14 0-22Z" fill="#fff3c4"/>`,
    tapers: c => `${shadow}${[170,230].map((x,i)=>`<rect x="${x-16}" y="280" width="32" height="45" rx="6" fill="#c9d8e6"/>
      <rect x="${x-10}" y="${110+i*20}" width="20" height="${175-i*20}" rx="6" fill="${c}"/><path d="M${x} ${110+i*20}v-12" stroke="#16324a" stroke-width="2"/>
      <path d="M${x} ${62+i*20}c10 14 10 28 0 36-10-8-10-22 0-36Z" fill="#f6b84a"/>`).join("")}`,
    board: c => `${shadow}<path d="M80 200a40 40 0 0 1 40-40h170a30 30 0 0 1 30 30v40a30 30 0 0 1-30 30H120a40 40 0 0 1-40-40Z" fill="${c}"/>
      <path d="M320 200h30a10 10 0 0 1 0 20h-30" fill="${shade(c,-.08)}"/><circle cx="345" cy="210" r="4" fill="${shade(c,.2)}"/>
      <g stroke="${shade(c,-.12)}" stroke-width="2" fill="none" opacity=".7"><path d="M100 190q100-12 210 0"/><path d="M95 215q110 8 220-5"/><path d="M110 240q90 6 190-4"/></g>
      <path d="M150 200c0-14 30-14 30 0Z" fill="#f2cf6b"/><circle cx="230" cy="198" r="10" fill="#9c3d54"/><circle cx="246" cy="204" r="9" fill="#9c3d54"/>`,
  };
  function art(p, color) {
    const c = color || p.colors[0][1];
    return `<svg viewBox="0 0 400 400" role="img" aria-label="${esc(p.name)}">${SHAPES[p.shape](c)}</svg>`;
  }

  /* ---------- Cart state (saved in this browser) ---------- */
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { cart = []; }
  cart = cart.filter(l => byId[l.id] && l.qty > 0);
  let promo = null;

  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch {} };
  const lineKey = (id, color) => id + "|" + color;
  const qtyInCart = id => cart.filter(l => l.id === id).reduce((a, l) => a + l.qty, 0);
  const subtotal = () => cart.reduce((a, l) => a + byId[l.id].price * l.qty, 0);
  const count = () => cart.reduce((a, l) => a + l.qty, 0);

  function addToCart(id, color, qty = 1) {
    const p = byId[id];
    const room = p.stock - qtyInCart(id);
    if (room <= 0) { toast(`Sorry, that's all the ${p.name} we have.`); return; }
    const n = Math.min(qty, room);
    const line = cart.find(l => lineKey(l.id, l.color) === lineKey(id, color));
    if (line) line.qty += n; else cart.push({ id, color, qty: n });
    save(); renderCart();
    const badge = $("#cartCount"); badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump");
    toast(n < qty ? `Added ${n} (only ${p.stock} in stock)` : `Added ${p.name} to your cart`);
  }
  function setQty(key, qty) {
    const line = cart.find(l => lineKey(l.id, l.color) === key);
    if (!line) return;
    const p = byId[line.id];
    const others = qtyInCart(line.id) - line.qty;
    line.qty = Math.max(0, Math.min(qty, p.stock - others));
    cart = cart.filter(l => l.qty > 0);
    save(); renderCart();
  }

  /* ---------- Catalog ---------- */
  const state = { cat: "All", q: "", sort: "featured" };
  const CATS = ["All", ...new Set(PRODUCTS.map(p => p.category))];

  function stars(r) { const f = Math.round(r); return "★".repeat(f) + "☆".repeat(5 - f); }

  function renderChips() {
    $("#chips").innerHTML = CATS.map(c =>
      `<button class="chip" role="tab" data-cat="${c}" aria-selected="${c === state.cat}">${c === "All" ? "All" : c}</button>`).join("");
    $$(".main-nav button").forEach(b => b.classList.toggle("active", b.dataset.cat === state.cat));
    $("#shopTitle").textContent = state.cat === "All" ? "Shop all" : state.cat;
  }

  function renderGrid() {
    const q = state.q.trim().toLowerCase();
    let list = PRODUCTS.filter(p => (state.cat === "All" || p.category === state.cat) &&
      (!q || (p.name + " " + p.blurb + " " + p.category).toLowerCase().includes(q)));
    if (state.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (state.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (state.sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);

    $("#empty").hidden = list.length > 0;
    $("#grid").innerHTML = list.map(p => {
      const out = p.stock === 0;
      const badge = out ? `<span class="badge out">Sold out</span>` : p.badge ? `<span class="badge">${p.badge}</span>` : "";
      return `<article class="card">
        <button class="card-img" data-open="${p.id}" aria-label="View ${esc(p.name)}">${art(p)}${badge}</button>
        <div class="card-body">
          <div class="card-top"><h3><button data-open="${p.id}">${esc(p.name)}</button></h3><span class="price">${money(p.price)}</span></div>
          <div class="meta"><span class="stars" aria-hidden="true">${stars(p.rating)}</span><span>${p.rating} (${p.reviews})</span></div>
          <div class="swatches">${p.colors.map(([n, c]) => `<span class="swatch" title="${esc(n)}" style="background:${c}"></span>`).join("")}</div>
          <button class="btn" data-quick="${p.id}" ${out ? "disabled" : ""}>${out ? "Sold out" : "Add to cart"}</button>
        </div>
      </article>`;
    }).join("");
  }

  /* ---------- Product detail ---------- */
  function openProduct(id) {
    const p = byId[id];
    let color = p.colors[0][0], qty = 1;
    const body = $("#pmBody");
    const stockText = () => {
      const left = p.stock - qtyInCart(p.id);
      if (p.stock === 0) return `<span class="stock none">Sold out. Check back soon.</span>`;
      if (left <= 0) return `<span class="stock none">You have all our stock in your cart</span>`;
      if (p.stock <= 5) return `<span class="stock low">Only ${p.stock} left</span>`;
      return `<span class="stock ok">In stock, ships in 1–2 days</span>`;
    };
    const draw = () => {
      const hex = p.colors.find(c => c[0] === color)[1];
      const canBuy = p.stock - qtyInCart(p.id) > 0;
      body.innerHTML = `
        <div class="pm-img">${art(p, hex)}</div>
        <div class="pm-info">
          <p class="eyebrow">${p.category}</p>
          <h2 id="pmTitle">${esc(p.name)}</h2>
          <div class="meta"><span class="stars">${stars(p.rating)}</span><span>${p.rating} · ${p.reviews} reviews</span></div>
          <span class="price">${money(p.price)}</span>
          <p>${esc(p.blurb)}</p>
          <div><div class="opt-label">Color: ${esc(color)}</div>
            <div class="opt-row" style="margin-top:8px">${p.colors.map(([n, c]) =>
              `<button class="color-opt" data-color="${esc(n)}" aria-pressed="${n === color}"><span class="swatch" style="background:${c}"></span>${esc(n)}</button>`).join("")}</div></div>
          ${stockText()}
          <div class="buy-row">
            <div class="qty" aria-label="Quantity"><button data-q="-1" aria-label="Decrease">−</button><span>${qty}</span><button data-q="1" aria-label="Increase">+</button></div>
            <button class="btn btn-primary" data-add ${canBuy ? "" : "disabled"}>${canBuy ? "Add to cart · " + money(p.price * qty) : "Unavailable"}</button>
          </div>
          <ul class="details">${p.details.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
        </div>`;
    };
    body.onclick = e => {
      const t = e.target.closest("button"); if (!t) return;
      if (t.dataset.color) { color = t.dataset.color; draw(); }
      else if (t.dataset.q) { qty = Math.max(1, Math.min(qty + +t.dataset.q, Math.max(1, p.stock - qtyInCart(p.id)))); draw(); }
      else if ("add" in t.dataset) { addToCart(p.id, color, qty); $("#productModal").close(); openCart(); }
    };
    draw();
    $("#productModal").showModal();
  }

  /* ---------- Cart drawer ---------- */
  function renderCart() {
    $("#cartCount").textContent = count();
    const sub = subtotal();
    const left = FREE_SHIP - sub;
    $("#shipMeter").innerHTML = cart.length
      ? (left > 0 ? `You're <strong>${money2(left)}</strong> away from free shipping.` : `<strong>You've got free shipping!</strong>`)
        + `<div class="bar"><i style="width:${Math.min(100, sub / FREE_SHIP * 100)}%"></i></div>`
      : "";
    $("#cartList").innerHTML = cart.length ? cart.map(l => {
      const p = byId[l.id], hex = p.colors.find(c => c[0] === l.color)?.[1], key = lineKey(l.id, l.color);
      return `<li class="cart-item">
        <div class="thumb">${art(p, hex)}</div>
        <div><h3>${esc(p.name)}</h3><div class="variant">${esc(l.color)} · ${money(p.price)}</div>
          <div class="qty"><button data-k="${esc(key)}" data-d="-1" aria-label="Decrease">−</button><span>${l.qty}</span><button data-k="${esc(key)}" data-d="1" aria-label="Increase">+</button></div><br>
          <button class="remove" data-rm="${esc(key)}">Remove</button></div>
        <strong>${money2(p.price * l.qty)}</strong>
      </li>`;
    }).join("") : `<li class="cart-empty">Your cart is empty.<br><br><button class="btn" id="keepShopping">Start shopping</button></li>`;
    $("#drawerFoot").hidden = !cart.length;
    $("#drawerFoot").innerHTML = `
      <div class="row"><span>Subtotal</span><strong>${money2(sub)}</strong></div>
      <p class="muted" style="margin:0">Shipping and taxes are calculated at checkout.</p>
      <button class="btn btn-primary btn-block" id="toCheckout">Checkout</button>`;
  }
  function openCart() {
    $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false");
    $("#scrim").hidden = false; document.body.classList.add("locked");
    $("#closeCart").focus();
  }
  function closeCart() {
    $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true");
    $("#scrim").hidden = true; document.body.classList.remove("locked");
  }

  /* ---------- Checkout ---------- */
  const co = { ship: "standard", data: {} };
  function totals() {
    const sub = subtotal();
    const discount = promo ? Math.round(sub * PROMOS[promo].pct / 100) : 0;
    const after = sub - discount;
    const ship = co.ship === "standard" && after >= FREE_SHIP ? 0 : SHIPPING[co.ship].price;
    const tax = Math.round(after * TAX_RATE);
    return { sub, discount, ship, tax, total: after + ship + tax };
  }
  function summaryHTML() {
    const t = totals();
    return `<h3>Order summary</h3>
      ${cart.map(l => { const p = byId[l.id], hex = p.colors.find(c => c[0] === l.color)?.[1];
        return `<div class="co-line"><div class="thumb">${art(p, hex)}<span class="n">${l.qty}</span></div><div>${esc(p.name)}<div class="muted">${esc(l.color)}</div></div><span>${money2(p.price * l.qty)}</span></div>`; }).join("")}
      <div class="promo"><input id="promoIn" placeholder="Promo code" value="${promo || ""}" aria-label="Promo code"><button class="btn" id="promoBtn" type="button">Apply</button></div>
      <div class="promo-msg" id="promoMsg">${promo ? `✓ ${PROMOS[promo].label}` : `<span class="muted">Try code WELCOME10</span>`}</div>
      <div class="row"><span>Subtotal</span><span>${money2(t.sub)}</span></div>
      ${t.discount ? `<div class="row"><span>Discount</span><span>−${money2(t.discount)}</span></div>` : ""}
      <div class="row"><span>Shipping</span><span>${t.ship ? money2(t.ship) : "Free"}</span></div>
      <div class="row"><span>Estimated tax</span><span>${money2(t.tax)}</span></div>
      <div class="row total"><span>Total</span><span>${money2(t.total)}</span></div>`;
  }
  const FIELDS = [
    ["email", "Email", "email", "full", "you@example.com"],
    ["first", "First name", "text"], ["last", "Last name", "text"],
    ["address", "Street address", "text", "full"],
    ["city", "City", "text"], ["zip", "ZIP / Postal code", "text"],
  ];
  function openCheckout() {
    if (!cart.length) return;
    closeCart();
    const t = totals();
    $("#coBody").innerHTML = `<div class="co">
      <form class="co-form" id="coForm" novalidate>
        <h2 id="coTitle">Checkout</h2>
        <fieldset><legend>Contact &amp; shipping address</legend>
          ${FIELDS.map(([n, label, type, full, ph]) => `<label class="field ${full ? "full" : ""}"><span>${label}</span>
            <input name="${n}" type="${type}" value="${esc(co.data[n] || "")}" ${ph ? `placeholder="${ph}"` : ""} autocomplete="off"><span class="err"></span></label>`).join("")}
        </fieldset>
        <fieldset><legend>Delivery</legend>
          <div class="ship-opts">${Object.entries(SHIPPING).map(([k, s]) => {
            const free = k === "standard" && t.sub - t.discount >= FREE_SHIP;
            return `<label class="ship-opt"><input type="radio" name="ship" value="${k}" ${co.ship === k ? "checked" : ""}><span>${s.label}</span><span>${free ? "Free" : money2(s.price)}</span></label>`; }).join("")}</div>
        </fieldset>
        <div class="pay-note"><strong>Payment:</strong> this is a demo store, so there's no payment step and no card is needed. Placing an order just shows the confirmation page.</div>
        <button class="btn btn-primary btn-block" type="submit">Place demo order · ${money2(t.total)}</button>
      </form>
      <aside class="co-summary" id="coSummary">${summaryHTML()}</aside></div>`;
    $("#checkoutModal").showModal();
  }
  function refreshCheckout() {
    const form = $("#coForm"); if (!form) return;
    new FormData(form).forEach((v, k) => { if (k !== "ship") co.data[k] = v; });
    openCheckoutKeepOpen();
  }
  function openCheckoutKeepOpen() {
    const dlg = $("#checkoutModal");
    const wasOpen = dlg.open; if (wasOpen) dlg.close();
    openCheckout();
  }
  function validate(form) {
    let ok = true;
    $$(".field", form).forEach(f => {
      const i = $("input", f), v = i.value.trim();
      let msg = "";
      if (!v) msg = "Required";
      else if (i.name === "email" && !/^\S+@\S+\.\S+$/.test(v)) msg = "Enter a valid email";
      f.classList.toggle("invalid", !!msg); $(".err", f).textContent = msg;
      if (msg && ok) { i.focus(); ok = false; }
    });
    return ok;
  }
  function placeOrder(form) {
    if (!validate(form)) return;
    const data = Object.fromEntries(new FormData(form));
    const t = totals();
    const orderNo = "UM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const items = count();
    cart = []; promo = null; co.data = {}; save(); renderCart(); renderGrid();
    $("#coBody").innerHTML = `<div class="done">
      <div class="check">✓</div>
      <h2>Thanks, ${esc(data.first)}!</h2>
      <p>Order <strong>${orderNo}</strong> (${items} item${items > 1 ? "s" : ""}, ${money2(t.total)}) has been placed. Since this is a demo, nothing will ship and no email will be sent.</p>
      <button class="btn btn-primary" data-close>Keep shopping</button></div>`;
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- Events ---------- */
  document.addEventListener("click", e => {
    const t = e.target.closest("button, a"); if (!t) return;
    if (t.dataset.cat) { state.cat = t.dataset.cat; renderChips(); renderGrid(); if (t.closest(".main-nav")) $("#shop").scrollIntoView(); }
    else if (t.dataset.open) openProduct(t.dataset.open);
    else if (t.dataset.quick) { const p = byId[t.dataset.quick]; p.colors.length > 1 ? openProduct(p.id) : addToCart(p.id, p.colors[0][0]); }
    else if (t.id === "cartBtn") openCart();
    else if (t.id === "closeCart" || t.id === "keepShopping") { closeCart(); if (t.id === "keepShopping") $("#shop").scrollIntoView(); }
    else if (t.dataset.k) { const l = cart.find(x => lineKey(x.id, x.color) === t.dataset.k); setQty(t.dataset.k, l.qty + +t.dataset.d); }
    else if (t.dataset.rm) setQty(t.dataset.rm, 0);
    else if (t.id === "toCheckout") openCheckout();
    else if (t.id === "promoBtn") {
      const code = $("#promoIn").value.trim().toUpperCase();
      if (PROMOS[code]) { promo = code; refreshCheckout(); toast("Promo code applied"); }
      else { $("#promoMsg").innerHTML = `<span style="color:var(--warn)">That code isn't valid.</span>`; }
    }
    else if ("close" in t.dataset) t.closest("dialog").close();
    else if (t.dataset.nav === "home") { e.preventDefault(); window.scrollTo({ top: 0 }); }
  });
  document.addEventListener("change", e => {
    if (e.target.name === "ship") { co.ship = e.target.value; refreshCheckout(); }
  });
  document.addEventListener("submit", e => {
    if (e.target.id === "coForm") { e.preventDefault(); placeOrder(e.target); }
  });
  $("#scrim").addEventListener("click", closeCart);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#drawer").classList.contains("open")) closeCart(); });
  $$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));
  $("#search").addEventListener("input", e => { state.q = e.target.value; renderGrid(); });
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; renderGrid(); });

  /* ---------- Init ---------- */
  $("#heroArt").innerHTML = `<svg viewBox="0 0 400 320" aria-hidden="true">
    <circle cx="300" cy="70" r="40" fill="#cfe5f7"/>
    <g transform="translate(-10,-40) scale(.85)">${SHAPES.vase("#7fb6e0")}</g>
    <g transform="translate(150,30) scale(.7)">${SHAPES.mug("#bcd9f0")}</g>
    <g transform="translate(110,110) scale(.55)">${SHAPES.candle("#2b7bbd")}</g></svg>`;
  renderChips(); renderGrid(); renderCart();
})();
