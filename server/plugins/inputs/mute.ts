import Chan from "../../models/chan.js";
import Network from "../../models/network.js";
import {PluginInputHandler} from "./index.js";

import Msg from "../../models/msg.js";

import Client from "../../client.js";
import {MessageType} from "../../../shared/types/msg.js";
import {ChanType} from "../../../shared/types/chan.js";

const commands = ["mute", "unmute"];
const allowDisconnected = true;

function args_to_channels(network: Network, args: string[]) {
	const targets: Chan[] = [];

	for (const arg of args) {
		const argLower = arg.toLowerCase();
		const target = network.channels.find((c) => c.name.toLowerCase() === argLower);

		if (target) {
			targets.push(target);
		}
	}

	return targets;
}

function change_mute_state(client: Client, target: Chan, valueToSet: boolean) {
	if (target.type === ChanType.SPECIAL) {
		return;
	}

	target.setMuteStatus(valueToSet);
	client.emit("mute:changed", {
		target: target.id,
		status: valueToSet,
	});
}

const input: PluginInputHandler = function (network, chan, cmd, args) {
	const valueToSet = cmd === "mute" ? true : false;

	if (args.length === 0) {
		change_mute_state(this, chan, valueToSet);
		this.save();
		return;
	}

	// User mute listing: takes precedence over nick/channel resolution
	if (args[0].toLowerCase() === "list" && args[1]?.toLowerCase() === "users") {
		const text =
			network.muteList.length === 0
				? "No users are muted on this network"
				: `Muted users on this network: ${network.muteList.join(", ")}`;
		chan.pushMessage(this, new Msg({type: MessageType.NOTICE, text}));
		return;
	}

	// A nick in the current channel's user list resolves to a user mute,
	// ahead of the channel-name resolution below
	const user = chan.findUser(args[0]);

	if (user) {
		// IRC nicks are case insensitive
		if (user.nick.toLowerCase() === network.nick.toLowerCase()) {
			chan.pushMessage(
				this,
				new Msg({
					type: MessageType.ERROR,
					text: "You can't mute yourself",
				})
			);
			return;
		}

		const idx = network.muteList.findIndex(
			(nick) => nick.toLowerCase() === user.nick.toLowerCase()
		);

		if (valueToSet) {
			if (idx !== -1) {
				chan.pushMessage(
					this,
					new Msg({
						type: MessageType.ERROR,
						text: "The specified user is already muted",
					})
				);
				return;
			}

			network.muteList.push(user.nick);
			chan.pushMessage(
				this,
				new Msg({type: MessageType.NOTICE, text: `${user.nick} is now muted`})
			);
		} else {
			if (idx === -1) {
				chan.pushMessage(
					this,
					new Msg({
						type: MessageType.ERROR,
						text: "The specified user is not muted",
					})
				);
				return;
			}

			network.muteList.splice(idx, 1);
			chan.pushMessage(
				this,
				new Msg({type: MessageType.NOTICE, text: `${user.nick} is no longer muted`})
			);
		}

		this.save();
		return;
	}

	const targets = args_to_channels(network, args);

	if (targets.length !== args.length) {
		const targetNames = targets.map((ch) => ch.name);
		const missing = args.filter((x) => !targetNames.includes(x));
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: `No open ${
					missing.length === 1 ? "channel or user" : "channels or users"
				} found for ${missing.join(",")}`,
			})
		);
		return;
	}

	for (const target of targets) {
		change_mute_state(this, target, valueToSet);
	}

	this.save();
};

export default {
	commands,
	input,
	allowDisconnected,
};
