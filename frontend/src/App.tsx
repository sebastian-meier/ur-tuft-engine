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
    pause: string;
    pauseRunning: string;
    resume: string;
    resumeRunning: string;
    calibrate: string;
    calibrateRunning: string;
    home: string;
    homeRunning: string;
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
    progress: string;
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
  pause: {
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
  };
  resume: {
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
  };
  calibrate: {
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
  };
  home: {
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
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
      pause: 'Pause & Raise Tool',
      pauseRunning: 'Pausing…',
      resume: 'Resume Program',
      resumeRunning: 'Resuming…',
      calibrate: 'Calibrate Z-Max',
      calibrateRunning: 'Calibrating…',
      home: 'Home to Center',
      homeRunning: 'Moving to center…',
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
      progress: 'Progress',
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
    pause: {
      successDelivered: 'Pause routine delivered to the robot.',
      infoSkipped: 'Pause routine generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Pause routine generated, but sending to the robot failed:',
      warningFailedFallback: 'Pause routine generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while attempting to pause the robot.',
    },
    resume: {
      successDelivered: 'Resume routine delivered to the robot.',
      infoSkipped: 'Resume routine generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Resume routine generated, but sending to the robot failed:',
      warningFailedFallback: 'Resume routine generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while attempting to resume the robot.',
    },
    calibrate: {
      successDelivered: 'Calibration raise delivered to the robot.',
      infoSkipped: 'Calibration raise generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Calibration raise generated, but sending to the robot failed:',
      warningFailedFallback: 'Calibration raise generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while attempting the calibration raise.',
    },
    home: {
      successDelivered: 'Home-to-center routine delivered to the robot.',
      infoSkipped: 'Home-to-center routine generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Home-to-center routine generated, but sending to the robot failed:',
      warningFailedFallback: 'Home-to-center routine generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while moving to the buffered center.',
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
      pause: 'Pause & Werkzeug anheben',
      pauseRunning: 'Pausiere…',
      resume: 'Programm fortsetzen',
      resumeRunning: 'Fortsetzen…',
      calibrate: 'Kalibrierung Z-Max',
      calibrateRunning: 'Kalibriere…',
      home: 'Zum Zentrum fahren',
      homeRunning: 'Fahre zum Zentrum…',
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
      progress: 'Fortschritt',
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
    pause: {
      successDelivered: 'Pausenroutine wurde an den Roboter gesendet.',
      infoSkipped: 'Pausenroutine generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Pausenroutine generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Pausenroutine generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Pausieren des Roboters.',
    },
    resume: {
      successDelivered: 'Fortsetzungsroutine wurde an den Roboter gesendet.',
      infoSkipped: 'Fortsetzungsroutine generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Fortsetzungsroutine generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Fortsetzungsroutine generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Fortsetzen des Roboters.',
    },
    calibrate: {
      successDelivered: 'Kalibrierungsfahrt wurde an den Roboter gesendet.',
      infoSkipped: 'Kalibrierungsfahrt generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Kalibrierungsfahrt generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Kalibrierungsfahrt generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler bei der Kalibrierungsfahrt.',
    },
    home: {
      successDelivered: 'Zentrierfahrt wurde an den Roboter gesendet.',
      infoSkipped: 'Zentrierfahrt generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Zentrierfahrt generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Zentrierfahrt generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Anfahren des Zentrums.',
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
    movementCount: number;
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

type PauseState = 'idle' | 'running' | 'success' | 'warning' | 'error';

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
const [jobProgress, setJobProgress] = useState<{ current: number; total: number } | null>(null);
const [pauseState, setPauseState] = useState<PauseState>('idle');
const [pauseError, setPauseError] = useState<string | null>(null);
const [pauseDeliveryStatus, setPauseDeliveryStatus] = useState<RobotStatus>('skipped');
const [pauseProgram, setPauseProgram] = useState<string | null>(null);
const [resumeState, setResumeState] = useState<PauseState>('idle');
const [resumeError, setResumeError] = useState<string | null>(null);
const [resumeDeliveryStatus, setResumeDeliveryStatus] = useState<RobotStatus>('skipped');
const [resumeProgram, setResumeProgram] = useState<string | null>(null);
const [calibrationState, setCalibrationState] = useState<PauseState>('idle');
const [calibrationError, setCalibrationError] = useState<string | null>(null);
const [calibrationDeliveryStatus, setCalibrationDeliveryStatus] = useState<RobotStatus>('skipped');
const [calibrationProgram, setCalibrationProgram] = useState<string | null>(null);
const [homeState, setHomeState] = useState<PauseState>('idle');
const [homeError, setHomeError] = useState<string | null>(null);
const [homeDeliveryStatus, setHomeDeliveryStatus] = useState<RobotStatus>('skipped');
const [homeProgram, setHomeProgram] = useState<string | null>(null);

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

  useEffect(() => {
    if (!result?.jobId) {
      return undefined;
    }

    let cancelled = false;

    const fetchProgress = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/progress/${result.jobId}`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { current: number; total: number };
        if (!cancelled) {
          setJobProgress({ current: payload.current, total: payload.total });
        }
      } catch {
        // Ignore polling errors; they will be retried on the next interval.
      }
    };

    fetchProgress();
    const intervalId = window.setInterval(fetchProgress, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [result?.jobId]);

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
    setCalibrationState('idle');
    setCalibrationError(null);
    setCalibrationDeliveryStatus('skipped');
    setCalibrationProgram(null);
    setJobProgress(null);
    setPauseState('idle');
    setPauseError(null);
    setPauseDeliveryStatus('skipped');
    setPauseProgram(null);
    setResumeState('idle');
    setResumeError(null);
    setResumeDeliveryStatus('skipped');
    setResumeProgram(null);
    setCalibrationState('idle');
    setCalibrationError(null);
    setCalibrationDeliveryStatus('skipped');
    setCalibrationProgram(null);
    setHomeState('idle');
    setHomeError(null);
    setHomeDeliveryStatus('skipped');
    setHomeProgram(null);
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
      if (payload.metadata.movementCount > 0) {
        setJobProgress({ current: 0, total: payload.metadata.movementCount });
      } else {
        setJobProgress(null);
      }
      setUploadState(response.status === 202 ? 'warning' : 'success');
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setErrorState({ key: 'custom', message: error.message });
      } else {
        setErrorState({ key: 'unexpected' });
      }
      setJobProgress(null);
      setUploadState('error');
      setPauseState('idle');
      setPauseError(null);
      setPauseDeliveryStatus('skipped');
      setPauseProgram(null);
      setResumeState('idle');
      setResumeError(null);
      setResumeDeliveryStatus('skipped');
      setResumeProgram(null);
      setCalibrationState('idle');
      setCalibrationError(null);
      setCalibrationDeliveryStatus('skipped');
      setCalibrationProgram(null);
      setHomeState('idle');
      setHomeError(null);
      setHomeDeliveryStatus('skipped');
      setHomeProgram(null);
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

  const handlePause = () => {
    setEmergencyOpen(true);
    setPendingEmergencyAction(() => executePause);
  };

  const executePause = async () => {
    setPauseState('running');
    setPauseError(null);
    setPauseDeliveryStatus('skipped');
    setPauseProgram(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result?.jobId ? { jobId: result.jobId } : {}),
      });

      const payload = (await response.json()) as { robotDelivery: { status: RobotStatus; error?: string }; program?: string | null };
      const deliveryStatus = payload.robotDelivery?.status ?? 'skipped';
      setPauseDeliveryStatus(deliveryStatus);
      setPauseProgram(payload.program ?? null);

      if (!response.ok && response.status !== 202) {
        const message = payload.robotDelivery?.error ?? 'Pause request failed.';
        throw new Error(message);
      }

      if (deliveryStatus === 'failed') {
        setPauseError(payload.robotDelivery?.error ?? t.pause.warningFailedFallback);
        setPauseState('warning');
      } else {
        setPauseState('success');
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setPauseError(error.message);
      } else {
        setPauseError(t.pause.errorUnexpected);
      }
      setPauseState('error');
      setPauseDeliveryStatus('failed');
    }
  };

  const handleResume = () => {
    if (!result?.jobId) {
      setResumeError(t.resume.errorUnexpected);
      setResumeState('error');
      return;
    }
    setEmergencyOpen(true);
    setPendingEmergencyAction(() => executeResume);
  };

  const executeResume = async () => {
    if (!result?.jobId) {
      setResumeError(t.resume.errorUnexpected);
      setResumeState('error');
      return;
    }

    setResumeState('running');
    setResumeError(null);
    setResumeDeliveryStatus('skipped');
    setResumeProgram(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: result.jobId }),
      });

      const payload = (await response.json()) as {
        robotDelivery: { status: RobotStatus; error?: string };
        resumePosition?: number;
        program?: string | null;
      };

      const deliveryStatus = payload.robotDelivery?.status ?? 'skipped';
      setResumeDeliveryStatus(deliveryStatus);
      setResumeProgram(payload.program ?? null);

      if (!response.ok && response.status !== 202) {
        const message = payload.robotDelivery?.error ?? 'Resume request failed.';
        throw new Error(message);
      }

      if (deliveryStatus === 'failed') {
        setResumeError(payload.robotDelivery?.error ?? t.resume.warningFailedFallback);
        setResumeState('warning');
      } else {
        setResumeState('success');
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setResumeError(error.message);
      } else {
        setResumeError(t.resume.errorUnexpected);
      }
      setResumeDeliveryStatus('failed');
      setResumeState('error');
    }
  };

  const handleCalibrate = () => {
    setEmergencyOpen(true);
    setPendingEmergencyAction(() => executeCalibrate);
  };

  const executeCalibrate = async () => {
    setCalibrationState('running');
    setCalibrationError(null);
    setCalibrationDeliveryStatus('skipped');
    setCalibrationProgram(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/calibrate`, {
        method: 'POST',
      });

      const payload = (await response.json()) as {
        robotDelivery: { status: RobotStatus; error?: string };
        program?: string;
      };

      const deliveryStatus = payload.robotDelivery?.status ?? 'skipped';
      setCalibrationDeliveryStatus(deliveryStatus);
      setCalibrationProgram(payload.program ?? null);

      if (!response.ok && response.status !== 202) {
        const message = payload.robotDelivery?.error ?? 'Calibration request failed.';
        throw new Error(message);
      }

      if (deliveryStatus === 'failed') {
        setCalibrationError(payload.robotDelivery?.error ?? t.calibrate.warningFailedFallback);
        setCalibrationState('warning');
      } else {
        setCalibrationState('success');
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setCalibrationError(error.message);
      } else {
        setCalibrationError(t.calibrate.errorUnexpected);
      }
      setCalibrationDeliveryStatus('failed');
      setCalibrationState('error');
    }
  };

  const handleHome = () => {
    setEmergencyOpen(true);
    setPendingEmergencyAction(() => executeHome);
  };

  const executeHome = async () => {
    setHomeState('running');
    setHomeError(null);
    setHomeDeliveryStatus('skipped');
    setHomeProgram(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/home`, {
        method: 'POST',
      });

      const payload = (await response.json()) as {
        robotDelivery: { status: RobotStatus; error?: string };
        program?: string;
      };

      const deliveryStatus = payload.robotDelivery?.status ?? 'skipped';
      setHomeDeliveryStatus(deliveryStatus);
      setHomeProgram(payload.program ?? null);

      if (!response.ok && response.status !== 202) {
        const message = payload.robotDelivery?.error ?? 'Home request failed.';
        throw new Error(message);
      }

      if (deliveryStatus === 'failed') {
        setHomeError(payload.robotDelivery?.error ?? t.home.warningFailedFallback);
        setHomeState('warning');
      } else {
        setHomeState('success');
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setHomeError(error.message);
      } else {
        setHomeError(t.home.errorUnexpected);
      }
      setHomeDeliveryStatus('failed');
      setHomeState('error');
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
                boundingBoxState === 'running'
              }
            >
              {boundingBoxState === 'running' ? t.actions.boundingBoxRunning : t.actions.boundingBox}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handlePause}
              disabled={uploadState === 'uploading' || pauseState === 'running'}
            >
              {pauseState === 'running' ? t.actions.pauseRunning : t.actions.pause}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleResume}
              disabled={
                uploadState === 'uploading' ||
                resumeState === 'running' ||
                !result?.jobId
              }
            >
              {resumeState === 'running' ? t.actions.resumeRunning : t.actions.resume}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleCalibrate}
              disabled={uploadState === 'uploading' || calibrationState === 'running'}
            >
              {calibrationState === 'running' ? t.actions.calibrateRunning : t.actions.calibrate}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleHome}
              disabled={uploadState === 'uploading' || homeState === 'running'}
            >
              {homeState === 'running' ? t.actions.homeRunning : t.actions.home}
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
        {pauseState === 'error' && pauseError && <p className="message error">{pauseError}</p>}
        {pauseState === 'warning' && (
          <p className="message warning">
            {pauseError ? `${t.pause.warningFailedPrefix} ${pauseError}` : t.pause.warningFailedFallback}
          </p>
        )}
        {pauseState === 'success' && pauseDeliveryStatus === 'delivered' && (
          <p className="message success">{t.pause.successDelivered}</p>
        )}
        {pauseState === 'success' && pauseDeliveryStatus === 'skipped' && (
          <p className="message info">{t.pause.infoSkipped}</p>
        )}
        {resumeState === 'error' && resumeError && <p className="message error">{resumeError}</p>}
        {resumeState === 'warning' && (
          <p className="message warning">
            {resumeError ? `${t.resume.warningFailedPrefix} ${resumeError}` : t.resume.warningFailedFallback}
          </p>
        )}
        {resumeState === 'success' && resumeDeliveryStatus === 'delivered' && (
          <p className="message success">{t.resume.successDelivered}</p>
        )}
        {resumeState === 'success' && resumeDeliveryStatus === 'skipped' && (
          <p className="message info">{t.resume.infoSkipped}</p>
        )}
        {calibrationState === 'error' && calibrationError && <p className="message error">{calibrationError}</p>}
        {calibrationState === 'warning' && (
          <p className="message warning">
            {calibrationError ? `${t.calibrate.warningFailedPrefix} ${calibrationError}` : t.calibrate.warningFailedFallback}
          </p>
        )}
        {calibrationState === 'success' && calibrationDeliveryStatus === 'delivered' && (
          <p className="message success">{t.calibrate.successDelivered}</p>
        )}
        {calibrationState === 'success' && calibrationDeliveryStatus === 'skipped' && (
          <p className="message info">{t.calibrate.infoSkipped}</p>
        )}
        {homeState === 'error' && homeError && <p className="message error">{homeError}</p>}
        {homeState === 'warning' && (
          <p className="message warning">
            {homeError ? `${t.home.warningFailedPrefix} ${homeError}` : t.home.warningFailedFallback}
          </p>
        )}
        {homeState === 'success' && homeDeliveryStatus === 'delivered' && (
          <p className="message success">{t.home.successDelivered}</p>
        )}
        {homeState === 'success' && homeDeliveryStatus === 'skipped' && (
          <p className="message info">{t.home.infoSkipped}</p>
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
              <strong>{t.metadataLabels.progress}:</strong>{' '}
              {jobProgress ? `${jobProgress.current}/${jobProgress.total}` : result.metadata.movementCount > 0 ? `0/${result.metadata.movementCount}` : '—'}
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
      {pauseProgram && (
        <section className="panel">
          <h2>{t.actions.pause}</h2>
          <textarea className="program-output" value={pauseProgram} readOnly rows={8} />
        </section>
      )}
      {resumeProgram && (
        <section className="panel">
          <h2>{t.actions.resume}</h2>
          <textarea className="program-output" value={resumeProgram} readOnly rows={8} />
        </section>
      )}
      {calibrationProgram && (
        <section className="panel">
          <h2>{t.actions.calibrate}</h2>
          <textarea className="program-output" value={calibrationProgram} readOnly rows={8} />
        </section>
      )}
      {homeProgram && (
        <section className="panel">
          <h2>{t.actions.home}</h2>
          <textarea className="program-output" value={homeProgram} readOnly rows={8} />
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
