export type PreviewServeMode = "static" | "live";

/** Static export preview — /api/expo-web/{id}/ */
export function expoWebBasePath(projectId: string): string {
  return `/api/expo-web/${projectId}`;
}

/** Live Metro preview (proxied) — /api/expo-live/{id}/ */
export function expoLiveBasePath(projectId: string): string {
  return `/api/expo-live/${projectId}`;
}

export function previewBasePath(
  projectId: string,
  mode: PreviewServeMode = "static"
): string {
  return mode === "live" ? expoLiveBasePath(projectId) : expoWebBasePath(projectId);
}

/** Runs in <head> before the Expo bundle — prefixes history URLs with the iframe base path. */
export function previewBasePathShim(
  projectId: string,
  mode: PreviewServeMode = "static"
): string {
  const base = previewBasePath(projectId, mode);
  return `(function(){
  window.__appablePreviewBase=1;
  var B=${JSON.stringify(base)};
  var p=location.pathname;
  if(p.indexOf(B)!==0){
    var tail=p==="/"?"":p;
    location.replace(B+tail+location.search+location.hash);
    return;
  }
  function prefix(u){
    if(!u||typeof u!=="string")return u;
    try{
      if(u.indexOf("://")!==-1)return u;
      if(u.indexOf(B)===0)return u;
      if(u.charAt(0)==="/")return B+u;
      return B+"/"+u;
    }catch(e){return u;}
  }
  var ps=history.pushState.bind(history);
  history.pushState=function(s,t,u){return ps(s,t,prefix(u));};
  var rs=history.replaceState.bind(history);
  history.replaceState=function(s,t,u){return rs(s,t,prefix(u));};
  document.addEventListener("click",function(e){
    var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
    if(!a)return;
    var h=a.getAttribute("href");
    if(!h||h.indexOf("://")!==-1||h.indexOf(B)===0)return;
    if(h.charAt(0)==="/"){
      e.preventDefault();
      history.pushState(null,"",prefix(h));
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  },true);
})();`;
}

export function injectPreviewHtml(
  html: string,
  projectId: string,
  extraScript?: string,
  mode: PreviewServeMode = "static"
): string {
  if (html.includes("__appablePreviewBase")) {
    if (extraScript && !html.includes("__appableTapBridge")) {
      const tag = `<script>${extraScript}</script>`;
      return html.includes("</body>")
        ? html.replace("</body>", `${tag}</body>`)
        : html + tag;
    }
    return html;
  }

  const base = previewBasePath(projectId, mode);
  const headInject =
    `<base href="${base}/" />` +
    `<script>${previewBasePathShim(projectId, mode)}</script>`;
  const bodyInject = extraScript ? `<script>${extraScript}</script>` : "";

  let out = html.includes("<head>")
    ? html.replace("<head>", `<head>${headInject}`)
    : headInject + html;

  if (bodyInject) {
    out = out.includes("</body>")
      ? out.replace("</body>", `${bodyInject}</body>`)
      : out + bodyInject;
  }
  return out;
}
