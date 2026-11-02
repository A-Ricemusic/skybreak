import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { boundedWorldWork, cancelWorldWork } from "./BoundedWorldWork";

afterEach(cancelWorldWork);
describe("bounded world test workers", () => {
 it("returns results and propagates build failures", () => {
  expect(boundedWorldWork("result", () => 42, 1)).toBe(42);
  const [ok, failure] = pcall(() => boundedWorldWork("failure", (): number => { error("build failed"); }, 1));
  expect(ok).toBe(false); expect(tostring(failure).find("build failed")[0]).toBeDefined();
 });
 it("cancels a timed-out build before its continuation can mutate the next fixture", () => {
  let worker: thread | undefined, continued = false;
  const [ok] = pcall(() => boundedWorldWork("stuck", () => {
   worker = coroutine.running(); task.wait(60); continued = true;
  }, 0.03));
  expect(ok).toBe(false); expect(coroutine.status(worker!)).toBe("dead"); expect(continued).toBe(false);
 });
});
