import { create } from "zustand";
import type { Knotwork } from "@jfrusher/knotwork";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { coverage, warningsByJob, type Warning } from "../core/jobs/coverage";
import { newId } from "../core/model/ids";
import type { BrigadeDoc, Job, Person, Team } from "../core/model/types";
import { crewSlice, readSlice } from "./sliceBridge";

interface Cover {
  warnings: Warning[];
  byJob: Map<string, Warning[]>;
}

let view: { doc: Knotwork; brigade: BrigadeDoc } | null = null;

/**
 * The crew and the day as Brigade reads them, from the one wedding.
 *
 * Memoised on the wedding's identity: every edit anywhere replaces it, so a
 * stale view is impossible, and React sees the same object until something
 * changed.
 */
export function brigadeDoc(doc: Knotwork): BrigadeDoc {
  if (view?.doc === doc) return view.brigade;
  view = { doc, brigade: readSlice(doc) };
  return view.brigade;
}

let cache: { doc: BrigadeDoc; cover: Cover } | null = null;

/**
 * The single derived view of a document, memoised on document identity. Every
 * edit replaces the document, so a stale cache is impossible, and the screen
 * and the printed sheets cannot disagree because both read this.
 */
function coverFor(doc: BrigadeDoc): Cover {
  if (cache && cache.doc === doc) return cache.cover;
  const warnings = coverage(doc);
  const cover: Cover = { warnings, byJob: warningsByJob(warnings) };
  cache = { doc, cover };
  return cover;
}

/** What Delegation shows: the wedding as it is now, wherever it was last changed. */
export const useBrigadeDoc = (): BrigadeDoc => useKnotworkStore((state) => brigadeDoc(state.doc));
export const useCover = (): Cover => useKnotworkStore((state) => coverFor(brigadeDoc(state.doc)));

/** Which jobs the board shows. */
interface Filter {
  personId: string | null;
  teamId: string | null;
  unassignedOnly: boolean;
}

/**
 * What is Delegation's own: which job is picked, the filter, a notice. The
 * crew itself is the wedding's — every edit below goes straight into it, on
 * the one history the header's undo drives.
 */
interface StoreState {
  selectedJobId: string | null;
  filter: Filter;
  notice: string | null;

  addTeam: (seed?: Partial<Team>) => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;

  addPerson: (seed?: Partial<Person>) => string;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;

  addJob: (blockId: string, seed?: Partial<Job>) => string;
  updateJob: (id: string, patch: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  toggleAssignment: (jobId: string, personId: string) => void;

  select: (id: string | null) => void;
  setFilter: (patch: Partial<Filter>) => void;
  setNotice: (notice: string | null) => void;
}

export const useStore = create<StoreState>((set, get) => {
  /** Shown as "Undo <label>"; edits with one label close together are one step. */
  const edit = (label: string, change: (doc: BrigadeDoc) => BrigadeDoc) => {
    const shared = useKnotworkStore.getState();
    shared.setSlice("crew", crewSlice(change(brigadeDoc(shared.doc))), { label });
  };

  return {
    selectedJobId: null,
    filter: { personId: null, teamId: null, unassignedOnly: false },
    notice: null,

    addTeam: (seed = {}) => {
      const id = seed.id ?? newId("team");
      edit("a new team", (doc) => ({
        ...doc,
        teams: [
          ...doc.teams,
          {
            id,
            tag: null,
            name: "New team",
            phone: "",
            notes: "",
            email: "",
            cost: null,
            deposit: null,
            depositPaidOn: "",
            balanceDueOn: "",
            balancePaidOn: "",
            confirmedOn: "",
            ...seed,
          },
        ],
      }));
      return id;
    },

    updateTeam: (id, patch) =>
      edit("a team's details", (doc) => ({
        ...doc,
        teams: doc.teams.map((team) => (team.id === id ? { ...team, ...patch } : team)),
      })),


    // People keep their jobs when their team goes: the work did not stop
    // existing because the supplier's row did.
    deleteTeam: (id) =>
      edit("removing a team", (doc) => ({
        ...doc,
        teams: doc.teams.filter((team) => team.id !== id),
        people: doc.people.map((person) =>
          person.teamId === id ? { ...person, teamId: null } : person,
        ),
        jobs: doc.jobs.map((job) => (job.teamId === id ? { ...job, teamId: null } : job)),
      })),

    addPerson: (seed = {}) => {
      const id = seed.id ?? newId("per");
      edit("a new person", (doc) => ({
        ...doc,
        people: [
          ...doc.people,
          { id, name: "New person", teamId: null, phone: "", notes: "", guestId: null, ...seed },
        ],
      }));
      return id;
    },

    updatePerson: (id, patch) =>
      edit("someone's details", (doc) => ({
        ...doc,
        people: doc.people.map((person) => (person.id === id ? { ...person, ...patch } : person)),
      })),

    deletePerson: (id) =>
      edit("removing someone", (doc) => ({
        ...doc,
        people: doc.people.filter((person) => person.id !== id),
        jobs: doc.jobs.map((job) =>
          job.personIds.includes(id)
            ? { ...job, personIds: job.personIds.filter((personId) => personId !== id) }
            : job,
        ),
      })),

    addJob: (blockId, seed = {}) => {
      const id = seed.id ?? newId("job");
      edit("a new job", (doc) => ({
        ...doc,
        jobs: [
          ...doc.jobs,
          { id, blockId, label: "New job", notes: "", teamId: null, personIds: [], ...seed },
        ],
      }));
      set({ selectedJobId: id });
      return id;
    },

    updateJob: (id, patch) =>
      edit("a job's details", (doc) => ({
        ...doc,
        jobs: doc.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
      })),

    deleteJob: (id) => {
      edit("removing a job", (doc) => ({ ...doc, jobs: doc.jobs.filter((job) => job.id !== id) }));
      if (get().selectedJobId === id) set({ selectedJobId: null });
    },

    toggleAssignment: (jobId, personId) =>
      edit("who is on a job", (doc) => ({
        ...doc,
        jobs: doc.jobs.map((job) =>
          job.id === jobId
            ? {
                ...job,
                personIds: job.personIds.includes(personId)
                  ? job.personIds.filter((id) => id !== personId)
                  : [...job.personIds, personId],
              }
            : job,
        ),
      })),

    select: (id) => set({ selectedJobId: id }),
    setFilter: (patch) => set((state) => ({ filter: { ...state.filter, ...patch } })),
    setNotice: (notice) => set({ notice }),
  };
});
