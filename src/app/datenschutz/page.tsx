import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Datenschutz | YORIAX',
  description: 'Datenschutzerklärung für YORIAX.',
};

export default function DatenschutzPage() {
  return (
    <LegalPageShell
      eyebrow="Privatsphäre"
      title="Datenschutz"
      description="Diese Datenschutzerklärung erklärt, welche Daten YORIAX verarbeitet und wofür sie genutzt werden."
    >
      <section>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">Stand: 5. Juni 2026</p>
      </section>

      <section>
        <h2>1. Verantwortlicher</h2>
        <p>
          David Hein
          <br />
          Einzelunternehmer
          <br />
          Constantinstr. 29
          <br />
          30177 Hannover
          <br />
          Deutschland
        </p>
        <p>
          E-Mail:{' '}
          <a href="mailto:info@fragenta.com">
            info@fragenta.com
          </a>
        </p>
      </section>

      <section>
        <h2>2. Geltungsbereich</h2>
        <p>
          Diese Datenschutzerklärung gilt für die Website yoriax.com und, soweit identisch angebunden,
          für die YORIAX-App. YORIAX ist eine Musikplattform für das Entdecken, Hören, Speichern,
          Verwalten und Veröffentlichen von Songs, Künstlerprofilen, Playlists und Feed-Clips.
        </p>
      </section>

      <section>
        <h2>3. Zugriffsdaten und Hosting</h2>
        <p>
          Beim Aufruf von YORIAX werden technische Zugriffsdaten verarbeitet, zum Beispiel IP-Adresse,
          Datum und Uhrzeit, aufgerufene URL, Browser- und Geräteinformationen sowie technische
          Fehlermeldungen. Diese Daten werden benötigt, um die Plattform auszuliefern, Angriffe zu
          erkennen, Fehler zu untersuchen und die Stabilität zu sichern.
        </p>
        <p>
          Die Website wird über Vercel bereitgestellt. Rechtsgrundlage ist unser berechtigtes Interesse
          an einem sicheren und stabilen Betrieb der Plattform gemäß Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </section>

      <section>
        <h2>4. Account, Login und Nutzerprofil</h2>
        <p>
          Wenn du einen Account erstellst oder dich einloggst, verarbeiten wir insbesondere deine
          E-Mail-Adresse, Authentifizierungsdaten, Profilangaben, Session-Daten, Login-Zeitpunkte
          und technische Sicherheitsdaten. Bei Google Login erhalten wir die für die Anmeldung
          notwendigen Google-Kontodaten, insbesondere E-Mail-Adresse und Profilinformationen, soweit
          du sie über Google freigibst.
        </p>
        <p>
          Rechtsgrundlage ist die Durchführung des Nutzungsverhältnisses gemäß Art. 6 Abs. 1 lit. b
          DSGVO sowie unser berechtigtes Interesse an der Sicherheit der Plattform gemäß Art. 6 Abs. 1
          lit. f DSGVO.
        </p>
      </section>

      <section>
        <h2>5. Musiknutzung und Plattformfunktionen</h2>
        <p>
          Zur Bereitstellung von YORIAX verarbeiten wir Daten zu Songs, Künstlerprofilen, Playlists,
          Likes, Follows, gespeicherten Songs, Wiedergaben, Uploads, Feed-Clips und administrativen
          Einstellungen. Diese Daten sind notwendig, damit du Musik hören, Inhalte speichern,
          Künstlern folgen und eigene Inhalte verwalten kannst.
        </p>
        <p>
          Uploads wie Coverbilder, Audiodateien, Videos oder Künstlerbanner können öffentlich
          abrufbar sein, wenn sie zur Darstellung auf YORIAX veröffentlicht werden. Lade daher nur
          Inhalte hoch, für die du die erforderlichen Rechte besitzt.
        </p>
      </section>

      <section>
        <h2>6. Supabase</h2>
        <p>
          Für Authentifizierung, Datenbank, Storage und Sessions nutzen wir Supabase. Dabei können
          Accountdaten, Profildaten, Plattformdaten und veröffentlichte Medien verarbeitet werden.
          Supabase wird eingesetzt, um die Kernfunktionen von YORIAX bereitzustellen.
        </p>
      </section>

      <section>
        <h2>7. Cloudflare Turnstile</h2>
        <p>
          Zum Schutz von Login und Registrierung nutzen wir Cloudflare Turnstile. Turnstile prüft, ob
          eine Anfrage wahrscheinlich von einem Menschen stammt, und kann dafür technische Daten wie
          IP-Adresse, Browser- und Geräteinformationen sowie Interaktionssignale verarbeiten.
        </p>
        <p>
          Rechtsgrundlage ist unser berechtigtes Interesse an Missbrauchs-, Spam- und Angriffsschutz
          gemäß Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </section>

      <section>
        <h2>8. E-Mails mit Resend</h2>
        <p>
          Für transaktionale E-Mails, zum Beispiel Begrüßungs- oder System-E-Mails, nutzen wir Resend.
          Dabei werden die für den Versand notwendigen Daten verarbeitet, insbesondere E-Mail-Adresse,
          Empfängerstatus, Versandzeitpunkt und technische Zustellinformationen.
        </p>
      </section>

      <section>
        <h2>9. Cookies und lokale Speicherung</h2>
        <p>
          YORIAX nutzt notwendige Speicherung für Login, Sicherheitsprüfung, Auth-Session und deine
          Cookie-Entscheidung. Komfort-Speicherung, zum Beispiel Sprache oder Player-Zustand, nutzen
          wir nur, wenn du sie erlaubst. Analytics- und Marketing-Cookies sind aktuell deaktiviert.
        </p>
        <p>
          Du kannst deine Entscheidung jederzeit über die Cookie-Einstellungen auf der Plattform
          ändern.
        </p>
      </section>

      <section>
        <h2>10. Speicherdauer</h2>
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie sie für die genannten Zwecke
          erforderlich sind. Account- und Plattformdaten werden grundsätzlich für die Dauer deines
          Accounts gespeichert. Gesetzliche Aufbewahrungspflichten und Sicherheitsinteressen können
          eine längere Speicherung erforderlich machen.
        </p>
      </section>

      <section>
        <h2>11. Empfänger und Drittlandübermittlung</h2>
        <p>
          Daten können an technische Dienstleister übermittelt werden, die uns beim Betrieb der
          Plattform unterstützen. Dazu gehören insbesondere Supabase, Vercel, Cloudflare, Resend und
          Google, soweit du Google Login nutzt. Soweit Daten außerhalb der EU oder des EWR verarbeitet
          werden, achten wir auf geeignete Garantien wie Standardvertragsklauseln oder vergleichbare
          Schutzmechanismen.
        </p>
      </section>

      <section>
        <h2>12. Deine Rechte</h2>
        <p>
          Du hast nach Maßgabe der DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
          der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen bestimmte Verarbeitungen. Wenn
          eine Verarbeitung auf Einwilligung beruht, kannst du diese Einwilligung jederzeit mit Wirkung
          für die Zukunft widerrufen.
        </p>
        <p>
          Du hast außerdem das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für
          Niedersachsen ist dies die Landesbeauftragte für den Datenschutz Niedersachsen.
        </p>
      </section>

      <section>
        <h2>13. Kontakt zu Datenschutzfragen</h2>
        <p>
          Wenn du Fragen zum Datenschutz oder zur Ausübung deiner Rechte hast, erreichst du uns unter{' '}
          <a href="mailto:info@fragenta.com">
            info@fragenta.com
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
