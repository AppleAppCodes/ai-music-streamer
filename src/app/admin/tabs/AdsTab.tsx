import { Loader2, Radio, Trash2, UploadCloud } from 'lucide-react';
import type { AdFile } from '../types';

export function AdsTab({
  isUploadingAd,
  uploadAdStatus,
  adFiles,
  adFrequency,
  isSavingAdFreq,
  onAdUpload,
  onAdDelete,
  onAdFrequencyChange,
  onSaveAdFrequency,
}: {
  isUploadingAd: boolean;
  uploadAdStatus: string | null;
  adFiles: AdFile[];
  adFrequency: number;
  isSavingAdFreq: boolean;
  onAdUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAdDelete: (fileName: string) => void;
  onAdFrequencyChange: (value: number) => void;
  onSaveAdFrequency: () => void;
}) {
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Radio className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Eigenwerbung Verwalten</h2>
        <p className="text-white/60 mb-8">
          Lade hier eine neue Audiodatei hoch (.mp3, .m4a), die den Free-Nutzern nach jedem 3. Song abgespielt wird.
          Die neue Datei überschreibt automatisch die alte Werbung und ist sofort live.
        </p>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-8 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
          <input
            type="file"
            accept="audio/*"
            onChange={onAdUpload}
            disabled={isUploadingAd}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            title="Klicke hier, um eine Audiodatei auszuwählen"
          />
          <div className="flex flex-col items-center justify-center gap-4">
            {isUploadingAd ? (
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            ) : (
              <UploadCloud className="w-10 h-10 text-white/50 group-hover:text-indigo-400 transition-colors" />
            )}
            <div>
              <p className="text-lg font-semibold text-white">
                {isUploadingAd ? 'Audiodatei wird hochgeladen...' : 'Klicke hier, um eine Audiodatei auszuwählen'}
              </p>
              <p className="text-sm text-white/40 mt-2">Maximal 10 MB (MP3, WAV, M4A)</p>
            </div>
          </div>
        </div>

        {uploadAdStatus && (
          <div className={`mt-6 p-4 rounded-xl text-sm font-medium border ${
            uploadAdStatus.includes('Erfolgreich')
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : uploadAdStatus.includes('Fehler')
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
          }`}>
            {uploadAdStatus}
          </div>
        )}

        {/* Ad Frequency Setting */}
        <div className="mt-12 text-left bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-2">Werbe-Intervall</h3>
          <p className="text-white/60 mb-6 text-sm">
            Stelle hier ein, nach wie vielen Songs die Basic-Nutzer eine Werbung hören sollen.
            (Bisher war dieser Wert fest auf 3 eingestellt).
          </p>

          <div className="flex items-center gap-4">
            <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-white font-medium">Werbung abspielen nach jedem:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onAdFrequencyChange(Math.max(1, adFrequency - 1))}
                  className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >-</button>
                <span className="text-xl font-bold text-white w-8 text-center">{adFrequency}</span>
                <button
                  onClick={() => onAdFrequencyChange(adFrequency + 1)}
                  className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >+</button>
                <span className="text-white/60 font-medium ml-2">. Song</span>
              </div>
            </div>
            <button
              onClick={onSaveAdFrequency}
              disabled={isSavingAdFreq}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl transition-colors disabled:opacity-50"
            >
              {isSavingAdFreq ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>

        {/* List of active ads */}
        <div className="mt-12 text-left">
          <h3 className="text-xl font-bold text-white mb-4">Aktive Werbungen ({adFiles.length})</h3>
          {adFiles.length === 0 ? (
            <div className="p-8 text-center bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-white/50">Keine Werbung hochgeladen. Nutze den Uploader oben!</p>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <ul className="divide-y divide-white/5">
                {adFiles.map((file) => (
                  <li key={file.id || file.name} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4 truncate mr-4">
                      <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Radio className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-white truncate">{file.name}</p>
                        <p className="text-xs text-white/50">
                          {file.created_at ? new Date(file.created_at).toLocaleDateString('de-DE') : 'Unbekannt'} • {(((file.metadata?.size as number) || 0) / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onAdDelete(file.name)}
                      className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex-shrink-0"
                      title="Werbung löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
