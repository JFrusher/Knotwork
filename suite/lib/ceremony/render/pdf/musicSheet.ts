import type { FontSource } from "@/apps/brigade/render/pdf/fontSource";
import { songName, songPlaying, type MusicCue } from "../../music";
import { renderFlow, type FlowBlock } from "./flow";

export interface MusicSheetOptions {
  fontSource: FontSource;
  coupleNames: string;
  generatedOn?: string;
}

/** Every piece of music in the ceremony, in order, for whoever is playing it: when it starts, and from where to where. */
export async function renderMusicSheet(cues: MusicCue[], options: MusicSheetOptions): Promise<Uint8Array> {
  const blocks: FlowBlock[] = cues.map((cue, index) => ({
    lines: [
      { text: `${index + 1}. ${songName(cue.song)}`, bold: true },
      { text: cue.where },
      ...(cue.cue ? [{ text: `Cue: ${cue.cue}` }] : []),
      ...(songPlaying(cue.song) ? [{ text: songPlaying(cue.song), muted: true }] : []),
    ],
  }));
  return renderFlow(blocks.length > 0 ? blocks : [{ lines: [{ text: "No music chosen yet.", muted: true }] }], {
    fontSource: options.fontSource,
    size: "A4",
    title: options.coupleNames ? `The music — ${options.coupleNames}` : "The music",
    generatedOn: options.generatedOn,
  });
}
