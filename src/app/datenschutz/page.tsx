import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Privacy Policy',
  description: 'Privacy policy for YORIAX.',
  path: '/datenschutz',
  noIndex: true,
  follow: true,
});

export default function DatenschutzPage() {
  return (
    <LegalPageShell
      eyebrow="Privatsphäre"
      title="Datenschutz"
      description="Diese Datenschutzerklärung erklärt, welche Daten YORIAX verarbeitet und wofür sie genutzt werden."
    >
      <section>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">Stand: 5. Juli 2026</p>
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
        <p>
          Zur Reichweitenmessung nutzen wir Vercel Web Analytics. Dabei werden Seitenaufrufe
          aggregiert und ohne Cookies sowie ohne geräteübergreifende Nutzerprofile ausgewertet.
          Rechtsgrundlage ist unser berechtigtes Interesse an der Analyse und Verbesserung des
          Angebots gemäß Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </section>

      <section>
        <h2>4. Account, Login und Nutzerprofil</h2>
        <p>
          Wenn du einen Account erstellst oder dich einloggst, verarbeiten wir insbesondere deine
          E-Mail-Adresse, Authentifizierungsdaten, Profilangaben, Session-Daten, Login-Zeitpunkte
          und technische Sicherheitsdaten. Bei Google Login erhalten wir die für die Anmeldung
          notwendigen Google-Kontodaten, insbesondere E-Mail-Adresse und Profilinformationen, soweit
          du sie über Google freigibst. Bei Anmeldung mit Apple erhalten wir die von Apple
          bereitgestellten Anmeldedaten; nutzt du {'„E-Mail-Adresse verbergen"'}, verarbeiten wir die
          von Apple erzeugte Weiterleitungsadresse.
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
        <p>
          Zur Verbesserung und Fehleranalyse der Apps verarbeiten wir außerdem technische
          Nutzungsangaben zu deinem Account: Zeitpunkt der letzten Aktivität, Land bzw.
          Geräteregion, App-Version, Betriebssystem-Version und Gerätemodell (z.&nbsp;B.
          {' „iPhone 15"'}). IP-Adressen speichern wir dabei nicht. Rechtsgrundlage ist unser
          berechtigtes Interesse an der Stabilität und Weiterentwicklung des Dienstes gemäß
          Art. 6 Abs. 1 lit. f DSGVO.
        </p>
        <p>
          <strong>Push-Benachrichtigungen (App):</strong> Wenn du in der iOS-App Mitteilungen
          erlaubst, speichern wir einen pseudonymen Geräte-Token, um dir Benachrichtigungen zu
          senden (z.&nbsp;B. neue Musik von Künstlern, denen du folgst, oder Neuigkeiten von
          YORIAX). Der Versand erfolgt über den Benachrichtigungsdienst von Expo (Expo, Inc., USA)
          und Apple. Die Erlaubnis ist freiwillig; du kannst sie jederzeit in den iOS-Einstellungen
          widerrufen. Nicht mehr gültige Geräte-Tokens werden automatisch aus unserer Datenbank
          entfernt. Rechtsgrundlage ist deine Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.
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
        <h2>9. Bezahlung mit Stripe</h2>
        <p>
          Für kostenpflichtige Funktionen (z.&nbsp;B. Abos) nutzen wir den Zahlungsdienstleister
          Stripe. Bei einem Kauf verarbeitet Stripe die für die Zahlungsabwicklung erforderlichen
          Daten, insbesondere Zahlungsdaten, E-Mail-Adresse und Transaktionsdaten. Zahlungsdaten wie
          vollständige Kartennummern werden ausschließlich bei Stripe verarbeitet und nicht auf
          unseren Systemen gespeichert; wir erhalten von Stripe den Zahlungsstatus und die für die
          Vertragsabwicklung nötigen Angaben.
        </p>
        <p>
          Rechtsgrundlage ist die Vertragserfüllung gemäß Art. 6 Abs. 1 lit. b DSGVO. Stripe kann
          Daten auch in den USA verarbeiten; Stripe ist nach dem EU-US Data Privacy Framework
          zertifiziert und verwendet Standardvertragsklauseln.
        </p>
      </section>

      <section>
        <h2>10. Cookies und lokale Speicherung</h2>
        <p>
          YORIAX nutzt notwendige Speicherung für Login, Sicherheitsprüfung, Auth-Session und deine
          Cookie-Entscheidung. Komfort-Speicherung, zum Beispiel Sprache oder Player-Zustand, nutzen
          wir nur, wenn du sie erlaubst. Analytics- und Marketing-Cookies setzen wir nicht ein; die
          Reichweitenmessung (Abschnitt 3) arbeitet ohne Cookies.
        </p>
        <p>
          Du kannst deine Entscheidung jederzeit über die Cookie-Einstellungen auf der Plattform
          ändern.
        </p>
      </section>

      <section>
        <h2>11. Speicherdauer</h2>
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie sie für die genannten Zwecke
          erforderlich sind. Account- und Plattformdaten werden grundsätzlich für die Dauer deines
          Accounts gespeichert. Gesetzliche Aufbewahrungspflichten und Sicherheitsinteressen können
          eine längere Speicherung erforderlich machen.
        </p>
      </section>

      <section>
        <h2>12. Empfänger und Drittlandübermittlung</h2>
        <p>
          Daten können an technische Dienstleister übermittelt werden, die uns beim Betrieb der
          Plattform unterstützen. Dazu gehören insbesondere Supabase, Vercel, Cloudflare, Resend, Stripe
          bei kostenpflichtigen Funktionen sowie Google oder Apple, soweit du den jeweiligen Login
          nutzt. Soweit Daten außerhalb der EU oder des EWR verarbeitet
          werden, achten wir auf geeignete Garantien wie Standardvertragsklauseln oder vergleichbare
          Schutzmechanismen.
        </p>
      </section>

      <section>
        <h2>13. Deine Rechte</h2>
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
        <h2>14. Kontakt zu Datenschutzfragen</h2>
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
