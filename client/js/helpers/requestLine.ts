import {cleanIrcMessage} from "../../../shared/irc";

// Format the feature originally shipped with. Fallback until per-network
// Request patterns land; removed together with its last use.
export const legacyRequestLinePattern =
	/\[Request\]\s*-\s*\[\s*\d+\s*:\]\s*(.+?)(?=\s*~\s*by\b|$)/i;

// Returns the Release name from a Request line matched by the given pattern
// (first capture group), or null when the line is not a request line.
export function extractReleaseName(text: string | undefined, pattern: RegExp): string | null {
	if (!text) {
		return null;
	}

	const cleanText = cleanIrcMessage(text);
	const match = cleanText.match(pattern);

	if (!match?.[1]) {
		return null;
	}

	const releaseName = match[1].trim();

	return releaseName.length > 0 ? releaseName : null;
}
