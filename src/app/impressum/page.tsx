import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Legal Notice',
  description: 'Legal notice and provider information for YORIAX.',
  path: '/impressum',
  noIndex: true,
  follow: true,
});

export default function ImpressumPage() {
  return (
    <LegalPageShell
      eyebrow="Rechtliches"
      title="Impressum"
      description="Anbieterkennzeichnung und Kontaktangaben für YORIAX."
    >
      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
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
      </section>

      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail:{' '}
          <a href="mailto:info@fragenta.com">
            info@fragenta.com
          </a>
        </p>
      </section>

      <section>
        <h2>Verantwortlich für Inhalte</h2>
        <p>
          David Hein
          <br />
          Constantinstr. 29
          <br />
          30177 Hannover
        </p>
      </section>

      <section>
        <h2>Verbraucherstreitbeilegung</h2>
        <p>
          Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <section>
        <h2>Haftung für Inhalte</h2>
        <p>
          Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Für fremde Inhalte, die Nutzerinnen, Nutzer oder Künstler auf
          YORIAX bereitstellen, gelten die gesetzlichen Verantwortlichkeitsregeln.
        </p>
      </section>

      <section>
        <h2>Urheberrecht</h2>
        <p>
          Die auf YORIAX veröffentlichten Inhalte, Designs, Markenbestandteile und Medien sind
          urheberrechtlich geschützt, soweit sie nicht ausdrücklich anders gekennzeichnet sind.
          Eine Nutzung außerhalb der Plattform benötigt eine vorherige Zustimmung der jeweiligen
          Rechteinhaber.
        </p>
      </section>
    </LegalPageShell>
  );
}
