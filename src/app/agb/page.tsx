import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'AGB | YORIAX',
  description: 'Allgemeine Nutzungsbedingungen für YORIAX.',
};

export default function AgbPage() {
  return (
    <LegalPageShell
      eyebrow="Nutzungsbedingungen"
      title="AGB"
      description="Diese Bedingungen regeln die Nutzung von YORIAX als Plattform für AI-native Musik, Playlists, Künstlerprofile und Feed-Clips."
    >
      <section>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">Stand: 5. Juni 2026</p>
      </section>

      <section>
        <h2>1. Anbieter und Geltungsbereich</h2>
        <p>
          Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung von YORIAX, einem Angebot von
          David Hein, Constantinstr. 29, 30177 Hannover, Deutschland, E-Mail:{' '}
          <a href="mailto:info@fragenta.com">info@fragenta.com</a>.
        </p>
        <p>
          YORIAX ist eine Musikplattform zum Entdecken, Anhören, Speichern und Veröffentlichen von
          Musik, Künstlerprofilen, Playlists, Charts und kurzen Feed-Clips. Abweichende Bedingungen
          gelten nur, wenn wir ihnen ausdrücklich zustimmen.
        </p>
      </section>

      <section>
        <h2>2. Account und Registrierung</h2>
        <p>
          Für bestimmte Funktionen, insbesondere das Abspielen vollständiger Songs, Likes, Playlists,
          Follows, Uploads oder Profilfunktionen, ist ein Account erforderlich. Du musst bei der
          Registrierung richtige Angaben machen und deine Zugangsdaten vertraulich behandeln.
        </p>
        <p>
          Du bist für alle Aktivitäten verantwortlich, die über deinen Account erfolgen, soweit du sie
          verursacht hast oder eine missbräuchliche Nutzung durch zumutbare Schutzmaßnahmen hättest
          verhindern können.
        </p>
      </section>

      <section>
        <h2>3. Nutzung der Plattform</h2>
        <p>
          Du darfst YORIAX nur rechtmäßig und im vorgesehenen Funktionsumfang nutzen. Nicht erlaubt
          sind insbesondere Angriffe auf die Plattform, das Umgehen technischer Schutzmaßnahmen,
          automatisiertes Auslesen ohne Zustimmung, Manipulation von Plays, Likes, Charts oder
          Accounts sowie das Hochladen oder Teilen rechtswidriger Inhalte.
        </p>
        <p>
          Wir können Funktionen ändern, weiterentwickeln, zeitweise beschränken oder entfernen, wenn
          dies aus technischen, rechtlichen oder Sicherheitsgründen erforderlich ist oder der
          Produktentwicklung dient.
        </p>
      </section>

      <section>
        <h2>4. Musik, Uploads und Rechte</h2>
        <p>
          Wenn du Inhalte auf YORIAX hochlädst oder uns Inhalte zur Veröffentlichung bereitstellst,
          zum Beispiel Songs, Coverbilder, Videos, Künstlerbanner, Texte oder Metadaten, bestätigst
          du, dass du die dafür erforderlichen Rechte besitzt und keine Rechte Dritter verletzt.
        </p>
        <p>
          Du räumst YORIAX an den veröffentlichten Inhalten ein einfaches, nicht ausschließliches,
          räumlich unbeschränktes und für die Dauer der Veröffentlichung widerrufliches Nutzungsrecht
          ein, soweit dies für Betrieb, Darstellung, Hosting, Streaming, technische Verarbeitung,
          Transcoding, Vorschauen, Charts, Feed-Clips, Teilen-Funktionen und Bewerbung innerhalb von
          YORIAX erforderlich ist.
        </p>
        <p>
          Dieses Nutzungsrecht ist auf den Plattformbetrieb beschränkt. Rechte an unbekannten
          Nutzungsarten werden nicht eingeräumt. Soweit du Inhalte löschst oder wir sie entfernen,
          endet das Nutzungsrecht für die Zukunft, soweit keine gesetzlichen Aufbewahrungs-,
          Nachweis- oder Sicherheitsinteressen entgegenstehen.
        </p>
      </section>

      <section>
        <h2>5. AI-native Inhalte</h2>
        <p>
          YORIAX fokussiert sich auf AI-native Musik. Wenn du KI-generierte oder KI-unterstützte
          Inhalte veröffentlichst, bist du selbst dafür verantwortlich, dass die verwendeten Tools,
          Prompts, Samples, Stimmen, Trainingsquellen, Lizenzen und sonstigen Bestandteile eine
          Veröffentlichung und Nutzung auf YORIAX erlauben.
        </p>
        <p>
          Inhalte, die Persönlichkeitsrechte, Urheberrechte, Markenrechte, Leistungsschutzrechte oder
          sonstige Rechte Dritter verletzen, dürfen nicht veröffentlicht werden.
        </p>
      </section>

      <section>
        <h2>6. Creator- und Admin-Funktionen</h2>
        <p>
          Uploads, Künstlerprofile, Banner, Videos, Social-Links und ähnliche Verwaltungsfunktionen
          können auf bestimmte Accounts, Creator oder Admins beschränkt sein. Ein Anspruch auf
          Freischaltung bestimmter Creator- oder Admin-Funktionen besteht nicht.
        </p>
      </section>

      <section>
        <h2>7. Verbotene Inhalte</h2>
        <p>
          Nicht erlaubt sind Inhalte, die rechtswidrig, beleidigend, volksverhetzend, bedrohend,
          gewaltverherrlichend, pornografisch, diskriminierend, irreführend, spamartig oder
          offensichtlich rechtsverletzend sind. Ebenfalls nicht erlaubt sind Inhalte, die fremde
          Personen ohne ausreichende Grundlage imitieren, bloßstellen oder deren Rechte verletzen.
        </p>
      </section>

      <section>
        <h2>8. Moderation, Sperrung und Löschung</h2>
        <p>
          Wir dürfen Inhalte entfernen, Sichtbarkeit einschränken, Funktionen deaktivieren oder
          Accounts vorübergehend oder dauerhaft sperren, wenn konkrete Anhaltspunkte für
          Rechtsverletzungen, Missbrauch, Sicherheitsrisiken oder Verstöße gegen diese AGB vorliegen.
        </p>
        <p>
          Bei schweren oder wiederholten Verstößen können wir den Account kündigen. Gesetzliche Rechte
          und Ansprüche bleiben unberührt.
        </p>
      </section>

      <section>
        <h2>9. Verfügbarkeit und Weiterentwicklung</h2>
        <p>
          YORIAX befindet sich in aktiver Entwicklung. Wir bemühen uns um einen stabilen Betrieb,
          schulden aber keine jederzeitige, unterbrechungsfreie Verfügbarkeit. Wartung, Updates,
          Störungen bei Dienstleistern, Sicherheitsmaßnahmen oder technische Probleme können die
          Nutzung zeitweise beeinträchtigen.
        </p>
      </section>

      <section>
        <h2>10. Kosten und zukünftige Bezahlfunktionen</h2>
        <p>
          Soweit Funktionen kostenlos angeboten werden, entstehen dir hierfür keine Plattformgebühren.
          Wenn zukünftig kostenpflichtige Funktionen, Abos oder Creator-Modelle eingeführt werden,
          gelten dafür zusätzliche Preis- und Vertragsinformationen, bevor Kosten entstehen.
        </p>
      </section>

      <section>
        <h2>11. Haftung</h2>
        <p>
          Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von
          Leben, Körper oder Gesundheit. Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung
          wesentlicher Vertragspflichten, also Pflichten, deren Erfüllung die ordnungsgemäße Nutzung
          der Plattform überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig vertrauen
          darfst. In diesem Fall ist die Haftung auf den typischerweise vorhersehbaren Schaden
          begrenzt.
        </p>
        <p>
          Die Haftung nach zwingenden gesetzlichen Vorschriften bleibt unberührt.
        </p>
      </section>

      <section>
        <h2>12. Kündigung und Account-Löschung</h2>
        <p>
          Du kannst deinen Account jederzeit kündigen oder eine Löschung verlangen. Bestimmte Inhalte,
          Nachweise oder Daten können weiter gespeichert werden, soweit dies gesetzlich erforderlich
          ist oder zur Abwehr, Durchsetzung oder Dokumentation von Ansprüchen benötigt wird.
        </p>
      </section>

      <section>
        <h2>13. Änderungen dieser AGB</h2>
        <p>
          Wir können diese AGB ändern, wenn dies aufgrund neuer Funktionen, technischer Änderungen,
          rechtlicher Entwicklungen oder Sicherheitsanforderungen erforderlich ist. Über wesentliche
          Änderungen informieren wir in angemessener Weise. Wenn du YORIAX nach Inkrafttreten der
          Änderungen weiter nutzt, gelten die geänderten Bedingungen, soweit gesetzlich zulässig.
        </p>
      </section>

      <section>
        <h2>14. Schlussbestimmungen</h2>
        <p>
          Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften des Landes, in dem du
          deinen gewöhnlichen Aufenthalt hast, bleiben unberührt. Sollten einzelne Bestimmungen dieser
          AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </section>
    </LegalPageShell>
  );
}
