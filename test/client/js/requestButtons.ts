import {expect} from "chai";
import {mount} from "@vue/test-utils";
import {createStore} from "vuex";
import sinon from "sinon";

import MessageTestWrapper from "../../components/helpers/MessageTestWrapper.vue";
import {ChanType} from "../../../shared/types/chan";
import {MessageType} from "../../../shared/types/msg";
import type {ClientChan, ClientMessage, ClientNetwork} from "../../../client/js/types";
import eventbus from "../../../client/js/eventbus";
import socket from "../../../client/js/socket";
import {
	legacyRequestLine,
	siteALine,
	siteAPattern,
	siteAPrefixedLine,
	siteAPrefixedPattern,
	siteBLine,
	siteBPattern,
} from "../../tests/requestLineFixtures";

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

function mountOnNetwork(text: string, requestPattern?: string, chan: ClientChan = channel) {
	const patternedNetwork = {
		name: "TestNet",
		requestPattern,
	} as ClientNetwork;

	return mountMessage(text, chan, patternedNetwork);
}

describe("Request command buttons", () => {
	it("render for a site A request line when the network pattern matches", () => {
		const wrapper = mountOnNetwork(siteALine, siteAPattern);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(3);
	});

	it("render for a site A request line carrying a preamble when the network pattern matches", () => {
		const wrapper = mountOnNetwork(siteAPrefixedLine, siteAPrefixedPattern);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(3);
	});

	it("render for a site B request line when the network pattern matches", () => {
		const wrapper = mountOnNetwork(siteBLine, siteBPattern);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(3);
	});

	it("render for a request line carrying IRC formatting codes", () => {
		const wrapper = mountOnNetwork(
			"\x02[1]\x02 \x0312Haps.2025.1080p\x03 von nick",
			siteAPattern
		);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(3);
	});

	it("do not render when the network has no pattern, even for the removed legacy format", () => {
		const wrapper = mountMessage(legacyRequestLine, channel);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(0);
	});

	it("do not render for a line the network pattern does not match", () => {
		const wrapper = mountOnNetwork("just chatting", siteAPattern);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(0);
	});

	it("do not render when the stored pattern is invalid", () => {
		const wrapper = mountOnNetwork(siteALine, "[unclosed");

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(0);
	});

	it("do not render in a query", () => {
		const wrapper = mountOnNetwork(siteALine, siteAPattern, query);

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(0);
	});

	it("do not render when the first capture group is empty", () => {
		const wrapper = mountOnNetwork("[x] end", "^\\[x\\]\\s*(.*?)\\s+end$");

		expect(wrapper.findAll(".request-action-button")).to.have.lengthOf(0);
	});

	describe("click flow", () => {
		let emitStub: sinon.SinonStub;
		let captured: unknown[][];

		const handler = (...args: unknown[]) => {
			captured.push(args);
		};

		beforeEach(() => {
			emitStub = sinon.stub(socket, "emit");
			captured = [];
			eventbus.on("confirm-dialog", handler);
		});

		afterEach(() => {
			eventbus.off("confirm-dialog", handler);
			emitStub.restore();
		});

		const commands = ["reqfilled", "reqdel", "reqwipe"] as const;

		commands.forEach((command, index) => {
			it(`asks for confirmation and sends !${command} with the release name on accept`, () => {
				const wrapper = mountOnNetwork(siteALine, siteAPattern);

				void wrapper.findAll(".request-action-button")[index].trigger("click");

				expect(captured).to.have.lengthOf(1);

				const [options, callback] = captured[0] as [
					{title: string; text: string; button: string},
					(result: boolean) => void,
				];

				expect(options.button).to.equal(`Send !${command}`);
				expect(options.text).to.contain("Haps.2025.MULTI.VFF.1080p.WEB.AC3.5.1.H265-GRP");

				callback(true);

				expect(
					emitStub.calledWith("input", {
						target: 1,
						text: `!${command} Haps.2025.MULTI.VFF.1080p.WEB.AC3.5.1.H265-GRP`,
					})
				).to.equal(true);
			});
		});

		it("sends nothing when the confirmation is rejected", () => {
			const wrapper = mountOnNetwork(siteALine, siteAPattern);

			void wrapper.findAll(".request-action-button")[0].trigger("click");

			const [, callback] = captured[0] as unknown as [unknown, (result: boolean) => void];
			callback(false);

			expect(emitStub.called).to.equal(false);
		});
	});
});
