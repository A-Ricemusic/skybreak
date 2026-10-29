assert(workspace:GetAttribute("LargeWorldSpike"))
local Http=game:GetService("HttpService")
local Stats=game:GetService("Stats")
local Scenery=require(game:GetService("ServerStorage").Scenery)
local Assets=require(game:GetService("ServerStorage").WorldAssets).WorldAssets
local buildingDensity=workspace:GetAttribute("SpikeBuildingsPer8k") or 6
local names={"Pine","Broadleaf","RockA","RockB","RockC","OfficeMidrise","ApartmentBlock","Hangar","ControlTower"}
local late=Assets:Preload(names)
print("LARGE_WORLD_PROPS:"..Http:JSONEncode({kind="preload",late=late}))
workspace.Terrain:Clear()
workspace.Terrain:FillBlock(CFrame.new(0,38,0),Vector3.new(2000,12,2000),Enum.Material.Grass)
task.wait(2) -- allow terrain spatial queries to observe the new pad
for _,extent in {8000,16000,24000,35000} do
 local factor=(extent/8000)^2
 local trees,rocks,buildings=math.floor(140*factor+.5),math.floor(22*factor+.5),math.floor(buildingDensity*factor+.5)
 local folder=Instance.new("Folder");folder.Name="PropsSpike";folder.Parent=workspace
 local before=Stats:GetTotalMemoryUsageMb()
 local start=os.clock()
 -- Scenery uses production ray grounding and cached upload/fallback paths.
 Scenery.Trees(folder,23,0,0,1800,1800,44,trees,nil,.4)
 Scenery.Rocks(folder,24,Scenery.PALETTES.temperate,0,0,1800,1800,44,rocks)
 for i=1,buildings do
  Assets.Place(if i%2==0 then "ApartmentBlock" else "OfficeMidrise",folder,CFrame.new((i%20)*70-700,44,math.floor(i/20)*70-700))
 end
 for i=1,3 do Assets.Place("Hangar",folder,CFrame.new(i*150-300,44,900)) end
 Assets.Place("ControlTower",folder,CFrame.new(500,44,900))
 local parts,uploaded=0,0
 for _,v in folder:GetDescendants() do
  if v:IsA("BasePart") then parts+=1 end
  if v:IsA("Model") and v:GetAttribute("GeometrySource")=="Uploaded" then uploaded+=1 end
 end
 print("LARGE_WORLD_PROPS:"..Http:JSONEncode({kind="props",buildingDensity=buildingDensity,extent=extent,trees=trees,rocks=rocks,buildings=buildings,airbaseProps=4,
 instances=#folder:GetDescendants(),baseParts=parts,uploadedModels=uploaded,wallSeconds=os.clock()-start,memoryBeforeMb=before,memoryAfterMb=Stats:GetTotalMemoryUsageMb()}))
 folder:Destroy();task.wait(2)
end
workspace.Terrain:Clear()
print("LARGE_WORLD_PROPS_COMPLETE")
