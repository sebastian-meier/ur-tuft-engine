/**
 * Presentational root component for the UR Tuft Engine UI. Collects user uploads, relays them to
 * the backend API, and surfaces the generated robot program and telemetry. Includes a lightweight
 * language switch so the interface can be used in English and German.
 */
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type RobotStatus = 'skipped' | 'delivered' | 'failed';

type UploadState = 'idle' | 'uploading' | 'success' | 'warning' | 'error';

type Language = 'en' | 'de';

const translations: Record<Language, {
  languageLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  artworkLabel: string;
  previewHeading: string;
  generatingPreview: string;
  fileLabel: string;
  sizeLabel: string;
  actions: {
    submit: string;
    submitUploading: string;
    reset: string;
    preflight: string;
    preflightRunning: string;
  };
  errors: {
    noFile: string;
    unexpected: string;
  };
  messages: {
    warningFailedPrefix: string;
    warningFailedFallback: string;
    successDelivered: string;
    infoSkipped: string;
  };
  programDetailsHeading: string;
  metadataLabels: {
    jobId: string;
    estimatedCycleTime: string;
    workspaceMapping: string;
    imageSize: string;
    tuftSegments: string;
    activePixels: string;
    robotDelivery: string;
  };
  robotDeliveryStatus: Record<RobotStatus, string>;
  preflight: {
    heading: string;
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
    metadataLabels: {
      jobId: string;
      estimatedCycleTime: string;
      travelDistance: string;
      coordinateFrame: string;
      cornerDwell: string;
      waypoints: string;
    };
  };
  languageOptions: Record<Language, string>;
}> = {
  en: {
    languageLabel: 'Language',
    heroTitle: 'UR Tuft Engine',
    heroSubtitle: 'Upload artwork, generate a UR robot program, and send it to the machine.',
    artworkLabel: 'Artwork Image',
    previewHeading: 'Preview',
    generatingPreview: 'Generating preview…',
    fileLabel: 'File',
    sizeLabel: 'Size',
    actions: {
      submit: 'Generate Program',
      submitUploading: 'Uploading…',
      reset: 'Reset',
      preflight: 'Run Preflight',
      preflightRunning: 'Running preflight…',
    },
    errors: {
      noFile: 'Please choose an image to upload.',
      unexpected: 'Unexpected error while uploading image.',
    },
    messages: {
      warningFailedPrefix: 'Program generated, but sending to the robot failed:',
      warningFailedFallback: 'Program generated, but sending to the robot failed.',
      successDelivered: 'Program delivered to the robot.',
      infoSkipped: 'Program is ready. Configure a robot host to send it automatically.',
    },
    programDetailsHeading: 'Program Details',
    metadataLabels: {
      jobId: 'Job ID',
      estimatedCycleTime: 'Estimated Cycle Time',
      workspaceMapping: 'Workspace Mapping',
      imageSize: 'Image Size',
      tuftSegments: 'Tuft Segments',
      activePixels: 'Active Pixels',
      robotDelivery: 'Robot Delivery',
    },
    robotDeliveryStatus: {
      delivered: 'delivered',
      failed: 'failed',
      skipped: 'skipped',
    },
    preflight: {
      heading: 'Preflight Routine',
      successDelivered: 'Preflight sequence delivered to the robot.',
      infoSkipped: 'Preflight sequence generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Preflight sequence generated, but sending to the robot failed:',
      warningFailedFallback: 'Preflight sequence generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while running the preflight routine.',
      metadataLabels: {
        jobId: 'Job ID',
        estimatedCycleTime: 'Estimated Duration',
        travelDistance: 'Travel Distance',
        coordinateFrame: 'Coordinate Frame',
        cornerDwell: 'Corner Dwell',
        waypoints: 'Waypoints',
      },
    },
    languageOptions: {
      en: 'English',
      de: 'Deutsch',
    },
  },
  de: {
    languageLabel: 'Sprache',
    heroTitle: 'UR Tuft Engine',
    heroSubtitle: 'Lade ein Motiv hoch, erzeuge ein UR-Programm und schicke es an den Roboter.',
    artworkLabel: 'Bilddatei',
    previewHeading: 'Vorschau',
    generatingPreview: 'Vorschau wird erstellt…',
    fileLabel: 'Datei',
    sizeLabel: 'Groesse',
    actions: {
      submit: 'Programm erzeugen',
      submitUploading: 'Wird hochgeladen…',
      reset: 'Zuruecksetzen',
      preflight: 'Preflight starten',
      preflightRunning: 'Preflight läuft…',
    },
    errors: {
      noFile: 'Bitte waehle ein Bild zum Hochladen aus.',
      unexpected: 'Unerwarteter Fehler beim Hochladen.',
    },
    messages: {
      warningFailedPrefix: 'Programm erzeugt, aber die Roboteruebertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Programm erzeugt, aber die Roboteruebertragung ist fehlgeschlagen.',
      successDelivered: 'Programm wurde an den Roboter uebertragen.',
      infoSkipped: 'Programm ist bereit. Konfiguriere einen Roboter-Host fuer die automatische Uebertragung.',
    },
    programDetailsHeading: 'Programmdetails',
    metadataLabels: {
      jobId: 'Job-ID',
      estimatedCycleTime: 'Geschaetzte Zykluszeit',
      workspaceMapping: 'Arbeitsbereich',
      imageSize: 'Bildgroesse',
      tuftSegments: 'Tuft-Segmente',
      activePixels: 'Aktive Pixel',
      robotDelivery: 'Roboteruebertragung',
    },
    robotDeliveryStatus: {
      delivered: 'erfolgreich',
      failed: 'fehlgeschlagen',
      skipped: 'uebersprungen',
    },
    preflight: {
      heading: 'Preflight-Routine',
      successDelivered: 'Preflight-Sequenz wurde an den Roboter gesendet.',
      infoSkipped: 'Preflight-Sequenz generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Preflight-Sequenz generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Preflight-Sequenz generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Ausführen der Preflight-Routine.',
      metadataLabels: {
        jobId: 'Job-ID',
        estimatedCycleTime: 'Geschätzte Dauer',
        travelDistance: 'Verfahrweg',
        coordinateFrame: 'Koordinatensystem',
        cornerDwell: 'Verweilzeit an den Ecken',
        waypoints: 'Wegpunkte',
      },
    },
    languageOptions: {
      en: 'English',
      de: 'Deutsch',
    },
  },
};

type ErrorState =
  | { key: 'none' }
  | { key: 'noFile' }
  | { key: 'unexpected' }
  | { key: 'custom'; message: string };

interface UploadResponse {
  jobId: string;
  metadata: {
    estimatedCycleTimeSeconds: number;
    resolution: string;
    imageWidth: number;
    imageHeight: number;
    tuftSegments: number;
    activePixels: number;
  };
  program: string;
  robotDelivery: {
    attempted: boolean;
    status: RobotStatus;
    error?: string;
  };
}

interface PreflightResponse {
  jobId: string;
  metadata: {
    estimatedCycleTimeSeconds: number;
    travelDistanceMm: number;
    coordinateFrame: string;
    cornerDwellSeconds: number;
    waypoints: Array<{ xMm: number; yMm: number; dwellSeconds: number }>;
  };
  program: string;
  robotDelivery: {
    attempted: boolean;
    status: RobotStatus;
    error?: string;
  };
}

type PreflightState = 'idle' | 'running' | 'success' | 'warning' | 'error';

/**
 * Renders the single-page upload workflow. Image previews are generated via an object URL that is
 * revoked once the component no longer needs it to avoid leaking resources.
 */
function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorState, setErrorState] = useState<ErrorState>({ key: 'none' });
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [preflightState, setPreflightState] = useState<PreflightState>('idle');
  const [preflightResult, setPreflightResult] = useState<PreflightResponse | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  const t = translations[language];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 }),
    [language],
  );

  const reset = () => {
    setSelectedFile(null);
    setUploadState('idle');
    setErrorState({ key: 'none' });
    setResult(null);
    setPreflightState('idle');
    setPreflightResult(null);
    setPreflightError(null);
  };

  const currentErrorMessage = useMemo(() => {
    if (errorState.key === 'none') {
      return null;
    }
    if (errorState.key === 'noFile') {
      return t.errors.noFile;
    }
    if (errorState.key === 'unexpected') {
      return t.errors.unexpected;
    }
    return errorState.message;
  }, [errorState, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorState({ key: 'noFile' });
      setUploadState('error');
      return;
    }

    setUploadState('uploading');
    setErrorState({ key: 'none' });
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/images`, {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json()) as UploadResponse & { error?: string };

      if (!response.ok && response.status !== 202) {
        const message = payload.error ?? 'Upload failed.';
        throw new Error(message);
      }

      setResult(payload);
      setUploadState(response.status === 202 ? 'warning' : 'success');
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setErrorState({ key: 'custom', message: error.message });
      } else {
        setErrorState({ key: 'unexpected' });
      }
      setUploadState('error');
    }
  };

  const handlePreflight = async () => {
    setPreflightState('running');
    setPreflightError(null);
    setPreflightResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/preflight`, {
        method: 'POST',
      });

      const payload = (await response.json()) as PreflightResponse & { error?: string };

      if (!response.ok && response.status !== 202) {
        const message = payload.error ?? 'Preflight failed.';
        throw new Error(message);
      }

      setPreflightResult(payload);
      setPreflightState(response.status === 202 ? 'warning' : 'success');
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setPreflightError(error.message);
      } else {
        setPreflightError(t.preflight.errorUnexpected);
      }
      setPreflightState('error');
    }
  };

  return (
    <main className="app">
      <div className="language-switch">
        <label htmlFor="language-select">{t.languageLabel}</label>
        <select
          id="language-select"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
        >
          <option value="en">{t.languageOptions.en}</option>
          <option value="de">{t.languageOptions.de}</option>
        </select>
      </div>
      <header>
        <h1>{t.heroTitle}</h1>
        <p>{t.heroSubtitle}</p>
      </header>

      <section className="panel">
        <form onSubmit={handleSubmit} className="upload-form">
          <label className="file-input">
            <span>{t.artworkLabel}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setResult(null);
                setUploadState('idle');
                setErrorState({ key: 'none' });
              }}
            />
          </label>

          {selectedFile && (
            <article className="preview">
              <h2>{t.previewHeading}</h2>
              {previewUrl ? (
                <img src={previewUrl} alt="Selected artwork preview" />
              ) : (
                <p className="message info">{t.generatingPreview}</p>
              )}
              <div className="file-details">
                <p>
                  {t.fileLabel}: {selectedFile.name}
                </p>
                <p>
                  {t.sizeLabel}: {numberFormatter.format(selectedFile.size / 1024)} KB
                </p>
              </div>
            </article>
          )}

          <div className="actions">
            <button type="submit" disabled={uploadState === 'uploading'}>
              {uploadState === 'uploading' ? t.actions.submitUploading : t.actions.submit}
            </button>
            <button type="button" className="secondary" onClick={reset} disabled={uploadState === 'uploading'}>
              {t.actions.reset}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handlePreflight}
              disabled={uploadState === 'uploading' || preflightState === 'running'}
            >
              {preflightState === 'running' ? t.actions.preflightRunning : t.actions.preflight}
            </button>
          </div>
        </form>

        {uploadState === 'error' && currentErrorMessage && <p className="message error">{currentErrorMessage}</p>}
        {uploadState === 'warning' && result?.robotDelivery.status === 'failed' && (
          <p className="message warning">
            {result.robotDelivery.error
              ? `${t.messages.warningFailedPrefix} ${result.robotDelivery.error}`
              : t.messages.warningFailedFallback}
          </p>
        )}
        {uploadState === 'success' && result?.robotDelivery.status === 'delivered' && (
          <p className="message success">{t.messages.successDelivered}</p>
        )}
        {uploadState === 'success' && result?.robotDelivery.status === 'skipped' && (
          <p className="message info">{t.messages.infoSkipped}</p>
        )}
        {preflightState === 'error' && preflightError && <p className="message error">{preflightError}</p>}
        {preflightState === 'warning' && preflightResult?.robotDelivery.status === 'failed' && (
          <p className="message warning">
            {preflightResult.robotDelivery.error
              ? `${t.preflight.warningFailedPrefix} ${preflightResult.robotDelivery.error}`
              : t.preflight.warningFailedFallback}
          </p>
        )}
        {preflightState === 'success' && preflightResult?.robotDelivery.status === 'delivered' && (
          <p className="message success">{t.preflight.successDelivered}</p>
        )}
        {preflightState === 'success' && preflightResult?.robotDelivery.status === 'skipped' && (
          <p className="message info">{t.preflight.infoSkipped}</p>
        )}
      </section>

      {result && (
        <section className="panel">
          <h2>{t.programDetailsHeading}</h2>
          <ul className="metadata">
            <li>
              <strong>{t.metadataLabels.jobId}:</strong> {result.jobId}
            </li>
            <li>
              <strong>{t.metadataLabels.estimatedCycleTime}:</strong> {result.metadata.estimatedCycleTimeSeconds} seconds
            </li>
            <li>
              <strong>{t.metadataLabels.workspaceMapping}:</strong> {result.metadata.resolution} px → configured mm
            </li>
            <li>
              <strong>{t.metadataLabels.imageSize}:</strong> {result.metadata.imageWidth}×
              {result.metadata.imageHeight} px
            </li>
            <li>
              <strong>{t.metadataLabels.tuftSegments}:</strong> {result.metadata.tuftSegments}
            </li>
            <li>
              <strong>{t.metadataLabels.activePixels}:</strong> {result.metadata.activePixels}
            </li>
            <li>
              <strong>{t.metadataLabels.robotDelivery}:</strong> {t.robotDeliveryStatus[result.robotDelivery.status]}
            </li>
          </ul>
          <textarea className="program-output" value={result.program} readOnly rows={16} />
        </section>
      )}
      {preflightResult && (
        <section className="panel">
          <h2>{t.preflight.heading}</h2>
          <ul className="metadata">
            <li>
              <strong>{t.preflight.metadataLabels.jobId}:</strong> {preflightResult.jobId}
            </li>
            <li>
              <strong>{t.preflight.metadataLabels.estimatedCycleTime}:</strong>{' '}
              {numberFormatter.format(preflightResult.metadata.estimatedCycleTimeSeconds)} seconds
            </li>
            <li>
              <strong>{t.preflight.metadataLabels.travelDistance}:</strong>{' '}
              {numberFormatter.format(preflightResult.metadata.travelDistanceMm)} mm
            </li>
            <li>
              <strong>{t.preflight.metadataLabels.coordinateFrame}:</strong>{' '}
              {preflightResult.metadata.coordinateFrame}
            </li>
            <li>
              <strong>{t.preflight.metadataLabels.cornerDwell}:</strong>{' '}
              {numberFormatter.format(preflightResult.metadata.cornerDwellSeconds)} s
            </li>
            <li>
              <strong>{t.preflight.metadataLabels.waypoints}:</strong>{' '}
              {preflightResult.metadata.waypoints
                .map((waypoint) => {
                  const base = `(${numberFormatter.format(waypoint.xMm)} mm, ${numberFormatter.format(
                    waypoint.yMm,
                  )} mm)`;
                  return waypoint.dwellSeconds > 0
                    ? `${base} · ${numberFormatter.format(waypoint.dwellSeconds)} s dwell`
                    : base;
                })
                .join(' → ')}
            </li>
          </ul>
          <textarea className="program-output" value={preflightResult.program} readOnly rows={12} />
        </section>
      )}
    </main>
  );
}

export default App;
