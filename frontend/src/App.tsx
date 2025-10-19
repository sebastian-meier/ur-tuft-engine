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
    toolTest: string;
    toolTestRunning: string;
    boundingBox: string;
    boundingBoxRunning: string;
    emergency: string;
    emergencyConfirm: string;
    emergencyCancel: string;
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
  toolTest: {
    heading: string;
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
    metadataLabels: {
      jobId: string;
      displacement: string;
      dwell: string;
      toolOutput: string;
      travelSpeed: string;
    };
  };
  boundingBox: {
    heading: string;
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
    missingBoundingBox: string;
    metadataLabels: {
      jobId: string;
      coordinateFrame: string;
      travelDistance: string;
      bounds: string;
    };
  };
  emergencyModal: {
    title: string;
    body: string;
    safetyReminder: string;
  };
  introduction: {
    heading: string;
    start: {
      heading: string;
      steps: string[];
    };
    finish: {
      heading: string;
      steps: string[];
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
      toolTest: 'Test Tufting Gun',
      toolTestRunning: 'Testing tufting gun…',
      boundingBox: 'Visit Tuft Area Corners',
      boundingBoxRunning: 'Moving to tuft area corners…',
      emergency: 'Emergency Routine',
      emergencyConfirm: 'Confirm & Execute',
      emergencyCancel: 'Cancel',
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
    toolTest: {
      heading: 'Tufting Gun Test',
      successDelivered: 'Tufting gun test program delivered to the robot.',
      infoSkipped: 'Tufting gun test program generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Tufting gun test program generated, but sending to the robot failed:',
      warningFailedFallback: 'Tufting gun test program generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while running the tufting gun test.',
      metadataLabels: {
        jobId: 'Job ID',
        displacement: 'Z Displacement',
        dwell: 'Dwell Duration',
        toolOutput: 'Tool Output',
        travelSpeed: 'Travel Speed',
      },
    },
    boundingBox: {
      heading: 'Bounding Box Corners',
      successDelivered: 'Bounding box routine delivered to the robot.',
      infoSkipped: 'Bounding box routine generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Bounding box routine generated, but sending to the robot failed:',
      warningFailedFallback: 'Bounding box routine generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while moving to bounding box corners.',
      missingBoundingBox: 'Generate a tufting program first to determine the bounding box.',
      metadataLabels: {
        jobId: 'Job ID',
        coordinateFrame: 'Coordinate Frame',
        travelDistance: 'Travel Distance',
        bounds: 'Bounding Box',
      },
    },
    emergencyModal: {
      title: 'Important',
      body: 'Please make sure the area around the robot is cleared and nobody is standing near the robot.',
      safetyReminder: 'Make sure all safety guidelines are being followed.',
    },
    introduction: {
      heading: 'Introduction',
      start: {
        heading: 'Starting the system',
        steps: [
          'Demo step 1: Power on the main controller and check system indicators.',
          'Demo step 2: Launch the tufting control software and connect to the robot.',
          'Demo step 3: Load the current production job and review tool settings.',
        ],
      },
      finish: {
        heading: 'Finishing up',
        steps: [
          'Demo step 1: Run the parking routine to return the robot to a safe pose.',
          'Demo step 2: Power down auxiliary equipment and secure the workspace.',
          'Demo step 3: Record production notes and hand over to the next operator.',
        ],
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
      toolTest: 'Tufting-Gun testen',
      toolTestRunning: 'Tufting-Gun-Test läuft…',
      boundingBox: 'Ecken der Tuft-Fläche anfahren',
      boundingBoxRunning: 'Roboter fährt Tuft-Fläche ab…',
      emergency: 'Notfallroutine',
      emergencyConfirm: 'Bestätigen & Ausführen',
      emergencyCancel: 'Abbrechen',
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
    toolTest: {
      heading: 'Tufting-Gun-Test',
      successDelivered: 'Testprogramm wurde an den Roboter gesendet.',
      infoSkipped: 'Testprogramm generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Testprogramm generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Testprogramm generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Ausführen des Tufting-Gun-Tests.',
      metadataLabels: {
        jobId: 'Job-ID',
        displacement: 'Z-Verschiebung',
        dwell: 'Verweilzeit',
        toolOutput: 'Digital-Ausgang',
        travelSpeed: 'Verfahrgeschwindigkeit',
      },
    },
    boundingBox: {
      heading: 'Ecken der Tuft-Fläche',
      successDelivered: 'Routine wurde an den Roboter gesendet.',
      infoSkipped: 'Routine generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Routine generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Routine generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Anfahren der Tuft-Flächen-Ecken.',
      missingBoundingBox: 'Erzeuge zuerst ein Tufting-Programm, um die Begrenzungsfläche zu bestimmen.',
      metadataLabels: {
        jobId: 'Job-ID',
        coordinateFrame: 'Koordinatensystem',
        travelDistance: 'Verfahrweg',
        bounds: 'Begrenzungsfläche',
      },
    },
    emergencyModal: {
      title: 'Wichtig',
      body: 'Bitte stelle sicher, dass der Bereich um den Roboter frei ist und niemand neben dem Roboter steht.',
      safetyReminder: 'Stelle sicher, dass alle Sicherheitsrichtlinien eingehalten werden.',
    },
    introduction: {
      heading: 'Einführung',
      start: {
        heading: 'Systemstart',
        steps: [
          'Demo Schritt 1: Hauptsteuerung einschalten und Statusanzeigen prüfen.',
          'Demo Schritt 2: Tufting-Software starten und Verbindung zum Roboter herstellen.',
          'Demo Schritt 3: Aktuellen Produktionsauftrag laden und Werkzeugeinstellungen prüfen.',
        ],
      },
      finish: {
        heading: 'Abschluss',
        steps: [
          'Demo Schritt 1: Parkroutine ausführen, um den Roboter in eine sichere Position zu fahren.',
          'Demo Schritt 2: Zusätzliche Geräte ausschalten und den Arbeitsplatz sichern.',
          'Demo Schritt 3: Produktionsnotizen dokumentieren und an die nächste Schicht übergeben.',
        ],
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

interface BoundingBoxMm {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface UploadResponse {
  jobId: string;
  metadata: {
    estimatedCycleTimeSeconds: number;
    resolution: string;
    imageWidth: number;
    imageHeight: number;
    tuftSegments: number;
    activePixels: number;
    boundingBoxMm: BoundingBoxMm | null;
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

interface ToolTestResponse {
  jobId: string;
  metadata: {
    displacementMeters: number;
    dwellSeconds: number;
    toolOutput: number;
    travelSpeedMmPerSec: number;
  };
  program: string;
  robotDelivery: {
    attempted: boolean;
    status: RobotStatus;
    error?: string;
  };
}

type ToolTestState = 'idle' | 'running' | 'success' | 'warning' | 'error';

interface BoundingBoxRoutineResponse {
  jobId: string;
  metadata: {
    boundingBox: BoundingBoxMm;
    coordinateFrame: string;
    travelDistanceMm: number;
  };
  program: string;
  robotDelivery: {
    attempted: boolean;
    status: RobotStatus;
    error?: string;
  };
}

type BoundingBoxRoutineState = 'idle' | 'running' | 'success' | 'warning' | 'error';

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
const [toolTestState, setToolTestState] = useState<ToolTestState>('idle');
const [toolTestResult, setToolTestResult] = useState<ToolTestResponse | null>(null);
const [toolTestError, setToolTestError] = useState<string | null>(null);
const [boundingBoxState, setBoundingBoxState] = useState<BoundingBoxRoutineState>('idle');
const [boundingBoxResult, setBoundingBoxResult] = useState<BoundingBoxRoutineResponse | null>(null);
const [boundingBoxError, setBoundingBoxError] = useState<string | null>(null);
const [emergencyOpen, setEmergencyOpen] = useState(false);
const [pendingEmergencyAction, setPendingEmergencyAction] = useState<null | (() => Promise<void>)>(null);

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
    setToolTestState('idle');
    setToolTestResult(null);
    setToolTestError(null);
    setBoundingBoxState('idle');
    setBoundingBoxResult(null);
    setBoundingBoxError(null);
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
    setPreflightState('idle');
    setPreflightResult(null);
    setPreflightError(null);
    setToolTestState('idle');
    setToolTestResult(null);
    setToolTestError(null);
    setBoundingBoxState('idle');
    setBoundingBoxResult(null);
    setBoundingBoxError(null);

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

const handlePreflight = () => {
  setEmergencyOpen(true);
  setPendingEmergencyAction(() => executePreflight);
};

const executePreflight = async () => {
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

const handleToolTest = () => {
  setEmergencyOpen(true);
  setPendingEmergencyAction(() => executeToolTest);
};

  const executeToolTest = async () => {
    setToolTestState('running');
    setToolTestError(null);
    setToolTestResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tool-test`, {
        method: 'POST',
      });

      const payload = (await response.json()) as ToolTestResponse & { error?: string };

      if (!response.ok && response.status !== 202) {
        const message = payload.error ?? 'Tool test failed.';
        throw new Error(message);
      }

      setToolTestResult(payload);
      setToolTestState(response.status === 202 ? 'warning' : 'success');
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setToolTestError(error.message);
      } else {
        setToolTestError(t.toolTest.errorUnexpected);
      }
      setToolTestState('error');
    }
  };

const handleBoundingBoxRoutine = () => {
  if (!result?.metadata.boundingBoxMm) {
    setBoundingBoxError(t.boundingBox.missingBoundingBox);
    setBoundingBoxState('error');
    return;
  }

  setEmergencyOpen(true);
  setPendingEmergencyAction(() => executeBoundingBoxRoutine);
};

  const executeBoundingBoxRoutine = async () => {
    if (!result?.metadata.boundingBoxMm) {
      return;
    }

    setBoundingBoxState('running');
    setBoundingBoxError(null);
    setBoundingBoxResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/bounding-box`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result.metadata.boundingBoxMm),
      });

      const payload = (await response.json()) as BoundingBoxRoutineResponse & { error?: string };

      if (!response.ok && response.status !== 202) {
        const message = payload.error ?? 'Bounding box routine failed.';
        throw new Error(message);
      }

      setBoundingBoxResult(payload);
      setBoundingBoxState(response.status === 202 ? 'warning' : 'success');
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setBoundingBoxError(error.message);
      } else {
        setBoundingBoxError(t.boundingBox.errorUnexpected);
      }
      setBoundingBoxState('error');
    }
  };

  const confirmEmergencyAction = () => {
    const action = pendingEmergencyAction;
    setEmergencyOpen(false);
    setPendingEmergencyAction(null);
    if (action) {
      action().catch((error) => {
        // surface generic error banner when confirmation action fails
        if (error instanceof Error) {
          setErrorState({ key: 'custom', message: error.message });
        } else {
          setErrorState({ key: 'unexpected' });
        }
      });
    }
  };

  const cancelEmergencyAction = () => {
    setEmergencyOpen(false);
    setPendingEmergencyAction(null);
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

      <section className="panel introduction">
        <h2>{t.introduction.heading}</h2>
        <article>
          <h3>{t.introduction.start.heading}</h3>
          <ol>
            {t.introduction.start.steps.map((step, index) => (
              <li key={`start-step-${index}`}>{step}</li>
            ))}
          </ol>
        </article>
        <article>
          <h3>{t.introduction.finish.heading}</h3>
          <ol>
            {t.introduction.finish.steps.map((step, index) => (
              <li key={`finish-step-${index}`}>{step}</li>
            ))}
          </ol>
        </article>
      </section>

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
            <button
              type="button"
              className="secondary"
              onClick={handleToolTest}
              disabled={uploadState === 'uploading' || toolTestState === 'running'}
            >
              {toolTestState === 'running' ? t.actions.toolTestRunning : t.actions.toolTest}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleBoundingBoxRoutine}
              disabled={
                uploadState === 'uploading' ||
                boundingBoxState === 'running' ||
                !result?.metadata.boundingBoxMm
              }
            >
              {boundingBoxState === 'running' ? t.actions.boundingBoxRunning : t.actions.boundingBox}
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
        {toolTestState === 'error' && toolTestError && <p className="message error">{toolTestError}</p>}
        {toolTestState === 'warning' && toolTestResult?.robotDelivery.status === 'failed' && (
          <p className="message warning">
            {toolTestResult.robotDelivery.error
              ? `${t.toolTest.warningFailedPrefix} ${toolTestResult.robotDelivery.error}`
              : t.toolTest.warningFailedFallback}
          </p>
        )}
        {toolTestState === 'success' && toolTestResult?.robotDelivery.status === 'delivered' && (
          <p className="message success">{t.toolTest.successDelivered}</p>
        )}
        {toolTestState === 'success' && toolTestResult?.robotDelivery.status === 'skipped' && (
          <p className="message info">{t.toolTest.infoSkipped}</p>
        )}
        {boundingBoxState === 'error' && boundingBoxError && <p className="message error">{boundingBoxError}</p>}
        {boundingBoxState === 'warning' && boundingBoxResult?.robotDelivery.status === 'failed' && (
          <p className="message warning">
            {boundingBoxResult.robotDelivery.error
              ? `${t.boundingBox.warningFailedPrefix} ${boundingBoxResult.robotDelivery.error}`
              : t.boundingBox.warningFailedFallback}
          </p>
        )}
        {boundingBoxState === 'success' && boundingBoxResult?.robotDelivery.status === 'delivered' && (
          <p className="message success">{t.boundingBox.successDelivered}</p>
        )}
        {boundingBoxState === 'success' && boundingBoxResult?.robotDelivery.status === 'skipped' && (
          <p className="message info">{t.boundingBox.infoSkipped}</p>
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
            {result.metadata.boundingBoxMm && (
              <li>
                <strong>{t.boundingBox.metadataLabels.bounds}:</strong>{' '}
                ({numberFormatter.format(result.metadata.boundingBoxMm.minX)} mm,{' '}
                {numberFormatter.format(result.metadata.boundingBoxMm.minY)} mm) → (
                {numberFormatter.format(result.metadata.boundingBoxMm.maxX)} mm,{' '}
                {numberFormatter.format(result.metadata.boundingBoxMm.maxY)} mm)
              </li>
            )}
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
      {toolTestResult && (
        <section className="panel">
          <h2>{t.toolTest.heading}</h2>
          <ul className="metadata">
            <li>
              <strong>{t.toolTest.metadataLabels.jobId}:</strong> {toolTestResult.jobId}
            </li>
            <li>
              <strong>{t.toolTest.metadataLabels.displacement}:</strong>{' '}
              {numberFormatter.format(toolTestResult.metadata.displacementMeters * 1000)} mm
            </li>
            <li>
              <strong>{t.toolTest.metadataLabels.dwell}:</strong>{' '}
              {numberFormatter.format(toolTestResult.metadata.dwellSeconds)} s
            </li>
            <li>
              <strong>{t.toolTest.metadataLabels.toolOutput}:</strong> {toolTestResult.metadata.toolOutput}
            </li>
            <li>
              <strong>{t.toolTest.metadataLabels.travelSpeed}:</strong>{' '}
              {numberFormatter.format(toolTestResult.metadata.travelSpeedMmPerSec)} mm/s
            </li>
          </ul>
          <textarea className="program-output" value={toolTestResult.program} readOnly rows={8} />
        </section>
      )}
      {boundingBoxResult && (
        <section className="panel">
          <h2>{t.boundingBox.heading}</h2>
          <ul className="metadata">
            <li>
              <strong>{t.boundingBox.metadataLabels.jobId}:</strong> {boundingBoxResult.jobId}
            </li>
            <li>
              <strong>{t.boundingBox.metadataLabels.coordinateFrame}:</strong>{' '}
              {boundingBoxResult.metadata.coordinateFrame}
            </li>
            <li>
              <strong>{t.boundingBox.metadataLabels.travelDistance}:</strong>{' '}
              {numberFormatter.format(boundingBoxResult.metadata.travelDistanceMm)} mm
            </li>
            <li>
              <strong>{t.boundingBox.metadataLabels.bounds}:</strong>{' '}
              ({numberFormatter.format(boundingBoxResult.metadata.boundingBox.minX)} mm,{' '}
              {numberFormatter.format(boundingBoxResult.metadata.boundingBox.minY)} mm) → (
              {numberFormatter.format(boundingBoxResult.metadata.boundingBox.maxX)} mm,{' '}
              {numberFormatter.format(boundingBoxResult.metadata.boundingBox.maxY)} mm)
            </li>
          </ul>
          <textarea className="program-output" value={boundingBoxResult.program} readOnly rows={8} />
        </section>
      )}
      {emergencyOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="emergency-modal-title">
            <h3 id="emergency-modal-title">{t.emergencyModal.title}</h3>
            <p>{t.emergencyModal.body}</p>
            <p>{t.emergencyModal.safetyReminder}</p>
            <div className="modal-actions">
              <button type="button" onClick={confirmEmergencyAction}>
                {t.actions.emergencyConfirm}
              </button>
              <button type="button" className="secondary" onClick={cancelEmergencyAction}>
                {t.actions.emergencyCancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
