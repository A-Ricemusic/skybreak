import { closedBridgeRoute } from "./EngineBatchD12Runtime";
import { gunOccluded, gunRaycastParams } from "./GunRuntime";
import { JetFactory } from "../shared/JetFactory";
import { Debris, TweenService } from "@rbxts/services";
import { navalHull, surfacePose, SamRules } from "../shared/EngineBatchD2";
import type { CombatSession, Enemy, Projectile } from "./CombatSession";
/** Freeze the last pose; lower every visible piece together, never leaving deck weapons floating. */
export function sinkNavalTarget(session: CombatSession, hull: Enemy): boolean {
	if(!hull.typedGround || !navalHull(hull.typedGround.type)) return false;
	if(hull.typedGround.type==="ship" && !hull.typedGround.naval && !hull.typedGround.route && !session.enemies.some(e=>e.typedGround?.parentId===hull.id)) return false;
	for(const e of session.enemies) {
		if(e!==hull && (e.typedGround?.parentId!==hull.id || e.health<=0)) continue;
		// Collateral mount removal is deliberately not a RecordKill: no score or kill credit.
		if(e!==hull) { session.retiredGroundIds ??= new Set<string>(); session.retiredGroundIds.add(e.id); }
		e.health=0; e.enabled=false; e.damageable=false; e.windup=0; e.frame=undefined;
		e.model.SetAttribute("Health",0); e.model.SetAttribute("SkybreakEnemy",false);
		e.model.SetAttribute("RequiredTarget",false); e.model.SetAttribute("Damageable",false); e.model.SetAttribute("AttackWarning",false);
		e.model.SetAttribute("Sinking",true); if(e.warning) e.warning.Enabled=false;
		for(const p of e.model.GetDescendants()) if(p.IsA("BasePart")) {
			p.CanQuery=false; p.CanCollide=false;
			TweenService.Create(p,new TweenInfo(6,Enum.EasingStyle.Linear),{CFrame:p.CFrame.sub(new Vector3(0,65,0))}).Play();
		}
		Debris.AddItem(e.model,6.1);
	}
	return true;
}
/** Active-phase time only: rearm/pause do not call this simulation. Routes hold at the end. */
export function stepSurfaceTargets(session: CombatSession, dt: number): void {
	for(const hull of session.enemies) {
		const spec=hull.typedGround;
		if(!spec?.route || !hull.enabled || hull.health<=0) continue;
		if(closedBridgeRoute(session,hull.id,"hull")) { hull.velocity=Vector3.zero; continue; }
		hull.surfaceStartedAt=(hull.surfaceStartedAt ?? 0)+dt;
		const pose=surfacePose(spec.route,hull.surfaceStartedAt);
		const authored=new CFrame(spec.position.x,spec.position.y,spec.position.z).mul(CFrame.Angles(0,math.rad(spec.yaw),0));
		const moving=new CFrame(pose.position.x,pose.position.y,pose.position.z).mul(CFrame.Angles(0,math.rad(pose.yaw),0));
		for(const e of session.enemies) {
			if((e!==hull && e.typedGround?.parentId!==hull.id) || e.health<=0) continue;
			e.surfaceOrigin ??= e.model.GetPivot();
			const previous=e.position;
			e.model.PivotTo(moving.mul(authored.Inverse()).mul(e.surfaceOrigin));
			e.position=e.model.PrimaryPart!.Position;
			e.velocity=dt>0 ? e.position.sub(previous).div(dt) : Vector3.zero;
			e.direction=moving.LookVector;
		}
	}
}

export function stepSamDefence(session: CombatSession, dt: number, attackWarning: (model: Model)=>BillboardGui): void {
	let threats=SamRules.Threats(session.enemies,session.projectiles);
	const cap=SamRules.Cap(session.difficulty);
	for(const e of session.enemies) {
		if(e.typedGround?.sam!==true) continue;
		const origin=e.position.add(new Vector3(0,12,0)), delta=new Vector3(session.state.x,session.state.y,session.state.z).sub(origin);
		if(!SamRules.Eligible(e.health>0,e.enabled,delta.Magnitude)) {
			if(e.health>0 && e.enabled && e.windup>0) threats--;
			e.windup=0; e.model.SetAttribute("AttackWarning",false); if(e.warning) e.warning.Enabled=false; continue;
		}
		e.fireTimer=math.max(0,e.fireTimer-dt);
		if(e.windup>0) {
			e.windup=math.max(0,e.windup-dt);
			if(e.windup<=0) {
				const scale=SamRules.Scale(session.difficulty), direction=delta.Unit;
				session.projectiles.push({part:JetFactory.CreateMissile(session.folder,origin,direction,true),position:origin,direction,hostile:true,sam:true,age:0,ace:false,damage:12*scale,speed:380*scale,life:10});
				e.fireTimer=SamRules.Reload/scale; e.model.SetAttribute("AttackWarning",false); if(e.warning) e.warning.Enabled=false;
			}
		} else if(e.fireTimer<=0 && threats<cap) {
			threats++; e.windup=SamRules.Windup/SamRules.Scale(session.difficulty); e.model.SetAttribute("AttackWarning",true);
			if(!e.warning) { e.warning=attackWarning(e.model); const label=e.warning.FindFirstChildOfClass("TextLabel"); if(label) label.Text="SAM LOCK"; } e.warning.Enabled=true;
		}
	}
}

/** Same water-ignoring scenery policy as the gun; only opted-in anti-ship projectiles use it. */
export function antiShipObstructed(session: CombatSession, missile: Projectile, nextPosition: Vector3): boolean {
	if(!missile.antiShip || !missile.target || !session.groundParams) return false;
	return gunOccluded(session.gunParams ??= gunRaycastParams(session.groundParams),missile.position,nextPosition,missile.target.model);
}
