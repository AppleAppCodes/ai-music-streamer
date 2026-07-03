import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Widerrufsbelehrung',
  description: 'Widerrufsbelehrung und Muster-Widerrufsformular für kostenpflichtige YORIAX-Funktionen.',
  path: '/widerruf',
  noIndex: true,
  follow: true,
});

export default function WiderrufPage() {
  return (
    <LegalPageShell
      eyebrow="Rechtliches"
      title="Widerrufsbelehrung"
      description="Widerrufsrecht für Verbraucher beim Abschluss kostenpflichtiger YORIAX-Funktionen (z. B. Abos)."
    >
      <section>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">Stand: 3. Juli 2026</p>
      </section>

      <section>
        <h2>Widerrufsrecht</h2>
        <p>
          Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu
          widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
        </p>
        <p>
          Um dein Widerrufsrecht auszuüben, musst du uns
        </p>
        <p>
          David Hein
          <br />
          Constantinstr. 29
          <br />
          30177 Hannover
          <br />
          Deutschland
          <br />
          E-Mail:{' '}
          <a href="mailto:info@fragenta.com">info@fragenta.com</a>
        </p>
        <p>
          mittels einer eindeutigen Erklärung (z.&nbsp;B. eine E-Mail) über deinen Entschluss,
          diesen Vertrag zu widerrufen, informieren. Du kannst dafür das beigefügte
          Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
        </p>
        <p>
          Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des
          Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.
        </p>
      </section>

      <section>
        <h2>Folgen des Widerrufs</h2>
        <p>
          Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten
          haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem
          die Mitteilung über deinen Widerruf dieses Vertrags bei uns eingegangen ist. Für diese
          Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen
          Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes
          vereinbart; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.
        </p>
        <p>
          Hast du verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so
          hast du uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt,
          zu dem du uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags
          unterrichtest, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im
          Vertrag vorgesehenen Dienstleistungen entspricht.
        </p>
      </section>

      <section>
        <h2>Vorzeitiges Erlöschen des Widerrufsrechts</h2>
        <p>
          Bei einem Vertrag über die Bereitstellung nicht auf einem körperlichen Datenträger
          befindlicher digitaler Inhalte erlischt das Widerrufsrecht auch dann, wenn wir mit der
          Ausführung des Vertrags begonnen haben, nachdem du ausdrücklich zugestimmt hast, dass wir
          mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist beginnen, und du deine
          Kenntnis davon bestätigt hast, dass du durch deine Zustimmung mit Beginn der Ausführung
          des Vertrags dein Widerrufsrecht verlierst.
        </p>
      </section>

      <section>
        <h2>Muster-Widerrufsformular</h2>
        <p>
          Wenn du den Vertrag widerrufen willst, dann fülle dieses Formular aus und sende es zurück
          an:
        </p>
        <p>
          David Hein, Constantinstr. 29, 30177 Hannover, Deutschland
          <br />
          E-Mail: info@fragenta.com
        </p>
        <p>
          Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf
          der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*):
        </p>
        <p>
          Bestellt am (*) / erhalten am (*): ____________
          <br />
          Name des/der Verbraucher(s): ____________
          <br />
          Anschrift des/der Verbraucher(s): ____________
          <br />
          Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ____________
          <br />
          Datum: ____________
        </p>
        <p>(*) Unzutreffendes streichen.</p>
      </section>
    </LegalPageShell>
  );
}
