import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { FaFolderOpen } from "react-icons/fa6";
import { FiMinus, FiX } from "react-icons/fi";
import {
	MdMic,
	MdMicOff,
	MdMonitor,
	MdRestartAlt,
	MdVideocam,
	MdVideocamOff,
	MdVideoFile,
	MdVolumeOff,
	MdVolumeUp,
} from "react-icons/md";
import { RxDragHandleDots2 } from "react-icons/rx";
import { useScopedT } from "@/contexts/I18nContext";
import { useAudioLevelMeter } from "../../hooks/useAudioLevelMeter";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { requestCameraAccess } from "../../lib/requestCameraAccess";
import { formatTimePadded } from "../../utils/timeUtils";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import { Tooltip } from "../ui/tooltip";
import styles from "./LaunchWindow.module.css";

const ICON_SIZE = 20;
const STOP_SHORTCUT_KEY = "F8";

const ICON_CONFIG = {
	drag: { icon: RxDragHandleDots2, size: ICON_SIZE },
	monitor: { icon: MdMonitor, size: ICON_SIZE },
	volumeOn: { icon: MdVolumeUp, size: ICON_SIZE },
	volumeOff: { icon: MdVolumeOff, size: ICON_SIZE },
	micOn: { icon: MdMic, size: ICON_SIZE },
	micOff: { icon: MdMicOff, size: ICON_SIZE },
	webcamOn: { icon: MdVideocam, size: ICON_SIZE },
	webcamOff: { icon: MdVideocamOff, size: ICON_SIZE },
	stop: { icon: FaRegStopCircle, size: ICON_SIZE },
	restart: { icon: MdRestartAlt, size: ICON_SIZE },
	record: { icon: BsRecordCircle, size: ICON_SIZE },
	videoFile: { icon: MdVideoFile, size: ICON_SIZE },
	folder: { icon: FaFolderOpen, size: ICON_SIZE },
	minimize: { icon: FiMinus, size: ICON_SIZE },
	close: { icon: FiX, size: ICON_SIZE },
} as const;

type IconName = keyof typeof ICON_CONFIG;

function getIcon(name: IconName, className?: string) {
	const { icon: Icon, size } = ICON_CONFIG[name];
	return <Icon size={size} className={className} />;
}

const hudGroupClasses =
	"flex items-center gap-0.5 bg-white/5 rounded-full transition-colors duration-150 hover:bg-white/[0.08]";

const hudIconBtnClasses =
	"flex items-center justify-center p-2 rounded-full transition-all duration-150 cursor-pointer text-white hover:bg-white/10 hover:scale-[1.08] active:scale-95";

const windowBtnClasses =
	"flex items-center justify-center p-2 rounded-full transition-all duration-150 cursor-pointer opacity-50 hover:opacity-90 hover:bg-white/[0.08]";

export function LaunchWindow() {
	const t = useScopedT("launch");

	const {
		recording,
		toggleRecording,
		restartRecording,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		webcamEnabled,
		setWebcamEnabled,
	} = useScreenRecorder();
	const [recordingStart, setRecordingStart] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const [recordingCountdown, setRecordingCountdown] = useState<number | null>(null);
	const startRecordingTimerRef = useRef<NodeJS.Timeout | null>(null);
	const toggleRecordingRef = useRef(toggleRecording);

	const showMicControls = microphoneEnabled && !recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } =
		useMicrophoneDevices(microphoneEnabled);
	const { level } = useAudioLevelMeter({
		enabled: showMicControls,
		deviceId: microphoneDeviceId,
	});

	useEffect(() => {
		if (selectedDeviceId && selectedDeviceId !== "default") {
			setMicrophoneDeviceId(selectedDeviceId);
		}
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		let timer: NodeJS.Timeout | null = null;
		if (recording) {
			if (!recordingStart) setRecordingStart(Date.now());
			timer = setInterval(() => {
				if (recordingStart) {
					setElapsed(Math.floor((Date.now() - recordingStart) / 1000));
				}
			}, 1000);
		} else {
			setRecordingStart(null);
			setElapsed(0);
			if (timer) clearInterval(timer);
		}
		return () => {
			if (timer) clearInterval(timer);
		};
	}, [recording, recordingStart]);

	useEffect(() => {
		if (!import.meta.env.DEV) {
			return;
		}

		void requestCameraAccess().catch((error) => {
			console.warn("Failed to trigger camera access request during development:", error);
		});
	}, []);

	const [selectedSource, setSelectedSource] = useState(() => t("sourceSelector.defaultSourceName"));
	const [hasSelectedSource, setHasSelectedSource] = useState(false);

	useEffect(() => {
		const checkSelectedSource = async () => {
			if (window.electronAPI) {
				const source = await window.electronAPI.getSelectedSource();
				if (source) {
					const sourceId = typeof source.id === "string" ? source.id : "";
					const sourceName =
						sourceId.startsWith("screen:") && typeof source.name === "string"
							? t("sourceSelector.defaultSourceName")
							: (source.name ?? t("sourceSelector.defaultSourceName"));
					setSelectedSource(String(sourceName));
					setHasSelectedSource(true);
				} else {
					setSelectedSource(t("sourceSelector.defaultSourceName"));
					setHasSelectedSource(false);
				}
			}
		};

		checkSelectedSource();

		const interval = setInterval(checkSelectedSource, 500);
		return () => clearInterval(interval);
	}, [t]);

	const triggerRecordingWithCountdown = useCallback(
		(forceStart = false) => {
			if (recording || recordingCountdown !== null) {
				return;
			}
			if (!forceStart && !hasSelectedSource) {
				return;
			}

			setRecordingCountdown(3);
		},
		[recording, recordingCountdown, hasSelectedSource],
	);

	useEffect(() => {
		toggleRecordingRef.current = toggleRecording;
	}, [toggleRecording]);

	useEffect(() => {
		if (recordingCountdown === null) {
			if (startRecordingTimerRef.current) {
				clearTimeout(startRecordingTimerRef.current);
				startRecordingTimerRef.current = null;
			}
			return;
		}

		if (recordingCountdown <= 1) {
			startRecordingTimerRef.current = setTimeout(() => {
				setRecordingCountdown(null);
				toggleRecordingRef.current();
				startRecordingTimerRef.current = null;
			}, 1000);
			return;
		}

		const timer = setTimeout(() => {
			setRecordingCountdown((prev) => (prev === null ? null : prev - 1));
		}, 1000);

		return () => clearTimeout(timer);
	}, [recordingCountdown]);

	useEffect(() => {
		return () => {
			if (startRecordingTimerRef.current) {
				clearTimeout(startRecordingTimerRef.current);
				startRecordingTimerRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== STOP_SHORTCUT_KEY) {
				return;
			}
			event.preventDefault();
			if (recordingCountdown !== null) {
				setRecordingCountdown(null);
				return;
			}
			if (recording) {
				toggleRecording();
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [recording, recordingCountdown, toggleRecording]);

	useEffect(() => {
		if (!window.electronAPI?.onStartRecordingRequested) {
			return;
		}

		return window.electronAPI.onStartRecordingRequested(() => {
			if (!recording) {
				triggerRecordingWithCountdown(true);
			}
		});
	}, [recording, triggerRecordingWithCountdown]);

	const openSourceSelector = () => {
		if (window.electronAPI) {
			window.electronAPI.openSourceSelector();
		}
	};

	const openVideoFile = async () => {
		const result = await window.electronAPI.openVideoFilePicker();

		if (result.canceled) {
			return;
		}

		if (result.success && result.path) {
			await window.electronAPI.setCurrentVideoPath(result.path);
			await window.electronAPI.switchToEditor();
		}
	};

	const openProjectFile = async () => {
		const result = await window.electronAPI.loadProjectFile();
		if (result.canceled || !result.success) return;
		await window.electronAPI.switchToEditor();
	};

	const sendHudOverlayHide = () => {
		if (window.electronAPI && window.electronAPI.hudOverlayHide) {
			window.electronAPI.hudOverlayHide();
		}
	};
	const sendHudOverlayClose = () => {
		if (window.electronAPI && window.electronAPI.hudOverlayClose) {
			window.electronAPI.hudOverlayClose();
		}
	};

	const handleRecordButtonClick = () => {
		if (recording) {
			toggleRecording();
			return;
		}
		if (!hasSelectedSource) {
			openSourceSelector();
			return;
		}
		triggerRecordingWithCountdown();
	};

	const toggleMicrophone = () => {
		if (!recording) {
			setMicrophoneEnabled(!microphoneEnabled);
		}
	};

	return (
		<div className="w-full h-full flex items-end justify-center bg-transparent relative">
			<div className={`flex flex-col items-center gap-2 mx-auto ${styles.electronDrag}`}>
				{recordingCountdown !== null && (
					<div className={`mb-2 px-4 py-3 rounded-2xl border border-[#34B27B]/35 bg-black/70 backdrop-blur-md ${styles.electronNoDrag}`}>
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-full bg-[#34B27B]/20 text-[#7be5b7] text-lg font-bold flex items-center justify-center">
								{recordingCountdown}
							</div>
							<div className="text-xs text-slate-200">
								<div className="font-medium">{t("sourceSelector.startRecording")}</div>
								<div className="text-slate-400 mt-0.5">
									{t("recording.countdownStopHint", { shortcut: STOP_SHORTCUT_KEY })}
								</div>
							</div>
						</div>
					</div>
				)}
				{/* Mic controls panel */}
				{showMicControls && (
					<div
						className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[rgba(28,28,36,0.97)] to-[rgba(18,18,26,0.96)] backdrop-blur-[16px] backdrop-saturate-[140%] border border-[rgba(80,80,120,0.25)] rounded-2xl shadow-mic-panel animate-mic-panel-in ${styles.electronNoDrag}`}
					>
						<div className="relative flex-1" style={{ maxWidth: "70%" }}>
							<select
								value={microphoneDeviceId || selectedDeviceId}
								onChange={(e) => {
									setSelectedDeviceId(e.target.value);
									setMicrophoneDeviceId(e.target.value);
								}}
								className="w-full appearance-none bg-white/10 text-white text-xs rounded-full pl-3 pr-7 py-2 border border-white/20 outline-none truncate"
							>
								{devices.map((device) => (
									<option key={device.deviceId} value={device.deviceId}>
										{device.label}
									</option>
								))}
							</select>
							<ChevronDown
								size={14}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none"
							/>
						</div>
						<AudioLevelMeter level={level} className="w-24 h-4" />
					</div>
				)}

				{/* Main pill bar */}
				<div className="flex items-center gap-1.5 px-2 py-1.5 isolate rounded-full shadow-hud-bar bg-gradient-to-br from-[rgba(28,28,36,0.97)] to-[rgba(18,18,26,0.96)] backdrop-blur-[16px] backdrop-saturate-[140%] border border-[rgba(80,80,120,0.25)]">
					{/* Drag handle */}
					<div className={`flex items-center px-1 ${styles.electronDrag}`}>
						{getIcon("drag", "text-white/30")}
					</div>

					{/* Source selector */}
					<button
						className={`${hudGroupClasses} p-2 ${styles.electronNoDrag}`}
						onClick={openSourceSelector}
						disabled={recording}
						title={selectedSource}
					>
						{getIcon("monitor", "text-white/80")}
						<span className="text-white/70 text-[11px] max-w-[72px] truncate">
							{selectedSource}
						</span>
					</button>

					{/* Audio controls group */}
					<div className={`${hudGroupClasses} ${styles.electronNoDrag}`}>
						<button
							className={`${hudIconBtnClasses} ${systemAudioEnabled ? "drop-shadow-[0_0_4px_rgba(74,222,128,0.4)]" : ""}`}
							onClick={() => !recording && setSystemAudioEnabled(!systemAudioEnabled)}
							disabled={recording}
							title={
								systemAudioEnabled ? t("audio.disableSystemAudio") : t("audio.enableSystemAudio")
							}
						>
							{systemAudioEnabled
								? getIcon("volumeOn", "text-green-400")
								: getIcon("volumeOff", "text-white/40")}
						</button>
						<button
							className={`${hudIconBtnClasses} ${microphoneEnabled ? "drop-shadow-[0_0_4px_rgba(74,222,128,0.4)]" : ""}`}
							onClick={toggleMicrophone}
							disabled={recording}
							title={microphoneEnabled ? t("audio.disableMicrophone") : t("audio.enableMicrophone")}
						>
							{microphoneEnabled
								? getIcon("micOn", "text-green-400")
								: getIcon("micOff", "text-white/40")}
						</button>
						<button
							className={`${hudIconBtnClasses} ${webcamEnabled ? "drop-shadow-[0_0_4px_rgba(74,222,128,0.4)]" : ""}`}
							onClick={async () => {
								await setWebcamEnabled(!webcamEnabled);
							}}
							title={webcamEnabled ? t("webcam.disableWebcam") : t("webcam.enableWebcam")}
						>
							{webcamEnabled
								? getIcon("webcamOn", "text-green-400")
								: getIcon("webcamOff", "text-white/40")}
						</button>
					</div>

					{/* Record/Stop group */}
					<button
						className={`flex items-center gap-0.5 rounded-full p-2 transition-colors duration-150 ${styles.electronNoDrag} ${
							recording ? "animate-record-pulse bg-red-500/10" : "bg-white/5 hover:bg-white/[0.08]"
						}`}
						onClick={handleRecordButtonClick}
						disabled={(!hasSelectedSource && !recording) || recordingCountdown !== null}
						style={{ flex: "0 0 auto" }}
					>
						{recording ? (
							<>
								{getIcon("stop", "text-red-400")}
								<span className="text-red-400 text-xs font-semibold tabular-nums">
									{formatTimePadded(elapsed)}
								</span>
							</>
						) : (
							getIcon("record", hasSelectedSource ? "text-white/80" : "text-white/30")
						)}
					</button>

					{/* Restart recording */}
					{recording && (
						<Tooltip content={t("tooltips.restartRecording")}>
							<button
								className={`${hudIconBtnClasses} ${styles.electronNoDrag}`}
								onClick={restartRecording}
							>
								{getIcon("restart", "text-white/60")}
							</button>
						</Tooltip>
					)}

					{/* Open video file */}
					<Tooltip content={t("tooltips.openVideoFile")}>
						<button
							className={`${hudIconBtnClasses} ${styles.electronNoDrag}`}
							onClick={openVideoFile}
							disabled={recording}
						>
							{getIcon("videoFile", "text-white/60")}
						</button>
					</Tooltip>

					{/* Open project */}
					<Tooltip content={t("tooltips.openProject")}>
						<button
							className={`${hudIconBtnClasses} ${styles.electronNoDrag}`}
							onClick={openProjectFile}
							disabled={recording}
						>
							{getIcon("folder", "text-white/60")}
						</button>
					</Tooltip>

					{/* Window controls */}
					<div className={`flex items-center gap-0.5 ${styles.electronNoDrag}`}>
						<button
							className={windowBtnClasses}
							title={t("tooltips.hideHUD")}
							onClick={sendHudOverlayHide}
						>
							{getIcon("minimize", "text-white")}
						</button>
						<button
							className={windowBtnClasses}
							title={t("tooltips.closeApp")}
							onClick={sendHudOverlayClose}
						>
							{getIcon("close", "text-white")}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
