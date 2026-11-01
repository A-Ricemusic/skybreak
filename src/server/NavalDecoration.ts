import type { NavalAsset } from "../shared/NavalKit";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { WorldAssets } from "./WorldAssets";
import { GROUND_KIT_BUDGET_ATTRIBUTE, kitInstanceAllowance } from "./WorldInstanceBudget";
/** Scenery-only decoration; the existing parts retain collision and placement. */
export function decorateNavalScenery(owner: Instance, asset: NavalAsset, proxies: BasePart[]): void {
 if (proxies.size() === 0) return;
 let lo = proxies[0].Position.sub(proxies[0].Size.div(2)), hi = proxies[0].Position.add(proxies[0].Size.div(2));
 for (const p of proxies) {
  const a = p.Position.sub(p.Size.div(2)), b = p.Position.add(p.Size.div(2));
  lo = new Vector3(math.min(lo.X,a.X), math.min(lo.Y,a.Y), math.min(lo.Z,a.Z));
  hi = new Vector3(math.max(hi.X,b.X), math.max(hi.Y,b.Y), math.max(hi.Z,b.Z));
 }
 const size = hi.sub(lo), authored = UploadedAssetSpecs[asset].size;
 const scale = math.min(size.X/authored.X, size.Y/authored.Y, size.Z/authored.Z);
 const visual = WorldAssets.PlaceUploaded(asset, owner, new CFrame((lo.X+hi.X)/2,lo.Y,(lo.Z+hi.Z)/2),scale);
 if (visual === undefined) return;
 if (1+visual.GetDescendants().size() > kitInstanceAllowance(asset)) { visual.Destroy(); return; }
 visual.SetAttribute(GROUND_KIT_BUDGET_ATTRIBUTE,true);
 for (const p of proxies) p.Transparency=1;
 for (const p of visual.GetDescendants()) if (p.IsA("BasePart")) { p.CanQuery=false; p.CanTouch=false; p.CanCollide=false; p.SetAttribute("FlightSolid",false); }
}
