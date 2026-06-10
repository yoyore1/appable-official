/**
 * Injected into the served Expo web build (inside the builder iframe).
 * - Reports taps on tagged elements ([data-appable-kind]) to the parent.
 * - Applies live (optimistic) text/color/background changes on command.
 * - Toggleable "edit mode" so normal app interaction still works when off.
 *
 * Communicates with the parent window via postMessage.
 */
export const TAP_EDIT_BRIDGE = `
(function () {
  if (window.__appableTapBridge) return;
  window.__appableTapBridge = true;
  var editMode = false;
  var STYLE_ID = "appable-tap-style";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "[data-appable-kind]{cursor:pointer}" +
      "body.appable-edit [data-appable-kind]{outline:1px dashed rgba(255,122,99,.5);outline-offset:2px}" +
      "body.appable-edit [data-appable-kind]:hover{outline:2px solid #FF7A63;background-color:rgba(255,122,99,.06)}";
    document.head.appendChild(s);
  }

  function post(msg) {
    try { parent.postMessage(Object.assign({ source: "appable" }, msg), "*"); } catch (e) {}
  }

  function closestTagged(el) {
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute("data-appable-kind")) return el;
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener(
    "click",
    function (e) {
      if (!editMode) return;
      var el = closestTagged(e.target);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      var cs = getComputedStyle(el);
      post({
        type: "appable:tap",
        kind: el.getAttribute("data-appable-kind"),
        id: el.getAttribute("data-appable-id"),
        path: el.getAttribute("data-appable-path") || el.getAttribute("data-appable-id"),
        text: el.getAttribute("data-appable-kind") === "text" ? (el.textContent || "") : "",
        color: cs.color,
        background: cs.backgroundColor,
      });
    },
    true
  );

  function applyOne(el, m) {
    if (typeof m.text === "string" && el.getAttribute("data-appable-kind") === "text") {
      el.textContent = m.text;
    }
    if (m.color) el.style.color = m.color;
    if (m.background) el.style.backgroundColor = m.background;
  }

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.target !== "appable") return;
    if (m.type === "appable:editMode") {
      editMode = !!m.on;
      ensureStyle();
      document.body.classList.toggle("appable-edit", editMode);
      return;
    }
    if (m.type === "appable:apply" && m.id) {
      var sel = "[data-appable-id=\\"" + (m.id + "").replace(/\\"/g, "") + "\\"]";
      var nodes = document.querySelectorAll(sel);
      for (var i = 0; i < nodes.length; i++) applyOne(nodes[i], m);
      return;
    }
  });

  ensureStyle();
  post({ type: "appable:ready" });
})();
`;
