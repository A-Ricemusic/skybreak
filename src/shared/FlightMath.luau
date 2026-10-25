-- Pure numeric flight rules, shared by server simulation and the chase camera.
local FlightMath = {}

FlightMath.MinSpeed = 165
FlightMath.MaxSpeed = 320
FlightMath.SoftBoundary = 2400
FlightMath.HardBoundary = 2800
FlightMath.MinAltitude = 130
FlightMath.MaxAltitude = 1050

function FlightMath.IsFinite(value)
	return type(value) == "number" and value == value and value > -math.huge and value < math.huge
end

function FlightMath.ClampInput(value, fallback)
	if not FlightMath.IsFinite(value) then
		return fallback or 0
	end
	return math.clamp(value, -1, 1)
end

function FlightMath.DampAlpha(rate, dt)
	return 1 - math.exp(-rate * math.max(dt, 0))
end

function FlightMath.WrapAngle(angle)
	return (angle + math.pi) % (2 * math.pi) - math.pi
end

function FlightMath.ApproachAngle(angle, target, maxStep)
	return FlightMath.WrapAngle(angle + math.clamp(FlightMath.WrapAngle(target - angle), -maxStep, maxStep))
end

function FlightMath.Forward(yaw, pitch)
	local horizontal = math.cos(pitch)
	return -math.sin(yaw) * horizontal, math.sin(pitch), -math.cos(yaw) * horizontal
end

function FlightMath.NewState()
	return { x = 0, y = 250, z = 500, yaw = 0, pitch = 0, roll = 0, speed = 255 }
end

-- x turns right, y pitches up. No stall or destructive terrain collision: this
-- is an approachable arcade model, with gradual recovery at airspace edges.
function FlightMath.Step(state, input, dt)
	dt = math.clamp(dt, 0, 0.1)
	local x = FlightMath.ClampInput(input.x)
	local y = FlightMath.ClampInput(input.y)
	local throttle = FlightMath.IsFinite(input.throttle) and math.clamp(input.throttle, 0, 1) or 0.65
	local targetSpeed = FlightMath.MinSpeed + (FlightMath.MaxSpeed - FlightMath.MinSpeed) * throttle
	state.speed += (targetSpeed - state.speed) * FlightMath.DampAlpha(2, dt)
	state.yaw = FlightMath.WrapAngle(state.yaw - x * 1.12 * dt)
	local targetPitch = y * 0.62
	if state.y < 190 then
		targetPitch = math.max(targetPitch, (190 - state.y) / 130)
	elseif state.y > 950 then
		targetPitch = math.min(targetPitch, -(state.y - 950) / 160)
	end
	state.pitch += (targetPitch - state.pitch) * FlightMath.DampAlpha(3.2, dt)
	local edge = math.max(math.abs(state.x), math.abs(state.z))
	if edge > FlightMath.SoftBoundary then
		local recovery = math.clamp((edge - FlightMath.SoftBoundary) / 250, 0, 1)
		state.yaw = FlightMath.ApproachAngle(state.yaw, math.atan2(state.x, state.z), recovery * 2.4 * dt)
	end
	state.roll += (-x * 0.85 - state.roll) * FlightMath.DampAlpha(5, dt)
	local dx, dy, dz = FlightMath.Forward(state.yaw, state.pitch)
	state.x = math.clamp(state.x + dx * state.speed * dt, -FlightMath.HardBoundary, FlightMath.HardBoundary)
	state.y = math.clamp(state.y + dy * state.speed * dt, FlightMath.MinAltitude, FlightMath.MaxAltitude)
	state.z = math.clamp(state.z + dz * state.speed * dt, -FlightMath.HardBoundary, FlightMath.HardBoundary)
	return state
end

return FlightMath
