import {expect} from "chai";

import {extractReleaseName, releaseNameForNetwork} from "../../client/js/helpers/requestLine";

// The format the feature originally shipped with. The client still uses it
// today; the per-network pattern replaces it in ticket 04. Kept here as
// reference data so the test pins the helper's behavior independently.
const legacyPattern = /\[Request\]\s*-\s*\[\s*\d+\s*:\]\s*(.+?)(?=\s*~\s*by\b|$)/i;

describe("Request line release name extraction", () => {
	it("extracts the release name from a legacy request line", () => {
		expect(
			extractReleaseName(
				"[Request] - [1:] Some.Release.2025.1080p ~ by requester",
				legacyPattern
			)
		).to.equal("Some.Release.2025.1080p");
	});

	it("extracts to end of line when no '~ by' suffix is present", () => {
		expect(extractReleaseName("[Request] - [12:] Another.Release", legacyPattern)).to.equal(
			"Another.Release"
		);
	});

	it("matches case-insensitively", () => {
		expect(
			extractReleaseName("[request] - [3:] Lower.Case.Release ~ by nick", legacyPattern)
		).to.equal("Lower.Case.Release");
	});

	it("cleans IRC formatting before matching", () => {
		expect(
			extractReleaseName("\x02[Request]\x02 - [4:] Bold.Release ~ by nick", legacyPattern)
		).to.equal("Bold.Release");
	});

	it("returns null for a non-matching line", () => {
		expect(extractReleaseName("just chatting about [Request] things", legacyPattern)).to.equal(
			null
		);
	});

	it("returns null for a line with nothing after the prefix", () => {
		expect(extractReleaseName("[Request] - [5:]", legacyPattern)).to.equal(null);
	});

	it("returns null when the capture group trims to empty", () => {
		const whitespaceCapture = /^\[x\]\s*(.*)$/;

		expect(extractReleaseName("[x]    ", whitespaceCapture)).to.equal(null);
	});

	it("returns null for empty text", () => {
		expect(extractReleaseName("", legacyPattern)).to.equal(null);
	});

	it("uses whatever pattern it is given", () => {
		const siteB = /^\[\s*\d+\.?\]\s+(.+?)\s+by\s+/;

		expect(
			extractReleaseName(
				"[  1.] fill.for.last.pred.SCENEGRP by nick on 2026-03-17 @ 16:03",
				siteB
			)
		).to.equal("fill.for.last.pred.SCENEGRP");
	});
});

describe("Network request pattern", () => {
	const legacyLine = "[Request] - [7:] Legacy.Release ~ by requester";
	const siteALine = "[1] Haps.2025.MULTI.VFF.1080p.WEB.AC3.5.1.H265-GRP von nick (23.10. 20:11)";
	const siteBLine =
		"[  2.] Some.Release.2015.PAL.FULL.MULTi.DVDR-GRP by nick on 2026-08-03 @ 00:25";
	const siteAPattern = "^\\[\\s*\\d+\\.?\\]\\s+(.+?)\\s+von\\s+";
	const siteBPattern = "^\\[\\s*\\d+\\.?\\]\\s+(.+?)\\s+by\\s+";

	it("matches with a per-network pattern (site A shape)", () => {
		expect(releaseNameForNetwork(siteALine, {requestPattern: siteAPattern})).to.equal(
			"Haps.2025.MULTI.VFF.1080p.WEB.AC3.5.1.H265-GRP"
		);
	});

	it("matches with a per-network pattern (site B shape)", () => {
		expect(releaseNameForNetwork(siteBLine, {requestPattern: siteBPattern})).to.equal(
			"Some.Release.2015.PAL.FULL.MULTi.DVDR-GRP"
		);
	});

	it("a set pattern is authoritative: non-matching lines get no release name", () => {
		expect(releaseNameForNetwork(legacyLine, {requestPattern: siteAPattern})).to.equal(null);
		expect(releaseNameForNetwork("chat", {requestPattern: siteAPattern})).to.equal(null);
	});

	it("falls back to the legacy format when no pattern is set", () => {
		expect(releaseNameForNetwork(legacyLine, {})).to.equal("Legacy.Release");
		expect(releaseNameForNetwork(siteALine, {})).to.equal(null);
	});

	it("falls back to the legacy format when the stored pattern is invalid, without throwing", () => {
		expect(releaseNameForNetwork(legacyLine, {requestPattern: "[unclosed"})).to.equal(
			"Legacy.Release"
		);
		expect(releaseNameForNetwork(siteALine, {requestPattern: "[unclosed"})).to.equal(null);
	});
});
