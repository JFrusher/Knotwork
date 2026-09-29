import { beforeEach, expect, test, vi } from "vitest";
import { fakeClient } from "@/lib/testing/realtime";
import { followWedding, othersIn, pageName, usePresence, type Here } from "./live";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const alex: Here = { email: "alex@example.com", where: "Seating" };

beforeEach(() => usePresence.setState({ others: [] }));

test("joins the wedding's private channel, says where it is, and catches up on each join", async () => {
  const fake = fakeClient();
  const onJoined = vi.fn();
  followWedding(fake.client, "w1", alex, { onMoved: vi.fn(), onJoined });
  await settle();

  expect(fake.client.realtime.setAuth).toHaveBeenCalled();
  expect(fake.client.channel).toHaveBeenCalledWith("wedding:w1", expect.objectContaining({ config: expect.objectContaining({ private: true }) }));
  fake.joined();
  expect(fake.channel.track).toHaveBeenCalledWith(alex);
  expect(onJoined).toHaveBeenCalledTimes(1);

  // Back after a dropped connection: whatever was said meanwhile was missed.
  fake.joined();
  expect(onJoined).toHaveBeenCalledTimes(2);
});

test("each announced version is heard", async () => {
  const fake = fakeClient();
  const onMoved = vi.fn();
  followWedding(fake.client, "w1", alex, { onMoved, onJoined: vi.fn() });
  await settle();
  fake.moved(7);
  expect(onMoved).toHaveBeenCalledWith(7);
});

test("the others here are everyone but me, once each however many windows", async () => {
  const fake = fakeClient();
  followWedding(fake.client, "w1", alex, { onMoved: vi.fn(), onJoined: vi.fn() });
  await settle();
  fake.present({
    a: [alex],
    b: [{ email: "sam@example.com", where: "Timeline" }],
    c: [{ email: "sam@example.com", where: "Guests" }],
    d: [{ email: "planner@example.com", where: null }],
  });
  expect(usePresence.getState().others).toEqual([
    { email: "planner@example.com", where: null },
    { email: "sam@example.com", where: "Guests" },
  ]);
});

test("moving page says so; stopping leaves the channel and forgets who was here", async () => {
  const fake = fakeClient();
  const live = followWedding(fake.client, "w1", alex, { onMoved: vi.fn(), onJoined: vi.fn() });
  await settle();
  fake.joined();
  live.at("Timeline");
  expect(fake.channel.track).toHaveBeenLastCalledWith({ email: alex.email, where: "Timeline" });

  usePresence.setState({ others: [{ email: "sam@example.com", where: null }] });
  live.stop();
  expect(fake.client.removeChannel).toHaveBeenCalledWith(fake.channel);
  expect(usePresence.getState().others).toEqual([]);
});

test("stopped before it joined, it never opens the channel", async () => {
  const fake = fakeClient();
  followWedding(fake.client, "w1", alex, { onMoved: vi.fn(), onJoined: vi.fn() }).stop();
  await settle();
  expect(fake.client.channel).not.toHaveBeenCalled();
});

test("a page is named as the header names it", () => {
  expect(pageName("/seating")).toBe("Seating");
  expect(pageName("/")).toBe("Overview");
  expect(pageName("/account")).toBeNull();
  expect(othersIn({}, "alex@example.com")).toEqual([]);
});
