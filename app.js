(() => {
  "use strict";

  const K = window.KURIKULUM;
  const DEFAULT_MODEL = "claude-sonnet-5-5";
  const MAX_SLIKA = 4;
  const MAX_DIM = 1800;
  const API_URL = "https://api.anthropic.com/v1/messages";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const LS = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* privatni način */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ništa */ } }
  };

  const state = {
    razred: "8",
    temaId: null,
    spol: null,               // "F" | "M"
    odabrani: new Set(),      // id-jevi odabranih ishoda
    slike: [],                // { id, file, url, mask }
    zadaci: [],               // pročitano i uređeno
    obrasci: "",
    biljeska: "",
    screen: "setup",
    zadnjiEkran: "setup"
  };

  class AppError extends Error {}

  /* ---------- Pomoćne funkcije ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let toastTimer = null;
  function toast(msg, isErr = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("err", isErr);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isErr ? 6000 : 2400);
  }

  function busy(on, text) {
    $("#busy").hidden = !on;
    if (text) $("#busyText").textContent = text;
  }

  function show(name) {
    $$(".screen").forEach((s) => { s.hidden = s.id !== "screen-" + name; });
    state.screen = name;
    const steps = $("#steps");
    const inSteps = ["setup", "review", "note"].includes(name);
    steps.classList.toggle("hidden", !inSteps);
    if (inSteps) {
      state.zadnjiEkran = name;
      $$("span", steps).forEach((s) => s.classList.toggle("on", s.dataset.step === name));
    }
    window.scrollTo(0, 0);
  }

  function brojRecenica(tekst) {
    const t = (tekst || "").replace(/\b(npr|tj|tzv|itd|dr|sl|usp|vlč|ak)\./gi, "$1");
    const m = t.trim().match(/[^.!?]+[.!?]+(\s|$)/g);
    return m ? m.length : (t.trim() ? 1 : 0);
  }

  const tema = () => K.razredi[state.razred].teme.find((t) => t.id === state.temaId);
  const customKey = () => `custom:${state.razred}:${state.temaId}`;
  function getCustom() {
    try { return JSON.parse(LS.get(customKey(), "[]")) || []; } catch { return []; }
  }

  /* ---------- Postavljanje ---------- */
  function initSetup() {
    const selR = $("#selRazred");
    selR.innerHTML = Object.entries(K.razredi).map(([k, r]) => `<option value="${esc(k)}">${esc(r.naziv)}</option>`).join("");
    selR.value = state.razred;
    fillTeme();
  }

  function fillTeme() {
    const selT = $("#selTema");
    const teme = K.razredi[state.razred].teme;
    selT.innerHTML = teme.map((t) => `<option value="${esc(t.id)}">${esc(t.naziv)}</option>`).join("");
    state.temaId = teme[0].id;
    selT.value = state.temaId;
    resetOdabrani();
    renderIshodi();
  }

  function sviIshodi() {
    const t = tema();
    return [
      ...K.komunikacija.map((i) => ({ ...i, grupa: "komunikacija" })),
      ...t.ishodi.map((i) => ({ ...i, grupa: "sadrzaj" })),
      ...getCustom().map((i) => ({ ...i, grupa: "vlastiti" }))
    ];
  }

  function resetOdabrani() {
    state.odabrani = new Set(sviIshodi().map((i) => i.id));
  }

  function renderIshodi() {
    const all = sviIshodi();
    const grupe = [
      ["sadrzaj", "Sadržaj: " + tema().naziv],
      ["komunikacija", "Matematička komunikacija"],
      ["vlastiti", "Vlastiti ishodi"]
    ];
    let html = "";
    for (const [g, naslov] of grupe) {
      const items = all.filter((i) => i.grupa === g);
      if (!items.length) continue;
      html += `<div class="grp">${esc(naslov)}</div>`;
      for (const i of items) {
        html += `<label class="ishod"><input type="checkbox" data-id="${esc(i.id)}" ${state.odabrani.has(i.id) ? "checked" : ""}>
          <span>${i.oznaka ? `<span class="oz">${esc(i.oznaka)}</span>` : ""}${esc(i.tekst)}</span></label>`;
      }
    }
    $("#ishodiList").innerHTML = html;
    updateSetupState();
  }

  /* ---------- Fotografije ---------- */
  function renderThumbs() {
    const box = $("#thumbs");
    box.innerHTML = state.slike.map((s, idx) => `
      <div class="thumb" data-id="${s.id}">
        <div class="img">
          <img src="${s.url}" alt="Stranica ${idx + 1}">
          ${s.mask ? `<div class="mask" style="height:${s.mask}%"></div>` : ""}
          <span class="num">Stranica ${idx + 1}</span>
        </div>
        <div class="tools">
          <select class="mask-sel" aria-label="Zakrij vrh stranice">
            ${[[0, "Bez zakrivanja"], [5, "Zakrij vrh 5%"], [10, "Zakrij vrh 10%"], [15, "Zakrij vrh 15%"]]
              .map(([v, l]) => `<option value="${v}" ${s.mask === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <button type="button" class="tb up" aria-label="Pomakni ranije" ${idx === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="tb down" aria-label="Pomakni kasnije" ${idx === state.slike.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="tb del" aria-label="Ukloni fotografiju">✕</button>
        </div>
      </div>`).join("");
    $("#slikeBroj").textContent = `${state.slike.length} / ${MAX_SLIKA}`;
    $("#btnAddPhoto").disabled = state.slike.length >= MAX_SLIKA;
    updateSetupState();
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png)$/i.test(f.name));
    const slobodno = MAX_SLIKA - state.slike.length;
    if (files.length > slobodno) toast(`Najviše ${MAX_SLIKA} fotografije po testu.`, true);
    for (const f of files.slice(0, Math.max(0, slobodno))) {
      state.slike.push({ id: Math.random().toString(36).slice(2), file: f, url: URL.createObjectURL(f), mask: 0 });
    }
    renderThumbs();
  }

  async function slikaUBase64(s) {
    const img = new Image();
    img.decoding = "async";
    img.src = s.url;
    try { await img.decode(); } catch { throw new AppError("Fotografiju nije moguće otvoriti. Probaj je ponovno snimiti."); }
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    if (s.mask) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, Math.round(h * s.mask / 100));
    }
    return c.toDataURL("image/jpeg", 0.85).split(",")[1];
  }

  function updateSetupState() {
    const ok = state.spol && state.slike.length > 0 && state.odabrani.size > 0;
    $("#btnAnaliza").disabled = !ok;
    let hint = "";
    if (!state.spol) hint = "Odaberi učenik ili učenica.";
    else if (!state.odabrani.size) hint = "Odaberi barem jedan ishod.";
    else if (!state.slike.length) hint = "Dodaj barem jednu fotografiju testa.";
    $("#setupHint").textContent = hint;
  }

  /* ---------- Poziv API-ja ---------- */
  function mapError(status, data) {
    const msg = (data && data.error && data.error.message) || "";
    if (status === 401) return "API ključ nije ispravan. Provjeri ga u postavkama.";
    if (status === 403) return "Ključ nema dopuštenje za ovaj zahtjev. Provjeri ga u postavkama.";
    if (status === 400 && /credit balance/i.test(msg)) return "Nema dovoljno kredita na računu. Dodaj kredit u Anthropic Consoleu (Plans & Billing).";
    if (status === 413) return "Fotografije su prevelike. Pokušaj s manje stranica.";
    if (status === 429) return "Previše zahtjeva u kratko vrijeme. Pričekaj minutu i pokušaj ponovno.";
    if (status === 529 || status >= 500) return "Anthropicov poslužitelj je trenutačno preopterećen. Pokušaj ponovno za koju minutu.";
    return msg ? `Greška: ${msg}` : `Neočekivana greška (${status}).`;
  }

  async function callClaude({ system, content, tools, toolName, maxTokens }) {
    const key = (LS.get("ap_key") || "").trim();
    if (!key) throw new AppError("Najprije upiši API ključ u postavkama.");
    const body = {
      model: LS.get("ap_model", DEFAULT_MODEL),
      max_tokens: maxTokens || 2000,
      system,
      messages: [{ role: "user", content }]
    };
    if (tools) { body.tools = tools; body.tool_choice = { type: "tool", name: toolName }; }

    let res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(body)
      });
    } catch {
      throw new AppError("Nema veze s internetom ili je veza prekinuta. Pokušaj ponovno.");
    }
    let data = null;
    try { data = await res.json(); } catch { /* prazno tijelo */ }
    if (!res.ok) throw new AppError(mapError(res.status, data));
    if (!data || !Array.isArray(data.content)) throw new AppError("Neočekivan odgovor poslužitelja.");
    return data;
  }

  /* ---------- Čitanje testa ---------- */
  const SYS_CITANJE = `Pomažeš učitelju matematike u hrvatskoj osnovnoj školi pročitati i pregledati učenikov ispunjeni test. Dobivaš fotografije stranica testa, redom kojim su poslane.

Za svaki zadatak koji vidiš:
- kratko prepiši zadatak (npr. "(2/3)^3" ili "Kako nazivamo brojeve a i n u potenciji?"),
- vjerno prepiši što je učenik napisao, uključujući pogreške; ne ispravljaj ga i ne dopunjavaj,
- SAMOSTALNO izračunaj ili odredi točan odgovor i usporedi ga s učenikovim,
- ocijeni: "tocno", "djelomicno" (npr. točan postupak ali pogrešan rezultat, ili točan rezultat kroz pogrešan međukorak, ili nepotpun odgovor), "netocno" ili "bez_odgovora",
- ako je odgovor pogrešan ili nepotpun, jednom kratkom rečenicom imenuj vrstu pogreške (npr. "kvadrira samo nazivnik", "ne razlikuje -a² i (-a)²", "umjesto eksponenta napisao naziv potencija").

Pravila:
- Ako rukopis, precrtani ili zamazani dio nije sigurno čitljiv, postavi nesigurno=true i u komentaru napiši što se čini da piše i zašto je nejasno. Ne nagađaj prešutno.
- Zadatke s više podzadataka (a, b, c) navedi odvojeno, npr. broj "9c".
- Ne izmišljaj zadatke kojih nema na slikama. Ne preskači zadatke.
- Ne prepisuj ime, prezime ni druge osobne podatke ako se vide; ignoriraj ih.
- Na kraju u polju "obrasci" napiši 3 do 6 kratkih opažanja: što učenik dobro radi, koje se pogreške ponavljaju i kako se pokazuje njegova matematička komunikacija (zapis, nazivlje, cjelovitost odgovora).
Odgovor predaj isključivo pozivom alata zapisi_pregled.`;

  const TOOL_PREGLED = {
    name: "zapisi_pregled",
    description: "Zapisuje pročitani i pregledani test.",
    input_schema: {
      type: "object",
      properties: {
        zadaci: {
          type: "array",
          items: {
            type: "object",
            properties: {
              broj: { type: "string", description: "Broj zadatka, npr. 9c" },
              zadatak: { type: "string", description: "Kratak zapis zadatka" },
              ucenik_napisao: { type: "string", description: "Što je učenik napisao (vjerno)" },
              tocan_odgovor: { type: "string", description: "Točan odgovor ili rezultat" },
              ocjena: { type: "string", enum: ["tocno", "djelomicno", "netocno", "bez_odgovora"] },
              komentar: { type: "string", description: "Vrsta pogreške ili napomena; prazno ako je točno" },
              nesigurno: { type: "boolean", description: "True ako čitanje rukopisa nije sigurno" }
            },
            required: ["broj", "zadatak", "ucenik_napisao", "tocan_odgovor", "ocjena", "komentar", "nesigurno"]
          }
        },
        obrasci: { type: "string", description: "Kratka opažanja o cjelini testa" }
      },
      required: ["zadaci", "obrasci"]
    }
  };

  function ishodiZaPrompt() {
    return sviIshodi().filter((i) => state.odabrani.has(i.id)).map((i) => {
      let r = "- " + i.tekst;
      if (i.razrada && i.razrada.length) r += " (podvještine: " + i.razrada.join("; ") + ")";
      return r;
    }).join("\n");
  }

  async function analiziraj() {
    if (!(LS.get("ap_key") || "").trim()) { toast("Najprije upiši API ključ u postavkama.", true); openSettings(); return; }
    busy(true, "Čitam test…");
    try {
      const content = [];
      for (let i = 0; i < state.slike.length; i++) {
        content.push({ type: "text", text: `Stranica ${i + 1}:` });
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await slikaUBase64(state.slike[i]) } });
      }
      const napomena = $("#napomena").value.trim();
      content.push({
        type: "text",
        text: `Razred: ${K.razredi[state.razred].naziv}\nTema: ${tema().naziv}\nIshodi koje učitelj prati:\n${ishodiZaPrompt()}\n${napomena ? "Napomena učitelja: " + napomena + "\n" : ""}\nPročitaj sve zadatke na ${state.slike.length === 1 ? "stranici" : "stranicama"} i zapiši pregled.`
      });
      const data = await callClaude({ system: SYS_CITANJE, content, tools: [TOOL_PREGLED], toolName: "zapisi_pregled", maxTokens: 8000 });
      const blok = data.content.find((b) => b.type === "tool_use");
      if (!blok || !blok.input || !Array.isArray(blok.input.zadaci)) {
        throw new AppError(data.stop_reason === "max_tokens"
          ? "Odgovor je bio predug i prekinut. Pokušaj s manje stranica odjednom."
          : "Nisam uspio pročitati test. Pokušaj ponovno s oštrijom fotografijom.");
      }
      state.zadaci = blok.input.zadaci.map((z) => ({
        broj: String(z.broj ?? ""), zadatak: String(z.zadatak ?? ""), ucenik_napisao: String(z.ucenik_napisao ?? ""),
        tocan_odgovor: String(z.tocan_odgovor ?? ""),
        ocjena: ["tocno", "djelomicno", "netocno", "bez_odgovora"].includes(z.ocjena) ? z.ocjena : "netocno",
        komentar: String(z.komentar ?? ""), nesigurno: !!z.nesigurno
      }));
      state.obrasci = String(blok.input.obrasci ?? "");
      renderReview();
      show("review");
    } catch (e) {
      toast(e instanceof AppError ? e.message : "Dogodila se neočekivana greška.", true);
      if (!(e instanceof AppError)) console.error(e);
    } finally {
      busy(false);
    }
  }

  /* ---------- Pregled ---------- */
  const OCJENE = [["tocno", "Točno"], ["djelomicno", "Djelomično"], ["netocno", "Netočno"], ["bez_odgovora", "Bez odgovora"]];

  function taskHtml(z, i) {
    return `<article class="task st-${z.ocjena}" data-i="${i}">
      <div class="task-head">
        <span class="lbl">Zad.</span>
        <input class="f-broj" type="text" value="${esc(z.broj)}" aria-label="Broj zadatka" autocomplete="off">
        <select class="f-ocjena" aria-label="Ocjena zadatka">
          ${OCJENE.map(([v, l]) => `<option value="${v}" ${z.ocjena === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
        <button type="button" class="del" aria-label="Ukloni zadatak">✕</button>
      </div>
      ${z.nesigurno ? `<p class="warn"><strong>Provjeri čitanje.</strong> ${esc(z.komentar || "Rukopis nije sasvim jasan.")}</p>` : ""}
      <label>Zadatak<input class="f-zadatak" type="text" value="${esc(z.zadatak)}" autocomplete="off"></label>
      <label>Učenik je napisao<textarea class="f-napisao" rows="2">${esc(z.ucenik_napisao)}</textarea></label>
      <label>Točan odgovor<input class="f-tocan" type="text" value="${esc(z.tocan_odgovor)}" autocomplete="off"></label>
      <label>Komentar (vrsta pogreške)<input class="f-komentar" type="text" value="${esc(z.nesigurno ? "" : z.komentar)}" autocomplete="off"></label>
    </article>`;
  }

  function renderReview() {
    $("#zadaci").innerHTML = state.zadaci.map(taskHtml).join("");
    $("#obrasci").value = state.obrasci;
  }

  function onReviewInput(e) {
    const art = e.target.closest(".task");
    if (!art) return;
    const z = state.zadaci[+art.dataset.i];
    if (!z) return;
    const c = e.target.classList;
    if (c.contains("f-broj")) z.broj = e.target.value;
    else if (c.contains("f-zadatak")) z.zadatak = e.target.value;
    else if (c.contains("f-napisao")) z.ucenik_napisao = e.target.value;
    else if (c.contains("f-tocan")) z.tocan_odgovor = e.target.value;
    else if (c.contains("f-komentar")) { z.komentar = e.target.value; z.nesigurno = false; }
    else if (c.contains("f-ocjena")) {
      z.ocjena = e.target.value;
      art.className = "task st-" + z.ocjena;
    }
  }

  /* ---------- Bilješka ---------- */
  const SYS_BILJESKA = `Pišeš bilješku učitelja matematike za e-Dnevnik. Bilješku čitaju učenik i roditelji.

Pravila:
- Točno 4 do 7 rečenica, jedan odlomak, bez nabrajanja, naslova i emotikona.
- Ton: profesionalan, ljubazan i jasan. Riječi razumljive učeniku 8. razreda i njegovim roditeljima, bez žargona. Matematičke nazive (baza, eksponent, potencija) smiješ koristiti, a ako je pogreška vezana uz njih, ukratko ih objasni.
- Treće lice: "Učenica ..." ili "Učenik ..." prema zadanom spolu, dosljedno u rodu (pokazala/pokazao, zna, treba). Ne koristi ime.
- Redoslijed: što učenik već dobro zna; što još treba uvježbati (konkretno, na jednom ili dva primjera opisanih riječima, npr. što točno radi pogrešno); jedan jasan savjet što vježbati. Matematičku komunikaciju (zapis, nazivlje, cjelovito objašnjavanje) uključi kad je vidljiva u pregledu.
- Ne spominji ocjenu, bodove, postotke, brojeve zadataka ni usporedbe s drugim učenicima. Ne navodi oznake ishoda (MAT OŠ ...).
- Piši samo ono što proizlazi iz dostavljenog pregleda; ništa ne izmišljaj. Ono što je u pregledu označeno kao nesigurno ne navodi kao činjenicu.
- Pogreške opisuj kao nešto što se još vježba, bez osuđivanja.
- Vrati samo tekst bilješke, bez uvoda i objašnjenja.`;

  function pregledZaPrompt() {
    const ocjenaTxt = { tocno: "točno", djelomicno: "djelomično", netocno: "netočno", bez_odgovora: "bez odgovora" };
    const redovi = state.zadaci.map((z) =>
      `- ${z.broj}: ${z.zadatak} | učenik: ${z.ucenik_napisao || "(prazno)"} | točno: ${z.tocan_odgovor} | ${ocjenaTxt[z.ocjena]}${z.komentar ? " | " + z.komentar : ""}`);
    return redovi.join("\n") + (state.obrasci.trim() ? `\n\nOpažanja o cjelini:\n${state.obrasci.trim()}` : "");
  }

  function kontekstZaBiljesku() {
    const stil = (LS.get("ap_stil") ?? window.STIL_PRIMJER).trim();
    const napomena = $("#napomena").value.trim();
    return `Spol: ${state.spol === "F" ? "učenica (ženski rod)" : "učenik (muški rod)"}
Razred i tema: ${K.razredi[state.razred].naziv}, ${tema().naziv}
Ishodi koje učitelj prati:
${ishodiZaPrompt()}
${napomena ? "Napomena učitelja: " + napomena + "\n" : ""}
Pregled testa:
${pregledZaPrompt()}
${stil ? `\nPrimjer bilješki ovog učitelja (koristi samo za ton, duljinu i izričaj; sadržaj ne preuzimaj):\n${stil}\n` : ""}`;
  }

  function tekstIzOdgovora(data) {
    return data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  }

  function ocistiBiljesku(t) {
    return t.replace(/^["„“]+|["”“]+$/g, "").replace(/^\s*(bilješka|biljeska)\s*:\s*/i, "").trim();
  }

  async function napisiBiljesku() {
    if (!state.zadaci.length) { toast("Nema zadataka za bilješku. Dodaj barem jedan.", true); return; }
    busy(true, "Pišem bilješku…");
    try {
      state.obrasci = $("#obrasci").value;
      const data = await callClaude({
        system: SYS_BILJESKA,
        content: [{ type: "text", text: kontekstZaBiljesku() + "\nNapiši bilješku." }],
        maxTokens: 1200
      });
      const t = ocistiBiljesku(tekstIzOdgovora(data));
      if (!t) throw new AppError("Odgovor je prazan. Pokušaj ponovno.");
      state.biljeska = t;
      $("#biljeska").value = t;
      updateCount();
      show("note");
    } catch (e) {
      toast(e instanceof AppError ? e.message : "Dogodila se neočekivana greška.", true);
      if (!(e instanceof AppError)) console.error(e);
    } finally {
      busy(false);
    }
  }

  async function preradi(uputa) {
    const trenutno = $("#biljeska").value.trim();
    if (!trenutno) return;
    if (!uputa) return;
    busy(true, "Prerađujem…");
    try {
      const data = await callClaude({
        system: SYS_BILJESKA,
        content: [{ type: "text", text: kontekstZaBiljesku() + `\nTrenutna bilješka:\n${trenutno}\n\nPreradi bilješku prema uputi učitelja: ${uputa}\nZadrži sva pravila (4 do 7 rečenica, treće lice, samo činjenice iz pregleda).` }],
        maxTokens: 1200
      });
      const t = ocistiBiljesku(tekstIzOdgovora(data));
      if (!t) throw new AppError("Odgovor je prazan. Pokušaj ponovno.");
      $("#biljeska").value = t;
      state.biljeska = t;
      $("#inpUputa").value = "";
      updateCount();
    } catch (e) {
      toast(e instanceof AppError ? e.message : "Dogodila se neočekivana greška.", true);
      if (!(e instanceof AppError)) console.error(e);
    } finally {
      busy(false);
    }
  }

  function updateCount() {
    const n = brojRecenica($("#biljeska").value);
    const p = $("#brojRecenica");
    p.textContent = n + (n === 1 ? " rečenica" : (n >= 2 && n <= 4 ? " rečenice" : " rečenica"));
    p.classList.toggle("warn", n < 4 || n > 7);
  }

  async function kopiraj() {
    const t = $("#biljeska").value.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      toast("Kopirano. Zalijepi u e-Dnevnik.");
    } catch {
      const ta = $("#biljeska");
      ta.focus(); ta.select();
      try { document.execCommand("copy"); toast("Kopirano. Zalijepi u e-Dnevnik."); }
      catch { toast("Kopiranje nije uspjelo. Označi tekst i kopiraj ručno.", true); }
    }
  }

  /* ---------- Postavke ---------- */
  function openSettings() {
    $("#inpKey").value = LS.get("ap_key", "") || "";
    $("#inpKey").type = "password";
    $("#btnShowKey").textContent = "Prikaži";
    $("#selModel").value = LS.get("ap_model", DEFAULT_MODEL);
    $("#inpStil").value = LS.get("ap_stil") ?? window.STIL_PRIMJER;
    $("#keyStatus").textContent = "";
    $("#keyStatus").className = "status";
    show("settings");
  }

  function spremiPostavke(tiho) {
    const key = $("#inpKey").value.trim();
    if (key) LS.set("ap_key", key);
    LS.set("ap_model", $("#selModel").value);
    LS.set("ap_stil", $("#inpStil").value);
    if (!tiho) toast("Spremljeno.");
  }

  async function provjeriKljuc() {
    const st = $("#keyStatus");
    spremiPostavke(true);
    st.className = "status";
    st.textContent = "Provjeravam…";
    try {
      await callClaude({ system: "Odgovori jednom riječju.", content: [{ type: "text", text: "Reci: u redu" }], maxTokens: 16 });
      st.className = "status ok";
      st.textContent = "Ključ radi i račun ima kredita.";
    } catch (e) {
      st.className = "status err";
      st.textContent = e instanceof AppError ? e.message : "Provjera nije uspjela.";
    }
  }

  /* ---------- Novi test ---------- */
  function noviTest() {
    state.slike.forEach((s) => URL.revokeObjectURL(s.url));
    state.slike = [];
    state.zadaci = [];
    state.obrasci = "";
    state.biljeska = "";
    state.spol = null;
    $$("#spol button").forEach((b) => b.setAttribute("aria-checked", "false"));
    $("#napomena").value = "";
    $("#biljeska").value = "";
    renderThumbs();
    show("setup");
  }

  /* ---------- Događaji ---------- */
  function bind() {
    $("#selRazred").addEventListener("change", (e) => { state.razred = e.target.value; fillTeme(); });
    $("#selTema").addEventListener("change", (e) => { state.temaId = e.target.value; resetOdabrani(); renderIshodi(); });

    $("#spol").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      state.spol = b.dataset.v;
      $$("#spol button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      updateSetupState();
    });

    $("#ishodiList").addEventListener("change", (e) => {
      const cb = e.target.closest("input[type=checkbox]");
      if (!cb) return;
      cb.checked ? state.odabrani.add(cb.dataset.id) : state.odabrani.delete(cb.dataset.id);
      updateSetupState();
    });

    $("#btnAddIshod").addEventListener("click", () => {
      const box = $("#addIshodBox");
      box.hidden = !box.hidden;
      if (!box.hidden) $("#inpIshod").focus();
    });
    $("#btnSaveIshod").addEventListener("click", () => {
      const txt = $("#inpIshod").value.trim();
      if (!txt) return;
      const list = getCustom();
      const id = "V-" + Date.now().toString(36);
      list.push({ id, tekst: txt });
      LS.set(customKey(), JSON.stringify(list));
      state.odabrani.add(id);
      $("#inpIshod").value = "";
      $("#addIshodBox").hidden = true;
      renderIshodi();
    });

    $("#btnAddPhoto").addEventListener("click", () => $("#fileInp").click());
    $("#fileInp").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });

    $("#thumbs").addEventListener("click", (e) => {
      const th = e.target.closest(".thumb");
      if (!th) return;
      const i = state.slike.findIndex((s) => s.id === th.dataset.id);
      if (i < 0) return;
      if (e.target.closest(".del")) {
        URL.revokeObjectURL(state.slike[i].url);
        state.slike.splice(i, 1);
      } else if (e.target.closest(".up") && i > 0) {
        [state.slike[i - 1], state.slike[i]] = [state.slike[i], state.slike[i - 1]];
      } else if (e.target.closest(".down") && i < state.slike.length - 1) {
        [state.slike[i + 1], state.slike[i]] = [state.slike[i], state.slike[i + 1]];
      } else return;
      renderThumbs();
    });
    $("#thumbs").addEventListener("change", (e) => {
      if (!e.target.classList.contains("mask-sel")) return;
      const th = e.target.closest(".thumb");
      const s = state.slike.find((x) => x.id === th.dataset.id);
      if (s) { s.mask = +e.target.value; renderThumbs(); }
    });

    $("#btnAnaliza").addEventListener("click", analiziraj);

    $("#zadaci").addEventListener("input", onReviewInput);
    $("#zadaci").addEventListener("change", onReviewInput);
    $("#zadaci").addEventListener("click", (e) => {
      if (!e.target.closest(".del")) return;
      const art = e.target.closest(".task");
      state.zadaci.splice(+art.dataset.i, 1);
      renderReview();
    });
    $("#obrasci").addEventListener("input", (e) => { state.obrasci = e.target.value; });
    $("#btnAddZadatak").addEventListener("click", () => {
      state.zadaci.push({ broj: "", zadatak: "", ucenik_napisao: "", tocan_odgovor: "", ocjena: "netocno", komentar: "", nesigurno: false });
      renderReview();
      const last = $$("#zadaci .task").pop();
      if (last) { last.scrollIntoView({ block: "center" }); $(".f-broj", last).focus(); }
    });
    $("#btnBackSetup").addEventListener("click", () => show("setup"));
    $("#btnNote").addEventListener("click", napisiBiljesku);

    $("#biljeska").addEventListener("input", () => { state.biljeska = $("#biljeska").value; updateCount(); });
    $("#btnCopy").addEventListener("click", kopiraj);
    $("#chips").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-u]");
      if (b) preradi(b.dataset.u);
    });
    $("#btnRefine").addEventListener("click", () => preradi($("#inpUputa").value.trim()));
    $("#inpUputa").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); preradi($("#inpUputa").value.trim()); } });
    $("#btnBackReview").addEventListener("click", () => show("review"));
    $("#btnNew").addEventListener("click", () => {
      if (confirm("Započeti novi test? Trenutna bilješka će nestati s ekrana.")) noviTest();
    });

    $("#btnSettings").addEventListener("click", () => {
      if (state.screen === "settings") { show(state.zadnjiEkran); return; }
      openSettings();
    });
    $("#btnBackSettings").addEventListener("click", () => { spremiPostavke(true); show(state.zadnjiEkran); });
    $("#btnSaveSettings").addEventListener("click", () => spremiPostavke(false));
    $("#btnTestKey").addEventListener("click", provjeriKljuc);
    $("#btnShowKey").addEventListener("click", () => {
      const inp = $("#inpKey");
      const sakriven = inp.type === "password";
      inp.type = sakriven ? "text" : "password";
      $("#btnShowKey").textContent = sakriven ? "Sakrij" : "Prikaži";
    });
    $("#btnResetStil").addEventListener("click", () => { $("#inpStil").value = window.STIL_PRIMJER; });
    $("#btnDelKey").addEventListener("click", () => {
      if (!confirm("Obrisati API ključ s ovog uređaja?")) return;
      LS.del("ap_key");
      $("#inpKey").value = "";
      toast("Ključ je obrisan.");
    });
  }

  /* ---------- Pokretanje ---------- */
  function init() {
    initSetup();
    renderThumbs();
    bind();
    if (!(LS.get("ap_key") || "").trim()) {
      openSettings();
      $("#keyStatus").textContent = "Dobrodošao. Za početak upiši svoj API ključ.";
    } else {
      show("setup");
    }
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* nije kritično */ });
    }
  }

  init();
})();
