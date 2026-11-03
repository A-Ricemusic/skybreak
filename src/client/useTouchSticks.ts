// Touch flight sticks for GameUI: the steering and throttle pads, their finger tracking (TouchSticks),
// the knob frames moved directly while dragging, tap-to-target, and the input-mode switch that releases
// the sticks when the player changes device. Moved verbatim out of GameUI; the HUD frames are rendered by
// screens/MissionHud through the returned refs and InputBegan handlers.
import { type MutableRefObject, useCallback, useEffect, useMemo, useRef } from "@rbxts/react";
import { GuiService, UserInputService } from "@rbxts/services";
import { stickVector, TouchSticks } from "../shared/TouchSticks";
import { type InputMode, shouldAcceptInputModeChange } from "../shared/UILayout";
import type { FlightController } from "./FlightController";
import { glyphCache, readInputMode } from "./screens/UIInput";

export interface TouchStickDeps {
	controller: FlightController;
	/** GameUI's screen tracker: sticks only respond during a sortie. */
	inMissionRef: MutableRefObject<boolean>;
	inputModeRef: MutableRefObject<InputMode>;
	mountedRef: MutableRefObject<boolean>;
	setInputMode: (mode: InputMode) => void;
	/** Shows the control hints again for a few seconds after a device switch. */
	setHintUntil: (until: number) => void;
}

export function useTouchSticks({
	controller,
	inMissionRef,
	inputModeRef,
	mountedRef,
	setInputMode,
	setHintUntil,
}: TouchStickDeps) {
	const joystickRef = useRef<Frame>();
	const knobRef = useRef<Frame>();
	const touches = useMemo(() => new TouchSticks<InputObject>(), []);
	const touchEndConnections = useMemo(() => new Map<InputObject, RBXScriptConnection>(), []);
	const throttleJoystickRef = useRef<Frame>();
	const throttleKnobRef = useRef<Frame>();
	const releaseJoystick = useCallback(() => {
		for (const [, connection] of touchEndConnections) connection.Disconnect();
		touchEndConnections.clear();
		touches.Clear();
		controller.SetTouchThrottleAxis(0);
		if (throttleKnobRef.current) throttleKnobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		if (knobRef.current) knobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		controller.SetInput(0, 0);
	}, [controller]);
	const applyInputMode = useCallback(
		(nextMode: InputMode) => {
			const current = inputModeRef.current;
			if (!shouldAcceptInputModeChange(current, nextMode, touches.Held())) return;
			if (current === "touch") releaseJoystick();
			inputModeRef.current = nextMode;
			glyphCache.clear();
			if (!mountedRef.current) return;
			setInputMode(nextMode);
			setHintUntil(os.clock() + 6);
		},
		[releaseJoystick],
	);
	const endJoystickTouch = useCallback(() => {
		releaseJoystick();
		applyInputMode(readInputMode());
	}, [applyInputMode, releaseJoystick]);
	const moveJoystick = useCallback(
		(input: InputObject) => {
			const joystick = joystickRef.current;
			const knob = knobRef.current;
			if (!joystick || !knob || !inMissionRef.current) return;
			const stick = stickVector(
				input.Position.X,
				input.Position.Y,
				joystick.AbsolutePosition.X,
				joystick.AbsolutePosition.Y,
				joystick.AbsoluteSize.X,
			);
			// The knob sits inside the (possibly HUD-scaled) frame: convert screen pixels back to its units.
			const unit = joystick.AbsoluteSize.X / math.max(1, joystick.Size.X.Offset);
			knob.Position = new UDim2(0.5, stick.offsetX / unit, 0.5, stick.offsetY / unit);
			controller.SetInput(stick.x, stick.y);
		},
		[controller],
	);
	const releaseTouch = useCallback(
		(input: InputObject) => {
			if (touches.steering === input) {
				controller.SetInput(0, 0);
				if (knobRef.current) knobRef.current.Position = UDim2.fromScale(0.5, 0.5);
			}
			if (touches.throttle === input) {
				controller.SetTouchThrottleAxis(0);
				if (throttleKnobRef.current) throttleKnobRef.current.Position = UDim2.fromScale(0.5, 0.5);
			}
			touchEndConnections.get(input)?.Disconnect();
			touchEndConnections.delete(input);
			touches.End(input);
			applyInputMode(readInputMode());
		},
		[controller, touches, applyInputMode],
	);
	const trackTouchEnd = useCallback(
		(input: InputObject) => {
			touchEndConnections.set(
				input,
				input.GetPropertyChangedSignal("UserInputState").Connect(() => {
					if (
						input.UserInputState === Enum.UserInputState.End ||
						input.UserInputState === Enum.UserInputState.Cancel
					)
						releaseTouch(input);
				}),
			);
		},
		[releaseTouch, touchEndConnections],
	);
	const joystickBegan = useCallback(
		(input: InputObject) => {
			if (
				!inMissionRef.current ||
				GuiService.MenuIsOpen ||
				UserInputService.GetFocusedTextBox() ||
				inputModeRef.current !== "touch" ||
				input.UserInputType !== Enum.UserInputType.Touch
			)
				return;
			if (!touches.Begin("steering", input)) return;
			trackTouchEnd(input);
			moveJoystick(input);
		},
		[moveJoystick, trackTouchEnd],
	);
	// The stick's InputBegan only covers its own frame. World boxes need the unconsumed screen touches too.
	useEffect(() => {
		const began = UserInputService.TouchStarted.Connect((input, processed) => {
			if (
				processed ||
				!inMissionRef.current ||
				inputModeRef.current !== "touch" ||
				GuiService.MenuIsOpen ||
				UserInputService.GetFocusedTextBox()
			)
				return;
			controller.TryTapTarget(input.Position);
		});
		return () => began.Disconnect();
	}, [controller]);
	const moveThrottle = useCallback(
		(input: InputObject) => {
			const stick = throttleJoystickRef.current;
			const knob = throttleKnobRef.current;
			if (!stick || !knob || !inMissionRef.current) return;
			const radius = math.max(1, stick.AbsoluteSize.Y * 0.34);
			const offset = math.clamp(
				input.Position.Y - stick.AbsolutePosition.Y - stick.AbsoluteSize.Y / 2,
				-radius,
				radius,
			);
			const unit = stick.AbsoluteSize.Y / math.max(1, stick.Size.Y.Offset);
			knob.Position = new UDim2(0.5, 0, 0.5, offset / unit);
			controller.SetTouchThrottleAxis(-offset / radius);
		},
		[controller],
	);
	const throttleBegan = useCallback(
		(input: InputObject) => {
			if (
				!inMissionRef.current ||
				GuiService.MenuIsOpen ||
				UserInputService.GetFocusedTextBox() ||
				inputModeRef.current !== "touch" ||
				input.UserInputType !== Enum.UserInputType.Touch
			)
				return;
			if (!touches.Begin("throttle", input)) return;
			trackTouchEnd(input);
			moveThrottle(input);
		},
		[moveThrottle, trackTouchEnd],
	);
	// Unmount: drop every tracked finger and zero the controller's touch axes (GameUI then stops the controller).
	useEffect(() => {
		return () => {
			for (const [, connection] of touchEndConnections) connection.Disconnect();
			touchEndConnections.clear();
			touches.Clear();
			controller.SetTouchThrottleAxis(0);
			controller.SetInput(0, 0);
		};
	}, [controller]);
	useEffect(() => {
		const changed = UserInputService.InputChanged.Connect((input) => {
			const active = touches.steering;
			if (
				input.UserInputState === Enum.UserInputState.Cancel ||
				input.UserInputState === Enum.UserInputState.End
			) {
				releaseTouch(input);
				return;
			}
			if (active && input === active) moveJoystick(input);
			if (input === touches.throttle) moveThrottle(input);
		});
		const ended = UserInputService.InputEnded.Connect(releaseTouch);
		const focus = UserInputService.WindowFocusReleased.Connect(endJoystickTouch);
		const menu = GuiService.MenuOpened.Connect(endJoystickTouch);
		const textFocus = UserInputService.TextBoxFocused.Connect(endJoystickTouch);
		return () => {
			changed.Disconnect();
			ended.Disconnect();
			focus.Disconnect();
			menu.Disconnect();
			textFocus.Disconnect();
		};
	}, [endJoystickTouch, moveJoystick, moveThrottle, releaseTouch]);
	return {
		joystickRef,
		knobRef,
		throttleJoystickRef,
		throttleKnobRef,
		joystickBegan,
		throttleBegan,
		releaseJoystick,
		applyInputMode,
	};
}
