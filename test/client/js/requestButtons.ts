import {expect} from "chai";
import {mount} from "@vue/test-utils";
import {createStore} from "vuex";

import MessageTestWrapper from "../../components/helpers/MessageTestWrapper.vue";
import {ChanType} from "../../../shared/types/chan";
import {MessageType} from "../../../shared/types/msg";
import type {ClientChan, ClientMessage, ClientNetwork} from "../../../client/js/types";

// Legacy format, see client/js/helpers/requestLine.ts
const legacyRequestLine = "[Request] - [1:] Some.Release.2025.1080p ~ by requester";

const network = {name: "TestNet"} as ClientNetwork;
const channel = {type: ChanType.CHANNEL, id: 1} as ClientChan;
const query = {type: ChanType.QUERY, id: 2} as ClientChan;

const store = createStore({state: {settings: {}}});

function mountMessage(text: string, chan: ClientChan, net: ClientNetwork = network) {
	return mount(MessageTestWrapper, {
		props: {
			message: {
				id: 1,
				text,
				time: "2026-01-01T00:00:00Z",
				type: MessageType.MESSAGE,
			} as unknown as ClientMessage,
			channel: chan,
			network: net,
		},
		global: {
			plugins: [store],
		},
	});
}

describe("Request command buttons", () => {
	it("render for a legacy request line in a channel", () => {
		const wrapper = mountMessage(legacyRequestLine, channel);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(3);
	});

	it("do not render for a non-matching line", () => {
		const wrapper = mountMessage("just chatting", channel);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(0);
	});

	it("do not render in a query", () => {
		const wrapper = mountMessage(legacyRequestLine, query);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(0);
	});

	const siteAPattern = "^\\[\\s*\\d+\\.?\\]\\s+(.+?)\\s+von\\s+";
	const siteALine = "[1] Haps.2025.MULTI.VFF.1080p.WEB.AC3.5.1.H265-GRP von nick (23.10. 20:11)";

	function mountOnNetwork(text: string, requestPattern?: string) {
		const patternedNetwork = {
			name: "TestNet",
			requestPattern,
		} as ClientNetwork;

		return mountMessage(text, channel, patternedNetwork);
	}

	it("render for a site A request line when the network pattern matches", () => {
		const wrapper = mountOnNetwork(siteALine, siteAPattern);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(3);
	});

	it("render for a site B request line when the network pattern matches", () => {
		const wrapper = mountOnNetwork(
			"[  2.] Some.Release.2015.PAL.FULL.MULTi.DVDR-GRP by nick on 2026-08-03 @ 00:25",
			"^\\[\\s*\\d+\\.?\\]\\s+(.+?)\\s+by\\s+"
		);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(3);
	});

	it("do not render for a line the network pattern does not match", () => {
		const wrapper = mountOnNetwork("just chatting", siteAPattern);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(0);
	});

	it("fall back to the legacy format when the stored pattern is invalid", () => {
		const wrapper = mountOnNetwork(legacyRequestLine, "[unclosed");

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(3);
	});
});
