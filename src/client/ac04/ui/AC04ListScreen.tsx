import React from "@rbxts/react";
import { type AC04InputMode, type AC04MenuLayout, type AC04Rect, type AC04TypeScale, ac04MenuLayout, ac04VisibleRows } from "../../../shared/ac04/ui/AC04MenuLayout";
import { type AC04Intent, ac04ClampFocus, ac04MoveFocus, ac04ScrollTop } from "../../../shared/ac04/ui/AC04Routing";
import { useAC04MenuKeys } from "./AC04Input";
import { type AC04Command, AC04CommandBar, AC04CommandList, AC04GridBackdrop, AC04Heading, AC04Line, AC04NavHints } from "./AC04Primitives";
import { AC04_COMMAND_FONT, AC04Color } from "./AC04Theme";

export interface AC04Status { text: string; warning?: boolean }

export interface AC04ListScreenProps {
	size: Vector2;
	input: AC04InputMode;
	heading: string;
	sub?: string;
	commands: AC04Command[];
	focus: number;
	top: number;
	onFocus: (index: number, top: number) => void;
	onActivate: (index: number) => void;
	/** Back action; omitted on the title screen. */
	onBack?: () => void;
	renderDetail?: (rect: AC04Rect, typography: AC04TypeScale, focus: number) => React.Element | undefined;
	status?: AC04Status;
	/** Replaces the default heading (the title screen draws its own mark in the title band). */
	renderHeading?: (layout: AC04MenuLayout) => React.Element;
	/** Extra activation hook so keyboard/gamepad confirms play the same confirmation sound as clicks. */
	onConfirmSound?: () => void;
}

/** Shared command screen: compact list, detail pane, contextual help, status and an always-visible Back. */
export function AC04ListScreen(props: AC04ListScreenProps) {
	const { size, input, commands } = props;
	const layout = ac04MenuLayout(size.X, size.Y, input, commands.size());
	const enabled = commands.map((command) => command.enabled);
	const shown = ac04ClampFocus(props.focus, enabled);
	const visible = ac04VisibleRows(layout);
	const top = ac04ScrollTop(math.max(0, shown), commands.size(), visible, props.top);
	const move = (index: number) => { if (index >= 0) props.onFocus(index, ac04ScrollTop(index, commands.size(), visible, top)); };
	useAC04MenuKeys(true, (intent: AC04Intent) => {
		if (intent === "up") move(ac04MoveFocus(shown < 0 ? 0 : shown, -1, enabled));
		else if (intent === "down") move(ac04MoveFocus(shown < 0 ? 0 : shown, 1, enabled));
		else if (intent === "confirm" && shown >= 0 && commands[shown]?.enabled) { props.onConfirmSound?.(); props.onActivate(shown); }
		else if (intent === "back" && props.onBack) { props.onConfirmSound?.(); props.onBack(); }
	});
	const help = shown >= 0 ? commands[shown]?.help : undefined;
	const footer: AC04Command[] = props.onBack ? [{ id: "back", label: "BACK", enabled: true }] : [];
	return (
		<frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
			<AC04GridBackdrop width={size.X} height={size.Y} />
			<AC04NavHints rect={layout.hints} input={input} textSize={layout.typography.small} />
			{props.renderHeading ? props.renderHeading(layout) : <AC04Heading rect={layout.title} text={props.heading} sub={props.sub} size={layout.typography.title} subSize={layout.typography.small} />}
			<AC04CommandList rect={layout.list} commands={commands} focus={shown} top={top} rowPitch={layout.rowPitch} textSize={layout.typography.command} onFocus={move} onActivate={(index) => props.onActivate(index)} />
			{props.renderDetail && <frame BackgroundTransparency={1} ClipsDescendants={true} Position={UDim2.fromOffset(layout.detail.x, layout.detail.y)} Size={UDim2.fromOffset(layout.detail.width, layout.detail.height)}>{props.renderDetail({ x: 0, y: 0, width: layout.detail.width, height: layout.detail.height }, layout.typography, shown)}</frame>}
			{help !== undefined && <AC04Line rect={layout.help} text={help} textSize={layout.typography.small + 1} color={AC04Color.Ink} />}
			{props.status && <AC04Line rect={layout.status} text={props.status.text} textSize={layout.typography.small} color={props.status.warning ? AC04Color.Warning : AC04Color.Muted} font={AC04_COMMAND_FONT} />}
			{footer.size() > 0 && <AC04CommandBar rect={layout.commands} commands={footer} textSize={layout.typography.small + 1} onActivate={() => props.onBack?.()} />}
		</frame>
	);
}
