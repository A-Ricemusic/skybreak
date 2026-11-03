// Server adapters for GroundAirDefence: AA gun windup, tracer bursts and the attack-warning billboard
// shared with SAM sites and airborne shooters. Extracted from CombatService.
import { GroundAirDefence } from "../shared/GroundAirDefence";
import { positionFor, ownsEnemy } from "./SessionQueries";
import type { CombatSession } from "./CombatSession";

/** Disabled billboard above `model`; callers flip `Enabled` while the shooter winds up. */
export function attackWarning(model: Model, text: string): BillboardGui {
	const warning = new Instance("BillboardGui");
	warning.Name = "MissileWarning";
	warning.Adornee = model.PrimaryPart;
	warning.Size = UDim2.fromOffset(135, 28);
	warning.StudsOffsetWorldSpace = new Vector3(0, 18, 0);
	warning.MaxDistance = 2300;
	warning.AlwaysOnTop = true;
	warning.Enabled = false;
	warning.Parent = model;
	const label = new Instance("TextLabel");
	label.Size = UDim2.fromScale(1, 1);
	label.BackgroundTransparency = 1;
	label.Font = Enum.Font.GothamBold;
	label.TextSize = 16;
	label.TextColor3 = Color3.fromRGB(255, 130, 85);
	label.TextStrokeTransparency = 0.2;
	label.Text = text;
	label.Parent = warning;
	return warning;
}
/** Missile-launch warning used by airborne shooters and SAM sites. */
export function missileWarning(model: Model): BillboardGui {
	return attackWarning(model, "MISSILE WARNING");
}

export function stepGroundDefence(session: CombatSession, dt: number): void {
	let firing = 0;
	for (const enemy of session.enemies)
		if (
			(enemy.typedGround?.type === "aa_gun" ||
				enemy.typedGround?.type === "gun_mount" ||
				enemy.typedGround?.type === "flak_gun") &&
			enemy.windup > 0 &&
			ownsEnemy(session, enemy)
		)
			firing++;
	for (const enemy of session.enemies) {
		if (
			enemy.typedGround?.type !== "aa_gun" &&
			enemy.typedGround?.type !== "gun_mount" &&
			enemy.typedGround?.type !== "flak_gun"
		)
			continue;
		const eligible = GroundAirDefence.Eligible(
			enemy.health > 0,
			enemy.enabled,
			enemy.position.sub(positionFor(session.state)).Magnitude,
		);
		if (!eligible) {
			enemy.windup = 0;
			enemy.model.SetAttribute("AttackWarning", false);
			if (enemy.warning) enemy.warning.Enabled = false;
			continue;
		}
		enemy.fireTimer = math.max(0, enemy.fireTimer - dt);
		if (enemy.windup > 0) {
			enemy.windup -= dt;
			if (enemy.windup <= 0) {
				const target = positionFor(session.state),
					delta = target.sub(enemy.position);
				const tracer = new Instance("Part");
				tracer.Name = "AA tracer burst";
				tracer.Anchored = true;
				tracer.CanCollide = false;
				tracer.CanTouch = false;
				tracer.CanQuery = false;
				tracer.Material = Enum.Material.Neon;
				tracer.Color = Color3.fromRGB(255, 180, 75);
				tracer.Size = new Vector3(1, 1, delta.Magnitude);
				tracer.CFrame = CFrame.lookAt(enemy.position.add(delta.mul(0.5)), target);
				tracer.Parent = session.folder;
				task.delay(0.15, () => tracer.Destroy());
				if (GroundAirDefence.Hit(math.random(), session.difficulty, session.evadeRemaining > 0)) {
					const damage = GroundAirDefence.Damage;
					session.health = math.max(0, session.health - damage);
					session.damageTaken += damage;
					session.lowestHealth = math.min(session.lowestHealth, session.health);
					if (session.health <= 0) return;
				}
				enemy.fireTimer = GroundAirDefence.Reload;
				enemy.model.SetAttribute("AttackWarning", false);
				if (enemy.warning) enemy.warning.Enabled = false;
			}
		} else if (enemy.fireTimer <= 0 && GroundAirDefence.Admit(firing)) {
			firing++;
			enemy.windup = GroundAirDefence.Windup;
			enemy.model.SetAttribute("AttackWarning", true);
			if (!enemy.warning) {
				enemy.warning = attackWarning(enemy.model, "AA FIRING");
			}
			enemy.warning.Enabled = true;
		}
	}
}
