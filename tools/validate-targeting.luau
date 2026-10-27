-- Engine regression. Run in Client against the built Client folder (or a fresh
-- clone containing the newly compiled modules). This is a fixture, not a sortie.
-- Oracle: actual Body.Position -> Camera:WorldToScreenPoint versus the engine's
-- rendered AbsolutePosition + AbsoluteSize/2. Never invert ViewportGui to test it.
return function(client)
    local Players=game:GetService("Players")
    local RunService=game:GetService("RunService")
    local player=Players.LocalPlayer
    local FC=require(client.FlightController)
    local Overlay=require(client.TargetBoxOverlay).TargetBoxOverlay
    local Smoothing=require(client.EnemySmoothing).EnemySmoothing
    local Mapping=require(client.ViewportGui)
    local camera=workspace.CurrentCamera
    local savedFrame=camera.CFrame
    RunService:BindToRenderStep("TargetingRegressionCamera",Enum.RenderPriority.Last.Value+20,function()
        camera.CFrame=CFrame.new(0,1000,0)
    end)
    local gui,bracket,stroke,caption,arrow=table.unpack(FC.createTargetCue(player.PlayerGui))
    gui.DisplayOrder=1001
    local folder=Instance.new("Folder");folder.Name="TargetingRegression";folder.Parent=workspace
    local model=Instance.new("Model");model.Name="RegressionBandit"
    local root=Instance.new("Part");root.Name="Root";root.Anchored=true;root.Transparency=1;root.Parent=model;model.PrimaryPart=root
    local body=Instance.new("Part");body.Name="Body";body.Size=Vector3.new(2,2,2);body.Color=Color3.new(1,0,1);body.Material=Enum.Material.Neon;body.Parent=model
    local weld=Instance.new("WeldConstraint");weld.Part0=root;weld.Part1=body;weld.Parent=body
    model:SetAttribute("TargetKind","air");model:SetAttribute("SkybreakEnemy",true);model:SetAttribute("SkybreakOwner",player.UserId)
    model:SetAttribute("Damageable",true);model:SetAttribute("RequiredTarget",true);model.Parent=folder
    local smoothing=Smoothing.new();smoothing:Start(folder)
    local visual=workspace:FindFirstChild("RegressionBandit_LocalVisual")
    assert(visual and root.LocalTransparencyModifier==1,"Production smoothing must own the visible clone")
    local visibleBody=visual.Body
    local overlay=Overlay.new();overlay:Start(folder,gui,player.UserId)
    local c=setmetatable({targetGui=gui,bracket=bracket,bracketStroke=stroke,caption=caption,arrow=arrow,
        enemies=smoothing,boxes=overlay,visualFrame=CFrame.new(),captionSpot={},markers={},aircraft=model,
        telemetry={target=model,targetKind="air",targetDamageable=true,targetRequired=true,lockProgress=0}},FC.FlightController)
    local checks,maxError=0,0
    local function check(condition,message) checks+=1;assert(condition,message) end
    local function centered(frame,expected)
        local actual=frame.AbsolutePosition+frame.AbsoluteSize/2
        local error=(actual-Vector2.new(expected.X,expected.Y)).Magnitude
        maxError=math.max(maxError,error)
        check(error<1.5,"Rendered center diverged: "..frame.Name.." parent="..tostring(frame.Parent.AbsolutePosition).."/"..tostring(frame.Parent.AbsoluteSize).." pos="..tostring(frame.Position).." actual="..tostring(actual).." vs "..tostring(expected).." error="..error)
    end
    local ok,result=pcall(function()
        for _,insets in {Enum.ScreenInsets.None,Enum.ScreenInsets.DeviceSafeInsets,Enum.ScreenInsets.CoreUISafeInsets} do
            gui.ScreenInsets=insets
            for _,scale in {.8,1,1.3} do
                -- A separate, scaled HUD root must not move/resize the unscaled targeting layer.
                local hud=Instance.new("Frame");hud.Position=UDim2.fromOffset(17,23);hud.Size=UDim2.fromScale(.8,.8);hud.Parent=gui
                local uiScale=Instance.new("UIScale");uiScale.Scale=scale;uiScale.Parent=hud
                local marker=Instance.new("Frame");marker.Name="ScaledHudProbe";marker.AnchorPoint=Vector2.new(.5,.5);marker.Size=UDim2.fromOffset(10,10);marker.Parent=hud
                RunService.RenderStepped:Wait();RunService.RenderStepped:Wait()
                camera.CFrame=CFrame.new(0,1000,0)
                local frame=camera.CFrame*CFrame.new(0,0,-1200)
                model:PivotTo(frame);smoothing:Step(1)
                local world=smoothing:GetFrame(model).Position
                -- Independent geometry check, before using projection as an oracle.
                check((visibleBody.Position-world).Magnitude<.001,"Visible mesh must move in this callback")
                local screen=camera:WorldToScreenPoint(visibleBody.Position)
                local viewport=camera:WorldToViewportPoint(visibleBody.Position)
                local size=camera.ViewportSize
                overlay:SetPlacement({},{x=0,y=0,width=size.X,height=size.Y})
                overlay:Update(camera,camera.CFrame.Position,nil,function(m) return smoothing:GetFrame(m).Position end)
                local box=gui:FindFirstChild("TargetBox");check(box and box.Visible,"Production overlay box missing")
                c.telemetry.target=model;c.telemetry.lockProgress=0;c.visualFrame=camera.CFrame
                camera.CFrame=CFrame.new(0,1000,0);c:updateTargetCue(camera)
                marker.Position=Mapping.viewportPosition(hud,viewport.X,viewport.Y)
                RunService.RenderStepped:Wait()
                centered(box,screen);centered(bracket,screen);centered(marker,screen)
                check(bracket.AbsoluteSize.X==24,"Selected minimum must render at 24 px")
                check(box.AbsoluteSize.X>=14 and box.AbsoluteSize.X<=40,"Box must render at 14–40 px")
                c.telemetry.lockProgress=1;camera.CFrame=CFrame.new(0,1000,0);c:updateTargetCue(camera)
                RunService.RenderStepped:Wait();centered(bracket,screen)
                check(bracket.AbsoluteSize.X==24 and stroke.Transparency==0 and string.find(caption.Text,"LOCKED"),"Locked selected minimum must be steady 24 px")
                -- Production keep-outs must enclose a separately rendered scaled control.
                -- Derive the coordinate-space delta from the camera APIs, not ViewportGui.
                local r={x=30,y=40,width=50,height=60}
                local control=Instance.new("Frame");control.Position=UDim2.fromOffset(r.x,r.y);control.Size=UDim2.fromOffset(r.width,r.height);control.Parent=hud
                c:SetTargetKeepouts({touch={joystick=r,throttle=r,missile=r,target=r,special=r,evade=r}},scale,hud,hud.AbsoluteSize)
                c:updateKeepouts(size)
                RunService.RenderStepped:Wait()
                local footprint=overlay:GetKeepouts()[1]
                local pad=require(game.ReplicatedStorage.Shared.TargetBoxes).TARGET_BOX_KEEPOUT_PAD
                local cameraOffset=Vector2.new(viewport.X-screen.X,viewport.Y-screen.Y)
                local rendered=control.AbsolutePosition+cameraOffset
                check(math.abs(footprint.x+pad-rendered.X)<1,"Keep-out x misses rendered control")
                check(math.abs(footprint.y+pad-rendered.Y)<1,"Keep-out y misses rendered control")
                check(math.abs(footprint.width-2*pad-control.AbsoluteSize.X)<1,"Keep-out width misses rendered control")
                check(math.abs(footprint.height-2*pad-control.AbsoluteSize.Y)<1,"Keep-out height misses rendered control")
                overlay:SetPlacement({},{x=0,y=0,width=size.X,height=size.Y})
                -- Drone path (no ordinary boxes to suppress it).
                overlay:Stop();c.telemetry.target=nil;c.telemetry.special="uav";c.telemetry.specialActive=1
                camera.CFrame=CFrame.new(0,1000,0);c:updateMarkers(camera);RunService.RenderStepped:Wait()
                check(c.markers[1] and c.markers[1].Visible,"Drone glyph missing");centered(c.markers[1],screen)
                overlay:Start(folder,gui,player.UserId);overlay:SetPlacement({},{x=0,y=0,width=size.X,height=size.Y})
                -- Eligibility uses real attribute events; false/dead/foreign must produce no box.
                for _,protection in {{"Damageable",false},{"SkybreakEnemy",false},{"SkybreakOwner",player.UserId+1}} do
                    local old=model:GetAttribute(protection[1]);model:SetAttribute(protection[1],protection[2]);RunService.Heartbeat:Wait()
                    overlay:Update(camera,camera.CFrame.Position,nil,function(m) return smoothing:GetFrame(m).Position end)
                    check(not overlay:IsBoxed(model),"Protected/dead/foreign contact boxed")
                    model:SetAttribute(protection[1],old);RunService.Heartbeat:Wait()
                end
                -- Protected selected contacts stay TRACK even with stale completed-lock telemetry.
                c.telemetry.target=model;c.telemetry.targetDamageable=false;c.telemetry.lockProgress=1
                camera.CFrame=CFrame.new(0,1000,0);c:updateTargetCue(camera)
                check(not string.find(caption.Text,"LOCKED") and string.find(caption.Text,"TRACK"),"Immune selection must never show LOCKED: "..caption.Text.." bracket="..tostring(bracket.Visible))
                c.telemetry.targetDamageable=true
                -- Offscreen cues use the same mapping. The oracle projects an engine ray
                -- at the expected right edge, rather than calling the mapping backwards.
                camera.CFrame=CFrame.new(0,1000,0)
                model:PivotTo(camera.CFrame*CFrame.new(5000,0,-1200));smoothing:Step(1)
                camera.CFrame=CFrame.new(0,1000,0);c:updateTargetCue(camera)
                c.telemetry.target=nil;camera.CFrame=CFrame.new(0,1000,0);c:updateMarkers(camera)
                local safeX=math.min(90,size.X*.16)
                local ray=camera:ViewportPointToRay(size.X-safeX,size.Y/2)
                local edge=camera:WorldToScreenPoint(ray.Origin+ray.Direction*100)
                local droneRay=camera:ViewportPointToRay(size.X/2+(size.X/2-safeX)*.9,size.Y/2)
                local droneEdge=camera:WorldToScreenPoint(droneRay.Origin+droneRay.Direction*100)
                RunService.RenderStepped:Wait()
                check(arrow.Visible,"Selected edge arrow missing");centered(arrow,edge);centered(c.markers[1],droneEdge)
                -- Negative control: a second inset correction really does move the rendered marker.
                local original=marker.Position
                marker.Position=UDim2.fromScale(original.X.Scale,original.Y.Scale+.1)
                RunService.RenderStepped:Wait()
                check((marker.AbsolutePosition+marker.AbsoluteSize/2-Vector2.new(screen.X,screen.Y)).Magnitude>5,"Oracle failed to detect deliberate displacement")
                hud:Destroy()
                for _,child in gui:GetChildren() do if child.Name=="TargetBox" then child:Destroy() end end
            end
        end
        return {checks=checks,maxRenderedError=maxError,viewport=tostring(camera.ViewportSize)}
    end)
    RunService:UnbindFromRenderStep("TargetingRegressionCamera");camera.CFrame=savedFrame
    smoothing:Stop();overlay:Stop();folder:Destroy();gui:Destroy()
    if not ok then error(result) end
    return result
end
