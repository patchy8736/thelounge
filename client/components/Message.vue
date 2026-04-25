<template>
	<div
		:id="'msg-' + prettyMessage.id"
		:class="[
			'msg',
			{
				self: prettyMessage.self,
				highlight: prettyMessage.highlight,
				'is-focused': isFocused,
				'previous-source': isPreviousSource,
			},
		]"
		:data-type="prettyMessage.type"
		:data-command="prettyMessage.command"
		:data-from="
			prettyMessage.from &&
			(prettyMessage.from.shoutbox
				? prettyMessage.from.original_nick
				: prettyMessage.from.nick)
		"
		:data-bridged="prettyMessage.from?.shoutbox"
	>
		<span
			aria-hidden="true"
			:aria-label="messageTimeLocale"
			class="time tooltipped tooltipped-e"
			>{{ `${messageTime}&#32;` }}
		</span>
		<template v-if="prettyMessage.type === 'unhandled'">
			<span class="from">[{{ prettyMessage.command }}]</span>
			<span class="content">
				<span v-for="(param, id) in prettyMessage.params" :key="id">{{
					`&#32;${param}&#32;`
				}}</span>
			</span>
		</template>
		<template v-else-if="isAction()">
			<span class="from"><span class="only-copy" aria-hidden="true">***&nbsp;</span></span>
			<component :is="messageComponent" :network="network" :message="prettyMessage" />
		</template>
		<template v-else-if="prettyMessage.type === 'action'">
			<span class="from"><span class="only-copy">*&nbsp;</span></span>
			<span class="content" dir="auto">
				<StatusmsgMarker :group="prettyMessage.statusmsgGroup" />
				<Username
					:user="prettyMessage.from"
					:network="network"
					:channel="channel"
					dir="auto"
				/>&#32;<ParsedMessage :message="prettyMessage" />
				<LinkPreview
					v-for="preview in prettyMessage.previews"
					:key="preview.link"
					:keep-scroll-position="keepScrollPosition"
					:link="preview"
					:channel="channel"
				/>
			</span>
		</template>
		<template v-else>
			<span v-if="prettyMessage.type === 'message'" class="from">
				<template v-if="prettyMessage.from && prettyMessage.from.nick">
					<span class="only-copy" aria-hidden="true">&lt;</span>
					<Username :user="prettyMessage.from" :network="network" :channel="channel" />
					<span class="only-copy" aria-hidden="true">&gt;&nbsp;</span>
				</template>
			</span>
			<span v-else-if="prettyMessage.type === 'plugin'" class="from">
				<template v-if="prettyMessage.from && prettyMessage.from.nick">
					<span class="only-copy" aria-hidden="true">[</span>
					{{ prettyMessage.from.nick }}
					<span class="only-copy" aria-hidden="true">]&nbsp;</span>
				</template>
			</span>
			<span v-else class="from">
				<template v-if="prettyMessage.from && prettyMessage.from.nick">
					<span class="only-copy" aria-hidden="true">-</span>
					<Username :user="prettyMessage.from" :network="network" :channel="channel" />
					<span class="only-copy" aria-hidden="true">-&nbsp;</span>
				</template>
			</span>
			<span class="content" dir="auto">
				<span
					v-if="prettyMessage.showInActive"
					aria-label="This message was shown in your active channel"
					class="msg-shown-in-active tooltipped tooltipped-e"
					><span></span
				></span>
				<StatusmsgMarker :group="prettyMessage.statusmsgGroup" />
				<ParsedMessage :network="network" :message="prettyMessage" />
				<span v-if="requestReleaseName" class="request-action-buttons">
					<button
						type="button"
						class="request-action-button"
						@click="sendRequestCommand('reqfilled')"
					>
						reqfilled
					</button>
					<button
						type="button"
						class="request-action-button"
						@click="sendRequestCommand('reqdel')"
					>
						reqdel
					</button>
					<button
						type="button"
						class="request-action-button"
						@click="sendRequestCommand('reqwipe')"
					>
						reqwipe
					</button>
				</span>
				<LinkPreview
					v-for="preview in prettyMessage.previews"
					:key="preview.link"
					:keep-scroll-position="keepScrollPosition"
					:link="preview"
					:channel="channel"
				/>
			</span>
		</template>
	</div>
</template>

<script lang="ts">
import {computed, defineComponent, PropType} from "vue";
import dayjs from "dayjs";

import constants from "../js/constants";
import localetime from "../js/helpers/localetime";
import Username from "./Username.vue";
import LinkPreview from "./LinkPreview.vue";
import ParsedMessage from "./ParsedMessage.vue";
import MessageTypes from "./MessageTypes";
import StatusmsgMarker from "./StatusmsgMarker.vue";
import eventbus from "../js/eventbus";
import socket from "../js/socket";

import type {ClientChan, ClientMessage, ClientNetwork} from "../js/types";
import {useStore} from "../js/store";
import {MessageType} from "../../shared/types/msg";
import {parser as shoutboxParser} from "../js/helpers/shoutbox-bridge/parser";
import {ChanType} from "../../shared/types/chan";
import {cleanIrcMessage} from "../../shared/irc";

MessageTypes.ParsedMessage = ParsedMessage;
MessageTypes.LinkPreview = LinkPreview;
MessageTypes.Username = Username;

export default defineComponent({
	name: "Message",
	components: {
		...MessageTypes,
		StatusmsgMarker,
	},
	props: {
		message: {type: Object as PropType<ClientMessage>, required: true},
		channel: {type: Object as PropType<ClientChan>, required: false},
		network: {type: Object as PropType<ClientNetwork>, required: true},
		keepScrollPosition: Function as PropType<() => void>,
		isPreviousSource: Boolean,
		isFocused: Boolean,
	},
	setup(props) {
		const store = useStore();

		const timeFormat = computed(() => {
			let format: keyof typeof constants.timeFormats;

			if (store.state.settings.use12hClock) {
				format = store.state.settings.showSeconds ? "msg12hWithSeconds" : "msg12h";
			} else {
				format = store.state.settings.showSeconds ? "msgWithSeconds" : "msgDefault";
			}

			return constants.timeFormats[format];
		});

		const messageTime = computed(() => {
			return dayjs(props.message.time).format(timeFormat.value);
		});

		const messageTimeLocale = computed(() => {
			return localetime(props.message.time);
		});

		const messageComponent = computed(() => {
			return "message-" + (props.message.type || "invalid"); // TODO: force existence of type in sharedmsg
		});

		const isAction = () => {
			if (!props.message.type) {
				return false;
			}

			return typeof MessageTypes["message-" + props.message.type] !== "undefined";
		};

		// IRC Bridge formatter
		const prettyMessage = computed(() => {
			if (
				props.channel?.type !== ChanType.CHANNEL ||
				!store.state.settings.beautifyBridgedMessages ||
				props.message.type !== MessageType.MESSAGE
			) {
				return props.message;
			}

			return shoutboxParser(props.message);
		});

		const requestReleaseName = computed(() => {
			if (props.channel?.type !== ChanType.CHANNEL) {
				return null;
			}

			const text = prettyMessage.value.text;

			if (!text) {
				return null;
			}

			const cleanText = cleanIrcMessage(text);

			const match = cleanText.match(
				/\[Request\]\s*-\s*\[\s*\d+\s*:\]\s*(.+?)(?=\s*~\s*by\b|$)/i
			);

			if (!match?.[1]) {
				return null;
			}

			const releaseName = match[1].trim();

			return releaseName.length > 0 ? releaseName : null;
		});

		const sendRequestCommand = (command: "reqfilled" | "reqdel" | "reqwipe") => {
			if (!props.channel || !requestReleaseName.value) {
				return;
			}

			const channelId = props.channel.id;
			const releaseName = requestReleaseName.value;

			eventbus.emit(
				"confirm-dialog",
				{
					title: "Confirm request action",
					text: `Send !${command} for "${releaseName}"?`,
					button: `Send !${command}`,
				},
				(result: boolean) => {
					if (!result) {
						return;
					}

					socket.emit("input", {
						target: channelId,
						text: `!${command} ${releaseName}`,
					});
				}
			);
		};

		return {
			timeFormat,
			prettyMessage,
			messageTime,
			messageTimeLocale,
			messageComponent,
			isAction,
			requestReleaseName,
			sendRequestCommand,
		};
	},
});
</script>
