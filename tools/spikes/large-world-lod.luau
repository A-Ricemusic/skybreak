-- Lower-detail surrogate: same cosine footprint/peak, sampled columns (not larger native voxels).
local function plan(extent)
 local ops={}
 local function block(x,z,w,d,h,material)
  table.insert(ops,{shape="block",material=material,x=x,y=-24+h/2,z=z,sx=w,sy=h,sz=d,yaw=0})
 end
 local lo=math.floor(-extent*.30/256)*256
 local hi=math.ceil(extent*.30/256)*256
 for x=math.floor(-extent*.12/256)*256,math.ceil(extent*.12/256)*256-1,256 do
  for z=lo,hi-1,256 do
   local step=if math.abs(x+128)<=3584 and math.abs(z+128)<=3584 then 64 else 256
   for dx=0,255,step do for dz=0,255,step do
    local px,pz=x+dx+step/2,z+dz+step/2
    local r=math.sqrt((px/(extent*.12))^2+(pz/(extent*.30))^2)
    if r<1 then
     local h=math.max(4,math.floor(576*(.5+.5*math.cos(math.pi*r))/4)*4)
     block(px,pz,step,step,h,"LeafyGrass")
    end
   end end
  end
 end
 return ops
end
return plan
