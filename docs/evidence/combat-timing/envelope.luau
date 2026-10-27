local Duel=require('./MissileDuel').MissileDuel
local Flight=require('./FlightMath').FlightMath
for _,level in {'easy','normal','ace'} do
 for act=1,3 do
  for _,speed in {160,320,450,600} do
   for _,delay in {0,0.3,0.6} do
    local shots,hits,cues,followedHits=0,0,0,0
    for bearing=0,330,30 do
     for _,range in {800,1400,1800} do
      local r=Duel:Fly({level=level,act=act,bearing=bearing,range=range,pilot='cue',reaction=delay,throttle=Flight:ThrottleForSpeed(speed)})
      if not r.held then shots+=1 end
      if r.event=='hit' then hits+=1 end
      if r.cued then cues+=1 end
      if r.breakStep and r.event=='hit' then followedHits+=1 end
     end
    end
    print(level,act,speed,delay,shots,hits,cues,followedHits)
   end
  end
 end
end
