/** Move all rendered parts immediately, including models with an authored pivot offset. */
export function moveRenderedTarget(model: Model, rootFrame: CFrame): void {
	const root = model.PrimaryPart;
	if (root) model.PivotTo(rootFrame.mul(root.PivotOffset));
}
