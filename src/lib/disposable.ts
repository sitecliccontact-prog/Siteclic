/* Adresses e-mail jetables (créées en 2 secondes pour profiter plusieurs fois de l'essai gratuit). */
const DOMAINS = new Set([
  "yopmail.com", "yopmail.fr", "yopmail.net", "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
  "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf", "jetable.org", "jetable.com", "jetable.net",
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "10minemail.com", "temp-mail.org", "temp-mail.io", "tempmail.com", "tempmail.net", "tempmailo.com",
  "tempr.email", "throwawaymail.com", "trashmail.com", "trashmail.fr", "trashmail.net", "getnada.com", "nada.email", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "mintemail.com", "mohmal.com", "emailondeck.com", "fakeinbox.com", "spamgourmet.com", "mailcatch.com",
  "mytemp.email", "tmpmail.org", "tmpmail.net", "tmail.ws", "minuteinbox.com", "burnermail.io", "inboxkitten.com", "spambox.us",
  "discard.email", "mail.tm", "mailpoof.com", "emailfake.com", "crazymailing.com", "harakirimail.com", "luxusmail.org", "byom.de",
  "mail-temp.com", "fexpost.com", "fexbox.org", "linshiyouxiang.net", "33mail.com", "anonaddy.me", "duck.com", "simplelogin.com",
  "1secmail.com", "1secmail.org", "1secmail.net", "kzccv.com", "qiott.com", "wuuvo.com", "icznn.com", "ezztt.com", "vjuum.com", "laafd.com", "txcct.com",
]);

export function isDisposable(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return DOMAINS.has(domain) || /(^|\.)(yopmail|mailinator|guerrillamail|10minutemail|temp-?mail|trashmail)\./.test(domain);
}
