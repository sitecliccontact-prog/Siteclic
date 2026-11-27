"use client";

/* « Ajouter à mon agenda » après une réservation, un rendez-vous ou un événement :
   Google Agenda (Android) ou fichier agenda (iPhone, Outlook). Rien n'est envoyé à un serveur. */

export type CalEvent = { title: string; day: string; time: string; minutes: number; details?: string };

const stamp = (day: string, time: string, plus = 0) => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + plus;
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCMinutes(total);
  return d.toISOString().slice(0, 16).replace(/[-:]/g, "") + "00";
};

export function AddToCalendar({ ev, en = false }: { ev: CalEvent; en?: boolean }) {
  const start = stamp(ev.day, ev.time);
  const end = stamp(ev.day, ev.time, ev.minutes);
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${start}/${end}&ctz=Europe/Paris${ev.details ? `&details=${encodeURIComponent(ev.details)}` : ""}`;
  function ics() {
    const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
    const body = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SiteClic//FR", "BEGIN:VEVENT",
      `UID:${start}-${Math.random().toString(36).slice(2)}@siteclic`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;TZID=Europe/Paris:${start}`, `DTEND;TZID=Europe/Paris:${end}`,
      `SUMMARY:${esc(ev.title)}`, ev.details ? `DESCRIPTION:${esc(ev.details)}` : "",
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${esc(ev.title)}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "rendez-vous.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return (
    <div className="s-cal">
      <span>{en ? "Add to my calendar" : "Ajouter à mon agenda"}</span>
      <div>
        <a href={google} target="_blank" rel="noreferrer" className="s-btn s-btn-line s-btn-sm">Google</a>
        <button type="button" onClick={ics} className="s-btn s-btn-line s-btn-sm">{en ? "iPhone / Outlook" : "iPhone / Outlook"}</button>
      </div>
    </div>
  );
}
