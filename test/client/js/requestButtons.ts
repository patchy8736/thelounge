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

function mountMessage(text: string, chan: ClientChan) {
	return mount(MessageTestWrapper, {
		props: {
			message: {
				id: 1,
				text,
				time: "2026-01-01T00:00:00Z",
				type: MessageType.MESSAGE,
			} as unknown as ClientMessage,
			channel: chan,
			network,
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
});
