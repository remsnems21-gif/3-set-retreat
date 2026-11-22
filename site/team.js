"use strict";
(() => {
  const cfg = window.RETREAT_SUPABASE;
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;
  const lang = () => (root.dataset.l === "de" ? "de" : "fr");

  const T = {
    fr: {
      open: "Ouvertes", inprog: "En cours", blocked: "Bloquées", done: "Faites", all: "Toutes", late: "En retard", news: "Nouveautés depuis ta dernière visite",
      search: "Rechercher", allOwners: "Tous les responsables", allCats: "Toutes les catégories", mine: "Mes tâches", onlyNews: "Seulement les nouveautés",
      add: "Nouvelle tâche", edit: "Modifier", newTask: "Nouvelle tâche", editTask: "Modifier la tâche", del: "Supprimer", delSure: "Vraiment supprimer ?",
      noDate: "sans date", lateTag: "en retard", by: "par", isNew: "Nouveau", isMod: "Modifié", isDone: "Fait", empty: "Aucune tâche pour ce filtre.",
      saved: "Enregistré", deleted: "Supprimé", update: "Mise à jour reçue", logout: "Déconnexion", hello: "Connecté·e :", pwBtn: "Mot de passe",
      badLogin: "E-mail ou mot de passe incorrect.", needBoth: "Indique ton e-mail et ton mot de passe.", needEmail: "Indique d'abord ton e-mail.",
      resetSent: "Si ce compte existe, un e-mail de réinitialisation est parti.", pwShort: "Au moins 10 caractères.", pwDiff: "Les deux mots de passe ne correspondent pas.",
      pwOk: "Mot de passe enregistré.", needTitle: "Indique la tâche.", fail: "Échec, réessaie. ", offline: "Connexion à la base impossible.",
      foot: (n, m) => n + " tâches au total · " + m + " affichées · mise à jour en direct", updated: "modifié", grpLate: "En retard", grpWeek: "Cette semaine et la suivante", grpLater: "Plus tard", grpNone: "Sans date", grpDone: "Faites"
    },
    de: {
      open: "Offen", inprog: "In Arbeit", blocked: "Blockiert", done: "Erledigt", all: "Alle", late: "Überfällig", news: "Neu seit deinem letzten Besuch",
      search: "Suchen", allOwners: "Alle Verantwortlichen", allCats: "Alle Kategorien", mine: "Meine Pendenzen", onlyNews: "Nur Neues",
      add: "Neue Pendenz", edit: "Bearbeiten", newTask: "Neue Pendenz", editTask: "Pendenz bearbeiten", del: "Löschen", delSure: "Wirklich löschen?",
      noDate: "ohne Datum", lateTag: "überfällig", by: "von", isNew: "Neu", isMod: "Geändert", isDone: "Erledigt", empty: "Keine Pendenzen für diesen Filter.",
      saved: "Gespeichert", deleted: "Gelöscht", update: "Aktualisierung erhalten", logout: "Abmelden", hello: "Angemeldet:", pwBtn: "Passwort",
      badLogin: "E-Mail oder Passwort falsch.", needBoth: "Bitte E-Mail und Passwort eingeben.", needEmail: "Bitte zuerst die E-Mail eingeben.",
      resetSent: "Falls das Konto existiert, ist eine E-Mail zum Zurücksetzen unterwegs.", pwShort: "Mindestens 10 Zeichen.", pwDiff: "Die beiden Passwörter stimmen nicht überein.",
      pwOk: "Passwort gespeichert.", needTitle: "Bitte die Aufgabe eingeben.", fail: "Fehlgeschlagen, bitte nochmals. ", offline: "Keine Verbindung zur Datenbank.",
      foot: (n, m) => n + " Pendenzen total · " + m + " angezeigt · live aktualisiert", updated: "geändert", grpLate: "Überfällig", grpWeek: "Diese und nächste Woche", grpLater: "Später", grpNone: "Ohne Datum", grpDone: "Erledigt"
    }
  };
  const t = (k) => T[lang()][k];
  const STATUS = ["À faire", "En cours", "Bloqué", "Fait"];
  const PRIO = ["Haute", "Moyenne", "Basse"];
  const OWNERS = ["Rémy", "Mathieu", "Mel", "Tous"];
  const CATS = ["Jalon", "Juridique & finances", "Lieux & partenaires", "Programme", "Inscription", "Expérience participants", "Marque & marketing"];
  const DE = { "À faire": "Offen", "En cours": "In Arbeit", "Bloqué": "Blockiert", "Fait": "Erledigt", "Haute": "Hoch", "Moyenne": "Mittel", "Basse": "Tief", "Tous": "Alle", "Jalon": "Meilenstein", "Juridique & finances": "Recht & Finanzen", "Lieux & partenaires": "Orte & Partner", "Programme": "Programm", "Inscription": "Anmeldung", "Expérience participants": "Erlebnis Teilnehmende", "Marque & marketing": "Marke & Marketing" };
  const lbl = (v) => (lang() === "de" && DE[v]) || v;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const opts = (list, sel) => list.map((v) => '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(lbl(v)) + "</option>").join("");

  const el = { auth: $("#tAuth"), pw: $("#tPw"), pending: $("#tPending"), app: $("#tApp"), user: $("#tUser") };
  let client = null, me = null, members = {}, tasks = [], since = null, channel = null, needPw = false, editing = null, delArmed = false, booted = false;
  const f = { st: "open", owner: "", cat: "", q: "", mine: false, news: false, late: false };

  let tt;
  function toast(m) { let n = $("#toast"); if (!n) { n = document.createElement("div"); n.id = "toast"; n.className = "toast"; n.setAttribute("role", "status"); document.body.appendChild(n); } n.textContent = m; n.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => n.classList.remove("on"), 2400); }
  function msg(id, text, err) { const n = $(id); n.textContent = text || ""; n.classList.toggle("err", !!err); }
  function view(which) {
    el.auth.hidden = which !== "auth"; el.pw.hidden = which !== "pw"; el.pending.hidden = which !== "pending"; el.app.hidden = which !== "app";
    el.user.hidden = !(which === "app" || which === "pending");
  }

  if (!cfg || !window.supabase || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(cfg.url)) { msg("#lMsg", T.fr.offline + " / " + T.de.offline, true); return; }
  const hp = new URLSearchParams(location.hash.slice(1));
  const flow = hp.get("type");
  const flowErr = hp.get("error_description");
  client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
  if (flow === "invite" || flow === "recovery") needPw = true;
  if (flow || flowErr) setTimeout(() => { if (location.hash.slice(1) !== "taches") location.hash = "taches"; }, 50);
  if (flowErr) msg("#lMsg", flowErr, true);

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") needPw = true;
    setTimeout(() => onSession(session), 0);
  });

  async function onSession(session) {
    if (!session) { me = null; stopLive(); view("auth"); return; }
    if (needPw) { view("pw"); return; }
    if (booted && me && me.id === session.user.id) return;
    const { data, error } = await client.from("retreat_members").select("user_id, display_name");
    if (error) { view("auth"); msg("#lMsg", t("offline") + " " + error.message, true); return; }
    members = Object.fromEntries((data || []).map((r) => [r.user_id, r.display_name]));
    const name = members[session.user.id];
    renderUser(session.user.email, name);
    if (!name) { me = null; view("pending"); return; }
    me = { id: session.user.id, name };
    const key = "retreat-seen-" + me.id;
    try { since = Number(localStorage.getItem(key)) || null; localStorage.setItem(key, String(Date.now())); } catch (e) { since = null; }
    booted = true;
    view("app");
    await load();
    startLive();
  }

  function renderUser(email, name) {
    el.user.innerHTML = '<span>' + esc(t("hello")) + " <b>" + esc(name || email) + "</b></span>" + '<button class="btn ghost" type="button" id="pwBtn">' + esc(t("pwBtn")) + "</button>" + '<button class="btn ghost" type="button" id="logoutBtn">' + esc(t("logout")) + "</button>";
  }

  async function load() {
    const { data, error } = await client.from("retreat_tasks").select("*").order("due", { ascending: true, nullsFirst: false }).order("num", { ascending: true });
    if (error) { toast(t("offline")); return; }
    tasks = data || [];
    render();
  }
  function startLive() {
    if (channel) return;
    channel = client.channel("retreat-tasks").on("postgres_changes", { event: "*", schema: "public", table: "retreat_tasks" }, (p) => {
      if (p.eventType === "DELETE") tasks = tasks.filter((x) => x.id !== p.old.id);
      else { const i = tasks.findIndex((x) => x.id === p.new.id); if (i >= 0) tasks[i] = p.new; else tasks.push(p.new); }
      if (p.new && p.new.updated_by && me && p.new.updated_by !== me.id) toast(t("update"));
      render();
    }).subscribe();
  }
  function stopLive() { if (channel) { client.removeChannel(channel); channel = null; } booted = false; }

  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const dObj = (s) => (s ? new Date(s + "T00:00:00") : null);
  const isOpen = (x) => x.status !== "Fait";
  const isLate = (x) => isOpen(x) && x.due && dObj(x.due) < today();
  const fresh = (x) => {
    if (!since || !me) return null;
    if (x.created_at && Date.parse(x.created_at) > since && x.created_by !== me.id) return "new";
    if (x.done_at && Date.parse(x.done_at) > since && x.updated_by !== me.id) return "done";
    if (x.updated_at && Date.parse(x.updated_at) > since && x.updated_by !== me.id) return "mod";
    return null;
  };
  const fmtDate = (s) => dObj(s).toLocaleDateString(lang() === "de" ? "de-CH" : "fr-CH", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const fmtWhen = (s) => new Date(s).toLocaleString(lang() === "de" ? "de-CH" : "fr-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  function filtered() {
    const q = f.q.trim().toLowerCase();
    return tasks.filter((x) => {
      if (f.st === "open" && !isOpen(x)) return false;
      if (["À faire", "En cours", "Bloqué", "Fait"].includes(f.st) && x.status !== f.st) return false;
      if (f.late && !isLate(x)) return false;
      if (f.owner && x.owner !== f.owner) return false;
      if (f.cat && x.category !== f.cat) return false;
      if (f.mine && me && !(x.owner === me.name || x.owner === "Tous")) return false;
      if (f.news && !fresh(x)) return false;
      if (q && !((x.title || "") + " " + (x.notes || "")).toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function render() {
    if (!me) return;
    const c = { open: 0, prog: 0, blk: 0, done: 0, late: 0, news: 0 };
    tasks.forEach((x) => { if (isOpen(x)) c.open++; if (x.status === "En cours") c.prog++; if (x.status === "Bloqué") c.blk++; if (x.status === "Fait") c.done++; if (isLate(x)) c.late++; if (fresh(x)) c.news++; });
    const tile = (key, n, label, hi, pressed) => '<button type="button" data-sum="' + key + '" class="' + (hi ? "hi" : "") + '" aria-pressed="' + pressed + '"><b>' + n + "</b><span>" + esc(label) + "</span></button>";
    $("#tSum").innerHTML = tile("news", c.news, t("news"), true, f.news) + tile("open", c.open, t("open"), false, f.st === "open" && !f.late && !f.news) + tile("late", c.late, t("late"), false, f.late) + tile("En cours", c.prog, t("inprog"), false, f.st === "En cours") + tile("Bloqué", c.blk, t("blocked"), false, f.st === "Bloqué") + tile("Fait", c.done, t("done"), false, f.st === "Fait");

    const stChips = [["open", t("open")], ["En cours", t("inprog")], ["Bloqué", t("blocked")], ["Fait", t("done")], ["all", t("all")]];
    $("#tBar").innerHTML =
      '<div class="chips">' + stChips.map(([k, l]) => '<button type="button" class="chip" data-st="' + esc(k) + '" aria-pressed="' + (f.st === k) + '">' + esc(l) + "</button>").join("") +
      '<button type="button" class="chip" data-tog="mine" aria-pressed="' + f.mine + '">' + esc(t("mine")) + "</button>" +
      '<button type="button" class="chip" data-tog="news" aria-pressed="' + f.news + '">' + esc(t("onlyNews")) + "</button></div>" +
      '<input id="fQ" type="search" placeholder="' + esc(t("search")) + '" aria-label="' + esc(t("search")) + '" value="' + esc(f.q) + '">' +
      '<select id="fOwner" aria-label="' + esc(t("allOwners")) + '"><option value="">' + esc(t("allOwners")) + "</option>" + opts(OWNERS, f.owner) + "</select>" +
      '<select id="fCat" aria-label="' + esc(t("allCats")) + '"><option value="">' + esc(t("allCats")) + "</option>" + opts(CATS, f.cat) + "</select>" +
      '<button type="button" class="btn" id="addBtn">+ ' + esc(t("add")) + "</button>";
    renderList();
  }

  function renderList() {
    const list = filtered();
    const td = today(), in14 = new Date(td); in14.setDate(in14.getDate() + 14);
    const groups = [[t("grpLate"), []], [t("grpWeek"), []], [t("grpLater"), []], [t("grpNone"), []], [t("grpDone"), []]];
    list.forEach((x) => {
      if (!isOpen(x)) groups[4][1].push(x);
      else if (!x.due) groups[3][1].push(x);
      else if (dObj(x.due) < td) groups[0][1].push(x);
      else if (dObj(x.due) <= in14) groups[1][1].push(x);
      else groups[2][1].push(x);
    });
    groups[4][1].sort((a, b) => Date.parse(b.done_at || b.updated_at) - Date.parse(a.done_at || a.updated_at));
    [0, 1, 2].forEach((i) => groups[i][1].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority))));
    const html = groups.filter(([, g]) => g.length).map(([h, g]) => '<h3 class="grp-h">' + esc(h) + " · " + g.length + "</h3>" + g.map(row).join("")).join("");
    $("#tList").innerHTML = html || '<p class="empty">' + esc(t("empty")) + "</p>";
    $("#tFoot").textContent = t("foot")(tasks.length, list.length);
  }

  function row(x) {
    const fr = fresh(x);
    const badge = fr === "new" ? '<span class="bdg">' + esc(t("isNew")) + "</span>" : fr === "mod" ? '<span class="bdg mod">' + esc(t("isMod")) + "</span>" : fr === "done" ? '<span class="bdg ok">' + esc(t("isDone")) + "</span>" : "";
    const late = isLate(x);
    const due = x.due ? '<span class="due' + (late ? " late" : "") + '">' + esc(fmtDate(x.due)) + (late ? "<small>" + esc(t("lateTag")) + "</small>" : "") + "</span>" : '<span class="due"><small>' + esc(t("noDate")) + "</small></span>";
    const who = x.updated_by && members[x.updated_by] ? '<span class="tag who">' + esc(t("updated")) + " " + esc(t("by")) + " " + esc(members[x.updated_by]) + " · " + esc(fmtWhen(x.updated_at)) + "</span>" : "";
    return '<article class="task' + (isOpen(x) ? "" : " done") + (fr ? " fresh" : "") + '">' +
      '<div class="tl"><select class="stsel" data-id="' + x.id + '" data-s="' + esc(x.status) + '" aria-label="Statut">' + opts(STATUS, x.status) + "</select>" + due + "</div>" +
      '<div><button type="button" class="ttl" data-edit="' + x.id + '"><span class="n">#' + esc(x.num) + "</span>" + esc(x.title) + "</button>" + badge +
      (x.notes ? '<p class="tn">' + esc(x.notes) + "</p>" : "") +
      '<div class="tmeta"><span class="tag o-' + esc(x.owner) + '">' + esc(lbl(x.owner)) + '</span><span class="tag p-' + esc(x.priority) + '">' + esc(lbl(x.priority)) + '</span><span class="tag">' + esc(lbl(x.category)) + "</span>" + who + "</div></div>" +
      '<button type="button" class="iconbtn" data-edit="' + x.id + '" aria-label="' + esc(t("edit")) + '"><svg class="ic"><use href="#i-r"/></svg></button></article>';
  }

  async function setStatus(id, status) {
    const x = tasks.find((y) => y.id === id); if (!x) return;
    const prev = x.status; x.status = status; renderList();
    const { data, error } = await client.from("retreat_tasks").update({ status }).eq("id", id).select().single();
    if (error) { x.status = prev; renderList(); toast(t("fail") + error.message); return; }
    Object.assign(x, data); render(); toast(t("saved"));
  }

  function openEditor(id) {
    editing = id ? tasks.find((x) => x.id === id) : null; delArmed = false;
    const x = editing || { title: "", owner: me && OWNERS.includes(me.name) ? me.name : "Tous", due: "", status: "À faire", priority: "Moyenne", category: "Programme", notes: "" };
    $("#mTitle").textContent = editing ? t("editTask") + " #" + editing.num : t("newTask");
    $("#mT").value = x.title; $("#mOwner").innerHTML = opts(OWNERS, x.owner); $("#mDue").value = x.due || "";
    $("#mStatus").innerHTML = opts(STATUS, x.status); $("#mPrio").innerHTML = opts(PRIO, x.priority); $("#mCat").innerHTML = opts(CATS, x.category);
    $("#mNotes").value = x.notes || ""; $("#mDel").hidden = !editing; $("#mDel").textContent = t("del"); msg("#mMsg", "");
    $("#tModal").hidden = false; setTimeout(() => $("#mT").focus(), 30);
  }
  function closeEditor() { $("#tModal").hidden = true; editing = null; }

  async function saveEditor(e) {
    e.preventDefault();
    const rec = { title: $("#mT").value.trim(), owner: $("#mOwner").value, due: $("#mDue").value || null, status: $("#mStatus").value, priority: $("#mPrio").value, category: $("#mCat").value, notes: $("#mNotes").value.trim() || null };
    if (!rec.title) { msg("#mMsg", t("needTitle"), true); return; }
    $("#mSave").disabled = true;
    const q = editing ? client.from("retreat_tasks").update(rec).eq("id", editing.id).select().single() : client.from("retreat_tasks").insert(rec).select().single();
    const { data, error } = await q;
    $("#mSave").disabled = false;
    if (error) { msg("#mMsg", t("fail") + error.message, true); return; }
    const i = tasks.findIndex((x) => x.id === data.id); if (i >= 0) tasks[i] = data; else tasks.push(data);
    closeEditor(); render(); toast(t("saved"));
  }
  async function deleteTask() {
    if (!editing) return;
    if (!delArmed) { delArmed = true; $("#mDel").textContent = t("delSure"); return; }
    const id = editing.id;
    const { error } = await client.from("retreat_tasks").delete().eq("id", id);
    if (error) { msg("#mMsg", t("fail") + error.message, true); return; }
    tasks = tasks.filter((x) => x.id !== id); closeEditor(); render(); toast(t("deleted"));
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#lEmail").value.trim(), password = $("#lPw").value;
    if (!email || !password) { msg("#lMsg", t("needBoth"), true); return; }
    msg("#lMsg", "…");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { msg("#lMsg", t("badLogin"), true); return; }
    $("#lPw").value = ""; msg("#lMsg", "");
  });
  $("#forgotBtn").addEventListener("click", async () => {
    const email = $("#lEmail").value.trim();
    if (!email) { msg("#lMsg", t("needEmail"), true); return; }
    await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg("#lMsg", t("resetSent"));
  });
  $("#pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = $("#pw1").value, b = $("#pw2").value;
    if (a.length < 10) { msg("#pwMsg", t("pwShort"), true); return; }
    if (a !== b) { msg("#pwMsg", t("pwDiff"), true); return; }
    const { error } = await client.auth.updateUser({ password: a });
    if (error) { msg("#pwMsg", t("fail") + error.message, true); return; }
    $("#pw1").value = ""; $("#pw2").value = ""; needPw = false; toast(t("pwOk"));
    if (me) { view("app"); return; }
    const { data } = await client.auth.getSession(); onSession(data.session);
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "logoutBtn") { stopLive(); client.auth.signOut(); return; }
    if (b.id === "pwBtn") { view("pw"); el.user.hidden = false; $("#pwCancel").hidden = !me; msg("#pwMsg", ""); return; }
    if (b.id === "pwCancel") { needPw = false; if (me) view("app"); return; }
    if (!me) return;
    if (b.dataset.sum) { const k = b.dataset.sum; f.news = k === "news" ? !f.news : false; f.late = k === "late" ? !f.late : false; if (k === "late") f.st = "open"; else if (k !== "news") f.st = k; render(); return; }
    if (b.dataset.st) { f.st = b.dataset.st; f.late = false; render(); return; }
    if (b.dataset.tog) { f[b.dataset.tog] = !f[b.dataset.tog]; render(); return; }
    if (b.id === "addBtn") { openEditor(null); return; }
    if (b.dataset.edit) { openEditor(Number(b.dataset.edit)); return; }
    if (b.id === "mCancel") { closeEditor(); return; }
    if (b.id === "mDel") { deleteTask(); return; }
  });
  document.addEventListener("change", (e) => {
    const s = e.target;
    if (s.classList.contains("stsel")) { setStatus(Number(s.dataset.id), s.value); return; }
    if (s.id === "fOwner") { f.owner = s.value; renderList(); }
    if (s.id === "fCat") { f.cat = s.value; renderList(); }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "fQ") { f.q = e.target.value; renderList(); } });
  $("#tForm").addEventListener("submit", saveEditor);
  $("#tModal").addEventListener("click", (e) => { if (e.target.id === "tModal") closeEditor(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#tModal").hidden) closeEditor(); });
  document.addEventListener("langchange", () => { if (me) { render(); el.user.querySelector("span").innerHTML = esc(t("hello")) + " <b>" + esc(me.name) + "</b>"; $("#pwBtn").textContent = t("pwBtn"); $("#logoutBtn").textContent = t("logout"); } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && me) load(); });
})();
