import { CGU } from "@/content/cgu";

export const metadata = { title: "Conditions générales · Le Cercle des Allocations" };

/** Conversion minimale du Markdown des CGU (titres, listes, gras, paragraphes). */
function render(md: string) {
  const inline = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p);
  const out: React.ReactNode[] = []; let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  for (const raw of md.split("\n")) {
    const l = raw.trimEnd();
    if (/^[-*] /.test(l)) { list.push(l.slice(2)); continue; }
    flush();
    if (!l.trim() || /^---+$/.test(l)) continue;
    const h = l.match(/^(#{1,4}) (.*)/);
    if (h) { const T = (["h1", "h2", "h3", "h3"] as const)[h[1].length - 1]; out.push(<T key={out.length}>{inline(h[2])}</T>); }
    else out.push(<p key={out.length}>{inline(l)}</p>);
  }
  flush();
  return out;
}

export default function Cgu() {
  return <article className="card" style={{ gap: 10 }}>{render(CGU)}</article>;
}
