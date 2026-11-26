import type { CSSProperties } from "react";
import { bookingEnabled, priceCents, socialUrl, specialIsFresh, type SiteContent } from "@/lib/site/schema";
import { AssistantWidget, AutoFilm, BookingDialog, SiteMotion, SiteVideo } from "./SiteClient";
import { GiftDialog, OrderDialog, VisitBeacon, type MenuItem } from "./SiteShop";
import { THEMES } from "./themes";
import { applyLook, isDark, isHex, reliefCss } from "@/lib/site/colors";
import { siteFloor } from "@/lib/site/floor";
import { tr, type Lang } from "@/lib/site/i18n";

/** Garantie de réservation affichée au visiteur (seulement si le restaurant a relié son compte Stripe). */
function guaranteeOf(c: SiteContent) {
  const p = c.booking?.pay;
  return p && p.mode !== "aucun" && p.account && p.perPerson > 0 ? { mode: p.mode, perPerson: p.perPerson } : null;
}

/** Affiche le site d'un client à partir de son contenu. */
export function SiteRenderer({ content, credit = false, slug, siteId, lang = "fr" }: { content: SiteContent; credit?: boolean; slug?: string; siteId?: string; lang?: Lang }) {
  const T = (fr: string) => tr(lang, fr);
  const t = THEMES[content.theme] ?? THEMES.bistrot;
  const c = applyLook(t.colors, content.look);
  const accent2 = isHex(content.look?.accent2) ? content.look.accent2 : "";
  const relief = content.look?.relief ?? "aucun";
  const style = {
    "--accent2": accent2 || c.accent,
    "--btn-bg": accent2 ? `linear-gradient(120deg, ${c.accent}, ${accent2})` : c.accent,
    "--bg": c.bg, "--surface": c.surface, "--ink": c.ink, "--muted": c.muted, "--line": c.line,
    "--accent": c.accent, "--on-accent": c.onAccent, "--band": c.band, "--on-band": c.onBand,
    "--display": t.display, "--body": t.body,
    "--dw": t.displayWeight, "--dt": t.displayTracking,
    "--radius": t.radius, "--btn-radius": t.btnRadius,
    backgroundColor: c.bg, color: c.ink, fontFamily: `${t.body}, system-ui, sans-serif`,
  } as CSSProperties;

  const { brand, hero, about, highlights, offer, hours, contact, closing } = content;
  const photos = (content.photos ?? []).filter((u) => /^https?:\/\//.test(u));
  const heroPhoto = photos[0];
  const aboutPhoto = photos[1];
  const gallery = photos.slice(aboutPhoto ? 2 : 1, 8);
  const phoneHref = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : undefined;
  const booking = bookingEnabled(content);
  const ctaHref = booking ? "#reserver" : phoneHref ?? "#infos";
  const special = specialIsFresh(content) ? content.special : null;
  const instagram = socialUrl("instagram", content.links?.instagram);
  const facebook = socialUrl("facebook", content.links?.facebook);
  const query = encodeURIComponent(`${brand.name} ${contact.address}`);
  const mapsHref = contact.address ? `https://www.google.com/maps/search/?api=1&query=${query}` : undefined;
  const mapEmbed = contact.address ? `https://www.google.com/maps?q=${query}&output=embed` : undefined;
  const cats = offer.categories.filter((cat) => cat.items.length);
  const hasOffer = cats.length > 0;
  const hasInfos = hours.length > 0 || contact.address || contact.phone || contact.email;
  // Commande à emporter : les plats de la carte qui ont un prix.
  const menuItems: MenuItem[] = offer.categories.flatMap((cat, ci) => cat.items.flatMap((it, ii) => {
    const price = priceCents(it.price);
    return price ? [{ key: `${ci}-${ii}`, cat: cat.name, name: it.name, price }] : [];
  }));
  const ordering = Boolean(content.order?.enabled && menuItems.length);
  const orderOnline = Boolean(content.order?.online && content.order?.account);
  const gift = content.gift?.enabled && content.gift.account ? content.gift : null;
  const reviews = content.reviews && (content.reviews.items.length || content.reviews.googleUrl) ? content.reviews : null;
  const hasEn = Boolean(content.translations?.en);
  const cls = [
    "site", t.fontClasses,
    t.btnCaps ? "is-caps" : "", t.ornament ? "is-orn" : "",
    t.heroAlign === "center" ? "is-center" : "is-left",
    heroPhoto ? "has-photo" : "no-photo",
    relief !== "aucun" ? `rl rl-${relief}` : "",
    isDark(c.bg) ? "is-dark" : "is-light",
    accent2 ? "has-grad" : "",
  ].join(" ");

  const ornament = t.ornament ? (
    <span className="s-orn" aria-hidden><i /><b /><i /></span>
  ) : null;

  return (
    <div className={cls} style={style}>
      <style>{SITE_CSS}</style>
      {relief !== "aucun" && <style>{reliefCss(relief, content.look?.custom)}</style>}

      {/* Navigation */}
      <header className="s-nav">
        <a href="#top" className="s-brand">{brand.name}</a>
        <nav className="s-links">
          <a href="#maison">{T("La maison")}</a>
          {hasOffer && <a href="#offre">{shortTitle(offer.title)}</a>}
          {hasInfos && <a href="#infos">{T("Infos pratiques")}</a>}
        </nav>
        {hasEn && slug && (
          <a href={lang === "en" ? `/s/${slug}` : `/s/${slug}/en`} className="s-lang" hrefLang={lang === "en" ? "fr" : "en"}>{lang === "en" ? "FR" : "EN"}</a>
        )}
        <a href={ctaHref} className="s-btn s-btn-line s-btn-sm">{hero.cta}</a>
      </header>

      {/* Accroche */}
      {heroPhoto ? (
        <section id="top" className="s-hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroPhoto} alt="" referrerPolicy="no-referrer" fetchPriority="high" />
          <div className="s-hero-shade" />
          <div className="s-wrap s-hero-photo-inner">
            {hero.eyebrow && <p className="s-eyebrow s-on-photo">{hero.eyebrow}</p>}
            <h1 className="s-display s-h1">{hero.title}</h1>
            <div className="s-hero-foot">
              <p className="s-lead">{hero.subtitle}</p>
              <a href={ctaHref} className="s-btn">{hero.cta}</a>
            </div>
          </div>
        </section>
      ) : (
        <section id="top" className="s-hero">
          <div className="s-wrap">
            {hero.eyebrow && <p className="s-eyebrow s-rise">{hero.eyebrow}</p>}
            {ornament}
            <h1 className="s-display s-h1 s-rise">{hero.title}</h1>
            <div className="s-hero-foot s-rise">
              <p className="s-lead">{hero.subtitle}</p>
              <div className="s-actions">
                <a href={ctaHref} className="s-btn">{hero.cta}</a>
                {hasOffer && <a href="#offre" className="s-link">{linkLabel(offer.title)}</a>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Bandeau d'informations essentielles */}
      {(contact.address || hours.length > 0 || contact.phone) && (
        <div className="s-strip">
          <div className="s-wrap s-strip-grid">
            {contact.address && (
              <a href={mapsHref} target="_blank" rel="noreferrer" className="s-strip-item">
                <span>{T("Adresse")}</span>{contact.address}
              </a>
            )}
            {hours.length > 0 && (
              <a href="#infos" className="s-strip-item">
                <span>{T("Horaires")}</span>{hours[0].days} · {hours[0].time}
              </a>
            )}
            {contact.phone && (
              <a href={phoneHref} className="s-strip-item">
                <span>{T("Téléphone")}</span>{contact.phone}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Menu du jour */}
      {special && (
        <section className="s-special" id="menu-du-jour" aria-label={special.title}>
          <div className="s-wrap">
            <div className="s-special-card" data-r>
              <div className="s-special-head">
                <p className="s-eyebrow"><i className="s-live" aria-hidden />{T("Aujourd'hui")} · {dayLabel(special.date)}</p>
                <h2 className="s-display s-special-title">{special.title}</h2>
              </div>
              <div className="s-special-text">
                {special.text.split(/\n+/).filter((l) => l.trim()).map((l, i) => <p key={i}>{l}</p>)}
              </div>
              {booking && <a href="#reserver" className="s-link">{T("Réserver une table")}</a>}
            </div>
          </div>
        </section>
      )}

      {/* La maison */}
      <section id="maison" className="s-section">
        <div className={`s-wrap s-about ${aboutPhoto ? "with-photo" : ""}`}>
          <div className="s-about-head" data-r>
            <p className="s-eyebrow">{T("La maison")}</p>
            <h2 className="s-display s-h2">{about.title}</h2>
            {aboutPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={aboutPhoto} alt="" loading="lazy" referrerPolicy="no-referrer" className="s-about-img" data-r />
            )}
          </div>
          <div className="s-prose" data-r>
            {about.paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? "s-display s-lede" : ""}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Vidéo de présentation */}
      {content.video?.enabled && (
        <section className="s-film" aria-label="Vidéo de présentation">
          <div className="s-wrap">
            <p className="s-eyebrow s-film-eyebrow" data-r>{T("En images")}</p>
            <div data-r>
              {content.video.url ? (
                <SiteVideo src={content.video.url} />
              ) : (
                <AutoFilm photos={photos} clips={content.video.clips ?? []} brand={brand.name}
                  sign={hero.eyebrow || contact.address.split(",").at(-1)?.trim() || ""}
                  lines={[hero.title, ...highlights.map((h) => h.title), about.title].filter(Boolean).slice(0, 5)} />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Ce qui nous distingue */}
      {highlights.length > 0 && (
        <section className="s-values">
          <div className="s-marquee" aria-hidden>
            <div className="s-marquee-track">
              {[0, 1].map((k) => (
                <span key={k}>
                  {highlights.map((h, i) => (
                    <span key={i} className="s-display">{h.title}<em>✦</em></span>
                  ))}
                  {highlights.map((h, i) => (
                    <span key={`b${i}`} className="s-display">{h.title}<em>✦</em></span>
                  ))}
                </span>
              ))}
            </div>
          </div>
          <div className="s-wrap s-values-list">
            {highlights.slice(0, 4).map((h, i) => (
              <div key={i} className="s-value" data-r style={{ "--d": `${i * 90}ms` } as CSSProperties}>
                <h3 className="s-display">{h.title}</h3>
                <p>{h.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Galerie */}
      {gallery.length > 0 && (
        <section className="s-gallery" aria-label="Photos">
          <div className={`s-gallery-grid n${Math.min(gallery.length, 6)}`}>
            {gallery.slice(0, 6).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" data-r style={{ "--d": `${(i % 3) * 110}ms` } as CSSProperties} />
            ))}
          </div>
        </section>
      )}

      {/* Offre */}
      {hasOffer && (
        <section id="offre" className="s-section s-surface">
          <div className="s-wrap">
            <div className="s-head" data-r>
              {ornament}
              <h2 className="s-display s-h2">{offer.title}</h2>
              {offer.intro && <p className="s-lead">{offer.intro}</p>}
            </div>
            <div className={`s-menu ${cats.length === 1 ? "single" : ""}`}>
              {cats.map((cat, i) => (
                <div key={i} className="s-cat" data-r style={{ "--d": `${i * 120}ms` } as CSSProperties}>
                  <h3 className="s-cat-title">{cat.name}</h3>
                  <ul>
                    {cat.items.map((it, j) => (
                      <li key={j}>
                        <div className="s-item-row">
                          <span className="s-item-name s-display">{it.name}</span>
                          {it.price && <><span className="s-dots" /><span className="s-price">{it.price}</span></>}
                        </div>
                        {it.description && <p className="s-item-desc">{it.description}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {ordering && (
              <div className="s-order-cta" data-r>
                <a href="#commander" className="s-btn">{T("Commander à emporter")}</a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Avis clients */}
      {reviews && (
        <section className="s-section s-reviews" aria-label={T("Ils en parlent")}>
          <div className="s-wrap">
            <div className="s-head" data-r>
              {ornament}
              <h2 className="s-display s-h2">{T("Ils en parlent")}</h2>
            </div>
            {reviews.items.length > 0 && (
              <div className="s-review-grid">
                {reviews.items.map((r, i) => (
                  <figure key={i} className="s-review" data-r style={{ "--d": `${i * 90}ms` } as CSSProperties}>
                    <span className="s-stars" aria-label={`${r.stars} sur 5`}>{"★".repeat(r.stars)}<i>{"★".repeat(5 - r.stars)}</i></span>
                    <blockquote className="s-display">« {r.text} »</blockquote>
                    <figcaption>{r.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}
            {reviews.googleUrl && /^https:\/\//.test(reviews.googleUrl) && (
              <div className="s-order-cta"><a href={reviews.googleUrl} target="_blank" rel="noreferrer" className="s-link">{T("Laisser un avis Google")}</a></div>
            )}
          </div>
        </section>
      )}

      {/* Infos pratiques */}
      {hasInfos && (
        <section id="infos" className="s-section">
          <div className="s-wrap">
            <div className="s-head s-head-left" data-r>
              <p className="s-eyebrow">{T("Infos pratiques")}</p>
              <h2 className="s-display s-h2">{T("Venir nous voir")}</h2>
            </div>
            <div className="s-infos" data-r>
              {hours.length > 0 && (
                <div className="s-info">
                  <h3 className="s-info-title">{T("Horaires")}</h3>
                  <dl>
                    {hours.map((h, i) => (
                      <div key={i} className="s-hours-row">
                        <dt>{h.days}</dt>
                        <dd className={/ferm/i.test(h.time) ? "closed" : ""}>{h.time}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {contact.address && (
                <div className="s-info">
                  <h3 className="s-info-title">{T("Adresse")}</h3>
                  <p className="s-info-big s-display">{contact.address}</p>
                  {mapsHref && <a href={mapsHref} target="_blank" rel="noreferrer" className="s-link">{T("Itinéraire")}</a>}
                </div>
              )}
              {(contact.phone || contact.email) && (
                <div className="s-info">
                  <h3 className="s-info-title">{T("Contact")}</h3>
                  {contact.phone && <a href={phoneHref} className="s-info-big s-display">{contact.phone}</a>}
                  {contact.email && <a href={`mailto:${contact.email}`} className="s-info-mail">{contact.email}</a>}
                </div>
              )}
            </div>
            {mapEmbed && (
              <div className="s-map" data-r>
                <span>{contact.address}</span>
                <iframe src={mapEmbed} title={`Plan d'accès : ${brand.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Invitation finale */}
      <section className="s-band">
        <div className="s-wrap s-band-inner" data-r>
          {ornament}
          <h2 className="s-display s-h2">{closing.title}</h2>
          {closing.text && <p>{closing.text}</p>}
          <a href={ctaHref} className="s-btn s-btn-inv">{hero.cta}</a>
          {gift && <a href="#cadeau" className="s-link s-gift-link">{T("Offrir une carte cadeau")}</a>}
        </div>
      </section>

      <footer className="s-footer">
        <div className="s-wrap">
          <p className="s-wordmark s-display">{brand.name}</p>
          <div className="s-footer-row">
            <span>{brand.tagline}</span>
            <span>{[contact.address, contact.phone].filter(Boolean).join(" · ")}</span>
          </div>
          {(instagram || facebook) && (
            <div className="s-social">
              {instagram && <a href={instagram} target="_blank" rel="noreferrer" className="s-link">Instagram</a>}
              {facebook && <a href={facebook} target="_blank" rel="noreferrer" className="s-link">Facebook</a>}
            </div>
          )}
          {credit && (
            <p className="s-credit">
              <a href="https://siteclic.vercel.app" target="_blank" rel="noopener">Site créé avec SiteClic</a>
            </p>
          )}
        </div>
      </footer>

      {/* Barre d'action sur téléphone */}
      {(booking || phoneHref || mapsHref) && (
        <div className="s-dock">
          {booking && <a href="#reserver" className="s-dock-main">{T("Réserver")}</a>}
          {phoneHref && <a href={phoneHref} className={booking ? "" : "s-dock-main"}>{T("Appeler")}</a>}
          {mapsHref && <a href={mapsHref} target="_blank" rel="noreferrer">{T("Itinéraire")}</a>}
        </div>
      )}

      <SiteMotion />
      <VisitBeacon slug={slug} />
      {ordering && <OrderDialog slug={slug} brand={brand.name} items={menuItems} online={orderOnline} lang={lang} />}
      {gift && <GiftDialog slug={slug} brand={brand.name} amounts={gift.amounts} lang={lang} />}
      {(content.assistant?.enabled || booking) && (
        <AssistantWidget slug={slug} siteId={siteId} brand={brand.name} booking={booking} special={Boolean(special)}
          launcher={content.assistant?.enabled ?? false} voiceKind={content.assistant?.voice ?? "femme"} />
      )}
      {booking && <BookingDialog slug={slug} brand={brand.name} phone={contact.phone} phoneHref={phoneHref}
        floor={siteFloor(content)} guarantee={guaranteeOf(content)} />}
    </div>
  );
}

function dayLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function shortTitle(s: string) {
  return s.length > 22 ? "Notre offre" : s;
}
function linkLabel(title: string) {
  const s = shortTitle(title);
  return `Voir ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
}

const SITE_CSS = `
.site{container-type:inline-size;--pad:clamp(22px,5.5cqi,72px);position:relative;min-height:100%;-webkit-font-smoothing:antialiased;line-height:1.6;font-size:16px;overflow-x:clip}
.site *{box-sizing:border-box}
.site a{color:inherit;text-decoration:none}
.site img{display:block}
.site .s-wrap{max-width:1240px;margin:0 auto;padding:0 var(--pad)}
.site .s-display{font-family:var(--display),Georgia,serif;font-weight:var(--dw);letter-spacing:var(--dt);line-height:1.04}
.site .s-eyebrow{font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--accent);font-weight:600;margin:0 0 22px}

/* Boutons et liens */
.site .s-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;border-radius:var(--btn-radius);background:var(--btn-bg,var(--accent));color:var(--on-accent);font-weight:600;padding:16px 28px;font-size:15px;transition:transform .25s,filter .25s,background .25s,color .25s;white-space:nowrap;border:1px solid var(--accent)}
.site.is-caps .s-btn{text-transform:uppercase;letter-spacing:.16em;font-size:12px;padding:18px 30px}
.site .s-btn:hover{transform:translateY(-1px);filter:brightness(1.07)}
.site .s-btn-sm{padding:10px 18px;font-size:13px}
.site.is-caps .s-btn-sm{padding:11px 18px;font-size:10.5px}
.site .s-btn-line{background:transparent;color:var(--ink);border-color:color-mix(in srgb,var(--ink) 35%,transparent)}
.site .s-btn-line:hover{background:var(--ink);color:var(--bg);filter:none}
.site .s-btn-inv{background:var(--on-band);color:var(--band);border-color:var(--on-band)}
.site .s-link{display:inline-flex;align-items:center;gap:10px;font-weight:600;font-size:15px;border-bottom:1px solid color-mix(in srgb,var(--ink) 35%,transparent);padding-bottom:4px;transition:border-color .25s,color .25s}
.site .s-link::after{content:"→";transition:transform .25s}
.site .s-link:hover{border-color:var(--accent);color:var(--accent)}
.site .s-link:hover::after{transform:translateX(3px)}
.site.is-caps .s-link{text-transform:uppercase;letter-spacing:.16em;font-size:12px}

/* Ornement façon carte de restaurant */
.site .s-orn{display:flex;align-items:center;gap:12px;color:var(--accent);margin:0 0 26px}
.site .s-orn i{display:block;width:44px;height:1px;background:currentColor;opacity:.7}
.site .s-orn b{display:block;width:7px;height:7px;transform:rotate(45deg);border:1px solid currentColor}
.site.is-center .s-hero .s-orn,.site .s-head .s-orn,.site .s-band .s-orn{justify-content:center}

/* Navigation */
.site .s-nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:28px;padding:18px var(--pad);background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.site .s-brand{font-family:var(--display),serif;font-weight:var(--dw);font-size:23px;letter-spacing:var(--dt);line-height:1.1;margin-right:auto}
.site .s-links{display:none;gap:32px;font-size:14px;color:var(--muted)}
.site .s-links a{transition:color .2s}
.site .s-links a:hover{color:var(--ink)}
.site .s-nav .s-btn{display:none}
@container (min-width:860px){.site .s-links{display:flex}.site .s-nav .s-btn{display:inline-flex}}
.site.has-photo .s-nav{position:absolute;left:0;right:0;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;border-bottom-color:rgba(255,255,255,.18);color:#fff}
.site.has-photo .s-nav .s-links{color:rgba(255,255,255,.8)}
.site.has-photo .s-nav .s-btn-line{color:#fff;border-color:rgba(255,255,255,.5)}

/* Accueil sans photo : typographique */
.site .s-hero{padding:clamp(72px,12cqi,168px) 0 clamp(64px,9cqi,128px);position:relative}
.site .s-h1{font-size:clamp(46px,9.6cqi,138px);margin:0;text-wrap:balance}
.site.is-center .s-hero{text-align:center}
.site.is-center .s-hero .s-h1{max-width:15ch;margin:0 auto}
.site.is-left .s-hero .s-h1{max-width:13ch}
.site .s-lead{font-size:clamp(17px,1.55cqi,20px);color:var(--muted);max-width:52ch;margin:0;line-height:1.65}
.site .s-hero-foot{display:flex;flex-direction:column;gap:32px;margin-top:clamp(32px,4.5cqi,56px)}
.site.is-center .s-hero .s-hero-foot{align-items:center}
.site .s-actions{display:flex;flex-wrap:wrap;align-items:center;gap:28px}
.site.is-center .s-hero .s-actions{justify-content:center}
@container (min-width:900px){
  .site.is-left .s-hero .s-hero-foot{flex-direction:row;align-items:flex-end;justify-content:space-between;gap:64px;border-top:1px solid var(--line);padding-top:36px}
}

/* Accueil avec photo : pleine largeur */
.site .s-hero-photo{position:relative;min-height:max(600px,min(62cqi,900px));display:flex;align-items:flex-end;color:#fff;overflow:hidden}
.site .s-hero-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.02);animation:s-zoom 1.6s cubic-bezier(.2,.7,.2,1) both}
.site .s-hero-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,.05) 45%,rgba(0,0,0,.72) 100%)}
.site .s-hero-photo-inner{position:relative;width:100%;padding-top:140px;padding-bottom:clamp(40px,6cqi,80px)}
.site .s-hero-photo .s-h1{max-width:14ch;color:#fff}
.site .s-hero-photo .s-lead{color:rgba(255,255,255,.82)}
.site .s-on-photo{color:rgba(255,255,255,.85)}
.site .s-hero-photo .s-hero-foot{margin-top:28px}
@container (min-width:900px){.site .s-hero-photo .s-hero-foot{flex-direction:row;align-items:flex-end;justify-content:space-between;gap:64px}}
@keyframes s-zoom{from{transform:scale(1.08);opacity:.6}to{transform:scale(1.02);opacity:1}}

/* Bandeau infos */
.site .s-strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.site .s-strip-grid{display:grid}
@container (min-width:760px){.site .s-strip-grid{grid-template-columns:repeat(3,1fr)}}
.site .s-strip-item{display:flex;flex-direction:column;gap:6px;padding:22px 0;font-size:15px;border-bottom:1px solid var(--line);transition:color .2s}
.site .s-strip-item:last-child{border-bottom:0}
.site .s-strip-item:hover{color:var(--accent)}
.site .s-strip-item span{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);font-weight:600}
@container (min-width:760px){.site .s-strip-item{padding:26px 28px;border-bottom:0;border-left:1px solid var(--line)}.site .s-strip-item:first-child{border-left:0;padding-left:0}}

/* Sections */
.site .s-section{padding:clamp(88px,11cqi,160px) 0}
.site .s-surface{background:var(--surface)}
.site .s-h2{font-size:clamp(38px,5.6cqi,76px);margin:0;text-wrap:balance}
.site .s-head{max-width:760px;margin:0 auto clamp(48px,6cqi,80px);text-align:center}
.site .s-head .s-lead{margin:22px auto 0}
.site .s-head-left{text-align:left;margin-left:0}

/* La maison */
.site .s-about{display:grid;gap:40px}
@container (min-width:900px){.site .s-about{grid-template-columns:.9fr 1.1fr;gap:clamp(56px,8cqi,120px);align-items:start}.site .s-about-head{position:sticky;top:110px}}
.site .s-about-img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--radius);margin-top:40px}
.site .s-prose p{font-size:clamp(16.5px,1.4cqi,18px);margin:0 0 22px;max-width:58ch;color:var(--muted)}
.site .s-prose .s-lede{font-size:clamp(25px,2.7cqi,36px);line-height:1.3;color:var(--ink);margin-bottom:36px;letter-spacing:calc(var(--dt) / 2);max-width:none}

/* Valeurs */
.site .s-values{border-top:1px solid var(--line);padding-bottom:clamp(56px,8cqi,112px)}
.site .s-marquee{overflow:hidden;border-bottom:1px solid var(--line);padding:clamp(22px,3cqi,34px) 0;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.site .s-marquee-track{display:flex;width:max-content;animation:s-marquee 38s linear infinite}
.site .s-marquee-track>span{display:flex}
.site .s-marquee .s-display{font-size:clamp(30px,4.4cqi,58px);white-space:nowrap;padding-right:.6em;font-style:italic;display:inline-flex;align-items:center;gap:.6em}
.site .s-marquee em{font-style:normal;font-size:.4em;color:var(--accent)}
@keyframes s-marquee{to{transform:translateX(-50%)}}
.site .s-values-list{display:grid;gap:0;margin-top:clamp(32px,5cqi,64px)}
@container (min-width:860px){.site .s-values-list{grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:48px}}
.site .s-value{padding:26px 0;border-bottom:1px solid var(--line)}
@container (min-width:860px){.site .s-value{border-bottom:0;border-top:1px solid var(--ink);padding:28px 0 0}}
.site .s-value h3{font-size:clamp(23px,2.2cqi,28px);margin:0 0 10px}
.site .s-value p{color:var(--muted);margin:0;max-width:40ch}

/* Galerie */
.site .s-film{padding:0 0 clamp(72px,9cqi,140px)}
.site .s-film .s-wrap{max-width:1240px}
.site .s-film-eyebrow{margin-bottom:18px}
.site .s-film-frame{position:relative;overflow:hidden;border-radius:var(--radius);background:#0b0b0b;aspect-ratio:4/5;isolation:isolate}
@container (min-width:700px){.site .s-film-frame{aspect-ratio:16/9}}
.site .s-film-frame video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site .s-film-sound{position:absolute;right:14px;bottom:14px;width:44px;height:44px;border-radius:999px;display:grid;place-items:center;color:#fff;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(8px);cursor:pointer}
.site .s-af-slide{position:absolute;inset:0;opacity:0;transition:opacity 1.1s ease}
.site .s-af-slide.on{opacity:1;z-index:1}
.site .s-af-slide img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.04);transition:transform 6s linear}
.site .s-af-slide.on img{transform:scale(1.16) translate(-1.5%,-1%)}
.site .s-af-slide:nth-child(even).on img{transform:scale(1.16) translate(1.5%,1%)}
.site .s-af-slide.plain{background:radial-gradient(120% 90% at 20% 10%,color-mix(in srgb,var(--accent) 45%,#111),#0b0b0b 70%)}
.site .s-af-slide.plain:nth-child(even){background:radial-gradient(110% 90% at 85% 85%,color-mix(in srgb,var(--accent) 40%,#111),#0b0b0b 70%)}
.site .s-af-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,.15) 55%,rgba(0,0,0,.72) 100%)}
.site .s-af-slide.end .s-af-shade{background:rgba(0,0,0,.62)}
.site .s-af-cap{position:absolute;left:clamp(18px,4cqi,48px);right:clamp(18px,4cqi,48px);bottom:clamp(22px,5cqi,56px);margin:0;color:#fff;font-size:clamp(26px,5.2cqi,64px);line-height:1.02;letter-spacing:var(--dt);font-weight:var(--dw);max-width:18ch;opacity:0;transform:translateY(18px);transition:opacity .8s ease .35s,transform .9s cubic-bezier(.2,.7,.2,1) .35s;text-wrap:balance}
.site .s-af-slide.on .s-af-cap{opacity:1;transform:none}
.site .s-af-end{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:10px;color:#fff;padding:24px}
.site .s-af-end p{margin:0;font-size:clamp(34px,7cqi,92px);line-height:1;letter-spacing:var(--dt);font-weight:var(--dw);opacity:0;transform:scale(.94);transition:opacity 1s ease .3s,transform 1.4s cubic-bezier(.2,.7,.2,1) .3s}
.site .s-af-end span{font-size:12px;letter-spacing:.24em;text-transform:uppercase;opacity:0;transition:opacity 1s ease .9s}
.site .s-af-slide.on .s-af-end p{opacity:1;transform:none}
.site .s-af-slide.on .s-af-end span{opacity:.8}
.site .s-af-bars{position:absolute;z-index:2;left:14px;right:14px;top:14px;display:flex;gap:6px}
.site .s-af-bars i{flex:1;height:2px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden;position:relative}
.site .s-af-bars i::after{content:"";position:absolute;inset:0;background:#fff;transform-origin:left;transform:scaleX(0)}
.site .s-af-bars i.done::after{transform:scaleX(1)}
.site .s-af-bars i.run::after{animation:s-af-run var(--af-d,4.2s) linear forwards}
.site .s-af-slide video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.02);transition:transform 6s ease-out}
.site .s-af-slide.on video{transform:scale(1.08)}
@keyframes s-af-run{to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.site .s-af-slide img,.site .s-af-slide.on img{transition:none;transform:none}}
.site .s-gallery{padding:0 var(--pad) clamp(88px,11cqi,160px)}
.site .s-gallery-grid{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 calc(var(--pad) * -1);padding:0 var(--pad);scrollbar-width:none}
.site .s-gallery-grid::-webkit-scrollbar{display:none}
.site .s-gallery-grid img{flex:0 0 78%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--radius);scroll-snap-align:center}
@container (min-width:860px){
  .site .s-gallery-grid{display:grid;max-width:1240px;margin:0 auto;padding:0;overflow:visible;grid-template-columns:repeat(4,1fr);grid-auto-rows:clamp(180px,20cqi,300px);gap:16px}
  .site .s-gallery-grid img{width:100%;height:100%;aspect-ratio:auto}
  .site .s-gallery-grid img:first-child{grid-column:span 2;grid-row:span 2}
  .site .s-gallery-grid.n1{grid-template-columns:1fr}.site .s-gallery-grid.n1 img{grid-column:auto;grid-row:span 2}
  .site .s-gallery-grid.n2{grid-template-columns:1.4fr 1fr}.site .s-gallery-grid.n2 img{grid-column:auto;grid-row:span 2}
  .site .s-gallery-grid.n3 img:first-child{grid-column:span 2}.site .s-gallery-grid.n3 img:not(:first-child){grid-column:span 2}
  .site .s-gallery-grid.n4 img:last-child{grid-column:span 2}
  .site .s-gallery-grid.n6 img:nth-child(6){grid-column:span 2}
}

/* Carte / offre */
.site .s-menu{display:grid;gap:56px;max-width:1080px;margin:0 auto}
@container (min-width:900px){.site .s-menu{grid-template-columns:1fr 1fr;gap:72px 96px}.site .s-menu.single{grid-template-columns:1fr;max-width:640px}}
.site .s-cat-title{font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--accent);font-weight:600;margin:0 0 6px;display:flex;align-items:center;gap:16px}
.site .s-cat-title::after{content:"";flex:1;height:1px;background:var(--line)}
.site .s-cat ul{list-style:none;margin:0;padding:0}
.site .s-cat li{padding:20px 0}
.site .s-cat li+li{border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.site .s-item-row{display:flex;align-items:baseline;gap:14px}
.site .s-item-name{font-size:clamp(20px,1.9cqi,23px);line-height:1.25}
.site .s-dots{flex:1;min-width:24px;border-bottom:1px dotted color-mix(in srgb,var(--ink) 40%,transparent);transform:translateY(-5px)}
.site .s-price{font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--accent)}
.site .s-item-desc{color:var(--muted);margin:6px 0 0;font-size:15px;max-width:48ch}

/* Infos pratiques */
.site .s-infos{display:grid;gap:0;border-top:1px solid var(--ink)}
@container (min-width:860px){.site .s-infos{grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:56px}}
.site .s-info{padding:28px 0;border-bottom:1px solid var(--line)}
@container (min-width:860px){.site .s-info{border-bottom:0;padding:32px 0 0}}
.site .s-info-title{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 18px}
.site .s-info dl{margin:0}
.site .s-hours-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px dashed var(--line)}
.site .s-hours-row:last-child{border-bottom:0}
.site .s-hours-row dt{font-weight:500}
.site .s-hours-row dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.site .s-hours-row dd.closed{color:var(--muted);font-style:italic}
.site .s-info-big{display:block;font-size:clamp(24px,2.4cqi,30px);line-height:1.2;margin:0 0 18px}
.site .s-info-mail{color:var(--muted);border-bottom:1px solid var(--line)}
.site .s-map{position:relative;margin-top:clamp(40px,5cqi,64px);height:clamp(260px,32cqi,420px);border-radius:var(--radius);overflow:hidden;background:var(--surface);border:1px solid var(--line)}
.site .s-map span{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-size:14px;padding:24px;text-align:center}
.site .s-map iframe{position:relative;width:100%;height:100%;border:0;filter:grayscale(1) contrast(1.05);opacity:.92}

/* Invitation finale */
.site .s-band{background:var(--band);color:var(--on-band);padding:clamp(96px,12cqi,176px) 0;text-align:center}
.site .s-band .s-orn{color:currentColor}
.site .s-band-inner{display:flex;flex-direction:column;align-items:center}
.site .s-band .s-h2{max-width:16ch}
.site .s-band p{max-width:50ch;opacity:.72;font-size:18px;margin:24px 0 40px}

/* Pied de page */
.site .s-footer{padding:clamp(64px,8cqi,112px) 0 clamp(96px,10cqi,48px);color:var(--muted);font-size:14px}
.site .s-wordmark{font-size:clamp(52px,12.5cqi,190px);color:var(--ink);margin:0 0 36px;line-height:.92;letter-spacing:calc(var(--dt) * 1.4);overflow-wrap:anywhere}
.site .s-footer-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:24px}
.site .s-credit{margin:22px 0 0;font-size:12px;opacity:.7}
.site .s-credit a:hover{text-decoration:underline}

/* Barre d'action téléphone */
.site .s-dock{position:sticky;bottom:12px;z-index:30;display:flex;gap:8px;margin:0 12px 12px;padding:6px;border-radius:calc(var(--btn-radius) + 6px);background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);box-shadow:0 12px 40px rgba(0,0,0,.25)}
.site .s-dock a{flex:1;text-align:center;padding:13px 10px;font-weight:600;font-size:14px;border-radius:var(--btn-radius);white-space:nowrap}
.site.is-caps .s-dock a{text-transform:uppercase;letter-spacing:.14em;font-size:11px}
.site .s-dock-main{background:var(--accent);color:var(--on-accent)}
@container (min-width:860px){.site .s-dock{display:none}}

/* Apparition douce */
.site .s-rise{animation:s-rise .9s cubic-bezier(.2,.7,.2,1) both}
.site .s-h1.s-rise{animation-delay:.08s}
.site .s-hero-foot.s-rise{animation-delay:.18s}
@keyframes s-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.site *{animation:none!important}}
/* Menu du jour */
.site .s-special{padding:clamp(28px,5cqi,56px) 0 0}
.site .s-special-card{position:relative;display:grid;gap:18px 48px;padding:clamp(26px,4.5cqi,52px);border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));border-radius:var(--radius);background:var(--surface)}
@container (min-width:760px){.site .s-special-card{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);align-items:start}.site .s-special-card .s-link{grid-column:2}}
.site .s-special-head .s-eyebrow{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.site .s-live{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 60%,transparent);animation:s-pulse 2.2s infinite}
@keyframes s-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 55%,transparent)}70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}
.site .s-special-title{font-size:clamp(32px,4.4cqi,56px);margin:0}
.site .s-special-text p{margin:0;padding:12px 0;border-bottom:1px solid var(--line);font-size:17px}
.site .s-special-text p:last-child{border-bottom:0}
.site .s-special-card .s-link{justify-self:start}

/* Apparitions au défilement (seulement si le navigateur les gère) */
.site.motion [data-r]{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.2,.7,.2,1) var(--d,0ms),transform 1.1s cubic-bezier(.2,.7,.2,1) var(--d,0ms)}
.site.motion img[data-r]{transform:scale(1.06);clip-path:inset(6% 4% 6% 4% round var(--radius));transition:opacity 1s ease var(--d,0ms),transform 1.6s cubic-bezier(.2,.7,.2,1) var(--d,0ms),clip-path 1.3s cubic-bezier(.2,.7,.2,1) var(--d,0ms)}
.site.motion [data-r].in{opacity:1;transform:none;clip-path:inset(0 0 0 0 round var(--radius))}
.site .s-hero-photo img{will-change:translate}
@media (prefers-reduced-motion:reduce){.site.motion [data-r]{opacity:1;transform:none;clip-path:none;transition:none}.site .s-live{animation:none}}

/* Réservation */
.site .s-modal{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:s-fade .25s ease}
@media (min-width:640px){.site .s-modal{align-items:center;padding:24px}}
.site .s-modal-panel{position:relative;width:100%;max-width:480px;max-height:92dvh;overflow:auto;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:calc(var(--radius) + 14px) calc(var(--radius) + 14px) 0 0;padding:30px 24px 26px;animation:s-up .35s cubic-bezier(.2,.7,.2,1)}
@media (min-width:640px){.site .s-modal-panel{border-radius:calc(var(--radius) + 10px);padding:38px 36px 32px}}
@keyframes s-fade{from{opacity:0}}
@keyframes s-up{from{transform:translateY(40px);opacity:0}}
.site .s-modal-close{position:absolute;top:14px;right:16px;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:22px;line-height:1;cursor:pointer}
.site .s-modal-title{font-size:clamp(28px,7vw,40px);margin:0 0 22px}
.site .s-modal .s-eyebrow{margin-bottom:10px}
.site .s-field{display:block;margin-bottom:14px}
.site .s-field>span{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:7px}
.site .s-field em{font-style:normal;text-transform:none;letter-spacing:0}
.site .s-field input,.site .s-field textarea{width:100%;font:inherit;font-size:16px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:13px 14px;outline:none;color-scheme:light dark;min-width:0;max-width:100%;-webkit-appearance:none;appearance:none;min-height:50px}
.site .s-field input:focus,.site .s-field textarea:focus{border-color:var(--accent)}
.site .s-field-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.site .s-floor{position:relative;aspect-ratio:4/3;border:1px solid var(--line);border-radius:var(--radius);background:
  radial-gradient(circle at 1px 1px,color-mix(in srgb,var(--ink) 14%,transparent) 1px,transparent 0) 0 0/18px 18px,var(--surface);overflow:hidden}
.site .s-tbl{position:absolute;transform:translate(-50%,-50%);display:grid;place-content:center;gap:0;text-align:center;border:1.5px solid color-mix(in srgb,var(--ink) 35%,transparent);background:var(--bg);color:var(--ink);font:inherit;cursor:pointer;transition:transform .2s,background .2s,border-color .2s}
.site .s-tbl.is-rond{width:15%;aspect-ratio:1;border-radius:50%}
.site .s-tbl.is-carre{width:16%;aspect-ratio:1;border-radius:8px}
.site .s-tbl.is-long{width:28%;aspect-ratio:2/1;border-radius:10px}
.site .s-tbl b{font-size:12px;line-height:1}.site .s-tbl small{font-size:9px;opacity:.65;line-height:1.2}
.site .s-tbl i{position:absolute;inset:-10px;transform:rotate(var(--a));pointer-events:none}
.site .s-tbl i::before{content:"";position:absolute;left:50%;top:0;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:color-mix(in srgb,var(--ink) 30%,transparent)}
.site .s-tbl.is-long i,.site .s-tbl.is-carre i{display:none}
.site .s-tbl:hover:not(:disabled){transform:translate(-50%,-50%) scale(1.06);border-color:var(--accent)}
.site .s-tbl.on{background:var(--accent);color:var(--on-accent);border-color:var(--accent);transform:translate(-50%,-50%) scale(1.08);box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 45%,transparent)}
.site .s-tbl.busy{cursor:not-allowed;background:repeating-linear-gradient(45deg,var(--surface) 0 5px,color-mix(in srgb,var(--ink) 12%,var(--surface)) 5px 10px);opacity:.7}
.site .s-tbl.small{cursor:not-allowed;opacity:.35}
/* Relief du fond (option du commerçant) : motifs dans src/lib/site/colors.ts */
.site.rl-profondeur img,.site.rl-profondeur .s-card,.site.rl-profondeur iframe{box-shadow:0 30px 60px -30px rgba(0,0,0,.55),0 12px 24px -16px rgba(0,0,0,.35)}
.site.rl-profondeur .s-btn{box-shadow:0 14px 30px -12px color-mix(in srgb,var(--accent) 70%,transparent),inset 0 1px 0 rgba(255,255,255,.25)}
.site.has-grad .s-eyebrow{background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.site .s-guarantee{display:flex;gap:10px;align-items:flex-start;margin:4px 0 14px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);font-size:13px;line-height:1.5;color:var(--muted);text-transform:none;letter-spacing:0}
.site .s-guarantee b{color:var(--ink)}
.site .s-lang{font-size:12px;letter-spacing:.14em;font-weight:600;padding:6px 10px;border:1px solid var(--line);border-radius:999px;margin-left:auto;margin-right:10px}
.site .s-order-cta{display:flex;justify-content:center;margin-top:clamp(32px,5cqi,56px)}
.site .s-reviews .s-review-grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));margin-top:clamp(32px,5cqi,56px)}
.site .s-review{margin:0;padding:28px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);display:grid;gap:14px}
.site .s-review blockquote{margin:0;font-size:clamp(19px,2.2cqi,23px);line-height:1.35}
.site .s-review figcaption{font-size:13px;color:var(--muted);letter-spacing:.06em}
.site .s-stars{color:var(--accent);letter-spacing:3px;font-size:15px}
.site .s-stars i{font-style:normal;opacity:.25}
.site .s-gift-link{margin-top:22px;color:inherit;display:inline-block}
.site .s-order-list{display:grid;gap:18px;margin:6px 0 20px;max-height:44vh;overflow:auto;padding-right:4px}
.site .s-order-cat{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin:0 0 6px;font-weight:600}
.site .s-order-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.site .s-order-item.on .s-order-name{color:var(--ink);font-weight:600}
.site .s-order-name{display:grid;font-size:15px;color:var(--ink);text-transform:none;letter-spacing:0}
.site .s-order-name small{color:var(--muted);font-size:13px}
.site .s-stepper-sm button{width:34px;height:34px}
.site .s-stepper-sm output{min-width:26px}
.site .s-gift-preview{position:relative;aspect-ratio:1.6;border-radius:calc(var(--radius) + 6px);padding:22px;display:grid;align-content:space-between;color:var(--on-accent);background:var(--btn-bg,var(--accent));box-shadow:0 24px 50px -24px color-mix(in srgb,var(--accent) 80%,transparent);margin:4px 0 18px;overflow:hidden}
.site .s-gift-preview::after{content:"";position:absolute;inset:0;background:radial-gradient(80% 60% at 90% 0%,rgba(255,255,255,.28),transparent 60%)}
.site .s-gift-preview span{font-size:20px}
.site .s-gift-preview b{font-size:44px;line-height:1}
.site .s-gift-preview small{font-size:11px;letter-spacing:.24em;text-transform:uppercase;opacity:.8}
.site .s-gift-amounts{display:flex;gap:8px;margin-bottom:16px}
.site .s-gift-amounts button{flex:1;padding:12px 0;border:1px solid var(--line);border-radius:var(--radius);background:transparent;color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
.site .s-gift-amounts button.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent)}
.site .s-floor-zone{position:absolute;left:var(--zx);top:var(--zy);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);opacity:.8;pointer-events:none;white-space:nowrap}
.site .s-floor-zone.is-out{left:0;right:0;bottom:0;padding:6px 10px;border-top:1px dashed var(--line);background:color-mix(in srgb,var(--accent) 6%,transparent);height:calc(100% - var(--zy))}
.site .s-floor-legend{display:flex;gap:14px;margin-top:8px;font-size:11px;color:var(--muted);text-transform:none;letter-spacing:0}
.site .s-floor-legend span{display:inline-flex;align-items:center;gap:6px}
.site .s-floor-legend i{width:10px;height:10px;border-radius:3px;border:1px solid var(--line);background:var(--bg)}
.site .s-floor-legend .l-on{background:var(--accent);border-color:var(--accent)}
.site .s-floor-legend .l-busy{background:repeating-linear-gradient(45deg,var(--surface) 0 3px,color-mix(in srgb,var(--ink) 25%,var(--surface)) 3px 6px)}
.site .s-floor-pick{margin:6px 0 0;font-size:13px;color:var(--muted);text-transform:none;letter-spacing:0}
.site .s-floor-pick b{color:var(--ink)}
.site .s-floor-pick button{margin-left:6px;border:0;background:none;color:var(--accent);font:inherit;text-decoration:underline;cursor:pointer}
.site .s-stepper{display:flex;align-items:center;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);width:max-content}
.site .s-stepper button{width:48px;height:46px;border:0;background:transparent;color:var(--ink);font-size:20px;cursor:pointer}
.site .s-stepper output{min-width:40px;text-align:center;font-weight:600;font-size:17px}
.site .s-btn-full{width:100%;margin-top:6px;cursor:pointer}
.site .s-btn:disabled{opacity:.6}
.site .s-modal-note{margin:12px 0 0;text-align:center;font-size:13px;color:var(--muted)}
.site .s-modal-error{margin:0 0 12px;color:#e5484d;font-size:14px}
.site .s-modal-done{display:grid;gap:18px;justify-items:start;padding-top:8px}
.site .s-modal-done .s-modal-title{margin:0;font-size:clamp(24px,6vw,32px);line-height:1.2}
/* Assistant IA */
.site .s-ai-launch{position:fixed;right:16px;bottom:88px;z-index:60;display:inline-flex;align-items:center;gap:9px;padding:13px 18px 13px 15px;border-radius:999px;border:0;background:var(--ink);color:var(--bg);font:inherit;font-weight:600;font-size:14px;cursor:pointer;box-shadow:0 14px 40px rgba(0,0,0,.3);animation:s-up .6s cubic-bezier(.2,.7,.2,1) 1s both}
.site .s-ai-launch span{display:none}
.site .s-ai-launch{padding:0;width:54px;height:54px;justify-content:center}
@container (min-width:860px){.site .s-ai-launch{bottom:24px;right:24px;width:auto;height:auto;padding:13px 18px 13px 15px}.site .s-ai-launch span{display:inline}}
.site .s-ai-launch.is-preview{position:sticky;float:right;margin:-70px 16px 16px 0;bottom:16px}
.site .s-ai{position:fixed;z-index:210;inset:auto 0 0 0;height:min(88dvh,640px);display:flex;flex-direction:column;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:22px 22px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.35);animation:s-up .35s cubic-bezier(.2,.7,.2,1);overflow:hidden}
@media (min-width:640px){.site .s-ai{inset:auto 24px 24px auto;width:390px;height:min(80dvh,620px);border-radius:22px}}
.site .s-ai-head{display:flex;align-items:center;gap:12px;padding:16px 16px 14px 20px;border-bottom:1px solid var(--line)}
.site .s-ai-head>div{flex:1;min-width:0}
.site .s-ai-dot{width:10px;height:10px;border-radius:50%;background:#3ecf8e;box-shadow:0 0 0 4px color-mix(in srgb,#3ecf8e 25%,transparent)}
.site .s-ai-title{margin:0;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.site .s-ai-sub{margin:0;font-size:12px;color:var(--muted)}
.site .s-ai-icon{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink);display:grid;place-items:center;font-size:20px;cursor:pointer}
.site .s-ai-icon.on{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.site .s-ai-body{flex:1;overflow-y:auto;padding:18px 16px;display:flex;flex-direction:column;gap:10px}
.site .s-ai-msg{margin:0;max-width:86%;padding:11px 15px;border-radius:18px;font-size:15px;line-height:1.5}
.site .s-ai-msg.bot{background:var(--surface);border:1px solid var(--line);border-bottom-left-radius:6px;align-self:flex-start}
.site .s-ai-msg.me{background:var(--accent);color:var(--on-accent);border-bottom-right-radius:6px;align-self:flex-end}
.site .s-ai-typing{display:flex;gap:5px;padding:15px 16px}
.site .s-ai-typing i{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:s-blink 1.2s infinite}
.site .s-ai-typing i:nth-child(2){animation-delay:.2s}.site .s-ai-typing i:nth-child(3){animation-delay:.4s}
@keyframes s-blink{0%,100%{opacity:.25}50%{opacity:1}}
.site .s-ai-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.site .s-ai-chips button{font:inherit;font-size:13px;padding:8px 13px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer}
.site .s-ai-chips button:hover{border-color:var(--accent);color:var(--accent)}
.site .s-ai-error{margin:0;padding:0 16px 6px;font-size:12px;color:#e5484d}
.site .s-ai-form{display:flex;align-items:center;gap:8px;padding:12px;border-top:1px solid var(--line)}
.site .s-ai-form input{flex:1;min-width:0;font:inherit;font-size:16px;padding:12px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);outline:none}
.site .s-ai-form input:focus{border-color:var(--accent)}
.site .s-ai-mic,.site .s-ai-send{width:46px;height:46px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;font-size:18px}
.site .s-ai-mic{border:1px solid var(--line);background:transparent;color:var(--ink)}
.site .s-ai-mic.on{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.site .s-ai-send{border:0;background:var(--accent);color:var(--on-accent)}
.site .s-ai-send:disabled{opacity:.35}
.site .s-social{display:flex;gap:28px;margin-top:22px}
.site .s-call-cta{display:flex;align-items:center;gap:14px;width:100%;margin:6px 0 4px;padding:14px 16px;border-radius:var(--radius);border:1px solid var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.site .s-call-cta b{display:block;font-size:16px}
.site .s-call-cta small{display:block;font-size:13px;color:var(--muted);margin-top:2px}
.site .s-call-cta-icon{width:46px;height:46px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);animation:s-ring 2.4s ease-in-out infinite}
@keyframes s-ring{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 45%,transparent)}50%{box-shadow:0 0 0 9px transparent}}
.site .s-modal-or{display:flex;align-items:center;gap:12px;margin:14px 0 6px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.14em}
.site .s-modal-or::before,.site .s-modal-or::after{content:"";flex:1;height:1px;background:var(--line)}
.site .s-call{position:fixed;inset:0;z-index:230;display:flex;flex-direction:column;align-items:center;padding:max(48px,env(safe-area-inset-top)) 24px max(36px,env(safe-area-inset-bottom));color:#fff;background:radial-gradient(90% 60% at 50% 38%,color-mix(in srgb,var(--accent) 38%,#0d0d0d),#070707 72%);animation:s-fade .35s ease;text-align:center}
@keyframes s-fade{from{opacity:0}}
.site .s-call-top{margin-bottom:auto}
.site .s-call-brand{margin:0;font-family:var(--display),serif;font-weight:var(--dw);letter-spacing:var(--dt);font-size:28px;line-height:1.1}
.site .s-call-time{margin:8px 0 0;font-size:13px;opacity:.65;font-variant-numeric:tabular-nums;letter-spacing:.04em}
.site .s-call-orb{position:relative;width:150px;height:150px;margin:28px 0 26px;border:0;padding:0;background:none;color:var(--on-accent);cursor:pointer;flex-shrink:0}
.site .s-call-orb span{position:absolute;inset:22px;border-radius:50%;display:grid;place-items:center;background:var(--accent);box-shadow:0 20px 60px color-mix(in srgb,var(--accent) 45%,transparent);transition:transform .4s ease}
.site .s-call-orb i{position:absolute;inset:22px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--accent) 70%,#fff);opacity:0}
.site .s-call.is-listening .s-call-orb i{animation:s-wave 2s ease-out infinite}
.site .s-call.is-listening .s-call-orb span{transform:scale(calc(1 + var(--lvl,0) * .14));transition:transform .08s linear}
.site .s-call.is-listening .s-call-orb i:nth-child(2){animation-delay:.66s}
.site .s-call.is-listening .s-call-orb i:nth-child(3){animation-delay:1.33s}
@keyframes s-wave{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}
.site .s-call.is-speaking .s-call-orb span{animation:s-talk .9s ease-in-out infinite alternate}
@keyframes s-talk{from{transform:scale(.94)}to{transform:scale(1.07)}}
.site .s-call.is-thinking .s-call-orb span{animation:s-think 1.4s ease-in-out infinite}
@keyframes s-think{0%,100%{opacity:1}50%{opacity:.55}}
.site .s-call-state{margin:0;font-size:13px;letter-spacing:.16em;text-transform:uppercase;opacity:.75}
.site .s-call-line{margin:14px 0 0;max-width:30ch;min-height:4.5em;font-size:18px;line-height:1.45;opacity:.95;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.site .s-call-error{margin:8px 0 0;font-size:13px;color:#ff8a8a;max-width:32ch}
.site .s-call-actions{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:42px;width:100%}
.site .s-call-small{width:64px;display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;color:#fff;font:inherit;font-size:12px;opacity:.8;cursor:pointer}
.site .s-call-small svg{width:52px;height:52px;padding:14px;border-radius:50%;background:rgba(255,255,255,.12)}
.site .s-call-ghost{visibility:hidden}
.site .s-call-end{width:72px;height:72px;border-radius:50%;border:0;display:grid;place-items:center;background:#e5484d;color:#fff;cursor:pointer;box-shadow:0 14px 40px rgba(229,72,77,.4)}
.site .s-call-end svg{transform:rotate(135deg)}
@media (prefers-reduced-motion:reduce){.site .s-call-orb i,.site .s-call-orb span,.site .s-call-cta-icon{animation:none!important}}
`;