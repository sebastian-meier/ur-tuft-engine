/**
 * Presentational root component for the UR Tuft Engine UI. Collects user uploads, relays them to
 * the backend API, and surfaces the generated robot program and telemetry. Includes a lightweight
 * language switch so the interface can be used in English and German.
 */
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
    stopTool: string;
    stopToolRunning: string;
    boundingBox: string;
    boundingBoxRunning: string;
    emergency: string;
    emergencyConfirm: string;
    emergencyCancel: string;
    start: string;
    startRunning: string;
    pause: string;
    pauseRunning: string;
    resume: string;
    resumeRunning: string;
    calibrate: string;
    calibrateRunning: string;
    home: string;
    homeRunning: string;
    progressApply: string;
    progressApplyRunning: string;
    seek: string;
    seekRunning: string;
    safeHeight: string;
    safeHeightRunning: string;
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
  programParts: {
    heading: string;
    selectLabel: string;
    optionLabel: string;
    movelSuffix: string;
    blockSuffix: string;
    progressPrefix: string;
    unavailable: string;
  };
  programDetailsHeading: string;
  manualProgress: {
    currentLabel: string;
    targetLabel: string;
  };
  metadataLabels: {
    jobId: string;
    estimatedCycleTime: string;
    workspaceMapping: string;
    imageSize: string;
    tuftSegments: string;
    activePixels: string;
    movelCommands: string;
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
  toolStop: {
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
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
  start: {
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
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
  seek: {
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
  };
  safeHeight: {
    successDelivered: string;
    infoSkipped: string;
    warningFailedPrefix: string;
    warningFailedFallback: string;
    errorUnexpected: string;
  };
  introduction: {
    heading: string;
    sections: Array<{
      heading: string;
      steps: string[];
    }>;
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
      stopTool: 'Stop Tufting Gun',
      stopToolRunning: 'Stopping tufting gun…',
      boundingBox: 'Visit Tuft Area Corners',
      boundingBoxRunning: 'Moving to tuft area corners…',
      emergency: 'Emergency Routine',
      emergencyConfirm: 'Confirm & Execute',
      emergencyCancel: 'Cancel',
      start: 'Send Program Part',
      startRunning: 'Sending…',
      pause: 'Pause & Raise Tool',
      pauseRunning: 'Pausing…',
      resume: 'Resume Program',
      resumeRunning: 'Resuming…',
      calibrate: 'Calibrate Z-Max',
      calibrateRunning: 'Calibrating…',
      home: 'Home to Center',
      homeRunning: 'Moving to center…',
      safeHeight: 'Raise to Safe Height',
      safeHeightRunning: 'Raising to safe height…',
      progressApply: 'Update Progress',
      progressApplyRunning: 'Updating progress…',
      seek: 'Move to Step',
      seekRunning: 'Moving to step…',
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
    programParts: {
      heading: 'Program parts',
      selectLabel: 'Program part',
      optionLabel: 'Part',
      movelSuffix: 'movel commands',
      blockSuffix: 'movement blocks',
      progressPrefix: 'Progress offset',
      unavailable: 'No program parts generated for this artwork.',
    },
    programDetailsHeading: 'Program Details',
    manualProgress: {
      currentLabel: 'Robot progress index',
      targetLabel: 'Set progress to index',
    },
    metadataLabels: {
      jobId: 'Job ID',
      estimatedCycleTime: 'Estimated Cycle Time',
      workspaceMapping: 'Workspace Mapping',
      imageSize: 'Image Size',
      tuftSegments: 'Tuft Segments',
      activePixels: 'Active Pixels',
      movelCommands: 'movel Commands',
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
    toolStop: {
      successDelivered: 'Tufting gun stop command delivered to the robot.',
      infoSkipped: 'Tufting gun stop command generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Tufting gun stop command generated, but sending to the robot failed:',
      warningFailedFallback: 'Tufting gun stop command generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while stopping the tufting gun.',
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
  start: {
    successDelivered: 'Program delivered to the robot.',
    infoSkipped: 'Program generated; configure a robot host to send it automatically.',
    warningFailedPrefix: 'Program generated, but sending to the robot failed:',
    warningFailedFallback: 'Program generated, but sending to the robot failed.',
    errorUnexpected: 'Unexpected error while starting the job.',
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
    safeHeight: {
      successDelivered: 'Safe-height raise delivered to the robot.',
      infoSkipped: 'Safe-height raise generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Safe-height raise generated, but sending to the robot failed:',
      warningFailedFallback: 'Safe-height raise generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while moving to the safe height.',
    },
    seek: {
      successDelivered: 'Seek routine delivered to the robot.',
      infoSkipped: 'Seek routine generated; configure a robot host to execute automatically.',
      warningFailedPrefix: 'Seek routine generated, but sending to the robot failed:',
      warningFailedFallback: 'Seek routine generated, but sending to the robot failed.',
      errorUnexpected: 'Unexpected error while moving to the selected step.',
    },
    introduction: {
      heading: 'Introduction',
      sections: [
        {
          heading: 'Starting the System',
          steps: [
            'Connect power',
            'Start computer',
            'Connect yarn to the tufting gun and check fabric',
            'Start robot with the control panel (follow startup sequence on the panel until everything is green)',
            'Make sure the robot is in Remote-Mode (see control panel upper right)',
            'Switch on tufting gun (if not already on)',
            'Remove cover of the tufting needle',
            'Make sure nobody is standing near the robot',
            'Check you followed all security guidelines',
            'Release the security stop and follow steps on the control panel',
          ],
        },
        {
          heading: 'Test the Robot',
          steps: [
            'Click on "Reset"',
            'Click on "Home to Center"',
            'Click on "Test Tufting Gun"',
            'Click on "Run Preflight"',
          ],
        },
        {
          heading: 'Start Tufting',
          steps: [
            'Select an Image',
            'Click on "Generate Program"',
            'Click on "Visit Tuft Area Corners" (Make sure this is actually the area you want to tuft on)',
            'Click on "Start Job"',
          ],
        },
        {
          heading: 'Finishing up',
          steps: [
            'Shut down robot through the control panel',
            'Put on needle cover',
            'Shut down computer',
            'Press the emergency button',
            'Unplug power cord',
            'Clean up',
          ],
        },
      ],
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
      stopTool: 'Tufting-Gun stoppen',
      stopToolRunning: 'Tufting-Gun wird gestoppt…',
      boundingBox: 'Ecken der Tuft-Fläche anfahren',
      boundingBoxRunning: 'Roboter fährt Tuft-Fläche ab…',
      emergency: 'Notfallroutine',
      emergencyConfirm: 'Bestätigen & Ausführen',
      emergencyCancel: 'Abbrechen',
      start: 'Programmschritt senden',
      startRunning: 'Sende…',
      pause: 'Pause & Werkzeug anheben',
      pauseRunning: 'Pausiere…',
      resume: 'Programm fortsetzen',
      resumeRunning: 'Fortsetzen…',
      calibrate: 'Kalibrierung Z-Max',
      calibrateRunning: 'Kalibriere…',
      home: 'Zum Zentrum fahren',
      homeRunning: 'Fahre zum Zentrum…',
      safeHeight: 'Sicherheitsabstand anfahren',
      safeHeightRunning: 'Sicherheitsabstand wird angefahren…',
      progressApply: 'Fortschritt aktualisieren',
      progressApplyRunning: 'Aktualisiere Fortschritt…',
      seek: 'Zu Schritt fahren',
      seekRunning: 'Fahre zu Schritt…',
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
    programParts: {
      heading: 'Programmschritte',
      selectLabel: 'Programmschritt',
      optionLabel: 'Teil',
      movelSuffix: 'movel-Befehle',
      blockSuffix: 'Bewegungsbloecke',
      progressPrefix: 'Fortschritts-Offset',
      unavailable: 'Keine Programmschritte fuer dieses Motiv erstellt.',
    },
    programDetailsHeading: 'Programmdetails',
    manualProgress: {
      currentLabel: 'Roboter-Fortschrittsindex',
      targetLabel: 'Fortschritt auf Index setzen',
    },
    metadataLabels: {
      jobId: 'Job-ID',
      estimatedCycleTime: 'Geschaetzte Zykluszeit',
      workspaceMapping: 'Arbeitsbereich',
      imageSize: 'Bildgroesse',
      tuftSegments: 'Tuft-Segmente',
      activePixels: 'Aktive Pixel',
      movelCommands: 'movel-Befehle',
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
    toolStop: {
      successDelivered: 'Stop-Befehl für die Tufting-Gun wurde an den Roboter gesendet.',
      infoSkipped: 'Stop-Befehl generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Stop-Befehl generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Stop-Befehl generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Stoppen der Tufting-Gun.',
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
  start: {
    successDelivered: 'Programm an den Roboter übertragen.',
    infoSkipped: 'Programm generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
    warningFailedPrefix: 'Programm generiert, aber die Roboterübertragung ist fehlgeschlagen:',
    warningFailedFallback: 'Programm generiert, aber die Roboterübertragung ist fehlgeschlagen.',
    errorUnexpected: 'Unerwarteter Fehler beim Starten des Programms.',
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
    safeHeight: {
      successDelivered: 'Sicherheitsabstandsbewegung wurde an den Roboter gesendet.',
      infoSkipped: 'Sicherheitsabstandsbewegung generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Sicherheitsabstandsbewegung generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Sicherheitsabstandsbewegung generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Anfahren des Sicherheitsabstands.',
    },
    seek: {
      successDelivered: 'Positionierungsfahrt wurde an den Roboter gesendet.',
      infoSkipped: 'Positionierungsfahrt generiert. Konfiguriere einen Roboter-Host für die automatische Ausführung.',
      warningFailedPrefix: 'Positionierungsfahrt generiert, aber die Roboterübertragung ist fehlgeschlagen:',
      warningFailedFallback: 'Positionierungsfahrt generiert, aber die Roboterübertragung ist fehlgeschlagen.',
      errorUnexpected: 'Unerwarteter Fehler beim Anfahren des gewählten Schritts.',
    },
    introduction: {
      heading: 'Einführung',
      sections: [
        {
          heading: 'System starten',
          steps: [
            'Strom anschließen',
            'Computer starten',
            'Garn an der Tufting-Gun anschließen und Stoff prüfen',
            'Roboter über das Bedienpanel starten (Startsequenz am Panel befolgen, bis alles grün ist)',
            'Sicherstellen, dass der Roboter im Remote-Modus ist (siehe Bedienpanel oben rechts)',
            'Tufting-Gun einschalten (falls noch aus)',
            'Schutz der Tufting-Nadel abnehmen',
            'Sicherstellen, dass niemand in der Nähe des Roboters steht',
            'Prüfen, dass alle Sicherheitsrichtlinien beachtet wurden',
            'Sicherheitsstopp lösen und den Anweisungen auf dem Bedienpanel folgen',
          ],
        },
        {
          heading: 'Roboter testen',
          steps: [
            'Auf "Zuruecksetzen" klicken',
            'Auf "Zum Zentrum fahren" klicken',
            'Auf "Tufting-Gun testen" klicken',
            'Auf "Preflight starten" klicken',
          ],
        },
        {
          heading: 'Tuften starten',
          steps: [
            'Bild auswählen',
            'Auf "Programm erzeugen" klicken',
            'Auf "Ecken der Tuft-Fläche anfahren" klicken (sicherstellen, dass dies die gewünschte Tuft-Fläche ist)',
            'Auf "Programm starten" klicken',
          ],
        },
        {
          heading: 'Abschließen',
          steps: [
            'Roboter über das Bedienpanel herunterfahren',
            'Nadelschutz aufsetzen',
            'Computer herunterfahren',
            'Not-Aus-Taster drücken',
            'Stromkabel abstecken',
            'Arbeitsbereich aufräumen',
          ],
        },
      ],
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

interface ProgramChunkDetails {
  program: string;
  startIndex: number;
  endIndex: number;
  blockCount: number;
  movelCount: number;
  progressStart: number;
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
    movelCommandCount: number;
  };
  programChunks: ProgramChunkDetails[];
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

interface ToolStopResponse {
  program: string;
  robotDelivery: {
    attempted: boolean;
    status: RobotStatus;
    error?: string;
  };
}

type ToolStopState = 'idle' | 'running' | 'success' | 'warning' | 'error';

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
  const [selectedChunkIndex, setSelectedChunkIndex] = useState(0);
  const [preflightState, setPreflightState] = useState<PreflightState>('idle');
  const [preflightResult, setPreflightResult] = useState<PreflightResponse | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [toolTestState, setToolTestState] = useState<ToolTestState>('idle');
  const [toolTestResult, setToolTestResult] = useState<ToolTestResponse | null>(null);
  const [toolTestError, setToolTestError] = useState<string | null>(null);
  const [toolStopState, setToolStopState] = useState<ToolStopState>('idle');
  const [toolStopError, setToolStopError] = useState<string | null>(null);
  const [toolStopDeliveryStatus, setToolStopDeliveryStatus] = useState<RobotStatus>('skipped');
  const [toolStopProgram, setToolStopProgram] = useState<string | null>(null);
  const [boundingBoxState, setBoundingBoxState] = useState<BoundingBoxRoutineState>('idle');
const [boundingBoxResult, setBoundingBoxResult] = useState<BoundingBoxRoutineResponse | null>(null);
const [boundingBoxError, setBoundingBoxError] = useState<string | null>(null);
const [emergencyOpen, setEmergencyOpen] = useState(false);
const [pendingEmergencyAction, setPendingEmergencyAction] = useState<null | (() => Promise<void>)>(null);
const [jobProgress, setJobProgress] = useState<{ current: number; total: number } | null>(null);
const [isProgressPollingPaused, setIsProgressPollingPaused] = useState(false);
const [pauseState, setPauseState] = useState<PauseState>('idle');
const [pauseError, setPauseError] = useState<string | null>(null);
const [pauseDeliveryStatus, setPauseDeliveryStatus] = useState<RobotStatus>('skipped');
const [pauseProgram, setPauseProgram] = useState<string | null>(null);
const [startState, setStartState] = useState<PauseState>('idle');
const [startError, setStartError] = useState<string | null>(null);
const [startDeliveryStatus, setStartDeliveryStatus] = useState<RobotStatus>('skipped');
const [startProgram, setStartProgram] = useState<string | null>(null);
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
  const [safeHeightState, setSafeHeightState] = useState<PauseState>('idle');
  const [safeHeightError, setSafeHeightError] = useState<string | null>(null);
  const [safeHeightDeliveryStatus, setSafeHeightDeliveryStatus] = useState<RobotStatus>('skipped');
  const [safeHeightProgram, setSafeHeightProgram] = useState<string | null>(null);
const [seekState, setSeekState] = useState<PauseState>('idle');
const [seekError, setSeekError] = useState<string | null>(null);
const [seekDeliveryStatus, setSeekDeliveryStatus] = useState<RobotStatus>('skipped');
const [seekProgram, setSeekProgram] = useState<string | null>(null);
const [manualProgressInput, setManualProgressInput] = useState('');
const [manualProgressApplying, setManualProgressApplying] = useState(false);
const [manualProgressError, setManualProgressError] = useState<string | null>(null);

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
    if (!result?.jobId || isProgressPollingPaused) {
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
  }, [result?.jobId, isProgressPollingPaused]);

  useEffect(() => {
    if (!result?.programChunks || result.programChunks.length === 0) {
      if (selectedChunkIndex !== 0) {
        setSelectedChunkIndex(0);
      }
      return;
    }
    const clampedIndex = Math.min(
      Math.max(0, selectedChunkIndex),
      result.programChunks.length - 1,
    );
    if (clampedIndex !== selectedChunkIndex) {
      setSelectedChunkIndex(clampedIndex);
    }
  }, [result?.programChunks, selectedChunkIndex]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 }),
    [language],
  );

  const reset = () => {
    setSelectedFile(null);
    setUploadState('idle');
    setErrorState({ key: 'none' });
    setResult(null);
    setSelectedChunkIndex(0);
    setIsProgressPollingPaused(false);
    setPreflightState('idle');
    setPreflightResult(null);
    setPreflightError(null);
    setToolTestState('idle');
    setToolTestResult(null);
    setToolTestError(null);
    setToolStopState('idle');
    setToolStopError(null);
    setToolStopDeliveryStatus('skipped');
    setToolStopProgram(null);
    setBoundingBoxState('idle');
    setBoundingBoxResult(null);
    setBoundingBoxError(null);
    setStartState('idle');
    setStartError(null);
    setStartDeliveryStatus('skipped');
    setStartProgram(null);
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
    setSafeHeightState('idle');
    setSafeHeightError(null);
    setSafeHeightDeliveryStatus('skipped');
    setSafeHeightProgram(null);
    setSeekState('idle');
    setSeekError(null);
    setSeekDeliveryStatus('skipped');
    setSeekProgram(null);
    setManualProgressInput('');
    setManualProgressApplying(false);
    setManualProgressError(null);
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

  const statusMessages: Array<{ variant: 'error' | 'warning' | 'success' | 'info'; text: string }> = [];

  if (uploadState === 'error' && currentErrorMessage) {
    statusMessages.push({ variant: 'error', text: currentErrorMessage });
  }
  const uploadDeliveryStatus: RobotStatus = result ? startDeliveryStatus : 'skipped';
  const uploadDeliveryError = startError;

  if (uploadState === 'warning' && uploadDeliveryStatus === 'failed') {
    statusMessages.push({
      variant: 'warning',
      text: uploadDeliveryError
        ? `${t.messages.warningFailedPrefix} ${uploadDeliveryError}`
        : t.messages.warningFailedFallback,
    });
  }
  if (uploadState === 'success' && uploadDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.messages.successDelivered });
  }
  if (uploadState === 'success' && uploadDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.messages.infoSkipped });
  }
  if (preflightState === 'error' && preflightError) {
    statusMessages.push({ variant: 'error', text: preflightError });
  }
  if (preflightState === 'warning' && preflightResult?.robotDelivery.status === 'failed') {
    statusMessages.push({
      variant: 'warning',
      text: preflightResult.robotDelivery.error
        ? `${t.preflight.warningFailedPrefix} ${preflightResult.robotDelivery.error}`
        : t.preflight.warningFailedFallback,
    });
  }
  if (preflightState === 'success' && preflightResult?.robotDelivery.status === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.preflight.successDelivered });
  }
  if (preflightState === 'success' && preflightResult?.robotDelivery.status === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.preflight.infoSkipped });
  }
  if (toolTestState === 'error' && toolTestError) {
    statusMessages.push({ variant: 'error', text: toolTestError });
  }
  if (toolTestState === 'warning' && toolTestResult?.robotDelivery.status === 'failed') {
    statusMessages.push({
      variant: 'warning',
      text: toolTestResult.robotDelivery.error
        ? `${t.toolTest.warningFailedPrefix} ${toolTestResult.robotDelivery.error}`
        : t.toolTest.warningFailedFallback,
    });
  }
  if (toolTestState === 'success' && toolTestResult?.robotDelivery.status === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.toolTest.successDelivered });
  }
  if (toolTestState === 'success' && toolTestResult?.robotDelivery.status === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.toolTest.infoSkipped });
  }
  if (toolStopState === 'error' && toolStopError) {
    statusMessages.push({ variant: 'error', text: toolStopError });
  }
  if (toolStopState === 'warning') {
    statusMessages.push({
      variant: 'warning',
      text: toolStopError ? `${t.toolStop.warningFailedPrefix} ${toolStopError}` : t.toolStop.warningFailedFallback,
    });
  }
  if (toolStopState === 'success' && toolStopDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.toolStop.successDelivered });
  }
  if (toolStopState === 'success' && toolStopDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.toolStop.infoSkipped });
  }
  if (boundingBoxState === 'error' && boundingBoxError) {
    statusMessages.push({ variant: 'error', text: boundingBoxError });
  }
  if (boundingBoxState === 'warning' && boundingBoxResult?.robotDelivery.status === 'failed') {
    statusMessages.push({
      variant: 'warning',
      text: boundingBoxResult.robotDelivery.error
        ? `${t.boundingBox.warningFailedPrefix} ${boundingBoxResult.robotDelivery.error}`
        : t.boundingBox.warningFailedFallback,
    });
  }
  if (boundingBoxState === 'success' && boundingBoxResult?.robotDelivery.status === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.boundingBox.successDelivered });
  }
  if (boundingBoxState === 'success' && boundingBoxResult?.robotDelivery.status === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.boundingBox.infoSkipped });
  }
  if (startState === 'error' && startError) {
    statusMessages.push({ variant: 'error', text: startError });
  }
  if (startState === 'warning') {
    statusMessages.push({
      variant: 'warning',
      text: startError ? `${t.start.warningFailedPrefix} ${startError}` : t.start.warningFailedFallback,
    });
  }
  if (startState === 'success' && startDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.start.successDelivered });
  }
  if (startState === 'success' && startDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.start.infoSkipped });
  }
  if (pauseState === 'error' && pauseError) {
    statusMessages.push({ variant: 'error', text: pauseError });
  }
  if (pauseState === 'warning') {
    statusMessages.push({
      variant: 'warning',
      text: pauseError ? `${t.pause.warningFailedPrefix} ${pauseError}` : t.pause.warningFailedFallback,
    });
  }
  if (pauseState === 'success' && pauseDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.pause.successDelivered });
  }
  if (pauseState === 'success' && pauseDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.pause.infoSkipped });
  }
  if (resumeState === 'error' && resumeError) {
    statusMessages.push({ variant: 'error', text: resumeError });
  }
  if (resumeState === 'warning') {
    statusMessages.push({
      variant: 'warning',
      text: resumeError ? `${t.resume.warningFailedPrefix} ${resumeError}` : t.resume.warningFailedFallback,
    });
  }
  if (resumeState === 'success' && resumeDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.resume.successDelivered });
  }
  if (resumeState === 'success' && resumeDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.resume.infoSkipped });
  }
  if (calibrationState === 'error' && calibrationError) {
    statusMessages.push({ variant: 'error', text: calibrationError });
  }
  if (calibrationState === 'warning') {
    statusMessages.push({
      variant: 'warning',
      text: calibrationError
        ? `${t.calibrate.warningFailedPrefix} ${calibrationError}`
        : t.calibrate.warningFailedFallback,
    });
  }
  if (calibrationState === 'success' && calibrationDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.calibrate.successDelivered });
  }
  if (calibrationState === 'success' && calibrationDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.calibrate.infoSkipped });
  }
  if (homeState === 'error' && homeError) {
    statusMessages.push({ variant: 'error', text: homeError });
  }
  if (homeState === 'warning') {
    statusMessages.push({
      variant: 'warning',
      text: homeError ? `${t.home.warningFailedPrefix} ${homeError}` : t.home.warningFailedFallback,
    });
  }
  if (homeState === 'success' && homeDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.home.successDelivered });
  }
  if (homeState === 'success' && homeDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.home.infoSkipped });
  }
  if (safeHeightState === 'error' && safeHeightError) {
    statusMessages.push({ variant: 'error', text: safeHeightError });
  }
  if (safeHeightState === 'warning') {
    statusMessages.push({
      variant: 'warning',
      text: safeHeightError
        ? `${t.safeHeight.warningFailedPrefix} ${safeHeightError}`
        : t.safeHeight.warningFailedFallback,
    });
  }
  if (safeHeightState === 'success' && safeHeightDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.safeHeight.successDelivered });
  }
  if (safeHeightState === 'success' && safeHeightDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.safeHeight.infoSkipped });
  }
  if (seekState === 'error' && seekError) {
    statusMessages.push({ variant: 'error', text: seekError });
  }
  if (seekState === 'warning') {
    statusMessages.push({
      variant: 'warning',
      text: seekError ? `${t.seek.warningFailedPrefix} ${seekError}` : t.seek.warningFailedFallback,
    });
  }
  if (seekState === 'success' && seekDeliveryStatus === 'delivered') {
    statusMessages.push({ variant: 'success', text: t.seek.successDelivered });
  }
  if (seekState === 'success' && seekDeliveryStatus === 'skipped') {
    statusMessages.push({ variant: 'info', text: t.seek.infoSkipped });
  }

  const latestMessage = statusMessages.length > 0 ? statusMessages[statusMessages.length - 1] : null;
  const latestMessageClass = latestMessage ? `message ${latestMessage.variant}` : '';
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
    setSelectedChunkIndex(0);
    setIsProgressPollingPaused(false);
    setPreflightState('idle');
    setPreflightResult(null);
    setPreflightError(null);
    setToolTestState('idle');
    setToolTestResult(null);
    setToolTestError(null);
    setToolStopState('idle');
    setToolStopError(null);
    setToolStopDeliveryStatus('skipped');
    setToolStopProgram(null);
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
      setSelectedChunkIndex(0);
      setIsProgressPollingPaused(false);
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
      setIsProgressPollingPaused(false);
      setUploadState('error');
      setStartState('idle');
      setStartError(null);
      setStartDeliveryStatus('skipped');
      setStartProgram(null);
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
      setToolStopState('idle');
      setToolStopError(null);
      setToolStopDeliveryStatus('skipped');
      setToolStopProgram(null);
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

  const handleToolStop = () => {
    void executeToolStop();
  };

  const executeToolStop = async () => {
    setToolStopState('running');
    setToolStopError(null);
    setToolStopDeliveryStatus('skipped');
    setToolStopProgram(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tool-stop`, {
        method: 'POST',
      });

      const payload = (await response.json()) as ToolStopResponse & { error?: string };
      const deliveryStatus = payload.robotDelivery?.status ?? 'skipped';
      setToolStopDeliveryStatus(deliveryStatus);
      setToolStopProgram(payload.program ?? null);

      if (!response.ok && response.status !== 202) {
        const message = payload.robotDelivery?.error ?? payload.error ?? 'Tool stop failed.';
        throw new Error(message);
      }

      if (deliveryStatus === 'failed') {
        setToolStopError(payload.robotDelivery?.error ?? t.toolStop.warningFailedFallback);
        setToolStopState('warning');
      } else {
        setToolStopState('success');
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setToolStopError(error.message);
      } else {
        setToolStopError(t.toolStop.errorUnexpected);
      }
      setToolStopState('error');
      setToolStopDeliveryStatus('failed');
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

  const executePause = useCallback(async () => {
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
      if (deliveryStatus === 'delivered') {
        setIsProgressPollingPaused(true);
      }

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
  }, [result?.jobId, t.pause.errorUnexpected, t.pause.warningFailedFallback]);

  const handlePause = useCallback(() => {
    if (uploadState === 'uploading' || pauseState === 'running') {
      return;
    }

    void executePause();
  }, [executePause, pauseState, uploadState]);

  useEffect(() => {
    const handleSpacebarPause = (event: KeyboardEvent) => {
      if (event.repeat || (event.code !== 'Space' && event.key !== ' ')) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (uploadState === 'uploading' || pauseState === 'running') {
        return;
      }

      event.preventDefault();
      handlePause();
    };

    window.addEventListener('keydown', handleSpacebarPause);

    return () => {
      window.removeEventListener('keydown', handleSpacebarPause);
    };
  }, [handlePause, pauseState, uploadState]);

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
      if (deliveryStatus === 'delivered') {
        setIsProgressPollingPaused(false);
      }

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

  const handleStartJob = () => {
    setEmergencyOpen(true);
    setPendingEmergencyAction(() => executeStartJob);
  };

  const executeStartJob = async () => {
    if (!result?.jobId) {
      setStartError('No job loaded.');
      setStartState('error');
      return;
    }

    setStartState('running');
    setStartError(null);
    setStartDeliveryStatus('skipped');
    setStartProgram(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: result.jobId, chunkIndex: selectedChunkIndex }),
      });

      const payload = (await response.json()) as {
        robotDelivery: { status: RobotStatus; error?: string };
        program?: string | null;
      };

      const deliveryStatus = payload.robotDelivery?.status ?? 'skipped';
      setStartDeliveryStatus(deliveryStatus);
      setStartProgram(payload.program ?? null);
      if (deliveryStatus === 'delivered') {
        setIsProgressPollingPaused(false);
      }

      if (!response.ok && response.status !== 202) {
        const message = payload.robotDelivery?.error ?? 'Start request failed.';
        throw new Error(message);
      }

      if (deliveryStatus === 'failed') {
        setStartError(payload.robotDelivery?.error ?? t.start.warningFailedFallback);
        setStartState('warning');
      } else {
        setStartState('success');
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setStartError(error.message);
      } else {
        setStartError(t.start.errorUnexpected);
      }
      setStartDeliveryStatus('failed');
      setStartState('error');
    }
  };

  const executeCalibrate = async () => {
    setCalibrationState('running');
    setCalibrationError(null);
    setCalibrationDeliveryStatus('skipped');
    setCalibrationProgram(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/calibrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result?.jobId ? { jobId: result.jobId } : {}),
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

  const handleSafeHeight = () => {
    setEmergencyOpen(true);
    setPendingEmergencyAction(() => executeSafeHeight);
  };

  const executeSafeHeight = async () => {
    setSafeHeightState('running');
    setSafeHeightError(null);
    setSafeHeightDeliveryStatus('skipped');
    setSafeHeightProgram(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/safe-height`, {
        method: 'POST',
      });

      const payload = (await response.json()) as {
        robotDelivery: { status: RobotStatus; error?: string };
        program?: string | null;
      };

      const deliveryStatus = payload.robotDelivery?.status ?? 'skipped';
      setSafeHeightDeliveryStatus(deliveryStatus);
      setSafeHeightProgram(payload.program ?? null);

      if (!response.ok && response.status !== 202) {
        const message = payload.robotDelivery?.error ?? 'Safe-height request failed.';
        throw new Error(message);
      }

      if (deliveryStatus === 'failed') {
        setSafeHeightError(payload.robotDelivery?.error ?? t.safeHeight.warningFailedFallback);
        setSafeHeightState('warning');
      } else {
        setSafeHeightState('success');
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setSafeHeightError(error.message);
      } else {
        setSafeHeightError(t.safeHeight.errorUnexpected);
      }
      setSafeHeightDeliveryStatus('failed');
      setSafeHeightState('error');
    }
  };

  const overrideProgressOnServer = async (value: number) => {
    if (!result?.jobId) {
      throw new Error('No job loaded');
    }

    const response = await fetch(`${API_BASE_URL}/api/progress/${result.jobId}/override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ current: value }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: 'Unable to override progress.' }))) as
        | { error?: string }
        | undefined;
      throw new Error(payload?.error ?? 'Unable to override progress.');
    }

    const entry = (await response.json()) as { current: number; total: number };
    setJobProgress({ current: entry.current, total: entry.total });
    setManualProgressInput(String(entry.current));
    setManualProgressError(null);
    return entry;
  };

  const applyManualProgress = async () => {
    if (!result?.jobId) {
      setManualProgressError('No job loaded.');
      return;
    }

    const value = Number.parseInt(manualProgressInput, 10);
    if (Number.isNaN(value)) {
      setManualProgressError('Enter a valid step number.');
      return;
    }

    if (jobProgress && value > jobProgress.total) {
      setManualProgressError(`Step must be between 0 and ${jobProgress.total}.`);
      return;
    }

    setManualProgressApplying(true);
    try {
      await overrideProgressOnServer(value);
    } catch (error) {
      setManualProgressError(error instanceof Error ? error.message : 'Unable to update progress.');
    } finally {
      setManualProgressApplying(false);
    }
  };

  const handleSeek = () => {
    setEmergencyOpen(true);
    setPendingEmergencyAction(() => executeSeek);
  };

  const executeSeek = async () => {
    if (!result?.jobId) {
      setSeekError('No job loaded.');
      setSeekState('error');
      return;
    }

    const value = Number.parseInt(manualProgressInput, 10);
    if (Number.isNaN(value)) {
      setSeekError('Enter a valid step number.');
      setSeekState('error');
      return;
    }

    if (jobProgress && value > jobProgress.total) {
      setSeekError(`Step must be between 0 and ${jobProgress.total}.`);
      setSeekState('error');
      return;
    }

    setSeekState('running');
    setSeekError(null);
    setSeekDeliveryStatus('skipped');
    setSeekProgram(null);

    try {
      await overrideProgressOnServer(value);

      const response = await fetch(`${API_BASE_URL}/api/seek`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: result.jobId, targetStep: value }),
      });

      const payload = (await response.json()) as {
        robotDelivery: { status: RobotStatus; error?: string };
        program?: string | null;
        progress?: { current: number; total: number } | null;
      };

      const deliveryStatus = payload.robotDelivery?.status ?? 'skipped';
      setSeekDeliveryStatus(deliveryStatus);
      setSeekProgram(payload.program ?? null);
      if (payload.progress) {
        setJobProgress({ current: payload.progress.current, total: payload.progress.total });
      }

      if (!response.ok && response.status !== 202) {
        const message = payload.robotDelivery?.error ?? 'Seek request failed.';
        throw new Error(message);
      }

      if (deliveryStatus === 'failed') {
        setSeekError(payload.robotDelivery?.error ?? t.seek.warningFailedFallback);
        setSeekState('warning');
      } else {
        setSeekState('success');
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setSeekError(error.message);
      } else {
        setSeekError(t.seek.errorUnexpected);
      }
      setSeekDeliveryStatus('failed');
      setSeekState('error');
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
        {t.introduction.sections.map((section, index) => (
          <article key={`introduction-section-${index}`}>
            <h3>{section.heading}</h3>
            <ol>
              {section.steps.map((step, stepIndex) => (
                <li key={`introduction-section-${index}-step-${stepIndex}`}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
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
                setSelectedChunkIndex(0);
                setIsProgressPollingPaused(false);
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
            <div className="actions-row">
              <button type="submit" disabled={uploadState === 'uploading'}>
                {uploadState === 'uploading' ? t.actions.submitUploading : t.actions.submit}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={handleStartJob}
                disabled={
                  uploadState === 'uploading' ||
                  startState === 'running' ||
                  !result?.jobId ||
                  (result?.programChunks?.length ?? 0) === 0
                }
              >
                {startState === 'running' ? t.actions.startRunning : t.actions.start}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={handleBoundingBoxRoutine}
                disabled={uploadState === 'uploading' || boundingBoxState === 'running'}
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
                disabled={uploadState === 'uploading' || resumeState === 'running' || !result?.jobId}
              >
                {resumeState === 'running' ? t.actions.resumeRunning : t.actions.resume}
              </button>
            </div>
            <div className="actions-row">
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
                onClick={handleToolStop}
                disabled={uploadState === 'uploading' || toolStopState === 'running'}
              >
                {toolStopState === 'running' ? t.actions.stopToolRunning : t.actions.stopTool}
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
                onClick={handleSafeHeight}
                disabled={uploadState === 'uploading' || safeHeightState === 'running'}
              >
                {safeHeightState === 'running' ? t.actions.safeHeightRunning : t.actions.safeHeight}
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
          </div>
        </form>

        {latestMessage && <p className={latestMessageClass}>{latestMessage.text}</p>}
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
              <strong>{t.metadataLabels.movelCommands}:</strong>{' '}
              {numberFormatter.format(result.metadata.movelCommandCount)}
            </li>
            <li>
              <strong>{t.metadataLabels.progress}:</strong>{' '}
              {jobProgress ? `${jobProgress.current}/${jobProgress.total}` : result.metadata.movementCount > 0 ? `0/${result.metadata.movementCount}` : '—'}
            </li>
            <li>
              <strong>{t.metadataLabels.robotDelivery}:</strong> {t.robotDeliveryStatus[startDeliveryStatus]}
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
          <div className="manual-progress">
            <p className="manual-progress-heading">
              {t.metadataLabels.progress} ({jobProgress ? `${jobProgress.total} steps` : '—'})
            </p>
            <div className="manual-progress-display">
              <label className="manual-progress-field" htmlFor="manual-progress-current">
                <span>{t.manualProgress.currentLabel}</span>
                <input
                  id="manual-progress-current"
                  type="number"
                  value={jobProgress ? jobProgress.current : ''}
                  readOnly
                  placeholder="—"
                />
              </label>
              <label className="manual-progress-field" htmlFor="manual-progress-input">
                <span>{t.manualProgress.targetLabel}</span>
                <input
                  id="manual-progress-input"
                  type="number"
                  min={0}
                  max={jobProgress?.total ?? undefined}
                  value={manualProgressInput}
                  onBlur={() => {
                    if (!jobProgress) {
                      return;
                    }
                    let value = Number.parseInt(manualProgressInput, 10);
                    if (Number.isNaN(value)) {
                      value = jobProgress.current;
                    }
                    value = Math.max(0, Math.min(jobProgress.total, value));
                    setManualProgressInput(String(value));
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/^\d*$/.test(value)) {
                      setManualProgressInput(value);
                      setManualProgressError(null);
                    }
                  }}
                  disabled={!result}
                />
              </label>
            </div>
            <div className="manual-progress-actions">
              <button
                type="button"
                className="secondary"
                onClick={applyManualProgress}
                disabled={
                  manualProgressApplying ||
                  uploadState === 'uploading' ||
                  !result?.jobId ||
                  manualProgressInput.trim().length === 0
                }
              >
                {manualProgressApplying ? t.actions.progressApplyRunning : t.actions.progressApply}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={handleSeek}
                disabled={
                  seekState === 'running' ||
                  uploadState === 'uploading' ||
                  !result?.jobId ||
                  manualProgressInput.trim().length === 0
                }
              >
                {seekState === 'running' ? t.actions.seekRunning : t.actions.seek}
              </button>
            </div>
            {manualProgressError && <p className="message error">{manualProgressError}</p>}
          </div>
          {result.programChunks.length > 0 ? (
            <>
              <div className="program-part-selector">
                <label htmlFor="program-part-select">{t.programParts.selectLabel}</label>
                <select
                  id="program-part-select"
                  value={selectedChunkIndex}
                  onChange={(event) => {
                    const nextIndex = Number.parseInt(event.target.value, 10);
                    if (!Number.isNaN(nextIndex)) {
                      setSelectedChunkIndex(nextIndex);
                    }
                  }}
                >
                  {result.programChunks.map((chunk, index) => (
                    <option key={`${chunk.startIndex}-${chunk.endIndex}`} value={index}>
                      {`${t.programParts.optionLabel} ${index + 1} – ${numberFormatter.format(chunk.movelCount)} ${t.programParts.movelSuffix}`}
                    </option>
                  ))}
                </select>
                <p className="program-part-summary">
                  {`${numberFormatter.format(
                    result.programChunks[selectedChunkIndex]?.blockCount ?? 0,
                  )} ${t.programParts.blockSuffix} · ${t.programParts.progressPrefix}: ${numberFormatter.format(
                    result.programChunks[selectedChunkIndex]?.progressStart ?? 0,
                  )}`}
                </p>
              </div>
              <textarea
                className="program-output"
                value={result.programChunks[selectedChunkIndex]?.program ?? ''}
                readOnly
                rows={16}
              />
            </>
          ) : (
            <p className="message info">{t.programParts.unavailable}</p>
          )}
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
      {toolStopProgram && (
        <section className="panel">
          <h2>{t.actions.stopTool}</h2>
          <textarea className="program-output" value={toolStopProgram} readOnly rows={6} />
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
      {safeHeightProgram && (
        <section className="panel">
          <h2>{t.actions.safeHeight}</h2>
          <textarea className="program-output" value={safeHeightProgram} readOnly rows={8} />
        </section>
      )}
      {homeProgram && (
        <section className="panel">
          <h2>{t.actions.home}</h2>
          <textarea className="program-output" value={homeProgram} readOnly rows={8} />
        </section>
      )}
      {startProgram && (
        <section className="panel">
          <h2>{t.actions.start}</h2>
          <textarea className="program-output" value={startProgram} readOnly rows={12} />
        </section>
      )}
      {seekProgram && (
        <section className="panel">
          <h2>{t.actions.seek}</h2>
          <textarea className="program-output" value={seekProgram} readOnly rows={8} />
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
