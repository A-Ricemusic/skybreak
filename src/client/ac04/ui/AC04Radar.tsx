import React, { useEffect, useRef } from "@rbxts/react";
import { RunService } from "@rbxts/services";
import { RADAR_NEAR_RANGE, type RadarContactKind, radarRange } from "../../../shared/RadarMath";
import { ac04ScopeProject, ac04ScopeReturnLine } from "../../../shared/ac04/ui/AC04HudLayout";
import type { AC04Rect } from "../../../shared/ac04/ui/AC04MenuLayout";
import type { FlightController } from "../../FlightController";
import { at } from "./AC04Primitives";
import { AC04_NUMBER_FONT, AC04Color } from "./AC04Theme";

/** Hostiles red, the protected friendly cyan; required targets solid, optional hollow; missiles blink. */
const GLYPH: { [K in RadarContactKind]: string } = {
	required: "▲", optional: "△", ground: "■", groundOptional: "□", objective: "◎", protected: "◆", missile: "•",
};
const COLOR: { [K in RadarContactKind]: Color3 } = {
	required: AC04Color.Hostile, optional: AC04Color.Hostile, ground: AC04Color.Hostile, groundOptional: AC04Color.Hostile,
	objective: AC04Color.White, protected: AC04Color.Friendly, missile: AC04Color.Danger,
};
const LAYER: { [K in RadarContactKind]: number } = { objective: 1, protected: 2, groundOptional: 3, ground: 4, optional: 5, required: 6, missile: 7 };
const INTERVAL = 1 / 20;
/** Player origin sits low in the scope so more of the view ahead is visible. */
const ORIGIN_Y = 0.66;
const CONE_DEGREES = 30;

function line(frame: Frame | undefined, x1: number, y1: number, x2: number, y2: number): void {
	if (!frame) return;
	const dx = x2 - x1, dy = y2 - y1, length = math.sqrt(dx * dx + dy * dy);
	frame.Visible = length > 1;
	frame.Position = UDim2.fromOffset((x1 + x2) / 2, (y1 + y2) / 2);
	frame.Size = UDim2.fromOffset(length, 1);
	frame.Rotation = math.deg(math.atan2(dy, dx));
}

/**
 * Heading-up rectangular scope (lower-left). Contacts come from FlightController.GetRadarContacts and
 * telemetry exactly as before; only the projection and glyph treatment are AC04-specific. The southern
 * return line is drawn where it falls inside the current range.
 */
function AC04RadarImpl({ rect, controller, returnZ }: { rect: AC04Rect; controller: FlightController; returnZ?: number }) {
	const scope = useRef<Frame>(), returnLine = useRef<Frame>(), rangeLabel = useRef<TextLabel>();
	const returnRef = useRef(returnZ);
	returnRef.current = returnZ;
	const { width, height } = rect;
	useEffect(() => {
		const root = scope.current;
		if (!root) return;
		const pool: TextLabel[] = [];
		const originX = width / 2, originY = height * ORIGIN_Y;
		let clock = INTERVAL, lastRange = -1;
		const connection = RunService.RenderStepped.Connect((dt) => {
			clock += dt;
			if (clock < INTERVAL) return;
			clock = 0;
			const position = controller.GetPosition(), yaw = controller.GetHeading();
			let used = 0;
			if (position && yaw !== undefined) {
				const contacts = controller.GetRadarContacts();
				const range = radarRange(position.X, position.Z, contacts);
				if (range !== lastRange && rangeLabel.current) { lastRange = range; rangeLabel.current.Text = range === RADAR_NEAR_RANGE ? "NEAR" : "WIDE"; }
				const z = returnRef.current;
				const segment = z !== undefined ? ac04ScopeReturnLine(position.X, position.Z, z, yaw, range, width, height, originX, originY) : undefined;
				if (segment) line(returnLine.current, segment[0], segment[1], segment[2], segment[3]);
				else if (returnLine.current) returnLine.current.Visible = false;
				const blink = os.clock() % 0.5 < 0.25;
				for (const contact of contacts) {
					const point = ac04ScopeProject(contact.x - position.X, contact.z - position.Z, yaw, range, width, height, originX, originY);
					let label = pool[used];
					if (!label) {
						label = new Instance("TextLabel");
						label.Name = "RadarContact";
						label.AnchorPoint = new Vector2(0.5, 0.5);
						label.Size = UDim2.fromOffset(20, 20);
						label.BackgroundTransparency = 1;
						label.Font = Enum.Font.GothamBold;
						label.TextStrokeColor3 = AC04Color.Shadow;
						label.TextStrokeTransparency = 0.35;
						label.Parent = root;
						pool[used] = label;
					}
					used++;
					const missile = contact.kind === "missile";
					label.Text = GLYPH[contact.kind];
					label.TextColor3 = contact.selected ? AC04Color.White : missile && blink ? AC04Color.White : COLOR[contact.kind];
					label.TextSize = math.floor((contact.selected ? 15 : missile ? 14 : 11) * math.max(1, width / 130));
					label.ZIndex = 3 + LAYER[contact.kind];
					label.TextTransparency = point.edge ? 0.5 : 0;
					label.Position = UDim2.fromOffset(point.x, point.y);
					label.Visible = true;
				}
			} else if (returnLine.current) returnLine.current.Visible = false;
			for (let i = used; i < pool.size(); i++) if (pool[i].Visible) pool[i].Visible = false;
		});
		return () => { connection.Disconnect(); for (const label of pool) label.Destroy(); };
	}, [width, height, controller]);
	const originX = width / 2, originY = height * ORIGIN_Y;
	const cone = (key: string, sign: number) => {
		const reach = originY - 4, angle = math.rad(CONE_DEGREES);
		const x2 = originX + sign * math.sin(angle) * reach, y2 = originY - math.cos(angle) * reach;
		const dx = x2 - originX, dy = y2 - originY;
		return <frame key={key} AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={AC04Color.Flight} BackgroundTransparency={0.6} BorderSizePixel={0} Position={UDim2.fromOffset((originX + x2) / 2, (originY + y2) / 2)} Size={UDim2.fromOffset(math.sqrt(dx * dx + dy * dy), 1)} Rotation={math.deg(math.atan2(dy, dx))} ZIndex={2} />;
	};
	return (
		<frame ref={scope} BackgroundColor3={AC04Color.Shadow} BackgroundTransparency={0.45} BorderSizePixel={0} ClipsDescendants={true} {...at(rect)}>
			<uistroke Color={AC04Color.Flight} Transparency={0.15} Thickness={1} />
			{cone("ConeLeft", -1)}
			{cone("ConeRight", 1)}
			<frame ref={returnLine} AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={AC04Color.Friendly} BackgroundTransparency={0.2} BorderSizePixel={0} Visible={false} ZIndex={2} />
			<textlabel AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Font={Enum.Font.GothamBlack} Text="▲" TextColor3={AC04Color.White} TextSize={12} Position={UDim2.fromOffset(originX, originY)} Size={UDim2.fromOffset(14, 14)} ZIndex={11} />
			<textlabel ref={rangeLabel} BackgroundTransparency={1} FontFace={AC04_NUMBER_FONT} Text="" TextColor3={AC04Color.FlightDim} TextSize={10} AnchorPoint={new Vector2(1, 1)} Position={new UDim2(1, -3, 1, -2)} Size={UDim2.fromOffset(40, 10)} TextXAlignment={Enum.TextXAlignment.Right} ZIndex={12} />
		</frame>
	);
}

export const AC04Radar = React.memo(AC04RadarImpl);
