// Choreconomy: kids earn points for chores; parents set what points are worth in money or screen time.
import { useState } from "react";
import { uid, useStored } from "./lib/store";
import { addDays, todayISO } from "./lib/time";

type Kid = { id: string; name: string; color: string };
type Chore = { id: string; name: string; points: number; every: "day" | "week"; kids: string[] };
type Entry = { id: string; kid: string; date: string; points: number; what: string; kind: "chore" | "bonus" | "spend" };

const T = "choreconomy";
const COLORS = ["#FF48B0", "#3255A4", "#00A95C", "#FF6C2F", "#765BA7", "#00838A"];
const SAMPLE_KIDS: Kid[] = [{ id: "k1", name: "Yasmine", color: COLORS[0] }, { id: "k2", name: "Adam", color: COLORS[1] }];
const SAMPLE_CHORES: Chore[] = [
  { id: "c1", name: "Make the bed", points: 5, every: "day", kids: ["k1", "k2"] },
  { id: "c2", name: "Set the table", points: 10, every: "day", kids: ["k1", "k2"] },
  { id: "c3", name: "Feed the cat", points: 10, every: "day", kids: ["k2"] },
  { id: "c4", name: "Tidy the bedroom", points: 30, every: "week", kids: ["k1", "k2"] },
  { id: "c5", name: "Help with the shopping", points: 40, every: "week", kids: ["k1"] },
];
const weekStart = (d: string) => { const x = new Date(d + "T12:00:00Z"); const dow = x.getUTCDay() || 7; return addDays(d, 1 - dow); };

export default function Choreconomy() {
  const [kids, setKids] = useStored<Kid[]>(T, "kids", SAMPLE_KIDS);
  const [chores, setChores] = useStored<Chore[]>(T, "chores", SAMPLE_CHORES);
  const [log, setLog] = useStored<Entry[]>(T, "log", []);
  const [moneyPer100, setMoneyPer100] = useStored(T, "money", 5);
  const [currency, setCurrency] = useStored(T, "currency", "TND");
  const [minutesPer100, setMinutesPer100] = useStored(T, "minutes", 60);
  const [pin, setPin] = useStored(T, "pin", "");
  const [unlocked, setUnlocked] = useState(false);
  const [pinTry, setPinTry] = useState("");
  const [tab, setTab] = useState<"week" | "shop" | "setup">("week");
  const [draft, setDraft] = useState({ name: "", points: "10", every: "day" as Chore["every"] });
  const [spend, setSpend] = useState({ kid: "", points: "", as: "money" as "money" | "screen" | "treat", treat: "" });

  const today = todayISO();
  const ws = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const parent = !pin || unlocked;

  const balance = (kid: string) => log.filter(e => e.kid === kid).reduce((s, e) => s + (e.kind === "spend" ? -e.points : e.points), 0);
  const weekEarned = (kid: string) => log.filter(e => e.kid === kid && e.kind !== "spend" && e.date >= ws).reduce((s, e) => s + e.points, 0);
  const doneOn = (kid: string, chore: string, date: string) => log.find(e => e.kid === kid && e.kind === "chore" && e.what === chore && e.date === date);
  const doneThisWeek = (kid: string, chore: string) => log.find(e => e.kid === kid && e.kind === "chore" && e.what === chore && e.date >= ws);

  const toggle = (kid: string, c: Chore, date: string) => {
    setLog(cur => {
      const hit = cur.find(e => e.kid === kid && e.kind === "chore" && e.what === c.id && (c.every === "day" ? e.date === date : e.date >= ws));
      return hit ? cur.filter(e => e.id !== hit.id) : [...cur, { id: uid(), kid, date, points: c.points, what: c.id, kind: "chore" }];
    });
  };
  const money = (pts: number) => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((pts / 100) * moneyPer100); } catch { return ((pts / 100) * moneyPer100).toFixed(2); } };
  const minutes = (pts: number) => Math.floor((pts / 100) * minutesPer100);
  const choreName = (id: string) => chores.find(c => c.id === id)?.name ?? "Old chore";

  const doSpend = () => {
    const p = Math.floor(+spend.points);
    if (!spend.kid || !(p > 0) || p > balance(spend.kid)) return;
    const what = spend.as === "money" ? `Cashed out ${money(p)}` : spend.as === "screen" ? `${minutes(p)} min of screen time` : spend.treat || "A treat";
    setLog(cur => [...cur, { id: uid(), kid: spend.kid, date: today, points: p, what, kind: "spend" }]);
    setSpend({ ...spend, points: "", treat: "" });
  };

  return (
    <div className="stack">
      <div className="ch-kids">
        {kids.map(k => (
          <div key={k.id} className="panel ch-kid" style={{ borderTop: `6px solid ${k.color}` }}>
            <p className="eyebrow">{k.name}</p>
            <div className="ch-bal num">{balance(k.id)}<small>points</small></div>
            <p className="note">Worth {money(balance(k.id))} or {minutes(balance(k.id))} min of screen time</p>
            <p className="note">+{weekEarned(k.id)} this week</p>
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="seg-mini" role="tablist">
          <button role="tab" aria-pressed={tab === "week"} onClick={() => setTab("week")}>This week</button>
          <button role="tab" aria-pressed={tab === "shop"} onClick={() => setTab("shop")}>Spend points</button>
          <button role="tab" aria-pressed={tab === "setup"} onClick={() => setTab("setup")}>Parents</button>
        </div>
        {pin && (unlocked ? <button className="btn small" onClick={() => setUnlocked(false)}>Lock parent settings</button> : <span className="pill">Parent settings locked</span>)}
      </div>

      {tab === "week" && kids.map(k => {
        const mine = chores.filter(c => c.kids.includes(k.id));
        return (
          <section key={k.id} className="panel">
            <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}><i style={{ width: 14, height: 14, borderRadius: 7, background: k.color, display: "inline-block" }} />{k.name}'s week</h2>
            {mine.length === 0 ? <p className="empty-note">No chores for {k.name} yet. Add some under Parents.</p> : (
              <div className="table-wrap">
                <table className="t ch-grid">
                  <thead><tr><th>Chore</th>{days.map(d => <th key={d} className={d === today ? "today" : ""}>{new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}</th>)}</tr></thead>
                  <tbody>
                    {mine.map(c => (
                      <tr key={c.id}>
                        <td>{c.name} <span className="pill">{c.points} pts{c.every === "week" ? " / week" : ""}</span></td>
                        {c.every === "day" ? days.map(d => {
                          const done = !!doneOn(k.id, c.id, d);
                          return <td key={d} className={d === today ? "today" : ""}>
                            <button className={"ch-box" + (done ? " done" : "")} style={done ? { background: k.color, borderColor: k.color } : undefined} disabled={d > today} onClick={() => toggle(k.id, c, d)} aria-label={`${c.name} on ${d}${done ? ", done" : ""}`}>{done ? "✓" : ""}</button>
                          </td>;
                        }) : (
                          <td colSpan={7}>
                            <button className={"ch-box wide" + (doneThisWeek(k.id, c.id) ? " done" : "")} style={doneThisWeek(k.id, c.id) ? { background: k.color, borderColor: k.color } : undefined} onClick={() => toggle(k.id, c, today)}>
                              {doneThisWeek(k.id, c.id) ? "Done this week ✓" : "Mark done this week"}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {tab === "shop" && (
        <div className="grid2">
          <section className="panel">
            <h2>Spend points</h2>
            <div className="stack" style={{ gap: 12 }}>
              <label className="field"><span>Who</span><select id="ch-sk" className="input" value={spend.kid} onChange={e => setSpend({ ...spend, kid: e.target.value })}><option value="">Choose</option>{kids.map(k => <option key={k.id} value={k.id}>{k.name} ({balance(k.id)} pts)</option>)}</select></label>
              <div className="seg-mini">
                <button aria-pressed={spend.as === "money"} onClick={() => setSpend({ ...spend, as: "money" })}>Pocket money</button>
                <button aria-pressed={spend.as === "screen"} onClick={() => setSpend({ ...spend, as: "screen" })}>Screen time</button>
                <button aria-pressed={spend.as === "treat"} onClick={() => setSpend({ ...spend, as: "treat" })}>A treat</button>
              </div>
              {spend.as === "treat" && <label className="field"><span>Treat</span><input id="ch-treat" className="input" value={spend.treat} onChange={e => setSpend({ ...spend, treat: e.target.value })} placeholder="Choose Friday's film" /></label>}
              <label className="field"><span>Points</span><input id="ch-sp" className="input num" inputMode="numeric" value={spend.points} onChange={e => setSpend({ ...spend, points: e.target.value })} /></label>
              {+spend.points > 0 && <p className="note">{spend.as === "money" ? `= ${money(+spend.points)}` : spend.as === "screen" ? `= ${minutes(+spend.points)} minutes` : ""}</p>}
              {spend.kid && +spend.points > balance(spend.kid) && <p className="pill bad">Not enough points yet.</p>}
              <button className="btn primary" onClick={doSpend} disabled={!parent || !spend.kid || !(+spend.points > 0) || +spend.points > balance(spend.kid)}>{parent ? "Spend points" : "A parent must unlock this"}</button>
            </div>
          </section>
          <section className="panel">
            <h2>History</h2>
            {log.length === 0 ? <p className="empty-note">Nothing yet. Tick off a chore to earn the first points.</p> : (
              <div className="table-wrap" style={{ maxHeight: 420 }}>
                <table className="t">
                  <tbody>
                    {[...log].reverse().slice(0, 60).map(e => (
                      <tr key={e.id}>
                        <td className="num note">{e.date.slice(5)}</td>
                        <td>{kids.find(k => k.id === e.kid)?.name}</td>
                        <td>{e.kind === "chore" ? choreName(e.what) : e.what}</td>
                        <td className="r" style={{ color: e.kind === "spend" ? "var(--bad)" : "var(--good)" }}>{e.kind === "spend" ? "-" : "+"}{e.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "setup" && !parent && (
        <section className="panel" style={{ maxWidth: 420 }}>
          <h2>Parents only</h2>
          <form className="row" onSubmit={e => { e.preventDefault(); if (pinTry === pin) { setUnlocked(true); setPinTry(""); } }}>
            <label className="field"><span>PIN</span><input id="ch-pin-try" className="input" type="password" inputMode="numeric" value={pinTry} onChange={e => setPinTry(e.target.value)} /></label>
            <button className="btn primary" type="submit">Unlock</button>
          </form>
          {pinTry.length >= pin.length && pinTry !== pin && <p className="pill bad" style={{ marginTop: 10 }}>That PIN is not right.</p>}
        </section>
      )}

      {tab === "setup" && parent && (
        <div className="grid2">
          <section className="panel">
            <h2>Chores</h2>
            <div className="stack" style={{ gap: 10 }}>
              {chores.map(c => (
                <div key={c.id} className="ch-chore">
                  <input id={`ch-cn-${c.id}`} className="input" value={c.name} aria-label="Chore name" onChange={e => setChores(chores.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} />
                  <input id={`ch-cp-${c.id}`} className="input num" style={{ width: 70 }} inputMode="numeric" value={c.points} aria-label="Points" onChange={e => setChores(chores.map(x => x.id === c.id ? { ...x, points: Math.max(0, parseInt(e.target.value) || 0) } : x))} />
                  <select id={`ch-ce-${c.id}`} className="input" style={{ width: 110 }} value={c.every} aria-label="How often" onChange={e => setChores(chores.map(x => x.id === c.id ? { ...x, every: e.target.value as Chore["every"] } : x))}><option value="day">Daily</option><option value="week">Weekly</option></select>
                  <div className="row" style={{ gap: 6 }}>
                    {kids.map(k => (
                      <label key={k.id} className="check note"><input type="checkbox" checked={c.kids.includes(k.id)} onChange={e => setChores(chores.map(x => x.id === c.id ? { ...x, kids: e.target.checked ? [...x.kids, k.id] : x.kids.filter(i => i !== k.id) } : x))} />{k.name}</label>
                    ))}
                    <button className="btn ghost small danger" onClick={() => setChores(chores.filter(x => x.id !== c.id))}>Remove</button>
                  </div>
                </div>
              ))}
              <form className="row" onSubmit={e => { e.preventDefault(); if (!draft.name.trim()) return; setChores([...chores, { id: uid(), name: draft.name.trim(), points: parseInt(draft.points) || 0, every: draft.every, kids: kids.map(k => k.id) }]); setDraft({ ...draft, name: "" }); }}>
                <label className="field" style={{ flexGrow: 3 }}><span>New chore</span><input id="ch-new" className="input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Water the plants" /></label>
                <label className="field" style={{ flexBasis: 70 }}><span>Points</span><input id="ch-new-p" className="input num" value={draft.points} onChange={e => setDraft({ ...draft, points: e.target.value })} /></label>
                <label className="field" style={{ flexBasis: 100 }}><span>Often</span><select id="ch-new-e" className="input" value={draft.every} onChange={e => setDraft({ ...draft, every: e.target.value as Chore["every"] })}><option value="day">Daily</option><option value="week">Weekly</option></select></label>
                <button className="btn small" type="submit">Add</button>
              </form>
            </div>
          </section>

          <div className="stack">
            <section className="panel">
              <h2>What points are worth</h2>
              <div className="row">
                <label className="field"><span>100 points =</span><input id="ch-m" className="input num" inputMode="decimal" value={moneyPer100} onChange={e => setMoneyPer100(Math.max(0, parseFloat(e.target.value) || 0))} /></label>
                <label className="field" style={{ flexBasis: 90 }}><span>Currency</span><select id="ch-cur" className="input" value={currency} onChange={e => setCurrency(e.target.value)}>{["TND", "EUR", "USD", "GBP", "MAD", "DZD", "CAD", "AED"].map(c => <option key={c}>{c}</option>)}</select></label>
                <label className="field"><span>or minutes of screen</span><input id="ch-min" className="input num" inputMode="numeric" value={minutesPer100} onChange={e => setMinutesPer100(Math.max(0, parseInt(e.target.value) || 0))} /></label>
              </div>
            </section>
            <section className="panel">
              <h2>Kids</h2>
              <div className="stack" style={{ gap: 8 }}>
                {kids.map(k => (
                  <div key={k.id} className="row" style={{ alignItems: "center" }}>
                    <input id={`ch-k-${k.id}`} className="input" style={{ flex: 1 }} value={k.name} aria-label="Name" onChange={e => setKids(kids.map(x => x.id === k.id ? { ...x, name: e.target.value } : x))} />
                    <div className="row" style={{ gap: 4 }}>{COLORS.map(c => <button key={c} className="ch-swatch" aria-label="Colour" aria-pressed={k.color === c} style={{ background: c }} onClick={() => setKids(kids.map(x => x.id === k.id ? { ...x, color: c } : x))} />)}</div>
                    {kids.length > 1 && <button className="btn ghost small danger" onClick={() => setKids(kids.filter(x => x.id !== k.id))}>Remove</button>}
                  </div>
                ))}
                <div><button className="btn small" onClick={() => setKids([...kids, { id: uid(), name: `Child ${kids.length + 1}`, color: COLORS[kids.length % COLORS.length] }])}>Add a child</button></div>
              </div>
            </section>
            <section className="panel">
              <h2>Parent PIN</h2>
              <p className="note" style={{ marginBottom: 10 }}>Stops kids changing points or spending without you. It only protects this device.</p>
              <label className="field"><span>{pin ? "Change PIN (leave empty to remove)" : "Set a PIN"}</span><input id="ch-pin" className="input" type="password" inputMode="numeric" value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setUnlocked(true); }} /></label>
            </section>
          </div>
        </div>
      )}
      <style>{`
        .ch-kids{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
        .ch-kid{padding-top:16px}
        .ch-bal{font-family:var(--serif);font-size:54px;line-height:1;margin:6px 0}
        .ch-bal small{font-family:var(--mono);font-size:12px;color:var(--muted);margin-left:8px;letter-spacing:.06em;text-transform:uppercase}
        .ch-grid th,.ch-grid td{text-align:center}.ch-grid th:first-child,.ch-grid td:first-child{text-align:left}
        .ch-grid .today{background:color-mix(in srgb,var(--accent) 8%,transparent)}
        .ch-box{width:34px;height:34px;border-radius:9px;border:2px solid var(--line);background:var(--surface);color:#fff;font-size:18px;font-weight:700;cursor:pointer}
        .ch-box:disabled{opacity:.35;cursor:not-allowed}
        .ch-box.wide{width:auto;padding:0 14px;font-size:14px;color:var(--ink)}.ch-box.wide.done{color:#fff}
        .ch-chore{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--line)}
        .ch-chore .row{grid-column:1/-1}
        .ch-swatch{width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer}
        .ch-swatch[aria-pressed="true"]{border-color:var(--ink)}
      `}</style>
    </div>
  );
}
