import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, screen } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(APP_ROOT, "dist");
const HEADLESS = process.env["HEADLESS"] === "true";

function getWindowIconPath() {
	if (process.platform !== "win32") {
		return undefined;
	}

	if (app.isPackaged) {
		return path.join(process.resourcesPath, "assets", "app-icon.png");
	}

	return path.join(APP_ROOT, "public", "openscreen.png");
}

let hudOverlayWindow: BrowserWindow | null = null;
let hudFadeInterval: NodeJS.Timeout | null = null;

function fadeOutHudOverlay(durationMs = 1000) {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) {
		return;
	}

	if (hudFadeInterval) {
		clearInterval(hudFadeInterval);
		hudFadeInterval = null;
	}

	const targetWindow = hudOverlayWindow;
	targetWindow.setOpacity(1);
	const steps = 20;
	const stepDuration = Math.max(16, Math.round(durationMs / steps));
	let currentStep = 0;

	hudFadeInterval = setInterval(() => {
		if (!targetWindow || targetWindow.isDestroyed()) {
			if (hudFadeInterval) {
				clearInterval(hudFadeInterval);
				hudFadeInterval = null;
			}
			return;
		}

		currentStep += 1;
		const opacity = Math.max(0, 1 - currentStep / steps);
		targetWindow.setOpacity(opacity);

		if (currentStep >= steps) {
			targetWindow.minimize();
			targetWindow.setOpacity(1);
			if (hudFadeInterval) {
				clearInterval(hudFadeInterval);
				hudFadeInterval = null;
			}
		}
	}, stepDuration);
}

ipcMain.on("hud-overlay-hide", () => {
	fadeOutHudOverlay(1000);
});

export function showHudOverlayWindow() {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) {
		return;
	}
	if (hudFadeInterval) {
		clearInterval(hudFadeInterval);
		hudFadeInterval = null;
	}
	hudOverlayWindow.setOpacity(1);
	if (hudOverlayWindow.isMinimized()) {
		hudOverlayWindow.restore();
	}
	hudOverlayWindow.show();
	hudOverlayWindow.focus();
}

export function createHudOverlayWindow(): BrowserWindow {
	const primaryDisplay = screen.getPrimaryDisplay();
	const { workArea } = primaryDisplay;

	const windowWidth = 500;
	const windowHeight = 155;

	const x = Math.floor(workArea.x + (workArea.width - windowWidth) / 2);
	const y = Math.floor(workArea.y + workArea.height - windowHeight - 5);

	const win = new BrowserWindow({
		width: windowWidth,
		height: windowHeight,
		minWidth: 500,
		maxWidth: 500,
		minHeight: 155,
		maxHeight: 155,
		x: x,
		y: y,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		show: !HEADLESS,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
	});

	hudOverlayWindow = win;

	win.on("closed", () => {
		if (hudOverlayWindow === win) {
			hudOverlayWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=hud-overlay");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "hud-overlay" },
		});
	}

	return win;
}

export function createEditorWindow(): BrowserWindow {
	const isMac = process.platform === "darwin";

	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		icon: getWindowIconPath(),
		...(isMac && {
			titleBarStyle: "hiddenInset",
			trafficLightPosition: { x: 12, y: 12 },
		}),
		transparent: false,
		resizable: true,
		alwaysOnTop: false,
		skipTaskbar: false,
		title: "小骆录屏",
		backgroundColor: "#000000",
		show: !HEADLESS,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			backgroundThrottling: false,
		},
	});

	// Maximize the window by default
	win.maximize();

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=editor");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "editor" },
		});
	}

	return win;
}

export function createSourceSelectorWindow(): BrowserWindow {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	const win = new BrowserWindow({
		width: 620,
		height: 420,
		minHeight: 350,
		maxHeight: 500,
		x: Math.round((width - 620) / 2),
		y: Math.round((height - 420) / 2),
		icon: getWindowIconPath(),
		frame: false,
		resizable: false,
		alwaysOnTop: true,
		transparent: true,
		backgroundColor: "#00000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=source-selector");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "source-selector" },
		});
	}

	return win;
}
