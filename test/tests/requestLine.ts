import {expect} from "chai";

import {extractReleaseName, releaseNameForNetwork} from "../../client/js/helpers/requestLine";
import {
	siteALine,
	siteAPattern,
	siteAPrefixedLine,
	siteAPrefixedPattern,
	siteBLine,
	siteBPattern,
} from "./requestLineFixtures";

// The format the feature originally shipped with, removed from the client in
// ADR 0001's contract phase. Kept as reference data: extractReleaseName is
// generic and these cases pin its trimming, cleaning and null behavior.
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
		const siteB = new RegExp(siteBPattern);

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

	it("extracts the release name when the line carries a preamble before the number", () => {
		expect(
			releaseNameForNetwork(siteAPrefixedLine, {requestPattern: siteAPrefixedPattern})
		).to.equal("Haps.2025.MULTI.VFF.1080p.WEB.AC3.5.1.H265-GRP");
	});

	it("a set pattern is authoritative: non-matching lines get no release name", () => {
		expect(releaseNameForNetwork(legacyLine, {requestPattern: siteAPattern})).to.equal(null);
		expect(releaseNameForNetwork("chat", {requestPattern: siteAPattern})).to.equal(null);
	});

	it("no pattern set: feature off, the removed legacy format matches nothing", () => {
		expect(releaseNameForNetwork(legacyLine, {})).to.equal(null);
		expect(releaseNameForNetwork(siteALine, {})).to.equal(null);
	});

	it("invalid stored pattern: feature off, without throwing", () => {
		expect(releaseNameForNetwork(legacyLine, {requestPattern: "[unclosed"})).to.equal(null);
		expect(releaseNameForNetwork(siteALine, {requestPattern: "[unclosed"})).to.equal(null);
	});
});
