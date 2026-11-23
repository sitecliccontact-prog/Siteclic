import type { CSSProperties } from "react";
import type { SiteContent } from "@/lib/site/schema";
import { THEMES } from "./themes";

/** Affiche le site d'un client à partir de son contenu. */
export function SiteRenderer({ content }: { content: SiteContent }) {
  const t = THEMES[content.theme] ?? THEMES.bistrot;
  const c = t.colors;
  const style = {
    "--bg": c.bg, "--surface": c.surface, "--ink": c.ink, "--muted": c.muted, "--line": c.line,
    "--accent": c.accent, "--on-accent": c.onAccent, "--band": c.band, "--on-band": c.onBand,
    "--display": t.display, "--body": t.body,
    "--dw": t.displayWeight, "--dt": t.displayTracking,
    background: c.bg, color: c.ink, fontFamily: `${t.body}, system-ui, sans-serif`,
  } as CSSProperties;

  const { brand, hero, about, highlights, offer, hours, contact, closing } = content;
  const photos = (content.photos ?? []).filter((u) => /^https?:\/\//.test(u));
  const heroPhoto = photos[0];
  const gallery = photos.slice(1, 7);
  const phoneHref = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : undefined;
  const ctaHref = phoneHref ?? "#infos";
  const mapsHref = contact.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${brand.name} ${contact.address}`)}`
    : undefined;
  const initial = brand.name.trim().charAt(0).toUpperCase();
  const hasOffer = offer.categories.some((cat) => cat.items.length > 0);
  const hasInfos = hours.length > 0 || contact.address || contact.phone || contact.email;

  return (
    <div className={`site ${t.fontClasses}`} style={style}>
      <style>{SITE_CSS}</style>

      {/* Navigation */}
      <header className="s-nav">
        <a href="#top" className="s-brand">{brand.name}</a>
        <nav className="s-links">
          <a href="#histoire">À propos</a>
          {hasOffer && <a href="#offre">{shortTitle(offer.title)}</a>}
          {hasInfos && <a href="#infos">Infos</a>}
        </nav>
        <a href={ctaHref} className="s-btn s-btn-sm">{hero.cta}</a>
      </header>

      {/* Accroche */}
      <section id="top" className="s-hero">
        <div className="s-wrap s-hero-grid">
          <div>
            {hero.eyebrow && <p className="s-eyebrow">{hero.eyebrow}</p>}
            <h1 className="s-display s-h1">{hero.title}</h1>
            <p className="s-lead">{hero.subtitle}</p>
            <div className="s-actions">
              <a href={ctaHref} className="s-btn">{hero.cta}</a>
              {hasOffer && <a href="#offre" className="s-btn s-btn-ghost">Découvrir {lowerFirst(shortTitle(offer.title))}</a>}
            </div>
          </div>
          {heroPhoto ? (
            <div className="s-mark s-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPhoto} alt="" referrerPolicy="no-referrer" />
              <i />
              <p>{brand.tagline}</p>
            </div>
          ) : (
            <div className="s-mark" aria-hidden>
              <span className="s-display">{initial}</span>
              <i />
              <p>{brand.tagline}</p>
            </div>
          )}
        </div>
      </section>

      {/* Points forts */}
      {highlights.length > 0 && (
        <section className="s-highlights">
          <div className="s-wrap s-grid3">
            {highlights.slice(0, 3).map((h, i) => (
              <div key={i} className="s-highlight">
                <span className="s-num">0{i + 1}</span>
                <h3 className="s-display">{h.title}</h3>
                <p>{h.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Galerie */}
      {gallery.length > 0 && (
        <section className="s-gallery">
          <div className="s-wrap s-gallery-grid">
            {gallery.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ))}
          </div>
        </section>
      )}

      {/* Histoire */}
      <section id="histoire" className="s-section">
        <div className="s-wrap s-about">
          <h2 className="s-display s-h2">{about.title}</h2>
          <div className="s-prose">
            {about.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </section>

      {/* Offre */}
      {hasOffer && (
        <section id="offre" className="s-section s-surface">
          <div className="s-wrap">
            <div className="s-head">
              <h2 className="s-display s-h2">{offer.title}</h2>
              {offer.intro && <p className="s-lead">{offer.intro}</p>}
            </div>
            <div className="s-menu">
              {offer.categories.filter((cat) => cat.items.length).map((cat, i) => (
                <div key={i} className="s-cat">
                  <h3 className="s-cat-title">{cat.name}</h3>
                  <ul>
                    {cat.items.map((it, j) => (
                      <li key={j}>
                        <div className="s-item-row">
                          <span className="s-item-name">{it.name}</span>
                          {it.price && <><span className="s-dots" /><span className="s-price">{it.price}</span></>}
                        </div>
                        {it.description && <p className="s-item-desc">{it.description}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Horaires et contact */}
      {hasInfos && (
        <section id="infos" className="s-section">
          <div className="s-wrap s-infos">
            {hours.length > 0 && (
              <div className="s-card">
                <p className="s-eyebrow">Horaires</p>
                <dl>
                  {hours.map((h, i) => (
                    <div key={i} className="s-hours-row"><dt>{h.days}</dt><dd>{h.time}</dd></div>
                  ))}
                </dl>
              </div>
            )}
            <div className="s-card">
              <p className="s-eyebrow">Nous trouver</p>
              {contact.address && <p className="s-contact-big s-display">{contact.address}</p>}
              <div className="s-contact-links">
                {phoneHref && <a href={phoneHref}>{contact.phone}</a>}
                {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                {mapsHref && <a href={mapsHref} target="_blank" rel="noreferrer">Itinéraire →</a>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Invitation finale */}
      <section className="s-band">
        <div className="s-wrap s-band-inner">
          <h2 className="s-display s-h2">{closing.title}</h2>
          <p>{closing.text}</p>
          <a href={ctaHref} className="s-btn s-btn-inv">{hero.cta}</a>
        </div>
      </section>

      <footer className="s-footer">
        <div className="s-wrap s-footer-inner">
          <span className="s-display s-brand">{brand.name}</span>
          <span>{[contact.address, contact.phone].filter(Boolean).join(" · ")}</span>
        </div>
      </footer>
    </div>
  );
}

function shortTitle(s: string) {
  return s.length > 22 ? "Notre offre" : s;
}
function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const SITE_CSS = `
.site{container-type:inline-size;--pad:clamp(20px,5cqi,56px);min-height:100%;-webkit-font-smoothing:antialiased;line-height:1.6}
.site *{box-sizing:border-box}
.site a{color:inherit;text-decoration:none}
.site .s-wrap{max-width:1180px;margin:0 auto;padding:0 var(--pad)}
.site .s-display{font-family:var(--display),Georgia,serif;font-weight:var(--dw);letter-spacing:var(--dt);line-height:1.02}
.site .s-nav{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:24px;padding:16px var(--pad);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.site .s-brand{font-family:var(--display),serif;font-weight:var(--dw);font-size:22px;letter-spacing:var(--dt);margin-right:auto}
.site .s-links{display:none;gap:28px;font-size:14px;color:var(--muted)}
.site .s-links a:hover{color:var(--ink)}
@container (min-width:820px){.site .s-links{display:flex}}
.site .s-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:600;padding:15px 26px;font-size:15px;transition:transform .2s,filter .2s;white-space:nowrap}
.site .s-btn:hover{transform:translateY(-1px);filter:brightness(1.06)}
.site .s-btn-sm{padding:10px 18px;font-size:13px}
.site .s-btn-ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.site .s-btn-inv{background:var(--on-band);color:var(--band)}
.site .s-eyebrow{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);font-weight:600;margin:0 0 18px}
.site .s-hero{padding:clamp(56px,10cqi,128px) 0 clamp(56px,8cqi,104px)}
.site .s-hero-grid{display:grid;gap:56px;align-items:center}
@container (min-width:900px){.site .s-hero-grid{grid-template-columns:1.35fr .9fr}.site .s-mark{aspect-ratio:4/5}}
.site .s-h1{font-size:clamp(44px,8.4cqi,104px);margin:0}
.site .s-lead{font-size:clamp(17px,1.6cqi,20px);color:var(--muted);max-width:56ch;margin:24px 0 0}
.site .s-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:36px}
.site .s-mark{position:relative;aspect-ratio:4/3;max-height:560px;border-radius:28px;background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;justify-content:flex-end;padding:32px;overflow:hidden}
.site .s-mark span{position:absolute;inset:0 0 22% 0;display:grid;place-items:center;font-size:clamp(150px,17cqi,280px);line-height:1;color:var(--accent)}
.site .s-mark i{display:block;width:48px;height:2px;background:var(--accent);margin-bottom:16px;position:relative}
.site .s-mark p{position:relative;font-family:var(--display),serif;font-size:clamp(22px,2.4cqi,30px);line-height:1.15;margin:0;max-width:16ch;font-style:italic}
.site .s-photo{padding:0;justify-content:flex-end}
.site .s-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site .s-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.6),transparent 55%)}
.site .s-photo i,.site .s-photo p{z-index:1;margin-left:32px;color:#fff}
.site .s-photo p{margin-bottom:32px}
.site .s-photo i{background:#fff}
.site .s-gallery{padding:clamp(40px,6cqi,72px) 0 0}
.site .s-gallery-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@container (min-width:820px){.site .s-gallery-grid{grid-template-columns:repeat(3,1fr);gap:16px}}
.site .s-gallery-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:20px;display:block}
.site .s-highlights{border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.site .s-grid3{display:grid;gap:0}
@container (min-width:820px){.site .s-grid3{grid-template-columns:repeat(3,1fr)}}
.site .s-highlight{padding:40px 0;border-bottom:1px solid var(--line)}
.site .s-highlight:last-child{border-bottom:0}
@container (min-width:820px){.site .s-highlight{padding:48px 36px;border-bottom:0;border-right:1px solid var(--line)}.site .s-highlight:first-child{padding-left:0}.site .s-highlight:last-child{border-right:0}}
.site .s-num{font-size:13px;color:var(--accent);font-weight:600;letter-spacing:.1em}
.site .s-highlight h3{font-size:clamp(24px,2.4cqi,30px);margin:14px 0 10px}
.site .s-highlight p{color:var(--muted);margin:0}
.site .s-section{padding:clamp(72px,10cqi,128px) 0}
.site .s-surface{background:var(--surface)}
.site .s-h2{font-size:clamp(36px,5.4cqi,64px);margin:0}
.site .s-about{display:grid;gap:32px}
@container (min-width:900px){.site .s-about{grid-template-columns:1fr 1.2fr;gap:80px}}
.site .s-prose p{font-size:clamp(17px,1.5cqi,19px);margin:0 0 20px;max-width:60ch}
.site .s-prose p:first-child::first-letter{font-family:var(--display),serif;float:left;font-size:3.4em;line-height:.85;padding:6px 10px 0 0;color:var(--accent)}
.site .s-head{max-width:720px;margin-bottom:56px}
.site .s-menu{display:grid;gap:48px}
@container (min-width:900px){.site .s-menu{grid-template-columns:1fr 1fr;gap:56px 80px}}
.site .s-cat-title{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);font-weight:600;margin:0 0 8px;padding-bottom:14px;border-bottom:1px solid var(--line)}
.site .s-cat ul{list-style:none;margin:0;padding:0}
.site .s-cat li{padding:18px 0;border-bottom:1px solid var(--line)}
.site .s-item-row{display:flex;align-items:baseline;gap:12px}
.site .s-item-name{font-family:var(--display),serif;font-size:21px;font-weight:var(--dw);letter-spacing:var(--dt)}
.site .s-dots{flex:1;border-bottom:1px dotted var(--muted);opacity:.5;transform:translateY(-4px)}
.site .s-price{font-weight:600;white-space:nowrap}
.site .s-item-desc{color:var(--muted);margin:6px 0 0;font-size:15px}
.site .s-infos{display:grid;gap:20px}
@container (min-width:820px){.site .s-infos{grid-template-columns:1fr 1fr}}
.site .s-card{background:var(--surface);border:1px solid var(--line);border-radius:28px;padding:clamp(28px,4cqi,44px)}
.site .s-card dl{margin:0}
.site .s-hours-row{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}
.site .s-hours-row:last-child{border-bottom:0}
.site .s-hours-row dt{font-weight:600}
.site .s-hours-row dd{margin:0;color:var(--muted);text-align:right}
.site .s-contact-big{font-size:clamp(26px,3cqi,36px);margin:0 0 24px}
.site .s-contact-links{display:flex;flex-direction:column;gap:10px}
.site .s-contact-links a{color:var(--ink);border-bottom:1px solid var(--line);padding-bottom:10px}
.site .s-contact-links a:hover{color:var(--accent)}
.site .s-band{background:var(--band);color:var(--on-band);padding:clamp(80px,11cqi,140px) 0;text-align:center}
.site .s-band-inner{display:flex;flex-direction:column;align-items:center}
.site .s-band p{max-width:52ch;opacity:.75;font-size:18px;margin:20px 0 36px}
.site .s-footer{padding:36px 0;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
.site .s-footer-inner{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center}
.site .s-footer .s-brand{color:var(--ink);margin:0}
`;
