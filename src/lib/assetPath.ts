function encodeRelativeAssetPath(relativePath: string): string {
	return relativePath
		.replace(/^\/+/, "")
		.split("/")
		.filter(Boolean)
		.map((part) => encodeURIComponent(part))
		.join("/");
}

function ensureTrailingSlash(value: string): string {
	return value.endsWith("/") ? value : `${value}/`;
}

export async function getAssetPath(relativePath: string): Promise<string> {
	const encodedRelativePath = encodeRelativeAssetPath(relativePath);

	try {
		if (typeof window !== "undefined") {
			// If running in a dev server (http/https), prefer the web-served path
			if (
				window.location &&
				window.location.protocol &&
				window.location.protocol.startsWith("http")
			) {
				return `/${encodedRelativePath}`;
			}

			if (window.location?.protocol === "file:") {
				return new URL(encodedRelativePath, window.location.href).toString();
			}

			if (window.electronAPI && typeof window.electronAPI.getAssetBasePath === "function") {
				const base = await window.electronAPI.getAssetBasePath();
				if (base) {
					return new URL(encodedRelativePath, ensureTrailingSlash(base)).toString();
				}
			}
		}
	} catch {
		// ignore and use fallback
	}

	// Fallback for web/dev server: public/wallpapers are served at '/wallpapers/...'
	return `/${encodedRelativePath}`;
}

export default getAssetPath;
