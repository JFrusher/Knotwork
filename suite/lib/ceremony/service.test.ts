import { describe, expect, it } from "vitest";
import { emptyCeremony } from "@/lib/model/slices";
import { CEREMONY_KINDS, type Ceremony } from "@/lib/model/types";
import { blankSong, newGroup } from "./actions";
import { ceremonyChecks, ceremonyPlace, lengthOf, musicShort, overrun, startTimes } from "./checks";
import { newMoment } from "./moments";
import { formatSec, musicCues, parseTime, songPlaying } from "./music";
import { suggestService } from "./service";

describe("a suggested order of service", () => {
  it("opens with music and the processional for every kind of ceremony, and is timed", () => {
    for (const kind of CEREMONY_KINDS) {
      const order = suggestService(kind);
      expect(order.slice(0, 2).map((moment) => moment.kind), kind).toEqual(["music", "processional"]);
      expect(lengthOf(order), kind).toBeGreaterThan(10);
    }
  });

  it("follows the registrar's legal words in a civil ceremony, and signs the register", () => {
    const titles = suggestService("civil").map((moment) => moment.title);
    expect(titles.indexOf("The declaratory words")).toBeLessThan(titles.indexOf("The contracting words"));
    expect(titles).toContain("Signing the register");
  });

  it("has no register at a humanist ceremony, where the legal part is done separately", () => {
    expect(suggestService("humanist").map((moment) => moment.kind)).not.toContain("signing");
  });
});

describe("the ceremony's times", () => {
  it("counts music as guests arrive as before the start, and every timed moment from the block's start", () => {
    const order = [newMoment("music"), newMoment("processional"), newMoment("welcome"), newMoment("vows")];
    expect(startTimes(order, 840)).toEqual([null, 840, 843, 846]);
    expect(lengthOf(order)).toBe(9);
  });

  it("is lost when its block has gone, and says by how much the order runs over", () => {
    const place = { label: "Ceremony", location: "Orangery", startMin: 840, endMin: 845 };
    const ceremony: Ceremony = { ...emptyCeremony(), blockId: "blk-ceremony", order: [newMoment("welcome"), newMoment("vows")] };
    expect(ceremonyPlace(ceremony, new Map([["blk-ceremony", place]]))).toEqual({ place, lost: false });
    expect(ceremonyPlace(ceremony, new Map())).toEqual({ place: null, lost: true });
    expect(overrun(ceremony, place)).toBe(1);
  });
});

describe("the ceremony's own checks", () => {
  it("asks a civil ceremony for its registrar's approval of readings and music, and two witnesses", () => {
    const ceremony: Ceremony = {
      ...emptyCeremony(),
      kind: "civil",
      witnesses: [{ kind: "text", ref: "Jo" }],
      order: [newMoment("reading"), newMoment("signing", { song: blankSong(), approved: true }), newMoment("vows")],
    };
    expect(ceremonyChecks(ceremony)).toEqual({ unapproved: 1, witnessesShort: 1, processionalMissing: false });
    // A humanist ceremony has no registrar and no register.
    expect(ceremonyChecks({ ...ceremony, kind: "humanist" })).toEqual({ unapproved: 0, witnessesShort: 0, processionalMissing: false });
  });

  it("asks for the processional's music to be approved too, which is its groups'", () => {
    const walking: Ceremony = { ...emptyCeremony(), order: [newMoment("processional")], processional: [newGroup({ song: blankSong({ title: "Canon in D" }) })] };
    expect(ceremonyChecks(walking).unapproved).toBe(1);
    expect(ceremonyChecks({ ...walking, processional: [newGroup()] }).unapproved).toBe(0);
  });

  it("says when people are walking but the processional is not in the order", () => {
    expect(ceremonyChecks({ ...emptyCeremony(), processional: [newGroup()] }).processionalMissing).toBe(true);
  });
});

describe("the music", () => {
  it("reads a time in the track as typed, and refuses one it cannot", () => {
    expect(parseTime("0:45")).toBe(45);
    expect(parseTime("2:05")).toBe(125);
    expect(parseTime("45")).toBe(45);
    expect(parseTime("")).toBeNull();
    expect(parseTime("1:75")).toBeUndefined();
    expect(parseTime("soon")).toBeUndefined();
    expect(formatSec(125)).toBe("2:05");
  });

  it("says how a piece is played, from where to where", () => {
    expect(songPlaying(blankSong({ playedBy: "String quartet", startSec: 45, endSec: 150 }))).toBe("String quartet, from 0:45 to 2:30");
    expect(songPlaying(blankSong({ endSec: 90 }))).toBe("fade at 1:30");
  });

  it("lists every piece in the order it plays, with the processional's where the processional is", () => {
    const canon = blankSong({ title: "Canon in D" });
    const couple = blankSong({ title: "The Water Is Wide" });
    const ceremony: Ceremony = {
      ...emptyCeremony(),
      order: [newMoment("processional", { song: canon }), newMoment("signing", { song: blankSong({ title: "Air" }) })],
      processional: [newGroup({ id: "g1" }), newGroup({ id: "g2", song: couple, cue: "at the second verse" })],
    };
    expect(musicCues(ceremony, (id) => (id === "g2" ? "Alex and Sam" : "?")).map((cue) => [cue.where, cue.song.title, cue.cue])).toEqual([
      ["The processional", "Canon in D", ""],
      ["The processional — Alex and Sam", "The Water Is Wide", "at the second verse"],
      ["Signing the register", "Air", ""],
    ]);
  });
});

describe("music shorter than its part", () => {
  it("says how long the silence is where the music fades before the part ends", () => {
    const signing = newMoment("signing", { song: blankSong({ title: "Clair de Lune", startSec: 0, endSec: 300 }) });
    expect(musicShort([signing])).toEqual([{ moment: signing, silentSec: 300 }]);
  });

  it("is quiet where the music lasts, plays to its end, or the part has no length", () => {
    const lasts = newMoment("signing", { song: blankSong({ startSec: 0, endSec: 600 }) });
    const toTheEnd = newMoment("signing", { song: blankSong({ startSec: 30 }) });
    const untimed = newMoment("music", { song: blankSong({ endSec: 60 }) });
    expect(musicShort([lasts, toTheEnd, untimed])).toEqual([]);
  });
});

describe("a Church of England service", () => {
  it("follows Common Worship, says where to stand, and sets the declarations and vows as responses", () => {
    const order = suggestService("religious");
    const titles = order.map((moment) => moment.title);
    expect(titles.indexOf("The declarations")).toBeLessThan(titles.indexOf("The vows"));
    expect(titles.indexOf("The proclamation")).toBeLessThan(titles.indexOf("The blessing of the marriage"));
    expect(order.filter((moment) => moment.guestNote === "Please stand").length).toBeGreaterThanOrEqual(3);
    expect(order.find((moment) => moment.kind === "vows")!.layout).toBe("responses");
    expect(order.every((moment) => moment.words === "")).toBe(true);
  });
});
